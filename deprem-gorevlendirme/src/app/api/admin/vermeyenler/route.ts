import { NextRequest, NextResponse } from 'next/server';
import { yoneticiOturum, ilceKisiti } from '@/lib/auth';
import { personelListesi } from '@/lib/reports';
import { getDb, getSetting, maskTc } from '@/lib/db';
import { logla } from '@/lib/audit';
import { VARSAYILAN_HATIRLATMA } from '@/lib/messages';

export const dynamic = 'force-dynamic';

// Beyan vermeyenler + SMS/e-posta listeleri + hatırlatma metni
export async function GET(req: NextRequest) {
  const o = await yoneticiOturum();
  if (!o) return NextResponse.json({ hata: 'Yetkisiz.' }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  const simdi = new Date();
  const yil = Number(sp.get('yil')) || simdi.getFullYear();
  const ay = Number(sp.get('ay')) || simdi.getMonth() + 1;

  const rows = personelListesi({ yil, ay, beyan: 'VERMEDI', ilceKisit: ilceKisiti(o) });
  const hatirlatma = getSetting('hatirlatma_metni') || VARSAYILAN_HATIRLATMA;

  return NextResponse.json({
    donem: { yil, ay },
    vermeyenler: rows.map((r) => ({ ...r, tc: maskTc(r.tc) })),
    telefonListesi: rows.map((r) => r.telefon).filter(Boolean),
    epostaListesi: rows.map((r) => r.email).filter(Boolean),
    hatirlatmaMetni: hatirlatma,
  });
}

// Toplu hatırlatma: SMS/e-posta kuyruklarına yazar (gerçek gönderim entegrasyonu için altyapı)
export async function POST(req: NextRequest) {
  const o = await yoneticiOturum();
  if (!o) return NextResponse.json({ hata: 'Yetkisiz.' }, { status: 403 });
  const b = await req.json();
  const simdi = new Date();
  const yil = Number(b.yil) || simdi.getFullYear();
  const ay = Number(b.ay) || simdi.getMonth() + 1;
  const mesaj = String(b.mesaj || getSetting('hatirlatma_metni') || VARSAYILAN_HATIRLATMA).slice(0, 500);

  const rows = personelListesi({ yil, ay, beyan: 'VERMEDI', ilceKisit: ilceKisiti(o) });
  const db = getDb();
  let sms = 0, eposta = 0, bildirim = 0;
  const smsEkle = db.prepare('INSERT INTO sms_outbox (telefon, mesaj) VALUES (?, ?)');
  const epostaEkle = db.prepare('INSERT INTO email_outbox (email, konu, mesaj) VALUES (?, ?, ?)');
  const bildirimEkleStmt = db.prepare("INSERT INTO notifications (user_id, mesaj, tip) VALUES (?, ?, 'UYARI')");
  const islem = db.transaction(() => {
    for (const r of rows) {
      if (r.telefon) { smsEkle.run(r.telefon, mesaj); sms++; }
      if (r.email) { epostaEkle.run(r.email, 'Aylık Durum Beyanı Hatırlatması', mesaj); eposta++; }
      bildirimEkleStmt.run(r.id, mesaj); bildirim++;
    }
  });
  islem();
  logla(o.uid, 'TOPLU_HATIRLATMA', `${yil}/${ay} — ${sms} SMS, ${eposta} e-posta kuyruğa alındı, ${bildirim} bildirim`);
  return NextResponse.json({ tamam: true, sms, eposta, bildirim });
}
