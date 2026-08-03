import { getDb, maskTc, unvanAdi } from './db';
import { UYGUNLUK_ADLARI } from './eligibility';

export interface PersonelSatiri {
  id: number;
  tc: string | null;
  sicil: string | null;
  ad: string;
  soyad: string;
  unvan: string | null;
  ilce: string | null;
  asm: string | null;
  birim: string | null;
  telefon: string | null;
  email: string | null;
  aktif: number;
  beyanVerdi: boolean;
  uygunluk: string; // UYGUN | UYGUN_DEGIL | DEGERLENDIRME | IZINLI | BEYAN_YOK
  beyanTarihi: string | null;
  toplamGorev: number;
  sonGorevTarih: string | null;
}

export interface PersonelFiltre {
  yil: number;
  ay: number;
  ilce?: string | null;
  asm?: string | null;
  birim?: string | null;
  unvan?: string | null;
  uygunluk?: string | null; // BEYAN_YOK dahil
  beyan?: 'VERDI' | 'VERMEDI' | null;
  gorevGecmisi?: 'VAR' | 'YOK' | null;
  ilceKisit?: string | null; // ilçe yöneticisi kısıtı
  arama?: string | null;
}

// Ay bazlı personel listesi: beyan durumu, uygunluk ve görev istatistikleri ile
export function personelListesi(f: PersonelFiltre): PersonelSatiri[] {
  const db = getDb();
  let sql = `
    SELECT u.id, u.tc, u.sicil, u.ad, u.soyad, u.unvan, u.ilce, u.asm, u.birim,
           u.telefon, u.email, u.aktif,
           d.uygunluk AS d_uygunluk, d.updated_at AS beyanTarihi,
           (SELECT COUNT(*) FROM assignment_members m JOIN assignments a ON a.id = m.assignment_id
             WHERE m.user_id = u.id AND a.durum = 'ONAYLANDI') AS toplamGorev,
           (SELECT MAX(a.onay_at) FROM assignment_members m JOIN assignments a ON a.id = m.assignment_id
             WHERE m.user_id = u.id AND a.durum = 'ONAYLANDI') AS sonGorevTarih
    FROM users u
    LEFT JOIN declarations d ON d.user_id = u.id AND d.yil = ? AND d.ay = ?
    WHERE u.rol = 'PERSONEL' AND u.aktif = 1
  `;
  const params: unknown[] = [f.yil, f.ay];
  if (f.ilceKisit) { sql += ' AND u.ilce = ?'; params.push(f.ilceKisit); }
  if (f.ilce) { sql += ' AND u.ilce = ?'; params.push(f.ilce); }
  if (f.asm) { sql += ' AND u.asm = ?'; params.push(f.asm); }
  if (f.birim) { sql += ' AND u.birim = ?'; params.push(f.birim); }
  if (f.unvan) { sql += ' AND u.unvan = ?'; params.push(f.unvan); }
  if (f.arama) {
    sql += " AND (u.ad || ' ' || u.soyad LIKE ? OR u.sicil LIKE ? OR u.tc LIKE ?)";
    const q = `%${f.arama}%`;
    params.push(q, q, q);
  }
  sql += ' ORDER BY u.ilce, u.asm, u.soyad, u.ad';

  let rows = (db.prepare(sql).all(...params) as Record<string, unknown>[]).map((r) => {
    const beyanVerdi = r.d_uygunluk != null;
    return {
      id: r.id as number,
      tc: r.tc as string | null,
      sicil: r.sicil as string | null,
      ad: r.ad as string,
      soyad: r.soyad as string,
      unvan: r.unvan as string | null,
      ilce: r.ilce as string | null,
      asm: r.asm as string | null,
      birim: r.birim as string | null,
      telefon: r.telefon as string | null,
      email: r.email as string | null,
      aktif: r.aktif as number,
      beyanVerdi,
      uygunluk: beyanVerdi ? (r.d_uygunluk as string) : 'BEYAN_YOK',
      beyanTarihi: (r.beyanTarihi as string) || null,
      toplamGorev: r.toplamGorev as number,
      sonGorevTarih: (r.sonGorevTarih as string) || null,
    } satisfies PersonelSatiri;
  });

  if (f.uygunluk) rows = rows.filter((r) => r.uygunluk === f.uygunluk);
  if (f.beyan === 'VERDI') rows = rows.filter((r) => r.beyanVerdi);
  if (f.beyan === 'VERMEDI') rows = rows.filter((r) => !r.beyanVerdi);
  if (f.gorevGecmisi === 'VAR') rows = rows.filter((r) => r.toplamGorev > 0);
  if (f.gorevGecmisi === 'YOK') rows = rows.filter((r) => r.toplamGorev === 0);
  return rows;
}

export interface GorevlendirmeUyesi {
  id: number;
  userId: number;
  sira: number;
  ad: string;
  soyad: string;
  unvan: string;
  ilce: string | null;
  asm: string | null;
  birim: string | null;
  telefon: string | null;
  tip: 'ASIL' | 'YEDEK';
  manuel: number;
  toplamGorev: number;
  sonGorevTarih: string | null;
}

export interface GorevlendirmeDetay {
  id: number;
  yil: number;
  ay: number;
  baslik: string;
  durum: string;
  created_at: string;
  onay_at: string | null;
  uyeler: GorevlendirmeUyesi[];
}

export function gorevlendirmeDetay(id: number, ilceKisit: string | null): GorevlendirmeDetay | null {
  const db = getDb();
  const a = db.prepare('SELECT * FROM assignments WHERE id = ?').get(id) as GorevlendirmeDetay | undefined;
  if (!a) return null;
  let sql = `
    SELECT m.id, m.user_id AS userId, m.sira, m.tip, m.manuel, m.unvan,
           u.ad, u.soyad, u.ilce, u.asm, u.birim, u.telefon,
           (SELECT COUNT(*) FROM assignment_members m2 JOIN assignments a2 ON a2.id = m2.assignment_id
             WHERE m2.user_id = u.id AND a2.durum = 'ONAYLANDI' AND a2.id != m.assignment_id) AS toplamGorev,
           (SELECT MAX(a2.onay_at) FROM assignment_members m2 JOIN assignments a2 ON a2.id = m2.assignment_id
             WHERE m2.user_id = u.id AND a2.durum = 'ONAYLANDI' AND a2.id != m.assignment_id) AS sonGorevTarih
    FROM assignment_members m JOIN users u ON u.id = m.user_id
    WHERE m.assignment_id = ?
  `;
  const params: unknown[] = [id];
  if (ilceKisit) { sql += ' AND u.ilce = ?'; params.push(ilceKisit); }
  sql += " ORDER BY m.tip = 'YEDEK', m.unvan, m.sira";
  const uyeler = db.prepare(sql).all(...params) as GorevlendirmeUyesi[];
  return { ...a, uyeler };
}

// Ortak sütun tanımları (dışa aktarmalarda sağlık bilgisi YER ALMAZ)
export function listeSatirlari(uyeler: GorevlendirmeUyesi[]) {
  return uyeler.map((u, i) => ({
    sira: i + 1,
    adSoyad: `${u.ad} ${u.soyad}`,
    unvan: unvanAdi(u.unvan),
    ilce: u.ilce || '',
    asm: u.asm || '',
    birim: u.birim || '',
    telefon: u.telefon || '',
    sonGorev: u.sonGorevTarih ? u.sonGorevTarih.slice(0, 10) : '-',
    toplamGorev: u.toplamGorev,
    durum: u.tip === 'ASIL' ? 'Asıl' : 'Yedek',
  }));
}

export function uygunlukAdi(kod: string): string {
  return UYGUNLUK_ADLARI[kod] || kod;
}

export function tcMaskele(tc: string | null): string {
  return maskTc(tc);
}
