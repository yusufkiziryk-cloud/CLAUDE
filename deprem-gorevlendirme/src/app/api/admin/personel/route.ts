import { NextRequest, NextResponse } from 'next/server';
import { yoneticiOturum, ilceKisiti } from '@/lib/auth';
import { personelListesi } from '@/lib/reports';
import { maskTc, getDb } from '@/lib/db';
import { logla } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// Filtreli personel listesi (yönetici)
export async function GET(req: NextRequest) {
  const o = await yoneticiOturum();
  if (!o) return NextResponse.json({ hata: 'Yetkisiz.' }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  const simdi = new Date();
  const rows = personelListesi({
    yil: Number(sp.get('yil')) || simdi.getFullYear(),
    ay: Number(sp.get('ay')) || simdi.getMonth() + 1,
    ilce: sp.get('ilce'),
    asm: sp.get('asm'),
    birim: sp.get('birim'),
    unvan: sp.get('unvan'),
    uygunluk: sp.get('uygunluk'),
    beyan: (sp.get('beyan') as 'VERDI' | 'VERMEDI') || null,
    gorevGecmisi: (sp.get('gorev') as 'VAR' | 'YOK') || null,
    arama: sp.get('arama'),
    ilceKisit: ilceKisiti(o),
  });
  // Ekranda TC kısmi gösterilir
  return NextResponse.json({ personel: rows.map((r) => ({ ...r, tc: maskTc(r.tc) })) });
}

// Tek personel ekleme/güncelleme (yönetici)
export async function POST(req: NextRequest) {
  const o = await yoneticiOturum();
  if (!o) return NextResponse.json({ hata: 'Yetkisiz.' }, { status: 403 });
  if (o.rol !== 'IL_YONETICI') return NextResponse.json({ hata: 'Bu işlem için il yöneticisi yetkisi gereklidir.' }, { status: 403 });
  const b = await req.json();
  if ((!b.tc && !b.sicil) || !b.ad || !b.soyad || !b.unvan) {
    return NextResponse.json({ hata: 'T.C./sicil, ad, soyad ve unvan zorunludur.' }, { status: 400 });
  }
  const db = getDb();
  const mevcut = b.id
    ? (db.prepare('SELECT id FROM users WHERE id = ?').get(b.id) as { id: number } | undefined)
    : (db.prepare('SELECT id FROM users WHERE (tc IS NOT NULL AND tc = ?) OR (sicil IS NOT NULL AND sicil = ?)').get(b.tc || '', b.sicil || '') as { id: number } | undefined);

  if (mevcut) {
    db.prepare(
      `UPDATE users SET ad=?, soyad=?, unvan=?, ilce=?, asm=?, birim=?, telefon=?, email=?, aktif=?, updated_at=datetime('now') WHERE id=?`
    ).run(b.ad, b.soyad, b.unvan, b.ilce || null, b.asm || null, b.birim || null, b.telefon || null, b.email || null, b.aktif ? 1 : 0, mevcut.id);
    logla(o.uid, 'PERSONEL_GUNCELLENDI', `id=${mevcut.id} ${b.ad} ${b.soyad}`);
    return NextResponse.json({ tamam: true, guncellendi: true });
  }
  db.prepare(
    `INSERT INTO users (tc, sicil, ad, soyad, unvan, ilce, asm, birim, telefon, email, aktif, rol)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PERSONEL')`
  ).run(b.tc || null, b.sicil || null, b.ad, b.soyad, b.unvan, b.ilce || null, b.asm || null, b.birim || null, b.telefon || null, b.email || null, b.aktif === false ? 0 : 1);
  logla(o.uid, 'PERSONEL_EKLENDI', `${b.ad} ${b.soyad}`);
  return NextResponse.json({ tamam: true, eklendi: true });
}
