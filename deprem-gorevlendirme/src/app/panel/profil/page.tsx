'use client';

import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { Yukleniyor } from '@/components/ui';

interface Kullanici {
  adSoyad: string; tcMaskeli: string; sicil: string | null; unvan: string;
  ilce: string | null; asm: string | null; birim: string | null; telefon: string | null; email: string | null;
}

export default function Profilim() {
  const [k, setK] = useState<Kullanici | null>(null);

  useEffect(() => {
    fetch('/api/personel/ozet').then((r) => r.json()).then((j) => setK(j.kullanici));
  }, []);

  const satirlar: [string, string | null][] = k
    ? [
        ['Ad Soyad', k.adSoyad],
        ['T.C. Kimlik No', k.tcMaskeli],
        ['Sicil No', k.sicil],
        ['Unvan', k.unvan],
        ['İlçe', k.ilce],
        ['Aile Sağlığı Merkezi', k.asm],
        ['Birim', k.birim],
        ['Telefon', k.telefon],
        ['E-posta', k.email],
      ]
    : [];

  return (
    <Shell tur="personel" baslik="Profilim">
      {!k ? (
        <Yukleniyor />
      ) : (
        <div className="kart divide-y divide-slate-100">
          {satirlar.map(([ad, deger]) => (
            <div key={ad} className="flex justify-between py-2.5 text-sm gap-4">
              <span className="text-slate-500">{ad}</span>
              <span className="font-medium text-right">{deger || '-'}</span>
            </div>
          ))}
          <p className="text-xs text-slate-400 pt-3">
            Bilgilerinizde hata varsa kurumunuzun personel birimine başvurun. Güvenlik gereği bu bilgiler ekrandan değiştirilemez.
          </p>
        </div>
      )}
    </Shell>
  );
}
