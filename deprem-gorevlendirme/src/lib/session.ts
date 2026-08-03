// Oturum (JWT) yardımcıları — Edge Runtime uyumlu (middleware'de de kullanılır,
// bu yüzden veritabanı/fs bağımlılığı İÇERMEMELİDİR).
import { SignJWT, jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'gelistirme-ortami-varsayilan-anahtar-degistirin'
);

export const SESSION_COOKIE = 'oturum';

export interface Oturum {
  uid: number;
  rol: 'PERSONEL' | 'IL_YONETICI' | 'ILCE_YONETICI';
  ilce: string | null;
  adSoyad: string;
}

export async function oturumOlustur(o: Oturum): Promise<string> {
  return await new SignJWT({ ...o })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(SECRET);
}

export async function oturumCoz(token: string): Promise<Oturum | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return {
      uid: payload.uid as number,
      rol: payload.rol as Oturum['rol'],
      ilce: (payload.ilce as string) ?? null,
      adSoyad: (payload.adSoyad as string) ?? '',
    };
  } catch {
    return null;
  }
}
