import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { yoneticiOturum, ilceKisiti } from '@/lib/auth';
import { personelListesi } from '@/lib/reports';

export const dynamic = 'force-dynamic';

// Yönetici kontrol paneli: özet kartlar + ilçe/ASM/birim seçenek listeleri
export async function GET(req: NextRequest) {
  const o = await yoneticiOturum();
  if (!o) return NextResponse.json({ hata: 'Yetkisiz.' }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  const simdi = new Date();
  const yil = Number(sp.get('yil')) || simdi.getFullYear();
  const ay = Number(sp.get('ay')) || simdi.getMonth() + 1;
  const kisit = ilceKisiti(o);

  const rows = personelListesi({ yil, ay, ilceKisit: kisit });

  const db = getDb();
  let gorevSql = `
    SELECT m.tip, COUNT(DISTINCT m.user_id) AS adet
    FROM assignment_members m
    JOIN assignments a ON a.id = m.assignment_id
    JOIN users u ON u.id = m.user_id
    WHERE a.yil = ? AND a.ay = ? AND a.durum = 'ONAYLANDI'`;
  const params: unknown[] = [yil, ay];
  if (kisit) { gorevSql += ' AND u.ilce = ?'; params.push(kisit); }
  gorevSql += ' GROUP BY m.tip';
  const gorevler = db.prepare(gorevSql).all(...params) as { tip: string; adet: number }[];

  const kartlar = {
    toplam: rows.length,
    beyanVeren: rows.filter((r) => r.beyanVerdi).length,
    beyanVermeyen: rows.filter((r) => !r.beyanVerdi).length,
    uygun: rows.filter((r) => r.uygunluk === 'UYGUN').length,
    uygunDegil: rows.filter((r) => r.uygunluk === 'UYGUN_DEGIL').length,
    degerlendirme: rows.filter((r) => r.uygunluk === 'DEGERLENDIRME').length,
    izinli: rows.filter((r) => r.uygunluk === 'IZINLI').length,
    gorevlendirilen: gorevler.find((g) => g.tip === 'ASIL')?.adet || 0,
    yedek: gorevler.find((g) => g.tip === 'YEDEK')?.adet || 0,
  };

  // Filtre seçenekleri
  let secenekSql = 'SELECT DISTINCT ilce, asm, birim FROM users WHERE rol = ? AND aktif = 1';
  const secenekParams: unknown[] = ['PERSONEL'];
  if (kisit) { secenekSql += ' AND ilce = ?'; secenekParams.push(kisit); }
  const secenekler = db.prepare(secenekSql).all(...secenekParams) as { ilce: string; asm: string; birim: string }[];
  const ilceler = [...new Set(secenekler.map((s) => s.ilce).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));
  const asmler = [...new Set(secenekler.map((s) => s.asm).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));
  const birimler = [...new Set(secenekler.map((s) => s.birim).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));

  return NextResponse.json({ donem: { yil, ay }, kartlar, ilceler, asmler, birimler });
}
