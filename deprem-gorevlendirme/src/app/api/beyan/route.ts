import { NextRequest, NextResponse } from 'next/server';
import { getDb, getBeyanPenceresi, ayAdi } from '@/lib/db';
import { aktifOturum } from '@/lib/auth';
import { hesaplaUygunluk } from '@/lib/eligibility';
import { logla, bildirimEkle } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// GET: bu ayın beyanı + önceki ayın beyanı (form ön doldurma için)
export async function GET() {
  const o = await aktifOturum();
  if (!o) return NextResponse.json({ hata: 'Oturum bulunamadı.' }, { status: 401 });
  const db = getDb();
  const simdi = new Date();
  const yil = simdi.getFullYear();
  const ay = simdi.getMonth() + 1;
  const oncekiAy = ay === 1 ? 12 : ay - 1;
  const oncekiYil = ay === 1 ? yil - 1 : yil;

  const buAy = db.prepare('SELECT * FROM declarations WHERE user_id = ? AND yil = ? AND ay = ?').get(o.uid, yil, ay);
  const onceki = db
    .prepare('SELECT * FROM declarations WHERE user_id = ? AND yil = ? AND ay = ?')
    .get(o.uid, oncekiYil, oncekiAy);
  // Önceki ay yoksa en son beyanı getir (uzun aradan sonra dönenler için)
  const sonKayit =
    onceki ||
    db.prepare('SELECT * FROM declarations WHERE user_id = ? ORDER BY yil DESC, ay DESC LIMIT 1').get(o.uid);

  return NextResponse.json({
    donem: { yil, ay, ayAdi: ayAdi(ay) },
    buAy: buAy || null,
    onceki: sonKayit || null,
  });
}

const CEVAP = (v: unknown, izinli: string[] = ['EVET', 'HAYIR']) => {
  const s = String(v || '').toUpperCase();
  return izinli.includes(s) ? s : null;
};

// POST: beyan kaydet ("değişiklik yok" hızlı onayı veya güncellenmiş form)
export async function POST(req: NextRequest) {
  const o = await aktifOturum();
  if (!o) return NextResponse.json({ hata: 'Oturum bulunamadı.' }, { status: 401 });
  const govde = await req.json();

  const simdi = new Date();
  const yil = simdi.getFullYear();
  const ay = simdi.getMonth() + 1;

  const pencere = getBeyanPenceresi(yil, ay);
  const gun = simdi.getDate();
  if (gun < pencere.baslangicGun || gun > pencere.bitisGun) {
    return NextResponse.json(
      { hata: `Beyan dönemi bu ay için ${pencere.baslangicGun}-${pencere.bitisGun}. günler arasındadır.` },
      { status: 400 }
    );
  }

  if (!govde.onay) {
    return NextResponse.json({ hata: 'Bilgilerin doğruluğunu onaylamanız gerekmektedir.' }, { status: 400 });
  }

  const db = getDb();
  let cevaplar: Record<string, string>;
  let degisiklikYok = 0;

  if (govde.degisiklikYok) {
    // "Durumumda değişiklik yok": önceki beyan aynen bu aya kopyalanır
    const onceki = db
      .prepare('SELECT * FROM declarations WHERE user_id = ? AND NOT (yil = ? AND ay = ?) ORDER BY yil DESC, ay DESC LIMIT 1')
      .get(o.uid, yil, ay) as Record<string, string> | undefined;
    if (!onceki) {
      return NextResponse.json(
        { hata: 'Önceki döneme ait beyan bulunamadı. Lütfen formu doldurarak beyan verin.' },
        { status: 400 }
      );
    }
    cevaplar = {
      gebelik: onceki.gebelik, cocuk: onceki.cocuk, kronik: onceki.kronik, engel: onceki.engel,
      bakim: onceki.bakim, izin: onceki.izin, diger: onceki.diger, aciklama: onceki.aciklama || '',
    };
    degisiklikYok = 1;
  } else {
    const gebelik = CEVAP(govde.gebelik, ['EVET', 'HAYIR', 'UYGULANAMAZ']);
    const cocuk = CEVAP(govde.cocuk);
    const kronik = CEVAP(govde.kronik);
    const engel = CEVAP(govde.engel);
    const bakim = CEVAP(govde.bakim);
    const izin = CEVAP(govde.izin);
    const diger = CEVAP(govde.diger);
    if (!gebelik || !cocuk || !kronik || !engel || !bakim || !izin || !diger) {
      return NextResponse.json({ hata: 'Lütfen tüm soruları cevaplayın.' }, { status: 400 });
    }
    const aciklama = String(govde.aciklama || '').slice(0, 300);
    cevaplar = { gebelik, cocuk, kronik, engel, bakim, izin, diger, aciklama };
  }

  const uygunluk = hesaplaUygunluk({
    gebelik: cevaplar.gebelik, cocuk: cevaplar.cocuk, kronik: cevaplar.kronik, engel: cevaplar.engel,
    bakim: cevaplar.bakim, izin: cevaplar.izin, diger: cevaplar.diger,
  });

  db.prepare(
    `INSERT INTO declarations (user_id, yil, ay, gebelik, cocuk, kronik, engel, bakim, izin, diger, aciklama, degisiklik_yok, uygunluk)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, yil, ay) DO UPDATE SET
       gebelik = excluded.gebelik, cocuk = excluded.cocuk, kronik = excluded.kronik, engel = excluded.engel,
       bakim = excluded.bakim, izin = excluded.izin, diger = excluded.diger, aciklama = excluded.aciklama,
       degisiklik_yok = excluded.degisiklik_yok, uygunluk = excluded.uygunluk, updated_at = datetime('now')`
  ).run(
    o.uid, yil, ay, cevaplar.gebelik, cevaplar.cocuk, cevaplar.kronik, cevaplar.engel,
    cevaplar.bakim, cevaplar.izin, cevaplar.diger, cevaplar.aciklama || null, degisiklikYok, uygunluk
  );

  logla(o.uid, 'BEYAN_KAYDEDILDI', `${ayAdi(ay)} ${yil} — ${degisiklikYok ? 'değişiklik yok' : 'form'} — sonuç: ${uygunluk}`);
  bildirimEkle(o.uid, `${ayAdi(ay)} ${yil} dönemi beyanınız kaydedildi.`, 'BASARI');

  return NextResponse.json({ tamam: true, uygunluk });
}
