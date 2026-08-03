import { cookies } from 'next/headers';
import { getDb } from './db';
import { oturumCoz, SESSION_COOKIE, type Oturum } from './session';

export { oturumOlustur, oturumCoz, SESSION_COOKIE } from './session';
export type { Oturum } from './session';

// API route handler'larında geçerli oturumu okur
export async function aktifOturum(): Promise<Oturum | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const oturum = await oturumCoz(token);
  if (!oturum) return null;
  // Kullanıcı silinmiş/pasif yapılmışsa oturumu geçersiz say
  const user = getDb().prepare('SELECT id, aktif FROM users WHERE id = ?').get(oturum.uid) as
    | { id: number; aktif: number }
    | undefined;
  if (!user || !user.aktif) return null;
  return oturum;
}

export async function yoneticiOturum(): Promise<Oturum | null> {
  const o = await aktifOturum();
  if (!o) return null;
  if (o.rol !== 'IL_YONETICI' && o.rol !== 'ILCE_YONETICI') return null;
  return o;
}

// İlçe yöneticisi yalnızca kendi ilçesini görebilir
export function ilceKisiti(o: Oturum): string | null {
  return o.rol === 'ILCE_YONETICI' ? o.ilce : null;
}
