import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { logla } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// Telefonla giriş 1. adım: doğrulama kodu üret.
// Gerçek SMS entegrasyonu yerine kod sms_outbox tablosuna yazılır (altyapı hazır).
// DEMO_MODE=1 iken kod yanıt içinde döner ve ekranda gösterilir.
export async function POST(req: NextRequest) {
  const { telefon } = await req.json();
  const tel = String(telefon || '').replace(/\D/g, '');
  if (tel.length < 10) {
    return NextResponse.json({ hata: 'Geçerli bir telefon numarası girin.' }, { status: 400 });
  }
  const db = getDb();
  const user = db
    .prepare("SELECT id FROM users WHERE replace(replace(telefon,' ',''),'-','') LIKE ? AND aktif = 1")
    .get(`%${tel.slice(-10)}`) as { id: number } | undefined;
  if (!user) {
    return NextResponse.json({ hata: 'Bu telefon numarasıyla kayıtlı aktif kullanıcı bulunamadı.' }, { status: 404 });
  }

  const kod = String(Math.floor(100000 + Math.random() * 900000));
  db.prepare("INSERT INTO sms_codes (telefon, kod, expires_at) VALUES (?, ?, datetime('now', '+5 minutes'))").run(tel, kod);
  db.prepare('INSERT INTO sms_outbox (telefon, mesaj) VALUES (?, ?)').run(
    tel,
    `Afet gorevlendirme sistemi giris kodunuz: ${kod}. Kod 5 dakika gecerlidir.`
  );
  logla(user.id, 'SMS_KOD_ISTENDI', `Telefon: ***${tel.slice(-4)}`);

  const demo = process.env.DEMO_MODE === '1';
  return NextResponse.json({ tamam: true, demoKod: demo ? kod : undefined });
}
