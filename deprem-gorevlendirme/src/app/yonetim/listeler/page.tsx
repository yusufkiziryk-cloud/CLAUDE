'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Shell from '@/components/Shell';
import { Yukleniyor, tarihGoster } from '@/components/ui';

interface GorevOzet {
  id: number; yil: number; ay: number; baslik: string; durum: string;
  created_at: string; onay_at: string | null; asilSayisi: number; yedekSayisi: number;
}

export default function ListelerSayfasi() {
  const [gorevler, setGorevler] = useState<GorevOzet[] | null>(null);

  useEffect(() => {
    fetch('/api/admin/gorevlendirme').then((r) => r.json()).then((j) => setGorevler(j.gorevlendirmeler || []));
  }, []);

  return (
    <Shell tur="yonetici" baslik="Asıl ve Yedek Görevlendirme Listeleri">
      {!gorevler ? (
        <Yukleniyor />
      ) : gorevler.length === 0 ? (
        <div className="kart text-center py-10 text-slate-500">
          Henüz görevlendirme oluşturulmadı.
          <div className="mt-4">
            <Link href="/yonetim/gorevlendirme" className="btn-primary">Otomatik Görevlendir</Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {gorevler.map((g) => (
            <Link key={g.id} href={`/yonetim/listeler/${g.id}`} className="kart flex items-center justify-between gap-3 hover:shadow-md transition">
              <div>
                <div className="font-bold">{g.baslik}</div>
                <div className="text-xs text-slate-400">
                  Oluşturma: {tarihGoster(g.created_at)} — {g.asilSayisi} asıl, {g.yedekSayisi} yedek
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold whitespace-nowrap ${
                g.durum === 'ONAYLANDI' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
              }`}>
                {g.durum === 'ONAYLANDI' ? 'Onaylandı' : 'Taslak'}
              </span>
            </Link>
          ))}
        </div>
      )}
    </Shell>
  );
}
