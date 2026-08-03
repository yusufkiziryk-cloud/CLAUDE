import { NextResponse } from 'next/server';
import { yoneticiOturum } from '@/lib/auth';
import { personelSablonu } from '@/lib/export-excel';

export const dynamic = 'force-dynamic';

// Personel içe aktarma Excel şablonunu indir
export async function GET() {
  const o = await yoneticiOturum();
  if (!o) return NextResponse.json({ hata: 'Yetkisiz.' }, { status: 403 });
  const buf = await personelSablonu();
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="personel-sablonu.xlsx"',
    },
  });
}
