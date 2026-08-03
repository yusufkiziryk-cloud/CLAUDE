import { NextResponse } from 'next/server';
import { getDb, ayAdi } from '@/lib/db';
import { aktifOturum } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Personelin kendi geçmiş beyanları (yalnızca kendi kaydı)
export async function GET() {
  const o = await aktifOturum();
  if (!o) return NextResponse.json({ hata: 'Oturum bulunamadı.' }, { status: 401 });
  const rows = getDb()
    .prepare('SELECT * FROM declarations WHERE user_id = ? ORDER BY yil DESC, ay DESC')
    .all(o.uid) as Record<string, unknown>[];
  return NextResponse.json({
    beyanlar: rows.map((r) => ({ ...r, donem: `${ayAdi(r.ay as number)} ${r.yil}` })),
  });
}
