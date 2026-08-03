'use client';

import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { Yukleniyor, tarihGoster } from '@/components/ui';

interface Gorev { donem: string; baslik: string; onayTarihi: string; tip: string }

export default function GorevlendirmeDurumum() {
  const [gorevler, setGorevler] = useState<Gorev[] | null>(null);

  useEffect(() => {
    fetch('/api/personel/gorevlendirme').then((r) => r.json()).then((j) => setGorevler(j.gorevler || []));
  }, []);

  return (
    <Shell tur="personel" baslik="Görevlendirme Durumum">
      {!gorevler ? (
        <Yukleniyor />
      ) : gorevler.length === 0 ? (
        <div className="kart text-center text-slate-500 py-10">
          Onaylanmış bir görevlendirme listesinde yer almıyorsunuz.
        </div>
      ) : (
        <div className="space-y-3">
          {gorevler.map((g, i) => (
            <div key={i} className="kart flex items-center justify-between gap-3">
              <div>
                <div className="font-bold">{g.baslik}</div>
                <div className="text-xs text-slate-400">Onay: {tarihGoster(g.onayTarihi)}</div>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${g.tip === 'Asıl' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'}`}>
                {g.tip}
              </span>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
