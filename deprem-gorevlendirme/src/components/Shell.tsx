'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

interface NavOgesi {
  href: string;
  ad: string;
}

const PERSONEL_NAV: NavOgesi[] = [
  { href: '/panel', ad: 'Ana Ekran' },
  { href: '/panel/beyan', ad: 'Bu Ayın Beyanı' },
  { href: '/panel/gecmis', ad: 'Geçmiş Beyanlarım' },
  { href: '/panel/gorevlendirme', ad: 'Görevlendirme Durumum' },
  { href: '/panel/profil', ad: 'Profilim' },
];

const YONETICI_NAV: NavOgesi[] = [
  { href: '/yonetim', ad: 'Dashboard' },
  { href: '/yonetim/personel', ad: 'Personel Listesi' },
  { href: '/yonetim/personel-yukle', ad: 'Excel Yükleme' },
  { href: '/yonetim/beyanlar', ad: 'Aylık Beyanlar' },
  { href: '/yonetim/beyan-vermeyenler', ad: 'Beyan Vermeyenler' },
  { href: '/yonetim/uygun-havuz', ad: 'Uygun Havuz' },
  { href: '/yonetim/gorevlendirme', ad: 'Otomatik Görevlendirme' },
  { href: '/yonetim/listeler', ad: 'Asıl / Yedek Listeler' },
  { href: '/yonetim/ciktilar', ad: 'Çıktılar' },
  { href: '/yonetim/ayarlar', ad: 'Ayarlar' },
];

export default function Shell({
  tur,
  baslik,
  children,
}: {
  tur: 'personel' | 'yonetici';
  baslik?: string;
  children: React.ReactNode;
}) {
  const yol = usePathname();
  const router = useRouter();
  const [menuAcik, setMenuAcik] = useState(false);
  const nav = tur === 'personel' ? PERSONEL_NAV : YONETICI_NAV;

  const cikis = async () => {
    await fetch('/api/auth/cikis', { method: 'POST' });
    router.push('/giris');
    router.refresh();
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-kurum text-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="lg:hidden p-1.5 rounded hover:bg-white/10"
              onClick={() => setMenuAcik(!menuAcik)}
              aria-label="Menü"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="min-w-0">
              <div className="font-bold text-sm sm:text-base truncate">Şanlıurfa İl Sağlık Müdürlüğü</div>
              <div className="text-xs text-blue-100 truncate">
                Deprem Görevlendirme Sistemi {tur === 'yonetici' ? '— Yönetici' : ''}
              </div>
            </div>
          </div>
          <button onClick={cikis} className="shrink-0 rounded-lg bg-white/10 hover:bg-white/20 px-3 py-1.5 text-sm font-medium">
            Çıkış
          </button>
        </div>
        {/* Mobil menü */}
        {menuAcik && (
          <nav className="lg:hidden border-t border-white/20 bg-kurum-koyu">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setMenuAcik(false)}
                className={`block px-4 py-3 text-sm border-b border-white/10 ${yol === n.href ? 'bg-white/15 font-semibold' : 'hover:bg-white/10'}`}
              >
                {n.ad}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-4 flex gap-4">
        {/* Masaüstü yan menü */}
        <nav className="hidden lg:block w-56 shrink-0">
          <div className="kart !p-2 sticky top-4">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`block rounded-lg px-3 py-2.5 text-sm mb-0.5 ${
                  yol === n.href ? 'bg-kurum text-white font-semibold' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {n.ad}
              </Link>
            ))}
          </div>
        </nav>

        <main className="flex-1 min-w-0">
          {baslik && <h1 className="text-xl font-bold text-slate-800 mb-4">{baslik}</h1>}
          {children}
        </main>
      </div>

      <footer className="text-center text-xs text-slate-400 py-4">
        Şanlıurfa İl Sağlık Müdürlüğü — Afet Görevlendirme Takip Sistemi
      </footer>
    </div>
  );
}
