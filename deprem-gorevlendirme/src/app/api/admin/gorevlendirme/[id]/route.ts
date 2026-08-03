import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { yoneticiOturum, ilceKisiti } from '@/lib/auth';
import { gorevlendirmeDetay } from '@/lib/reports';
import { logla, bildirimEkle } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// Görevlendirme detayı (önizleme ekranı)
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const o = await yoneticiOturum();
  if (!o) return NextResponse.json({ hata: 'Yetkisiz.' }, { status: 403 });
  const detay = gorevlendirmeDetay(Number(params.id), ilceKisiti(o));
  if (!detay) return NextResponse.json({ hata: 'Görevlendirme bulunamadı.' }, { status: 404 });
  return NextResponse.json({ gorevlendirme: detay });
}

// Üye işlemleri: ekle / çıkar / asıl-yedek değiştir / onayla
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const o = await yoneticiOturum();
  if (!o) return NextResponse.json({ hata: 'Yetkisiz.' }, { status: 403 });
  const id = Number(params.id);
  const db = getDb();
  const gorev = db.prepare('SELECT * FROM assignments WHERE id = ?').get(id) as
    | { id: number; durum: string; baslik: string; yil: number; ay: number }
    | undefined;
  if (!gorev) return NextResponse.json({ hata: 'Görevlendirme bulunamadı.' }, { status: 404 });

  const b = await req.json();
  const islem = String(b.islem || '');

  if (islem === 'onayla') {
    if (gorev.durum === 'ONAYLANDI') return NextResponse.json({ hata: 'Liste zaten onaylanmış.' }, { status: 400 });
    db.prepare("UPDATE assignments SET durum = 'ONAYLANDI', onay_at = datetime('now') WHERE id = ?").run(id);
    // Seçilen personellere bildirim
    const uyeler = db
      .prepare('SELECT user_id, tip FROM assignment_members WHERE assignment_id = ?')
      .all(id) as { user_id: number; tip: string }[];
    for (const u of uyeler) {
      bildirimEkle(
        u.user_id,
        u.tip === 'ASIL'
          ? `${gorev.baslik}: ASIL personel olarak seçildiniz.`
          : `${gorev.baslik}: YEDEK personel olarak seçildiniz.`,
        'BILGI'
      );
    }
    logla(o.uid, 'GOREVLENDIRME_ONAYLANDI', `#${id} ${gorev.baslik} (${uyeler.length} kişi)`);
    return NextResponse.json({ tamam: true });
  }

  if (gorev.durum === 'ONAYLANDI') {
    return NextResponse.json({ hata: 'Onaylanmış liste üzerinde değişiklik yapılamaz.' }, { status: 400 });
  }

  if (islem === 'cikar') {
    const uye = db.prepare('SELECT m.*, u.ad, u.soyad FROM assignment_members m JOIN users u ON u.id=m.user_id WHERE m.assignment_id = ? AND m.user_id = ?').get(id, Number(b.userId)) as { ad: string; soyad: string } | undefined;
    db.prepare('DELETE FROM assignment_members WHERE assignment_id = ? AND user_id = ?').run(id, Number(b.userId));
    logla(o.uid, 'GOREVLENDIRME_UYE_CIKARILDI', `#${id} — ${uye ? uye.ad + ' ' + uye.soyad : b.userId} (manuel değişiklik)`);
    return NextResponse.json({ tamam: true });
  }

  if (islem === 'ekle') {
    const userId = Number(b.userId);
    const user = db.prepare("SELECT id, ad, soyad, unvan FROM users WHERE id = ? AND rol = 'PERSONEL' AND aktif = 1").get(userId) as
      | { id: number; ad: string; soyad: string; unvan: string }
      | undefined;
    if (!user) return NextResponse.json({ hata: 'Personel bulunamadı.' }, { status: 404 });
    const mevcut = db.prepare('SELECT id FROM assignment_members WHERE assignment_id = ? AND user_id = ?').get(id, userId);
    if (mevcut) return NextResponse.json({ hata: 'Bu personel zaten listede.' }, { status: 400 });
    const tip = b.tip === 'YEDEK' ? 'YEDEK' : 'ASIL';
    const maxSira = (db.prepare('SELECT MAX(sira) AS m FROM assignment_members WHERE assignment_id = ? AND tip = ?').get(id, tip) as { m: number | null }).m || 0;
    db.prepare('INSERT INTO assignment_members (assignment_id, user_id, tip, unvan, manuel, sira) VALUES (?, ?, ?, ?, 1, ?)').run(id, userId, tip, user.unvan, maxSira + 1);
    logla(o.uid, 'GOREVLENDIRME_UYE_EKLENDI', `#${id} — ${user.ad} ${user.soyad} (${tip}, manuel)`);
    return NextResponse.json({ tamam: true });
  }

  if (islem === 'tip-degistir') {
    const uye = db.prepare('SELECT m.*, u.ad, u.soyad FROM assignment_members m JOIN users u ON u.id=m.user_id WHERE m.assignment_id = ? AND m.user_id = ?').get(id, Number(b.userId)) as
      | { tip: string; ad: string; soyad: string }
      | undefined;
    if (!uye) return NextResponse.json({ hata: 'Personel listede bulunamadı.' }, { status: 404 });
    const yeniTip = uye.tip === 'ASIL' ? 'YEDEK' : 'ASIL';
    const maxSira = (db.prepare('SELECT MAX(sira) AS m FROM assignment_members WHERE assignment_id = ? AND tip = ?').get(id, yeniTip) as { m: number | null }).m || 0;
    db.prepare('UPDATE assignment_members SET tip = ?, manuel = 1, sira = ? WHERE assignment_id = ? AND user_id = ?').run(yeniTip, maxSira + 1, id, Number(b.userId));
    logla(o.uid, 'GOREVLENDIRME_TIP_DEGISTI', `#${id} — ${uye.ad} ${uye.soyad}: ${uye.tip} → ${yeniTip} (manuel)`);
    return NextResponse.json({ tamam: true });
  }

  return NextResponse.json({ hata: 'Geçersiz işlem.' }, { status: 400 });
}

// Taslak görevlendirmeyi sil
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const o = await yoneticiOturum();
  if (!o) return NextResponse.json({ hata: 'Yetkisiz.' }, { status: 403 });
  const id = Number(params.id);
  const db = getDb();
  const gorev = db.prepare('SELECT durum, baslik FROM assignments WHERE id = ?').get(id) as { durum: string; baslik: string } | undefined;
  if (!gorev) return NextResponse.json({ hata: 'Görevlendirme bulunamadı.' }, { status: 404 });
  if (gorev.durum === 'ONAYLANDI') return NextResponse.json({ hata: 'Onaylanmış görevlendirme silinemez.' }, { status: 400 });
  db.prepare('DELETE FROM assignments WHERE id = ?').run(id);
  logla(o.uid, 'GOREVLENDIRME_SILINDI', `#${id} ${gorev.baslik} (taslak)`);
  return NextResponse.json({ tamam: true });
}
