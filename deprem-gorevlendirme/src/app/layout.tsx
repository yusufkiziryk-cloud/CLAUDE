import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Deprem Görevlendirme Sistemi | Şanlıurfa İl Sağlık Müdürlüğü',
  description: 'Aile hekimliği personeli deprem görevlendirme uygunluk takip sistemi',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
