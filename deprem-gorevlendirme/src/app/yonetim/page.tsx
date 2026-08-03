'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Shell from '@/components/Shell';
import { Yukleniyor, DonemSecici } from '@/components/ui';

interface Kartlar {
  toplam: number; beyanVeren: number; beyanVermeyen: number; uygun: number;
  uygunDegil: number; degerlendirme: number; izinli: number; gorevlendirilen: number; yedek: number;
}

const KART_TANIMLARI: { alan: keyof Kartlar; ad: string; renk: string; link?: string }[] = [
  { alan: 'toplam', ad: 'Toplam Personel', renk: 'border-slate-300', link: '/yonetim/personel' },
  { alan: 'beyanVeren', ad: 'Bu Ay Beyan Verenler', renk: 'border-green-400', link: '/yonetim/beyanlar' },
  { alan: 'beyanVermeyen', ad: 'Beyan Vermeyenler', renk: 'border-slate-400', link: '/yonetim/beyan-vermeyenler' },
  { alan: 'uygun', ad: 'Uygun Personel', renk: 'border-green-500', link: '/yonetim/uygun-havuz' },
  { alan: 'uygunDegil', ad: 'Uygun Olmayan', renk: 'border-red-400', link: '/yonetim/beyanlar' },
  { alan: 'degerlendirme', ad: 'Değerlendirme Bekleyen', renk: 'border-orange-400', link: '/yonetim/beyanlar' },
  { alan: 'izinli', ad: 'İzinli / Raporlu', renk: 'border-purple-400', link: '/yonetim/beyanlar' },
  { alan: 'gorevlendirilen', ad: 'Görevlendirilenler', renk: 'border-blue-500', link: '/yonetim/listeler' },
  { alan: 'yedek', ad: 'Yedek Personeller', renk: 'border-blue-300', link: '/yonetim/listeler' },
];

export default function YonetimDashboard() {
  const simdi = new Date();
  const [yil, setYil] = useState(simdi.getFullYear());
  const [ay, setAy] = useState(simdi.getMonth() + 1);
  const [kartlar, setKartlar] = useState<Kartlar | null>(null);

  useEffect(() => {
    setKartlar(null);
    fetch(`/api/admin/dashboard?yil=${yil}&ay=${ay}`)
      .then((r) => r.json())
      .then((j) => setKartlar(j.kartlar));
  }, [yil, ay]);

  return (
    <Shell tur="yonetici" baslik="Dashboard">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <DonemSecici yil={yil} ay={ay} onChange={(y, a) => { setYil(y); setAy(a); }} />
        <Link href="/yonetim/gorevlendirme" className="btn-primary">Otomatik Görevlendir →</Link>
      </div>

      {!kartlar ? (
        <Yukleniyor />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 gap-3">
          {KART_TANIMLARI.map((k) => (
            <Link key={k.alan} href={k.link || '#'} className={`kart border-l-4 ${k.renk} hover:shadow-md transition`}>
              <div className="text-3xl font-bold">{kartlar[k.alan]}</div>
              <div className="text-sm text-slate-500 mt-1">{k.ad}</div>
            </Link>
          ))}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3 mt-6">
        <Link href="/yonetim/ciktilar" className="btn-ghost !py-4">📄 Excel / Word / PDF Çıktıları</Link>
        <Link href="/yonetim/personel-yukle" className="btn-ghost !py-4">📥 Excel ile Personel Yükle</Link>
      </div>
    </Shell>
  );
}
