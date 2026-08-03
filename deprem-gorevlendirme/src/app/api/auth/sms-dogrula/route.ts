import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { oturumOlustur, SESSION_COOKIE } from '@/lib/auth';
import { logla } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// Telefonla giriş 2. adım: kodu doğrula, oturum aç
export async function POST(req: NextRequest) {
  const { telefon, kod } = await req.json();
  const tel = String(telefon || '').replace(/\D/g, '');
  const db = getDb();

  const kayit = db
    .prepare(
      "SELECT id FROM sms_codes WHERE telefon = ? AND kod = ? AND used = 0 AND expires_at > datetime('now') ORDER BY id DESC LIMIT 1"
    )
    .get(tel, String(kod || '').trim()) as { id: number } | undefined;
  if (!kayit) {
    return NextResponse.json({ hata: 'Kod hatalı veya süresi dolmuş.' }, { status: 401 });
  }
  db.prepare('UPDATE sms_codes SET used = 1 WHERE id = ?').run(kayit.id);

  const user = db
    .prepare("SELECT id, ad, soyad, rol, ilce FROM users WHERE replace(replace(telefon,' ',''),'-','') LIKE ? AND aktif = 1")
    .get(`%${tel.slice(-10)}`) as
    | { id: number; ad: string; soyad: string; rol: 'PERSONEL' | 'IL_YONETICI' | 'ILCE_YONETICI'; ilce: string | null }
    | undefined;
  if (!user) {
    return NextResponse.json({ hata: 'Kullanıcı bulunamadı.' }, { status: 404 });
  }

  const token = await oturumOlustur({ uid: user.id, rol: user.rol, ilce: user.ilce, adSoyad: `${user.ad} ${user.soyad}` });
  logla(user.id, 'GIRIS', 'SMS kodu ile giriş yapıldı');
  const yoneticiMi = user.rol === 'IL_YONETICI' || user.rol === 'ILCE_YONETICI';
  const res = NextResponse.json({ tamam: true, yonlendir: yoneticiMi ? '/yonetim' : '/panel' });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && process.env.HTTP_ONLY !== '1',
    maxAge: 60 * 60 * 12,
    path: '/',
  });
  return res;
}
