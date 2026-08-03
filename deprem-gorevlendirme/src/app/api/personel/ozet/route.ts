import { NextResponse } from 'next/server';
import { getDb, maskTc, unvanAdi, getBeyanPenceresi, ayAdi } from '@/lib/db';
import { aktifOturum } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Personel ana ekranı: kimlik kartı bilgileri + bu ayın beyan durumu + uyarılar
export async function GET() {
  const o = await aktifOturum();
  if (!o) return NextResponse.json({ hata: 'Oturum bulunamadı.' }, { status: 401 });
  const db = getDb();
  const u = db
    .prepare('SELECT id, tc, sicil, ad, soyad, unvan, ilce, asm, birim, telefon, email FROM users WHERE id = ?')
    .get(o.uid) as Record<string, string | number | null>;

  const simdi = new Date();
  const yil = simdi.getFullYear();
  const ay = simdi.getMonth() + 1;

  const buAy = db
    .prepare('SELECT * FROM declarations WHERE user_id = ? AND yil = ? AND ay = ?')
    .get(o.uid, yil, ay) as Record<string, unknown> | undefined;
  const sonBeyan = db
    .prepare('SELECT yil, ay, updated_at, uygunluk FROM declarations WHERE user_id = ? ORDER BY yil DESC, ay DESC LIMIT 1')
    .get(o.uid) as { yil: number; ay: number; updated_at: string; uygunluk: string } | undefined;

  const pencere = getBeyanPenceresi(yil, ay);
  const bugunGun = simdi.getDate();
  const pencereAcik = bugunGun >= pencere.baslangicGun && bugunGun <= pencere.bitisGun;
  const kalanGun = pencere.bitisGun - bugunGun;

  // Uyarı listesi
  const uyarilar: { mesaj: string; tip: string }[] = [];
  if (!buAy && pencereAcik) {
    uyarilar.push({ mesaj: `Bu ay (${ayAdi(ay)} ${yil}) henüz beyan vermediniz.`, tip: 'UYARI' });
    if (kalanGun <= 1) uyarilar.push({ mesaj: 'Beyan için son 1 gün!', tip: 'UYARI' });
    else if (kalanGun <= 3) uyarilar.push({ mesaj: `Beyan için son ${kalanGun} gün.`, tip: 'UYARI' });
  }

  const bildirimler = db
    .prepare('SELECT id, mesaj, tip, okundu, created_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 10')
    .all(o.uid);

  return NextResponse.json({
    kullanici: {
      adSoyad: `${u.ad} ${u.soyad}`,
      tcMaskeli: maskTc(u.tc as string),
      sicil: u.sicil,
      unvan: unvanAdi(u.unvan as string),
      ilce: u.ilce,
      asm: u.asm,
      birim: u.birim,
      telefon: u.telefon,
      email: u.email,
    },
    donem: { yil, ay, ayAdi: ayAdi(ay), pencere, pencereAcik, kalanGun },
    buAyBeyanVerildi: !!buAy,
    buAyUygunluk: buAy ? (buAy.uygunluk as string) : null,
    sonBeyan: sonBeyan
      ? { donem: `${ayAdi(sonBeyan.ay)} ${sonBeyan.yil}`, tarih: sonBeyan.updated_at, uygunluk: sonBeyan.uygunluk }
      : null,
    uyarilar,
    bildirimler,
  });
}
