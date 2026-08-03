import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType,
  AlignmentType, HeadingLevel, Footer, PageNumber, BorderStyle, VerticalAlign,
} from 'docx';
import { KURUM_ADI, ayAdi } from './db';
import { GorevlendirmeDetay, GorevlendirmeUyesi, listeSatirlari } from './reports';

const INCE_KENAR = {
  top: { style: BorderStyle.SINGLE, size: 2, color: '999999' },
  bottom: { style: BorderStyle.SINGLE, size: 2, color: '999999' },
  left: { style: BorderStyle.SINGLE, size: 2, color: '999999' },
  right: { style: BorderStyle.SINGLE, size: 2, color: '999999' },
};

function hucre(metin: string, opts: { baslik?: boolean; genislik?: number } = {}): TableCell {
  return new TableCell({
    borders: INCE_KENAR,
    verticalAlign: VerticalAlign.CENTER,
    shading: opts.baslik ? { fill: '0D5BA5' } : undefined,
    width: opts.genislik ? { size: opts.genislik, type: WidthType.PERCENTAGE } : undefined,
    children: [
      new Paragraph({
        alignment: opts.baslik ? AlignmentType.CENTER : AlignmentType.LEFT,
        children: [
          new TextRun({
            text: metin,
            bold: opts.baslik,
            color: opts.baslik ? 'FFFFFF' : '000000',
            size: 18, // 9pt
          }),
        ],
      }),
    ],
  });
}

// Kurum başlığı: logo alanı + kurum adı + rapor başlığı + ay/yıl + oluşturma tarihi
function belgeBasligi(baslik: string, yil: number, ay: number): Paragraph[] {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: '[ KURUM LOGOSU ]', size: 16, color: '999999' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120 },
      children: [new TextRun({ text: KURUM_ADI, bold: true, size: 26 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 120 },
      children: [new TextRun({ text: baslik, bold: true, size: 24, color: '0D5BA5' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `${ayAdi(ay)} ${yil}`, bold: true, size: 22 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [
        new TextRun({ text: `Oluşturma tarihi: ${new Date().toLocaleString('tr-TR')}`, italics: true, size: 16 }),
      ],
    }),
  ];
}

function onayAlani(): Paragraph[] {
  return [
    new Paragraph({ spacing: { before: 600 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: 'ONAY', bold: true, size: 20 })],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 480 },
      children: [new TextRun({ text: '.........................................', size: 20 })],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: 'İl Sağlık Müdürü', size: 20 })],
    }),
  ];
}

function sayfaAltligi(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ children: ['Sayfa ', PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES], size: 16 }),
        ],
      }),
    ],
  });
}

function gorevTablosu(uyeler: GorevlendirmeUyesi[]): Table {
  const basliklar = ['Sıra', 'Ad Soyad', 'Unvan', 'İlçe', 'ASM', 'Birim', 'Telefon', 'Son Görev', 'Toplam', 'Asıl/Yedek'];
  const genislikler = [5, 17, 14, 10, 16, 9, 11, 8, 5, 8];
  const satirlar = listeSatirlari(uyeler);
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: basliklar.map((b, i) => hucre(b, { baslik: true, genislik: genislikler[i] })),
      }),
      ...satirlar.map(
        (s) =>
          new TableRow({
            children: [
              hucre(String(s.sira)), hucre(s.adSoyad), hucre(s.unvan), hucre(s.ilce), hucre(s.asm),
              hucre(s.birim), hucre(s.telefon), hucre(s.sonGorev), hucre(String(s.toplamGorev)), hucre(s.durum),
            ],
          })
      ),
    ],
  });
}

function belge(children: (Paragraph | Table)[]): Document {
  return new Document({
    styles: { default: { document: { run: { font: 'Calibri', size: 20 } } } },
    sections: [{ properties: {}, footers: { default: sayfaAltligi() }, children }],
  });
}

// Resmî yazıya eklenebilecek görevlendirme listesi
export async function gorevlendirmeWord(g: GorevlendirmeDetay, tur: 'resmi' | 'asil-yedek' | 'ilce' | 'teblig'): Promise<Buffer> {
  const cocuklar: (Paragraph | Table)[] = [];

  if (tur === 'resmi') {
    cocuklar.push(...belgeBasligi('Deprem ve Afet Görevlendirme Listesi', g.yil, g.ay));
    cocuklar.push(
      new Paragraph({
        spacing: { after: 240 },
        children: [
          new TextRun({
            text:
              'Olası deprem ve afet durumlarında görev almak üzere, aşağıda kimlik ve görev yeri bilgileri ' +
              'yer alan aile hekimliği personeli görevlendirilmiştir.',
            size: 20,
          }),
        ],
      })
    );
    const asil = g.uyeler.filter((u) => u.tip === 'ASIL');
    const yedek = g.uyeler.filter((u) => u.tip === 'YEDEK');
    cocuklar.push(new Paragraph({ spacing: { before: 120, after: 120 }, children: [new TextRun({ text: 'ASIL PERSONEL LİSTESİ', bold: true, size: 22 })] }));
    cocuklar.push(gorevTablosu(asil));
    cocuklar.push(new Paragraph({ spacing: { before: 240, after: 120 }, children: [new TextRun({ text: 'YEDEK PERSONEL LİSTESİ', bold: true, size: 22 })] }));
    cocuklar.push(gorevTablosu(yedek));
  } else if (tur === 'asil-yedek') {
    cocuklar.push(...belgeBasligi('Asıl ve Yedek Personel Tablosu', g.yil, g.ay));
    cocuklar.push(gorevTablosu(g.uyeler));
  } else if (tur === 'ilce') {
    cocuklar.push(...belgeBasligi('İlçe Bazlı Görevlendirme Çizelgesi', g.yil, g.ay));
    const ilceler = new Map<string, GorevlendirmeUyesi[]>();
    for (const u of g.uyeler) {
      const k = u.ilce || 'Belirtilmemiş';
      if (!ilceler.has(k)) ilceler.set(k, []);
      ilceler.get(k)!.push(u);
    }
    for (const ilce of [...ilceler.keys()].sort((a, b) => a.localeCompare(b, 'tr'))) {
      cocuklar.push(new Paragraph({ spacing: { before: 240, after: 120 }, children: [new TextRun({ text: `${ilce.toLocaleUpperCase('tr')} İLÇESİ`, bold: true, size: 22 })] }));
      cocuklar.push(gorevTablosu(ilceler.get(ilce)!));
    }
  } else {
    // Tebliğ listesi: imza sütunlu
    cocuklar.push(...belgeBasligi('Personel Tebliğ Listesi', g.yil, g.ay));
    cocuklar.push(
      new Paragraph({
        spacing: { after: 240 },
        children: [
          new TextRun({
            text: 'Aşağıda adı geçen personele görevlendirme kararı tebliğ edilmiştir.',
            size: 20,
          }),
        ],
      })
    );
    const satirlar = listeSatirlari(g.uyeler);
    cocuklar.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            tableHeader: true,
            children: ['Sıra', 'Ad Soyad', 'Unvan', 'İlçe / ASM', 'Asıl/Yedek', 'Tebliğ Tarihi', 'İmza'].map((b, i) =>
              hucre(b, { baslik: true, genislik: [5, 20, 15, 25, 10, 12, 13][i] })
            ),
          }),
          ...satirlar.map(
            (s) =>
              new TableRow({
                children: [
                  hucre(String(s.sira)), hucre(s.adSoyad), hucre(s.unvan),
                  hucre(`${s.ilce} / ${s.asm}`), hucre(s.durum), hucre(''), hucre(''),
                ],
              })
          ),
        ],
      })
    );
  }

  cocuklar.push(...onayAlani());
  return Buffer.from(await Packer.toBuffer(belge(cocuklar)));
}
