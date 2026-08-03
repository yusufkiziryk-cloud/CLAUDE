import { NextRequest, NextResponse } from 'next/server';
import { yoneticiOturum } from '@/lib/auth';
import { personelExcelOku } from '@/lib/export-excel';
import { getDb } from '@/lib/db';
import { logla } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// Excel'den toplu personel aktarma: aynı kişi (TC veya sicil eşleşmesi) güncellenir,
// yeni kişi eklenir; mükerrer kayıt oluşturulmaz.
export async function POST(req: NextRequest) {
  const o = await yoneticiOturum();
  if (!o) return NextResponse.json({ hata: 'Yetkisiz.' }, { status: 403 });
  if (o.rol !== 'IL_YONETICI') return NextResponse.json({ hata: 'Bu işlem için il yöneticisi yetkisi gereklidir.' }, { status: 403 });

  const form = await req.formData();
  const dosya = form.get('dosya');
  if (!dosya || typeof dosya === 'string') {
    return NextResponse.json({ hata: 'Excel dosyası seçilmedi.' }, { status: 400 });
  }
  const buf = Buffer.from(await dosya.arrayBuffer());
  let kayitlar;
  try {
    kayitlar = await personelExcelOku(buf);
  } catch {
    return NextResponse.json({ hata: 'Dosya okunamadı. Lütfen geçerli bir .xlsx dosyası yükleyin.' }, { status: 400 });
  }
  if (kayitlar.length === 0) {
    return NextResponse.json({ hata: 'Dosyada aktarılacak kayıt bulunamadı.' }, { status: 400 });
  }

  const db = getDb();
  let eklenen = 0, guncellenen = 0;
  const hatalar: { satir: number; hata: string }[] = [];
  const bul = db.prepare('SELECT id FROM users WHERE (tc IS NOT NULL AND tc = ?) OR (sicil IS NOT NULL AND sicil = ?)');
  const guncelle = db.prepare(
    `UPDATE users SET tc = COALESCE(?, tc), sicil = COALESCE(?, sicil), ad=?, soyad=?, unvan=?, ilce=?, asm=?, birim=?,
     telefon=?, email=?, aktif=?, updated_at=datetime('now') WHERE id=?`
  );
  const ekle = db.prepare(
    `INSERT INTO users (tc, sicil, ad, soyad, unvan, ilce, asm, birim, telefon, email, aktif, rol)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PERSONEL')`
  );

  const islem = db.transaction(() => {
    for (const k of kayitlar) {
      if (k.hata) { hatalar.push({ satir: k.satirNo, hata: k.hata }); continue; }
      const mevcut = bul.get(k.tc || '', k.sicil || '') as { id: number } | undefined;
      if (mevcut) {
        guncelle.run(k.tc, k.sicil, k.ad, k.soyad, k.unvan, k.ilce, k.asm, k.birim, k.telefon, k.email, k.aktif ? 1 : 0, mevcut.id);
        guncellenen++;
      } else {
        ekle.run(k.tc, k.sicil, k.ad, k.soyad, k.unvan, k.ilce, k.asm, k.birim, k.telefon, k.email, k.aktif ? 1 : 0);
        eklenen++;
      }
    }
  });
  islem();

  logla(o.uid, 'PERSONEL_EXCEL_YUKLENDI', `${eklenen} eklendi, ${guncellenen} güncellendi, ${hatalar.length} hatalı satır`);
  return NextResponse.json({ tamam: true, eklenen, guncellenen, hatalar });
}
