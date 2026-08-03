'use client';

import Shell from '@/components/Shell';
import PersonelTablosu from '@/components/PersonelTablosu';

export default function AylikBeyanlarSayfasi() {
  return (
    <Shell tur="yonetici" baslik="Aylık Beyan Sonuçları">
      <PersonelTablosu sabitFiltre={{ beyan: 'VERDI' }} />
    </Shell>
  );
}
