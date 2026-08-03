import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/db';
import { oturumOlustur, SESSION_COOKIE } from '@/lib/auth';
import { logla } from '@/lib/audit';

export const dynamic = 'force-dynamic';

interface KullaniciSatiri {
  id: number;
  ad: string;
  soyad: string;
  rol: 'PERSONEL' | 'IL_YONETICI' | 'ILCE_YONETICI';
  ilce: string | null;
  aktif: number;
  password_hash: string | null;
}

// T.C. kimlik no veya sicil no + şifre ile giriş
export async function POST(req: NextRequest) {
  const { kimlik, sifre } = await req.json();
  if (!kimlik || !sifre) {
    return NextResponse.json({ hata: 'Kimlik bilgisi ve şifre gereklidir.' }, { status: 400 });
  }
  const db = getDb();
  const user = db
    .prepare('SELECT id, ad, soyad, rol, ilce, aktif, password_hash FROM users WHERE tc = ? OR sicil = ?')
    .get(String(kimlik).trim(), String(kimlik).trim()) as KullaniciSatiri | undefined;

  if (!user || !user.aktif) {
    return NextResponse.json({ hata: 'Kullanıcı bulunamadı veya pasif durumda.' }, { status: 401 });
  }
  if (!user.password_hash) {
    return NextResponse.json(
      { hata: 'Henüz şifre oluşturmadınız. Lütfen "İlk Giriş / Şifre Oluştur" bölümünü kullanın.', ilkGiris: true },
      { status: 403 }
    );
  }
  const dogru = await bcrypt.compare(String(sifre), user.password_hash);
  if (!dogru) {
    logla(user.id, 'GIRIS_BASARISIZ', 'Hatalı şifre');
    return NextResponse.json({ hata: 'Şifre hatalı.' }, { status: 401 });
  }

  const token = await oturumOlustur({
    uid: user.id,
    rol: user.rol,
    ilce: user.ilce,
    adSoyad: `${user.ad} ${user.soyad}`,
  });
  logla(user.id, 'GIRIS', 'Şifre ile giriş yapıldı');

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
