import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/db';
import { logla } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// İlk giriş: kimlik (TC/sicil) + kayıtlı telefon doğrulaması ile şifre oluşturma
export async function POST(req: NextRequest) {
  const { kimlik, telefon, yeniSifre } = await req.json();
  if (!kimlik || !telefon || !yeniSifre) {
    return NextResponse.json({ hata: 'Tüm alanlar zorunludur.' }, { status: 400 });
  }
  if (String(yeniSifre).length < 6) {
    return NextResponse.json({ hata: 'Şifre en az 6 karakter olmalıdır.' }, { status: 400 });
  }
  const db = getDb();
  const user = db
    .prepare('SELECT id, telefon, aktif, password_hash FROM users WHERE tc = ? OR sicil = ?')
    .get(String(kimlik).trim(), String(kimlik).trim()) as
    | { id: number; telefon: string | null; aktif: number; password_hash: string | null }
    | undefined;

  if (!user || !user.aktif) {
    return NextResponse.json({ hata: 'Kullanıcı bulunamadı veya pasif durumda.' }, { status: 404 });
  }
  if (user.password_hash) {
    return NextResponse.json({ hata: 'Bu hesap için zaten şifre oluşturulmuş. Şifrenizi unuttuysanız yöneticinize başvurun.' }, { status: 400 });
  }
  const kayitliTel = (user.telefon || '').replace(/\D/g, '');
  const girilenTel = String(telefon).replace(/\D/g, '');
  if (!kayitliTel || kayitliTel.slice(-10) !== girilenTel.slice(-10)) {
    return NextResponse.json({ hata: 'Telefon numarası sistemdeki kayıtla eşleşmiyor.' }, { status: 400 });
  }

  const hash = await bcrypt.hash(String(yeniSifre), 10);
  db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(hash, user.id);
  logla(user.id, 'SIFRE_OLUSTURULDU', 'İlk giriş şifresi oluşturuldu');
  return NextResponse.json({ tamam: true });
}
