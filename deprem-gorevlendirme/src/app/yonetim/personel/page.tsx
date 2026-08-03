'use client';

import Shell from '@/components/Shell';
import PersonelTablosu from '@/components/PersonelTablosu';

export default function PersonelListesiSayfasi() {
  return (
    <Shell tur="yonetici" baslik="Personel Listesi">
      <PersonelTablosu />
    </Shell>
  );
}
