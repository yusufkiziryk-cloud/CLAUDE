import { NextRequest, NextResponse } from 'next/server';
import { getDb, ayAdi } from '@/lib/db';
import { yoneticiOturum, ilceKisiti } from '@/lib/auth';
import { uygunHavuz, otomatikSec, AdayPersonel } from '@/lib/assignment';
import { logla } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// Otomatik görevlendirme: uygun havuzdan seçim yapar, TASLAK olarak kaydeder.
export async function POST(req: NextRequest) {
  const o = await yoneticiOturum();
  if (!o) return NextResponse.json({ hata: 'Yetkisiz.' }, { status: 403 });
  const b = await req.json();
  const simdi = new Date();
  const yil = Number(b.yil) || simdi.getFullYear();
  const ay = Number(b.ay) || simdi.getMonth() + 1;
  const p = {
    yil, ay,
    asilHekim: Math.max(0, Number(b.asilHekim) || 0),
    asilAsc: Math.max(0, Number(b.asilAsc) || 0),
    yedekHekim: Math.max(0, Number(b.yedekHekim) || 0),
    yedekAsc: Math.max(0, Number(b.yedekAsc) || 0),
    ilceler: Array.isArray(b.ilceler) ? b.ilceler.filter((i: unknown) => typeof i === 'string') : [],
    asmLimit: Math.max(1, Number(b.asmLimit) || 2),
  };
  if (p.asilHekim + p.asilAsc + p.yedekHekim + p.yedekAsc === 0) {
    return NextResponse.json({ hata: 'En az bir personel sayısı belirtmelisiniz.' }, { status: 400 });
  }

  const havuz = uygunHavuz(yil, ay, p.ilceler, ilceKisiti(o));
  if (havuz.length === 0) {
    return NextResponse.json({ hata: 'Seçilen dönem ve ilçelerde "Görevlendirmeye Uygun" personel bulunamadı.' }, { status: 400 });
  }
  const sonuc = otomatikSec(havuz, p);

  const db = getDb();
  const baslik = `${ayAdi(ay)} ${yil} Deprem Görevlendirmesi`;
  const gorev = db
    .prepare("INSERT INTO assignments (yil, ay, baslik, durum, created_by) VALUES (?, ?, ?, 'TASLAK', ?)")
    .run(yil, ay, baslik, o.uid);
  const gorevId = Number(gorev.lastInsertRowid);

  const ekle = db.prepare(
    'INSERT INTO assignment_members (assignment_id, user_id, tip, unvan, manuel, sira) VALUES (?, ?, ?, ?, 0, ?)'
  );
  const grubuEkle = (liste: AdayPersonel[], tip: 'ASIL' | 'YEDEK') => {
    liste.forEach((a, i) => ekle.run(gorevId, a.id, tip, a.unvan, i + 1));
  };
  const islem = db.transaction(() => {
    grubuEkle(sonuc.asilHekim, 'ASIL');
    grubuEkle(sonuc.asilAsc, 'ASIL');
    grubuEkle(sonuc.yedekHekim, 'YEDEK');
    grubuEkle(sonuc.yedekAsc, 'YEDEK');
  });
  islem();

  logla(o.uid, 'OTOMATIK_GOREVLENDIRME', `${baslik} (taslak #${gorevId}) — asıl AH:${sonuc.asilHekim.length}, asıl ASÇ:${sonuc.asilAsc.length}, yedek AH:${sonuc.yedekHekim.length}, yedek ASÇ:${sonuc.yedekAsc.length}`);
  return NextResponse.json({ tamam: true, gorevId, uyarilar: sonuc.uyarilar });
}
