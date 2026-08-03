/**
 * Örnek çıktı dosyalarını üretir (ornekler/ klasörüne).
 * Çalışan uygulamanın gerçek dışa aktarma uçlarını kullanır — böylece örnekler
 * her zaman gerçek çıktılarla birebir aynıdır.
 *
 * Kullanım: uygulama çalışırken (npm start / npm run dev)  →  npm run ornekler
 */
const fs = require('fs');
const path = require('path');

const TABAN = process.env.APP_URL || 'http://localhost:3000';
const HEDEF = path.join(__dirname, '..', 'ornekler');

async function main() {
  fs.mkdirSync(HEDEF, { recursive: true });

  // Yönetici olarak giriş yap
  const girisYaniti = await fetch(`${TABAN}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kimlik: '11111111111', sifre: 'admin123' }),
  });
  if (!girisYaniti.ok) {
    console.error('Yönetici girişi başarısız. Uygulama çalışıyor mu ve seed yüklü mü?');
    process.exit(1);
  }
  const cerez = girisYaniti.headers.get('set-cookie').split(';')[0];

  // Örnekler için görevlendirme id'sini bul (en son oluşturulan)
  const gorevler = await (await fetch(`${TABAN}/api/admin/gorevlendirme`, { headers: { cookie: cerez } })).json();
  const gorevId = gorevler.gorevlendirmeler?.[0]?.id;
  if (!gorevId) {
    console.error('Örnek görevlendirme bulunamadı. Önce "npm run seed" çalıştırın.');
    process.exit(1);
  }
  const gorev = gorevler.gorevlendirmeler[0];
  const donem = `yil=${gorev.yil}&ay=${gorev.ay}`;

  const indirilecekler = [
    ['/api/admin/sablon', 'personel-sablonu.xlsx'],
    [`/api/admin/export?format=excel&tur=tum-personel&${donem}`, 'ornek-tum-personel.xlsx'],
    [`/api/admin/export?format=excel&tur=asil-liste&gorevId=${gorevId}&${donem}`, 'ornek-asil-gorevlendirme-listesi.xlsx'],
    [`/api/admin/export?format=word&tur=resmi&gorevId=${gorevId}&${donem}`, 'ornek-gorevlendirme-resmi-yazi.docx'],
    [`/api/admin/export?format=word&tur=teblig&gorevId=${gorevId}&${donem}`, 'ornek-teblig-listesi.docx'],
    [`/api/admin/export?format=pdf&tur=gorevlendirme&gorevId=${gorevId}&${donem}`, 'ornek-gorevlendirme-listesi.pdf'],
    [`/api/admin/export?format=pdf&tur=aylik-durum&${donem}`, 'ornek-aylik-durum-raporu.pdf'],
  ];

  for (const [url, dosyaAdi] of indirilecekler) {
    const y = await fetch(`${TABAN}${url}`, { headers: { cookie: cerez } });
    if (!y.ok) {
      console.error(`HATA ${y.status}: ${url}`);
      continue;
    }
    const buf = Buffer.from(await y.arrayBuffer());
    fs.writeFileSync(path.join(HEDEF, dosyaAdi), buf);
    console.log(`✓ ${dosyaAdi} (${buf.length} bayt)`);
  }
  console.log(`\nÖrnek dosyalar '${HEDEF}' klasörüne yazıldı.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
