'use client';

import Shell from '@/components/Shell';
import PersonelTablosu from '@/components/PersonelTablosu';

export default function UygunHavuzSayfasi() {
  return (
    <Shell tur="yonetici" baslik="Görevlendirmeye Uygun Personel Havuzu">
      <PersonelTablosu sabitFiltre={{ uygunluk: 'UYGUN' }} />
    </Shell>
  );
}
