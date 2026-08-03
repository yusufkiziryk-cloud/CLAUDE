import { NextResponse } from 'next/server';
import { getDb, ayAdi } from '@/lib/db';
import { aktifOturum } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Personelin kendi görevlendirme geçmişi (yalnızca onaylanmış listeler)
export async function GET() {
  const o = await aktifOturum();
  if (!o) return NextResponse.json({ hata: 'Oturum bulunamadı.' }, { status: 401 });
  const rows = getDb()
    .prepare(
      `SELECT a.yil, a.ay, a.baslik, a.onay_at, m.tip
       FROM assignment_members m JOIN assignments a ON a.id = m.assignment_id
       WHERE m.user_id = ? AND a.durum = 'ONAYLANDI'
       ORDER BY a.yil DESC, a.ay DESC`
    )
    .all(o.uid) as { yil: number; ay: number; baslik: string; onay_at: string; tip: string }[];
  return NextResponse.json({
    gorevler: rows.map((r) => ({
      donem: `${ayAdi(r.ay)} ${r.yil}`,
      baslik: r.baslik,
      onayTarihi: r.onay_at,
      tip: r.tip === 'ASIL' ? 'Asıl' : 'Yedek',
    })),
  });
}
