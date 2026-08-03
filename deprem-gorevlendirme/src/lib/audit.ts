import { getDb } from './db';

export function logla(userId: number | null, islem: string, detay?: string) {
  getDb()
    .prepare('INSERT INTO audit_log (user_id, islem, detay) VALUES (?, ?, ?)')
    .run(userId, islem, detay || null);
}

export function bildirimEkle(userId: number, mesaj: string, tip: 'BILGI' | 'UYARI' | 'BASARI' = 'BILGI') {
  getDb()
    .prepare('INSERT INTO notifications (user_id, mesaj, tip) VALUES (?, ?, ?)')
    .run(userId, mesaj, tip);
}
