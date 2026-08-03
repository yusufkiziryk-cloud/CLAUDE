import PDFDocument from 'pdfkit';
import path from 'path';
import { KURUM_ADI, ayAdi } from './db';
import { GorevlendirmeDetay, listeSatirlari, PersonelSatiri, uygunlukAdi } from './reports';
import { unvanAdi } from './db';

const FONT = path.join(process.cwd(), 'fonts', 'DejaVuSans.ttf');
const FONT_BOLD = path.join(process.cwd(), 'fonts', 'DejaVuSans-Bold.ttf');
const MAVI = '#0d5ba5';

type Doc = InstanceType<typeof PDFDocument>;

function yeniBelge(): { doc: Doc; bitir: () => Promise<Buffer> } {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 40, bottom: 50, left: 36, right: 36 }, bufferPages: true });
  doc.registerFont('Normal', FONT);
  doc.registerFont('Kalin', FONT_BOLD);
  doc.font('Normal');
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const bitti = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
  const bitir = async () => {
    // Sayfa numaraları (footer)
    const aralik = doc.bufferedPageRange();
    for (let i = aralik.start; i < aralik.start + aralik.count; i++) {
      doc.switchToPage(i);
      // Kenar boşluğu içine yazarken pdfkit'in yeni sayfa açmasını önle
      const altBosluk = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.font('Normal').fontSize(8).fillColor('#666666');
      doc.text(`Sayfa ${i + 1} / ${aralik.count}`, 36, doc.page.height - 35, {
        width: doc.page.width - 72,
        align: 'center',
        lineBreak: false,
      });
      doc.page.margins.bottom = altBosluk;
    }
    doc.end();
    return bitti;
  };
  return { doc, bitir };
}

function belgeBasligi(doc: Doc, baslik: string, yil: number, ay: number) {
  const genislik = doc.page.width - 72;
  doc.fontSize(8).fillColor('#999999').text('[ KURUM LOGOSU ]', 36, 40, { width: genislik, align: 'center' });
  doc.moveDown(0.4);
  doc.font('Kalin').fontSize(13).fillColor('#000000').text(KURUM_ADI, { width: genislik, align: 'center' });
  doc.moveDown(0.2);
  doc.font('Kalin').fontSize(12).fillColor(MAVI).text(baslik, { width: genislik, align: 'center' });
  doc.moveDown(0.1);
  doc.font('Kalin').fontSize(11).fillColor('#000000').text(`${ayAdi(ay)} ${yil}`, { width: genislik, align: 'center' });
  doc.moveDown(0.1);
  doc.font('Normal').fontSize(8).fillColor('#555555')
    .text(`Oluşturma tarihi: ${new Date().toLocaleString('tr-TR')}`, { width: genislik, align: 'center' });
  doc.moveDown(1);
  doc.fillColor('#000000');
}

interface Sutun { baslik: string; genislik: number }

// Metni verilen genişliğe tek satıra sığdırır; sığmazsa sonuna "…" ekleyerek kısaltır
function sigdir(doc: Doc, metin: string, genislik: number): string {
  if (doc.widthOfString(metin) <= genislik) return metin;
  let m = metin;
  while (m.length > 1 && doc.widthOfString(m + '…') > genislik) m = m.slice(0, -1);
  return m + '…';
}

// Basit tablo çizici: hücreler tek satır, sayfa sonunda otomatik yeni sayfa açar
function tabloCiz(doc: Doc, sutunlar: Sutun[], satirlar: string[][]) {
  const solX = 36;
  const satirYuk = 18;
  const toplamGen = sutunlar.reduce((t, s) => t + s.genislik, 0);
  const olcek = (doc.page.width - 72) / toplamGen;

  const basligiCiz = () => {
    let x = solX;
    const y = doc.y;
    doc.rect(solX, y, doc.page.width - 72, satirYuk).fill(MAVI);
    doc.font('Kalin').fontSize(7.5).fillColor('#ffffff');
    for (const s of sutunlar) {
      const w = s.genislik * olcek;
      doc.text(sigdir(doc, s.baslik, w - 4), x + 2, y + 5, { lineBreak: false });
      x += w;
    }
    doc.y = y + satirYuk;
    doc.fillColor('#000000');
  };

  basligiCiz();
  doc.font('Normal').fontSize(7.5);
  for (let i = 0; i < satirlar.length; i++) {
    if (doc.y + satirYuk > doc.page.height - 60) {
      doc.addPage();
      doc.y = 40;
      basligiCiz();
      doc.font('Normal').fontSize(7.5);
    }
    const y = doc.y;
    if (i % 2 === 1) {
      doc.rect(solX, y, doc.page.width - 72, satirYuk).fill('#eef4fb');
      doc.fillColor('#000000');
    }
    let x = solX;
    for (let j = 0; j < sutunlar.length; j++) {
      const w = sutunlar[j].genislik * olcek;
      doc.text(sigdir(doc, satirlar[i][j] ?? '', w - 4), x + 2, y + 5, { lineBreak: false });
      x += w;
    }
    doc.moveTo(solX, y + satirYuk).lineTo(doc.page.width - 36, y + satirYuk).lineWidth(0.3).strokeColor('#cccccc').stroke();
    doc.y = y + satirYuk;
  }
  doc.moveDown(1);
}

function onayAlani(doc: Doc) {
  if (doc.y > doc.page.height - 140) { doc.addPage(); doc.y = 60; }
  const x = doc.page.width - 220;
  doc.moveDown(2);
  const y = doc.y;
  doc.font('Kalin').fontSize(10).text('ONAY', x, y, { width: 180, align: 'center' });
  doc.font('Normal').fontSize(10).text('.....................................', x, y + 40, { width: 180, align: 'center' });
  doc.text('İl Sağlık Müdürü', x, y + 55, { width: 180, align: 'center' });
}

const GOREV_SUTUNLAR: Sutun[] = [
  { baslik: 'Sıra', genislik: 4 },
  { baslik: 'Ad Soyad', genislik: 16 },
  { baslik: 'Unvan', genislik: 14 },
  { baslik: 'İlçe', genislik: 9 },
  { baslik: 'ASM', genislik: 17 },
  { baslik: 'Birim', genislik: 7 },
  { baslik: 'Telefon', genislik: 12 },
  { baslik: 'Son Görev', genislik: 8 },
  { baslik: 'Top.', genislik: 4 },
  { baslik: 'Asıl/Yedek', genislik: 9 },
];

// Görevlendirme listesi PDF (asıl+yedek veya ayrı ayrı). Sağlık bilgisi içermez.
export async function gorevlendirmePdf(g: GorevlendirmeDetay, tur: 'hepsi' | 'asil-yedek'): Promise<Buffer> {
  const { doc, bitir } = yeniBelge();
  belgeBasligi(doc, tur === 'hepsi' ? 'Görevlendirme Listesi' : 'Asıl ve Yedek Personel Listesi', g.yil, g.ay);

  const bolum = (etiket: string, tip: 'ASIL' | 'YEDEK') => {
    const uyeler = g.uyeler.filter((u) => u.tip === tip);
    doc.font('Kalin').fontSize(10).fillColor('#000000').text(etiket, 36, doc.y);
    doc.moveDown(0.3);
    tabloCiz(
      doc,
      GOREV_SUTUNLAR,
      listeSatirlari(uyeler).map((s) => [
        String(s.sira), s.adSoyad, s.unvan, s.ilce, s.asm, s.birim, s.telefon, s.sonGorev, String(s.toplamGorev), s.durum,
      ])
    );
  };
  bolum('ASIL PERSONEL LİSTESİ', 'ASIL');
  bolum('YEDEK PERSONEL LİSTESİ', 'YEDEK');
  onayAlani(doc);
  return bitir();
}

// Aylık durum raporu: özet sayılar + uygunluk dağılımı
export interface AylikOzet {
  toplam: number;
  beyanVeren: number;
  beyanVermeyen: number;
  uygun: number;
  uygunDegil: number;
  degerlendirme: number;
  izinli: number;
  gorevlendirilen: number;
  yedek: number;
}

export async function aylikDurumPdf(ozet: AylikOzet, yil: number, ay: number, ilceOzet: { ilce: string; toplam: number; veren: number; uygun: number }[]): Promise<Buffer> {
  const { doc, bitir } = yeniBelge();
  belgeBasligi(doc, 'Aylık Durum Raporu', yil, ay);

  const satirlar: [string, string][] = [
    ['Toplam aktif personel', String(ozet.toplam)],
    ['Bu ay beyan verenler', String(ozet.beyanVeren)],
    ['Beyan vermeyenler', String(ozet.beyanVermeyen)],
    ['Görevlendirmeye uygun', String(ozet.uygun)],
    ['Görevlendirmeye uygun değil', String(ozet.uygunDegil)],
    ['Yönetici değerlendirmesi gerekli', String(ozet.degerlendirme)],
    ['İzinli veya raporlu', String(ozet.izinli)],
    ['Görevlendirilen (asıl)', String(ozet.gorevlendirilen)],
    ['Yedek personel', String(ozet.yedek)],
  ];
  tabloCiz(doc, [{ baslik: 'Gösterge', genislik: 60 }, { baslik: 'Sayı', genislik: 20 }], satirlar);

  doc.font('Kalin').fontSize(10).text('İLÇE BAZLI DAĞILIM', 36, doc.y);
  doc.moveDown(0.3);
  tabloCiz(
    doc,
    [
      { baslik: 'İlçe', genislik: 30 },
      { baslik: 'Toplam Personel', genislik: 20 },
      { baslik: 'Beyan Veren', genislik: 20 },
      { baslik: 'Uygun', genislik: 20 },
    ],
    ilceOzet.map((s) => [s.ilce, String(s.toplam), String(s.veren), String(s.uygun)])
  );
  onayAlani(doc);
  return bitir();
}

// Beyan tamamlama raporu: kim verdi, kim vermedi
export async function beyanTamamlamaPdf(rows: PersonelSatiri[], yil: number, ay: number): Promise<Buffer> {
  const { doc, bitir } = yeniBelge();
  belgeBasligi(doc, 'Beyan Tamamlama Raporu', yil, ay);
  const sutunlar: Sutun[] = [
    { baslik: 'Sıra', genislik: 5 },
    { baslik: 'Ad Soyad', genislik: 20 },
    { baslik: 'Unvan', genislik: 15 },
    { baslik: 'İlçe', genislik: 11 },
    { baslik: 'ASM', genislik: 19 },
    { baslik: 'Beyan', genislik: 8 },
    { baslik: 'Uygunluk Durumu', genislik: 22 },
  ];
  tabloCiz(
    doc,
    sutunlar,
    rows.map((r, i) => [
      String(i + 1),
      `${r.ad} ${r.soyad}`,
      unvanAdi(r.unvan),
      r.ilce || '',
      r.asm || '',
      r.beyanVerdi ? 'Verdi' : 'Vermedi',
      uygunlukAdi(r.uygunluk),
    ])
  );
  onayAlani(doc);
  return bitir();
}
