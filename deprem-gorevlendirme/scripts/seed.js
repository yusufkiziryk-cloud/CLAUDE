/**
 * Demo verisi yükleme betiği.
 * Kullanım: npm run seed
 *
 * Oluşturulanlar:
 *  - 1 il yöneticisi, 1 ilçe yöneticisi (Haliliye)
 *  - Şanlıurfa'nın 13 ilçesine dağılmış ~70 personel (aile hekimi + ASÇ)
 *  - Önceki ay için beyanlar (çoğunluk), bu ay için kısmi beyanlar
 *  - Önceki aya ait onaylanmış örnek bir görevlendirme
 */
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'uygulama.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.exec(fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8'));

// Deterministik sözde-rastgele üreteç (her çalıştırmada aynı demo veri)
let tohum = 42;
function rasgele() {
  tohum = (tohum * 1103515245 + 12345) % 2147483648;
  return tohum / 2147483648;
}
function sec(dizi) { return dizi[Math.floor(rasgele() * dizi.length)]; }

const ILCELER = [
  'Haliliye', 'Eyyübiye', 'Karaköprü', 'Siverek', 'Viranşehir', 'Suruç', 'Akçakale',
  'Birecik', 'Bozova', 'Ceylanpınar', 'Halfeti', 'Harran', 'Hilvan',
];

const ERKEK_AD = ['Mehmet', 'Ahmet', 'Mustafa', 'Ali', 'Hasan', 'Hüseyin', 'İbrahim', 'Osman', 'Yusuf', 'Ömer', 'Halil', 'Ramazan', 'Emre', 'Murat', 'Serkan'];
const KADIN_AD = ['Ayşe', 'Fatma', 'Emine', 'Hatice', 'Zeynep', 'Elif', 'Meryem', 'Şeyma', 'Büşra', 'Esra', 'Merve', 'Dilek', 'Songül', 'Sultan', 'Gül'];
const SOYADLAR = ['Yılmaz', 'Kaya', 'Demir', 'Çelik', 'Şahin', 'Öztürk', 'Aydın', 'Arslan', 'Doğan', 'Kılıç', 'Aslan', 'Çetin', 'Kara', 'Koç', 'Kurt', 'Özdemir', 'Polat', 'Erdoğan', 'Güneş', 'Aktaş'];

function tcUret(i) { return String(10000000000 + i * 137 + 11); }
function telUret(i) { return '05' + String(300000000 + i * 7919).slice(0, 9); }

const simdi = new Date();
const buYil = simdi.getFullYear();
const buAy = simdi.getMonth() + 1;
const oncekiAy = buAy === 1 ? 12 : buAy - 1;
const oncekiYil = buAy === 1 ? buYil - 1 : buYil;

console.log(`Demo veri yükleniyor... (dönem: ${buAy}/${buYil}, önceki: ${oncekiAy}/${oncekiYil})`);
console.log(`Veritabanı: ${DB_PATH}`);

const kullaniciEkle = db.prepare(`
  INSERT INTO users (tc, sicil, ad, soyad, unvan, ilce, asm, birim, telefon, email, aktif, rol, password_hash)
  VALUES (@tc, @sicil, @ad, @soyad, @unvan, @ilce, @asm, @birim, @telefon, @email, 1, @rol, @hash)
  ON CONFLICT(tc) DO NOTHING
`);

const hash = (s) => bcrypt.hashSync(s, 10);

// --- Yöneticiler ---
kullaniciEkle.run({
  tc: '11111111111', sicil: 'Y0001', ad: 'İlyas', soyad: 'Yönetici', unvan: null,
  ilce: null, asm: null, birim: null, telefon: '05001110001', email: 'il.yonetici@saglik.gov.tr',
  rol: 'IL_YONETICI', hash: hash('admin123'),
});
kullaniciEkle.run({
  tc: '22222222222', sicil: 'Y0002', ad: 'Harun', soyad: 'İlçeci', unvan: null,
  ilce: 'Haliliye', asm: null, birim: null, telefon: '05001110002', email: 'haliliye.yonetici@saglik.gov.tr',
  rol: 'ILCE_YONETICI', hash: hash('ilce123'),
});

// --- Personel ---
// İlk iki kayıt bilinen demo hesaplar (şifreleri hazır)
const demoPersonel = [
  {
    tc: '10000000001', sicil: 'S1001', ad: 'Deniz', soyad: 'Hekimoğlu', unvan: 'AILE_HEKIMI',
    ilce: 'Haliliye', asm: 'Haliliye 1 Nolu ASM', birim: '1. Birim', telefon: '05001112233',
    email: 'deniz.hekimoglu@saglik.gov.tr', rol: 'PERSONEL', hash: hash('demo123'),
  },
  {
    tc: '10000000002', sicil: 'S2001', ad: 'Selin', soyad: 'Sağlıkçı', unvan: 'AILE_SAGLIGI_CALISANI',
    ilce: 'Eyyübiye', asm: 'Eyyübiye 1 Nolu ASM', birim: '2. Birim', telefon: '05001112244',
    email: 'selin.saglikci@saglik.gov.tr', rol: 'PERSONEL', hash: hash('demo123'),
  },
];
demoPersonel.forEach((p) => kullaniciEkle.run(p));

let sayac = 10;
for (const ilce of ILCELER) {
  // İlçe başına 2-3 ASM, ASM başına 1-2 birim, her birimde 1 AH + 1 ASÇ
  const asmSayisi = ilce === 'Haliliye' || ilce === 'Eyyübiye' || ilce === 'Siverek' ? 3 : 2;
  for (let a = 1; a <= asmSayisi; a++) {
    const asm = `${ilce} ${a} Nolu ASM`;
    for (let b = 1; b <= 2; b++) {
      for (const unvan of ['AILE_HEKIMI', 'AILE_SAGLIGI_CALISANI']) {
        sayac++;
        const kadin = rasgele() < 0.5;
        kullaniciEkle.run({
          tc: tcUret(sayac),
          sicil: (unvan === 'AILE_HEKIMI' ? 'S1' : 'S2') + String(1000 + sayac),
          ad: kadin ? sec(KADIN_AD) : sec(ERKEK_AD),
          soyad: sec(SOYADLAR),
          unvan, ilce, asm, birim: `${b}. Birim`,
          telefon: telUret(sayac),
          email: rasgele() < 0.7 ? `personel${sayac}@saglik.gov.tr` : null,
          rol: 'PERSONEL',
          hash: rasgele() < 0.3 ? hash('demo123') : null, // bir kısmı henüz şifre oluşturmamış
        });
      }
    }
  }
}

const personeller = db.prepare("SELECT id, unvan, ilce FROM users WHERE rol = 'PERSONEL' ORDER BY id").all();
console.log(`${personeller.length} personel kaydı hazır.`);

// --- Uygunluk hesabı (varsayılan kurallarla aynı) ---
function uygunlukHesapla(c) {
  if (c.izin === 'EVET') return 'IZINLI';
  if (c.gebelik === 'EVET') return 'UYGUN_DEGIL';
  if (c.cocuk === 'EVET' || c.kronik === 'EVET' || c.engel === 'EVET' || c.bakim === 'EVET' || c.diger === 'EVET') return 'DEGERLENDIRME';
  return 'UYGUN';
}

const beyanEkle = db.prepare(`
  INSERT INTO declarations (user_id, yil, ay, gebelik, cocuk, kronik, engel, bakim, izin, diger, aciklama, degisiklik_yok, uygunluk, created_at, updated_at)
  VALUES (@user_id, @yil, @ay, @gebelik, @cocuk, @kronik, @engel, @bakim, @izin, @diger, @aciklama, @degisiklik_yok, @uygunluk, @tarih, @tarih)
  ON CONFLICT(user_id, yil, ay) DO NOTHING
`);

function beyanUret(userId, yil, ay, gun) {
  const c = {
    gebelik: rasgele() < 0.06 ? 'EVET' : rasgele() < 0.5 ? 'HAYIR' : 'UYGULANAMAZ',
    cocuk: rasgele() < 0.15 ? 'EVET' : 'HAYIR',
    kronik: rasgele() < 0.1 ? 'EVET' : 'HAYIR',
    engel: rasgele() < 0.04 ? 'EVET' : 'HAYIR',
    bakim: rasgele() < 0.08 ? 'EVET' : 'HAYIR',
    izin: rasgele() < 0.07 ? 'EVET' : 'HAYIR',
    diger: rasgele() < 0.05 ? 'EVET' : 'HAYIR',
  };
  const tarih = `${yil}-${String(ay).padStart(2, '0')}-${String(gun).padStart(2, '0')} 09:00:00`;
  beyanEkle.run({
    user_id: userId, yil, ay, ...c,
    aciklama: null, degisiklik_yok: 0,
    uygunluk: uygunlukHesapla(c), tarih,
  });
  return c;
}

// Önceki ay: personelin ~%90'ı beyan verdi
let oncekiBeyan = 0;
for (const p of personeller) {
  if (rasgele() < 0.9) {
    beyanUret(p.id, oncekiYil, oncekiAy, 1 + Math.floor(rasgele() * 9));
    oncekiBeyan++;
  }
}
// Bu ay: ~%30'u şimdiden beyan verdi (ayın başındayız)
let buAyBeyan = 0;
const buAyGun = Math.max(1, simdi.getDate() - 1);
for (const p of personeller) {
  if (rasgele() < 0.3) {
    beyanUret(p.id, buYil, buAy, 1 + Math.floor(rasgele() * buAyGun));
    buAyBeyan++;
  }
}
console.log(`Beyanlar: önceki ay ${oncekiBeyan}, bu ay ${buAyBeyan}.`);

// --- Önceki aya ait onaylanmış örnek görevlendirme ---
const varMi = db.prepare('SELECT id FROM assignments WHERE yil = ? AND ay = ?').get(oncekiYil, oncekiAy);
if (!varMi) {
  const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  const onayTarihi = `${oncekiYil}-${String(oncekiAy).padStart(2, '0')}-12 14:00:00`;
  const g = db.prepare(
    "INSERT INTO assignments (yil, ay, baslik, durum, created_by, created_at, onay_at) VALUES (?, ?, ?, 'ONAYLANDI', 1, ?, ?)"
  ).run(oncekiYil, oncekiAy, `${AYLAR[oncekiAy - 1]} ${oncekiYil} Deprem Görevlendirmesi`, onayTarihi, onayTarihi);
  const gorevId = g.lastInsertRowid;

  const uygunlar = db.prepare(
    "SELECT u.id, u.unvan FROM users u JOIN declarations d ON d.user_id = u.id AND d.yil = ? AND d.ay = ? WHERE d.uygunluk = 'UYGUN' AND u.rol = 'PERSONEL'"
  ).all(oncekiYil, oncekiAy);
  const hekimler = uygunlar.filter((u) => u.unvan === 'AILE_HEKIMI').slice(0, 6);
  const asclar = uygunlar.filter((u) => u.unvan === 'AILE_SAGLIGI_CALISANI').slice(0, 6);
  const uyeEkle = db.prepare('INSERT INTO assignment_members (assignment_id, user_id, tip, unvan, manuel, sira) VALUES (?, ?, ?, ?, 0, ?)');
  hekimler.slice(0, 4).forEach((u, i) => uyeEkle.run(gorevId, u.id, 'ASIL', u.unvan, i + 1));
  asclar.slice(0, 4).forEach((u, i) => uyeEkle.run(gorevId, u.id, 'ASIL', u.unvan, i + 1));
  hekimler.slice(4, 6).forEach((u, i) => uyeEkle.run(gorevId, u.id, 'YEDEK', u.unvan, i + 1));
  asclar.slice(4, 6).forEach((u, i) => uyeEkle.run(gorevId, u.id, 'YEDEK', u.unvan, i + 1));
  console.log(`Önceki ay için onaylanmış örnek görevlendirme oluşturuldu (#${gorevId}).`);
}

console.log('');
console.log('=== DEMO HESAPLAR ===');
console.log('İl Yöneticisi   : TC 11111111111 (veya sicil Y0001) / şifre: admin123');
console.log('İlçe Yöneticisi : TC 22222222222 (veya sicil Y0002) / şifre: ilce123  (yalnızca Haliliye)');
console.log('Aile Hekimi     : TC 10000000001 (veya sicil S1001) / şifre: demo123');
console.log('ASÇ             : TC 10000000002 (veya sicil S2001) / şifre: demo123');
console.log('');
console.log('Seed tamamlandı.');
