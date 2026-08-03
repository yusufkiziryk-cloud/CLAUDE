import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { yoneticiOturum } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Görevlendirme listelerini (taslak + onaylı) getirir
export async function GET(req: NextRequest) {
  const o = await yoneticiOturum();
  if (!o) return NextResponse.json({ hata: 'Yetkisiz.' }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  let sql = `
    SELECT a.*, (SELECT COUNT(*) FROM assignment_members m WHERE m.assignment_id = a.id AND m.tip='ASIL') AS asilSayisi,
           (SELECT COUNT(*) FROM assignment_members m WHERE m.assignment_id = a.id AND m.tip='YEDEK') AS yedekSayisi
    FROM assignments a WHERE 1=1`;
  const params: unknown[] = [];
  if (sp.get('yil')) { sql += ' AND a.yil = ?'; params.push(Number(sp.get('yil'))); }
  if (sp.get('ay')) { sql += ' AND a.ay = ?'; params.push(Number(sp.get('ay'))); }
  sql += ' ORDER BY a.id DESC';
  const rows = getDb().prepare(sql).all(...params);
  return NextResponse.json({ gorevlendirmeler: rows });
}
