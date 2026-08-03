import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'uygulama.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  // Şema, seed betiğiyle ortak kullanılan schema.sql dosyasından yüklenir
  _db.exec(fs.readFileSync(path.join(process.cwd(), 'schema.sql'), 'utf8'));
  return _db;
}

// ---- Ayarlar yardımcıları ----

export function getSetting(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row ? row.value : null;
}

export function setSetting(key: string, value: string) {
  getDb()
    .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, value);
}

export const KURUM_ADI = process.env.KURUM_ADI || 'T.C. Şanlıurfa Valiliği İl Sağlık Müdürlüğü';

export const AYLAR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

export function ayAdi(ay: number): string {
  return AYLAR[ay - 1] || String(ay);
}

export function maskTc(tc: string | null | undefined): string {
  if (!tc || tc.length < 5) return tc || '';
  return tc.slice(0, 3) + '*'.repeat(tc.length - 5) + tc.slice(-2);
}

export function unvanAdi(unvan: string | null | undefined): string {
  if (unvan === 'AILE_HEKIMI') return 'Aile Hekimi';
  if (unvan === 'AILE_SAGLIGI_CALISANI') return 'Aile Sağlığı Çalışanı';
  return unvan || '';
}

// Beyan dönemi penceresi: ay bazında ayarlanabilir, yoksa varsayılan 1..31
export function getBeyanPenceresi(yil: number, ay: number): { baslangicGun: number; bitisGun: number } {
  const ozel = getSetting(`beyan_penceresi_${yil}_${ay}`);
  if (ozel) {
    try {
      const p = JSON.parse(ozel);
      return { baslangicGun: p.baslangicGun ?? 1, bitisGun: p.bitisGun ?? 31 };
    } catch {}
  }
  const genel = getSetting('beyan_penceresi_varsayilan');
  if (genel) {
    try {
      const p = JSON.parse(genel);
      return { baslangicGun: p.baslangicGun ?? 1, bitisGun: p.bitisGun ?? 31 };
    } catch {}
  }
  return { baslangicGun: 1, bitisGun: 31 };
}
