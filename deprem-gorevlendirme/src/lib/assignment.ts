import { getDb } from './db';

export interface AdayPersonel {
  id: number;
  ad: string;
  soyad: string;
  unvan: string; // AILE_HEKIMI | AILE_SAGLIGI_CALISANI
  ilce: string;
  asm: string;
  birim: string;
  telefon: string;
  toplamGorev: number;
  sonGorevTarih: string | null;
  oncekiAyGorevli: boolean;
}

export interface SecimParametreleri {
  yil: number;
  ay: number;
  asilHekim: number;
  asilAsc: number;
  yedekHekim: number;
  yedekAsc: number;
  ilceler: string[]; // boş = tüm ilçeler
  asmLimit: number;  // aynı ASM'den en fazla kaç kişi (asıl+yedek)
}

// Belirtilen ay için "Görevlendirmeye Uygun" personel havuzunu, görev geçmişi
// istatistikleriyle birlikte getirir.
export function uygunHavuz(yil: number, ay: number, ilceler: string[], ilceKisit: string | null): AdayPersonel[] {
  const db = getDb();
  const oncekiAy = ay === 1 ? 12 : ay - 1;
  const oncekiYil = ay === 1 ? yil - 1 : yil;

  let sql = `
    SELECT u.id, u.ad, u.soyad, u.unvan, u.ilce, u.asm, u.birim, u.telefon,
      (SELECT COUNT(*) FROM assignment_members m
         JOIN assignments a ON a.id = m.assignment_id
        WHERE m.user_id = u.id AND a.durum = 'ONAYLANDI') AS toplamGorev,
      (SELECT MAX(a.onay_at) FROM assignment_members m
         JOIN assignments a ON a.id = m.assignment_id
        WHERE m.user_id = u.id AND a.durum = 'ONAYLANDI') AS sonGorevTarih,
      EXISTS(SELECT 1 FROM assignment_members m
         JOIN assignments a ON a.id = m.assignment_id
        WHERE m.user_id = u.id AND a.durum = 'ONAYLANDI'
          AND a.yil = ? AND a.ay = ?) AS oncekiAyGorevli
    FROM users u
    JOIN declarations d ON d.user_id = u.id AND d.yil = ? AND d.ay = ?
    WHERE u.aktif = 1 AND u.rol = 'PERSONEL' AND d.uygunluk = 'UYGUN'
  `;
  const params: unknown[] = [oncekiYil, oncekiAy, yil, ay];
  if (ilceKisit) {
    sql += ' AND u.ilce = ?';
    params.push(ilceKisit);
  }
  if (ilceler.length > 0) {
    sql += ` AND u.ilce IN (${ilceler.map(() => '?').join(',')})`;
    params.push(...ilceler);
  }
  const rows = db.prepare(sql).all(...params) as (Omit<AdayPersonel, 'oncekiAyGorevli'> & { oncekiAyGorevli: number })[];
  return rows.map((r) => ({ ...r, oncekiAyGorevli: !!r.oncekiAyGorevli }));
}

export interface SecimSonucu {
  asilHekim: AdayPersonel[];
  asilAsc: AdayPersonel[];
  yedekHekim: AdayPersonel[];
  yedekAsc: AdayPersonel[];
  uyarilar: string[];
}

// Adayları öncelik sırasına dizer:
//  1) daha az görevlendirilmiş olan önce
//  2) son görevlendirme tarihi daha eski olan (hiç görevlendirilmemişse en önce)
//  3) eşitlikte kayıt id'sine göre kararlı sıralama
function oncelikSirala(adaylar: AdayPersonel[]): AdayPersonel[] {
  return [...adaylar].sort((a, b) => {
    if (a.toplamGorev !== b.toplamGorev) return a.toplamGorev - b.toplamGorev;
    const at = a.sonGorevTarih || '';
    const bt = b.sonGorevTarih || '';
    if (at !== bt) return at < bt ? -1 : 1;
    return a.id - b.id;
  });
}

// İlçe dengesi: sıralı aday listesinden, ilçeler arasında dönüşümlü (round-robin)
// seçim yaparak istenen sayıda kişiyi alır. ASM limiti ve tekrar seçimi de gözetir.
function dengeliSec(
  adaylar: AdayPersonel[],
  adet: number,
  secilmis: Set<number>,
  asmSayaci: Map<string, number>,
  asmLimit: number
): AdayPersonel[] {
  const siralanmis = oncelikSirala(adaylar).filter((a) => !secilmis.has(a.id));
  const ilceKuyruklari = new Map<string, AdayPersonel[]>();
  for (const a of siralanmis) {
    if (!ilceKuyruklari.has(a.ilce)) ilceKuyruklari.set(a.ilce, []);
    ilceKuyruklari.get(a.ilce)!.push(a);
  }
  const ilceler = [...ilceKuyruklari.keys()];
  const sonuc: AdayPersonel[] = [];
  let bosGecisSayisi = 0;
  let i = 0;
  while (sonuc.length < adet && bosGecisSayisi < ilceler.length && ilceler.length > 0) {
    const ilce = ilceler[i % ilceler.length];
    const kuyruk = ilceKuyruklari.get(ilce)!;
    let alindi = false;
    while (kuyruk.length > 0) {
      const aday = kuyruk.shift()!;
      const asmKey = `${aday.ilce}|${aday.asm}`;
      if ((asmSayaci.get(asmKey) || 0) >= asmLimit) continue;
      sonuc.push(aday);
      secilmis.add(aday.id);
      asmSayaci.set(asmKey, (asmSayaci.get(asmKey) || 0) + 1);
      alindi = true;
      break;
    }
    bosGecisSayisi = alindi ? 0 : bosGecisSayisi + 1;
    i++;
  }
  return sonuc;
}

// Otomatik seçim: önce önceki ay görevlendirilmemişler arasından, havuz yetmezse
// (uyarı vererek) önceki ay görevlendirilenler de dahil edilerek seçim yapılır.
export function otomatikSec(havuz: AdayPersonel[], p: SecimParametreleri): SecimSonucu {
  const uyarilar: string[] = [];
  const secilmis = new Set<number>();
  const asmSayaci = new Map<string, number>();

  const grupSec = (unvan: string, adet: number, etiket: string): AdayPersonel[] => {
    if (adet <= 0) return [];
    const grup = havuz.filter((a) => a.unvan === unvan);
    const oncelikli = grup.filter((a) => !a.oncekiAyGorevli);
    let secim = dengeliSec(oncelikli, adet, secilmis, asmSayaci, p.asmLimit);
    if (secim.length < adet) {
      // Havuz yetmedi: arka arkaya görevlendirme kuralını gevşet
      const ek = dengeliSec(
        grup.filter((a) => a.oncekiAyGorevli),
        adet - secim.length,
        secilmis,
        asmSayaci,
        p.asmLimit
      );
      if (ek.length > 0) {
        uyarilar.push(`${etiket}: havuz yetersiz olduğu için önceki ay görevlendirilen ${ek.length} kişi de seçildi.`);
      }
      secim = secim.concat(ek);
    }
    if (secim.length < adet) {
      uyarilar.push(`${etiket}: istenen ${adet} kişiden yalnızca ${secim.length} kişi seçilebildi (uygun personel yetersiz).`);
    }
    return secim;
  };

  const asilHekim = grupSec('AILE_HEKIMI', p.asilHekim, 'Asıl aile hekimi');
  const asilAsc = grupSec('AILE_SAGLIGI_CALISANI', p.asilAsc, 'Asıl aile sağlığı çalışanı');
  const yedekHekim = grupSec('AILE_HEKIMI', p.yedekHekim, 'Yedek aile hekimi');
  const yedekAsc = grupSec('AILE_SAGLIGI_CALISANI', p.yedekAsc, 'Yedek aile sağlığı çalışanı');

  return { asilHekim, asilAsc, yedekHekim, yedekAsc, uyarilar };
}
