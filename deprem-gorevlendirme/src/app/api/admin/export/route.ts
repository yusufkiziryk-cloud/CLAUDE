import { NextRequest, NextResponse } from 'next/server';
import { yoneticiOturum, ilceKisiti } from '@/lib/auth';
import { personelListesi, gorevlendirmeDetay } from '@/lib/reports';
import { personelExcel, grupluPersonelExcel, gorevlendirmeExcel } from '@/lib/export-excel';
import { gorevlendirmeWord } from '@/lib/export-word';
import { gorevlendirmePdf, aylikDurumPdf, beyanTamamlamaPdf } from '@/lib/export-pdf';
import { logla } from '@/lib/audit';
import { ayAdi, getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function dosyaYaniti(buf: Buffer, ad: string, mime: string) {
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': mime,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(ad)}"`,
    },
  });
}

// Tüm Excel / Word / PDF çıktıları tek uçtan üretilir.
// format=excel|word|pdf, tur=çıktı türü, yil, ay, gorevId (görevlendirme çıktıları için)
export async function GET(req: NextRequest) {
  const o = await yoneticiOturum();
  if (!o) return NextResponse.json({ hata: 'Yetkisiz.' }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  const simdi = new Date();
  const yil = Number(sp.get('yil')) || simdi.getFullYear();
  const ay = Number(sp.get('ay')) || simdi.getMonth() + 1;
  const format = sp.get('format') || 'excel';
  const tur = sp.get('tur') || '';
  const gorevId = Number(sp.get('gorevId')) || 0;
  const kisit = ilceKisiti(o);
  const donemEk = `${ayAdi(ay)}-${yil}`.toLocaleLowerCase('tr');

  const liste = (ekstra: Partial<Parameters<typeof personelListesi>[0]> = {}) =>
    personelListesi({ yil, ay, ilceKisit: kisit, ...ekstra });

  const gorev = () => {
    if (!gorevId) return null;
    return gorevlendirmeDetay(gorevId, kisit);
  };

  try {
    let buf: Buffer | null = null;
    let ad = '';
    let mime = XLSX_MIME;

    if (format === 'excel') {
      switch (tur) {
        case 'tum-personel':
          buf = await personelExcel('Tüm Personel Listesi', liste(), yil, ay); ad = `tum-personel-${donemEk}.xlsx`; break;
        case 'beyan-verenler':
          buf = await personelExcel('Bu Ay Beyan Veren Personel', liste({ beyan: 'VERDI' }), yil, ay); ad = `beyan-verenler-${donemEk}.xlsx`; break;
        case 'beyan-vermeyenler':
          buf = await personelExcel('Beyan Vermeyen Personel', liste({ beyan: 'VERMEDI' }), yil, ay); ad = `beyan-vermeyenler-${donemEk}.xlsx`; break;
        case 'uygun':
          buf = await personelExcel('Görevlendirmeye Uygun Personel', liste({ uygunluk: 'UYGUN' }), yil, ay); ad = `uygun-personel-${donemEk}.xlsx`; break;
        case 'uygun-degil': {
          const rows = liste().filter((r) => r.uygunluk === 'UYGUN_DEGIL' || r.uygunluk === 'IZINLI');
          buf = await personelExcel('Görevlendirmeye Uygun Olmayan Personel', rows, yil, ay); ad = `uygun-olmayan-${donemEk}.xlsx`; break;
        }
        case 'ilce-bazli':
          buf = await grupluPersonelExcel('İlçe Bazlı Personel Listesi', liste(), 'ilce', yil, ay); ad = `ilce-bazli-${donemEk}.xlsx`; break;
        case 'asm-bazli':
          buf = await grupluPersonelExcel('ASM Bazlı Personel Listesi', liste(), 'asm', yil, ay); ad = `asm-bazli-${donemEk}.xlsx`; break;
        case 'asil-liste': {
          const g = gorev();
          if (!g) return NextResponse.json({ hata: 'Görevlendirme seçilmedi.' }, { status: 400 });
          buf = await gorevlendirmeExcel(g, 'ASIL'); ad = `asil-liste-${donemEk}.xlsx`; break;
        }
        case 'yedek-liste': {
          const g = gorev();
          if (!g) return NextResponse.json({ hata: 'Görevlendirme seçilmedi.' }, { status: 400 });
          buf = await gorevlendirmeExcel(g, 'YEDEK'); ad = `yedek-liste-${donemEk}.xlsx`; break;
        }
        default:
          return NextResponse.json({ hata: 'Geçersiz Excel çıktı türü.' }, { status: 400 });
      }
    } else if (format === 'word') {
      const g = gorev();
      if (!g) return NextResponse.json({ hata: 'Word çıktıları için görevlendirme seçmelisiniz.' }, { status: 400 });
      mime = DOCX_MIME;
      const wordTur = (['resmi', 'asil-yedek', 'ilce', 'teblig'] as const).find((t) => t === tur);
      if (!wordTur) return NextResponse.json({ hata: 'Geçersiz Word çıktı türü.' }, { status: 400 });
      buf = await gorevlendirmeWord(g, wordTur);
      ad = `gorevlendirme-${wordTur}-${donemEk}.docx`;
    } else if (format === 'pdf') {
      mime = 'application/pdf';
      if (tur === 'aylik-durum') {
        const rows = liste();
        const db = getDb();
        let gorevSql = `SELECT m.tip, COUNT(DISTINCT m.user_id) AS adet FROM assignment_members m
          JOIN assignments a ON a.id = m.assignment_id JOIN users u ON u.id = m.user_id
          WHERE a.yil = ? AND a.ay = ? AND a.durum = 'ONAYLANDI'`;
        const params: unknown[] = [yil, ay];
        if (kisit) { gorevSql += ' AND u.ilce = ?'; params.push(kisit); }
        gorevSql += ' GROUP BY m.tip';
        const gorevSayilari = db.prepare(gorevSql).all(...params) as { tip: string; adet: number }[];
        const ilceler = new Map<string, { toplam: number; veren: number; uygun: number }>();
        for (const r of rows) {
          const k = r.ilce || 'Belirtilmemiş';
          if (!ilceler.has(k)) ilceler.set(k, { toplam: 0, veren: 0, uygun: 0 });
          const s = ilceler.get(k)!;
          s.toplam++;
          if (r.beyanVerdi) s.veren++;
          if (r.uygunluk === 'UYGUN') s.uygun++;
        }
        buf = await aylikDurumPdf(
          {
            toplam: rows.length,
            beyanVeren: rows.filter((r) => r.beyanVerdi).length,
            beyanVermeyen: rows.filter((r) => !r.beyanVerdi).length,
            uygun: rows.filter((r) => r.uygunluk === 'UYGUN').length,
            uygunDegil: rows.filter((r) => r.uygunluk === 'UYGUN_DEGIL').length,
            degerlendirme: rows.filter((r) => r.uygunluk === 'DEGERLENDIRME').length,
            izinli: rows.filter((r) => r.uygunluk === 'IZINLI').length,
            gorevlendirilen: gorevSayilari.find((g) => g.tip === 'ASIL')?.adet || 0,
            yedek: gorevSayilari.find((g) => g.tip === 'YEDEK')?.adet || 0,
          },
          yil, ay,
          [...ilceler.entries()].map(([ilce, s]) => ({ ilce, ...s })).sort((a, b) => a.ilce.localeCompare(b.ilce, 'tr'))
        );
        ad = `aylik-durum-raporu-${donemEk}.pdf`;
      } else if (tur === 'beyan-tamamlama') {
        buf = await beyanTamamlamaPdf(liste(), yil, ay);
        ad = `beyan-tamamlama-raporu-${donemEk}.pdf`;
      } else if (tur === 'gorevlendirme' || tur === 'asil-yedek') {
        const g = gorev();
        if (!g) return NextResponse.json({ hata: 'Görevlendirme seçilmedi.' }, { status: 400 });
        buf = await gorevlendirmePdf(g, tur === 'gorevlendirme' ? 'hepsi' : 'asil-yedek');
        ad = `gorevlendirme-listesi-${donemEk}.pdf`;
      } else {
        return NextResponse.json({ hata: 'Geçersiz PDF çıktı türü.' }, { status: 400 });
      }
    } else {
      return NextResponse.json({ hata: 'Geçersiz format.' }, { status: 400 });
    }

    logla(o.uid, 'DISA_AKTARMA', `${format}/${tur} — ${ad}`);
    return dosyaYaniti(buf!, ad, mime);
  } catch (e) {
    console.error('Dışa aktarma hatası:', e);
    return NextResponse.json({ hata: 'Çıktı oluşturulurken bir hata oluştu.' }, { status: 500 });
  }
}
