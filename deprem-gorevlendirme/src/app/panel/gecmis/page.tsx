'use client';

import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { Yukleniyor, UygunlukRozeti, tarihGoster } from '@/components/ui';

interface BeyanKaydi {
  id: number; donem: string; uygunluk: string; degisiklik_yok: number; updated_at: string;
  gebelik: string; cocuk: string; kronik: string; engel: string; bakim: string; izin: string; diger: string;
  aciklama: string | null;
}

const ALANLAR: [keyof BeyanKaydi, string][] = [
  ['gebelik', 'Gebelik'], ['cocuk', 'Yaş aralığında çocuk'], ['kronik', 'Kronik hastalık'],
  ['engel', 'Engellilik / hareket kısıtı'], ['bakim', 'Bakım yükümlülüğü'],
  ['izin', 'Rapor / izin / geçici görev'], ['diger', 'Diğer engel'],
];

function cevapGoster(v: string) {
  if (v === 'EVET') return <b className="text-orange-600">Evet</b>;
  if (v === 'UYGULANAMAZ') return <span className="text-slate-400">Uygulanamaz</span>;
  return <span>Hayır</span>;
}

export default function GecmisBeyanlar() {
  const [beyanlar, setBeyanlar] = useState<BeyanKaydi[] | null>(null);
  const [acik, setAcik] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/beyan/gecmis').then((r) => r.json()).then((j) => setBeyanlar(j.beyanlar || []));
  }, []);

  return (
    <Shell tur="personel" baslik="Geçmiş Beyanlarım">
      {!beyanlar ? (
        <Yukleniyor />
      ) : beyanlar.length === 0 ? (
        <div className="kart text-center text-slate-500 py-10">Henüz beyanınız bulunmuyor.</div>
      ) : (
        <div className="space-y-3">
          {beyanlar.map((b) => (
            <div key={b.id} className="kart">
              <button className="w-full flex items-center justify-between gap-3 text-left" onClick={() => setAcik(acik === b.id ? null : b.id)}>
                <div>
                  <div className="font-bold">{b.donem}</div>
                  <div className="text-xs text-slate-400">
                    {tarihGoster(b.updated_at)} {b.degisiklik_yok ? '— "Değişiklik yok" ile onaylandı' : ''}
                  </div>
                </div>
                <UygunlukRozeti durum={b.uygunluk} />
              </button>
              {acik === b.id && (
                <div className="mt-3 pt-3 border-t border-slate-100 text-sm space-y-1.5">
                  {ALANLAR.map(([alan, ad]) => (
                    <div key={alan} className="flex justify-between">
                      <span className="text-slate-500">{ad}</span>
                      {cevapGoster(String(b[alan]))}
                    </div>
                  ))}
                  {b.aciklama && (
                    <div className="pt-2">
                      <span className="text-slate-500">Açıklama: </span>{b.aciklama}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
