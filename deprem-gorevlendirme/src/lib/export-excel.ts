import ExcelJS from 'exceljs';
import { KURUM_ADI, ayAdi, unvanAdi } from './db';
import { PersonelSatiri, GorevlendirmeDetay, listeSatirlari, uygunlukAdi, tcMaskele } from './reports';

const BASLIK_STIL: Partial<ExcelJS.Style> = {
  font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D5BA5' } },
  alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
  border: {
    top: { style: 'thin' }, bottom: { style: 'thin' },
    left: { style: 'thin' }, right: { style: 'thin' },
  },
};

function sayfaBasligi(ws: ExcelJS.Worksheet, baslik: string, yil: number, ay: number, sutunSayisi: number) {
  ws.mergeCells(1, 1, 1, sutunSayisi);
  ws.getCell(1, 1).value = KURUM_ADI;
  ws.getCell(1, 1).font = { bold: true, size: 13 };
  ws.getCell(1, 1).alignment = { horizontal: 'center' };
  ws.mergeCells(2, 1, 2, sutunSayisi);
  ws.getCell(2, 1).value = `${baslik} — ${ayAdi(ay)} ${yil}`;
  ws.getCell(2, 1).font = { bold: true, size: 12 };
  ws.getCell(2, 1).alignment = { horizontal: 'center' };
  ws.mergeCells(3, 1, 3, sutunSayisi);
  ws.getCell(3, 1).value = `Oluşturma tarihi: ${new Date().toLocaleString('tr-TR')}`;
  ws.getCell(3, 1).font = { size: 9, italic: true };
  ws.getCell(3, 1).alignment = { horizontal: 'center' };
  ws.addRow([]);
}

function tabloYaz(
  ws: ExcelJS.Worksheet,
  basliklar: { header: string; width: number }[],
  satirlar: (string | number)[][]
) {
  const headerRow = ws.addRow(basliklar.map((b) => b.header));
  headerRow.eachCell((c) => Object.assign(c, { style: BASLIK_STIL }));
  headerRow.height = 22;
  basliklar.forEach((b, i) => (ws.getColumn(i + 1).width = b.width));
  for (const s of satirlar) {
    const r = ws.addRow(s);
    r.eachCell((c) => {
      c.border = {
        top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      };
    });
  }
}

const PERSONEL_SUTUNLARI = [
  { header: 'Sıra', width: 6 },
  { header: 'T.C. Kimlik No', width: 16 },
  { header: 'Sicil No', width: 12 },
  { header: 'Ad Soyad', width: 24 },
  { header: 'Unvan', width: 22 },
  { header: 'İlçe', width: 14 },
  { header: 'ASM', width: 26 },
  { header: 'Birim', width: 12 },
  { header: 'Telefon', width: 14 },
  { header: 'Beyan Durumu', width: 14 },
  { header: 'Uygunluk', width: 28 },
  { header: 'Toplam Görev', width: 12 },
  { header: 'Son Görev Tarihi', width: 16 },
];

function personelSatirlari(rows: PersonelSatiri[]): (string | number)[][] {
  return rows.map((r, i) => [
    i + 1,
    tcMaskele(r.tc),
    r.sicil || '',
    `${r.ad} ${r.soyad}`,
    unvanAdi(r.unvan),
    r.ilce || '',
    r.asm || '',
    r.birim || '',
    r.telefon || '',
    r.beyanVerdi ? 'Verdi' : 'Vermedi',
    uygunlukAdi(r.uygunluk),
    r.toplamGorev,
    r.sonGorevTarih ? r.sonGorevTarih.slice(0, 10) : '-',
  ]);
}

// Genel personel listesi çıktısı (tüm personel, beyan verenler/vermeyenler, uygun/uygun olmayan)
export async function personelExcel(baslik: string, rows: PersonelSatiri[], yil: number, ay: number): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Liste');
  sayfaBasligi(ws, baslik, yil, ay, PERSONEL_SUTUNLARI.length);
  tabloYaz(ws, PERSONEL_SUTUNLARI, personelSatirlari(rows));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// İlçe veya ASM bazlı: her grup ayrı sayfa
export async function grupluPersonelExcel(
  baslik: string,
  rows: PersonelSatiri[],
  grupAlan: 'ilce' | 'asm',
  yil: number,
  ay: number
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const gruplar = new Map<string, PersonelSatiri[]>();
  for (const r of rows) {
    const k = (r[grupAlan] as string) || 'Belirtilmemiş';
    if (!gruplar.has(k)) gruplar.set(k, []);
    gruplar.get(k)!.push(r);
  }
  const adlar = [...gruplar.keys()].sort((a, b) => a.localeCompare(b, 'tr'));
  for (const grupAdi of adlar) {
    // Excel sayfa adında yasak karakterleri temizle, 31 karakterle sınırla
    const ws = wb.addWorksheet(grupAdi.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Grup');
    sayfaBasligi(ws, `${baslik} — ${grupAdi}`, yil, ay, PERSONEL_SUTUNLARI.length);
    tabloYaz(ws, PERSONEL_SUTUNLARI, personelSatirlari(gruplar.get(grupAdi)!));
  }
  if (adlar.length === 0) {
    const ws = wb.addWorksheet('Liste');
    sayfaBasligi(ws, baslik, yil, ay, PERSONEL_SUTUNLARI.length);
    tabloYaz(ws, PERSONEL_SUTUNLARI, []);
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const GOREV_SUTUNLARI = [
  { header: 'Sıra', width: 6 },
  { header: 'Ad Soyad', width: 24 },
  { header: 'Unvan', width: 22 },
  { header: 'İlçe', width: 14 },
  { header: 'ASM', width: 26 },
  { header: 'Birim', width: 12 },
  { header: 'Telefon', width: 14 },
  { header: 'Son Görevlendirme', width: 16 },
  { header: 'Toplam Görevlendirme', width: 14 },
  { header: 'Asıl / Yedek', width: 12 },
];

// Görevlendirme listesi (asıl veya yedek). Sağlık bilgisi içermez.
export async function gorevlendirmeExcel(g: GorevlendirmeDetay, tip: 'ASIL' | 'YEDEK' | 'HEPSI'): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(tip === 'YEDEK' ? 'Yedek Liste' : tip === 'ASIL' ? 'Asıl Liste' : 'Görevlendirme');
  const uyeler = tip === 'HEPSI' ? g.uyeler : g.uyeler.filter((u) => u.tip === tip);
  const etiket = tip === 'ASIL' ? 'Asıl Görevlendirme Listesi' : tip === 'YEDEK' ? 'Yedek Görevlendirme Listesi' : 'Görevlendirme Listesi';
  sayfaBasligi(ws, `${g.baslik} — ${etiket}`, g.yil, g.ay, GOREV_SUTUNLARI.length);
  const satirlar = listeSatirlari(uyeler).map((s) => [
    s.sira, s.adSoyad, s.unvan, s.ilce, s.asm, s.birim, s.telefon, s.sonGorev, s.toplamGorev, s.durum,
  ]);
  tabloYaz(ws, GOREV_SUTUNLARI, satirlar);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// Personel içe aktarma için boş Excel şablonu
export async function personelSablonu(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Personel');
  const sutunlar = [
    { header: 'T.C. Kimlik No', width: 16 },
    { header: 'Sicil No', width: 12 },
    { header: 'Ad', width: 16 },
    { header: 'Soyad', width: 16 },
    { header: 'Unvan', width: 24 },
    { header: 'İlçe', width: 14 },
    { header: 'ASM', width: 28 },
    { header: 'Birim', width: 12 },
    { header: 'Telefon', width: 14 },
    { header: 'E-posta', width: 26 },
    { header: 'Aktif', width: 10 },
  ];
  const headerRow = ws.addRow(sutunlar.map((s) => s.header));
  headerRow.eachCell((c) => Object.assign(c, { style: BASLIK_STIL }));
  sutunlar.forEach((s, i) => (ws.getColumn(i + 1).width = s.width));
  ws.addRow(['99900000001', 'ORNEK-1', 'Örnek', 'Hekim', 'Aile Hekimi', 'Haliliye', 'Haliliye 1 Nolu ASM', '1. Birim', '05009990001', 'ornek@saglik.gov.tr', 'Evet']);
  ws.addRow(['99900000002', 'ORNEK-2', 'Örnek', 'Çalışan', 'Aile Sağlığı Çalışanı', 'Eyyübiye', 'Eyyübiye 2 Nolu ASM', '2. Birim', '05009990002', '', 'Evet']);
  const not = ws.addRow([]);
  ws.addRow(['Notlar: Unvan sütununa "Aile Hekimi" veya "Aile Sağlığı Çalışanı" yazınız. Aktif sütununa "Evet" veya "Hayır" yazınız.']);
  ws.addRow(['T.C. kimlik no veya sicil numarasından en az biri zorunludur. Aynı kişi tekrar yüklenirse bilgileri güncellenir.']);
  void not;
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// Yüklenen personel Excel dosyasını okur
export interface IcePersonel {
  tc: string | null;
  sicil: string | null;
  ad: string;
  soyad: string;
  unvan: string | null;
  ilce: string | null;
  asm: string | null;
  birim: string | null;
  telefon: string | null;
  email: string | null;
  aktif: boolean;
  satirNo: number;
  hata?: string;
}

function hucre(row: ExcelJS.Row, i: number): string {
  const c = row.getCell(i).value;
  if (c == null) return '';
  if (typeof c === 'object' && 'text' in (c as object)) return String((c as { text: unknown }).text).trim();
  return String(c).trim();
}

export async function personelExcelOku(buf: Buffer): Promise<IcePersonel[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const sonuc: IcePersonel[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // başlık satırı
    const tc = hucre(row, 1).replace(/\D/g, '') || null;
    const sicil = hucre(row, 2) || null;
    const ad = hucre(row, 3);
    const soyad = hucre(row, 4);
    if (!tc && !sicil && !ad && !soyad) return; // boş satır / not satırı
    const unvanRaw = hucre(row, 5).toLocaleLowerCase('tr');
    let unvan: string | null = null;
    if (unvanRaw.includes('hekim')) unvan = 'AILE_HEKIMI';
    else if (unvanRaw.includes('sağlığı') || unvanRaw.includes('sagligi') || unvanRaw.includes('çalışan') || unvanRaw.includes('calisan') || unvanRaw.includes('ebe') || unvanRaw.includes('hemşire')) unvan = 'AILE_SAGLIGI_CALISANI';
    const aktifRaw = hucre(row, 11).toLocaleLowerCase('tr');
    const kayit: IcePersonel = {
      tc, sicil, ad, soyad, unvan,
      ilce: hucre(row, 6) || null,
      asm: hucre(row, 7) || null,
      birim: hucre(row, 8) || null,
      telefon: hucre(row, 9).replace(/[^\d+]/g, '') || null,
      email: hucre(row, 10) || null,
      aktif: aktifRaw === '' || aktifRaw.startsWith('e') || aktifRaw === '1' || aktifRaw === 'true',
      satirNo: rowNumber,
    };
    if (!kayit.tc && !kayit.sicil) kayit.hata = 'T.C. kimlik no veya sicil numarası zorunludur';
    else if (!kayit.ad || !kayit.soyad) kayit.hata = 'Ad ve soyad zorunludur';
    else if (kayit.tc && kayit.tc.length !== 11) kayit.hata = 'T.C. kimlik numarası 11 haneli olmalıdır';
    else if (!kayit.unvan) kayit.hata = 'Unvan "Aile Hekimi" veya "Aile Sağlığı Çalışanı" olmalıdır';
    sonuc.push(kayit);
  });
  return sonuc;
}
