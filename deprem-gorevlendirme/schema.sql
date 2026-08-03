CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tc TEXT UNIQUE,
    sicil TEXT UNIQUE,
    ad TEXT NOT NULL,
    soyad TEXT NOT NULL,
    unvan TEXT,                -- AILE_HEKIMI | AILE_SAGLIGI_CALISANI (yöneticilerde boş olabilir)
    ilce TEXT,
    asm TEXT,
    birim TEXT,
    telefon TEXT,
    email TEXT,
    aktif INTEGER NOT NULL DEFAULT 1,
    rol TEXT NOT NULL DEFAULT 'PERSONEL',  -- PERSONEL | IL_YONETICI | ILCE_YONETICI
    password_hash TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS declarations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    yil INTEGER NOT NULL,
    ay INTEGER NOT NULL,
    gebelik TEXT NOT NULL DEFAULT 'UYGULANAMAZ',  -- EVET | HAYIR | UYGULANAMAZ
    cocuk TEXT NOT NULL DEFAULT 'HAYIR',          -- EVET | HAYIR
    kronik TEXT NOT NULL DEFAULT 'HAYIR',
    engel TEXT NOT NULL DEFAULT 'HAYIR',
    bakim TEXT NOT NULL DEFAULT 'HAYIR',
    izin TEXT NOT NULL DEFAULT 'HAYIR',
    diger TEXT NOT NULL DEFAULT 'HAYIR',
    aciklama TEXT,
    degisiklik_yok INTEGER NOT NULL DEFAULT 0,
    uygunluk TEXT NOT NULL DEFAULT 'UYGUN',       -- UYGUN | UYGUN_DEGIL | DEGERLENDIRME | IZINLI
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, yil, ay)
  );

  CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    yil INTEGER NOT NULL,
    ay INTEGER NOT NULL,
    baslik TEXT NOT NULL,
    durum TEXT NOT NULL DEFAULT 'TASLAK',   -- TASLAK | ONAYLANDI
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    onay_at TEXT
  );

  CREATE TABLE IF NOT EXISTS assignment_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tip TEXT NOT NULL,          -- ASIL | YEDEK
    unvan TEXT NOT NULL,        -- seçim anındaki unvan
    manuel INTEGER NOT NULL DEFAULT 0,
    sira INTEGER NOT NULL DEFAULT 0,
    UNIQUE(assignment_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    islem TEXT NOT NULL,
    detay TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sms_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telefon TEXT NOT NULL,
    kod TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sms_outbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telefon TEXT NOT NULL,
    mesaj TEXT NOT NULL,
    durum TEXT NOT NULL DEFAULT 'BEKLIYOR',  -- BEKLIYOR | GONDERILDI (gerçek SMS entegrasyonu için altyapı)
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS email_outbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    konu TEXT NOT NULL,
    mesaj TEXT NOT NULL,
    durum TEXT NOT NULL DEFAULT 'BEKLIYOR',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mesaj TEXT NOT NULL,
    tip TEXT NOT NULL DEFAULT 'BILGI',   -- BILGI | UYARI | BASARI
    okundu INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_decl_ay ON declarations(yil, ay);
  CREATE INDEX IF NOT EXISTS idx_decl_user ON declarations(user_id);
  CREATE INDEX IF NOT EXISTS idx_member_user ON assignment_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, okundu);
