import { NextRequest, NextResponse } from 'next/server';
import { oturumCoz, SESSION_COOKIE } from './lib/session';

// Rota koruması: personel sayfaları oturum, yönetim sayfaları yönetici rolü ister.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const oturum = token ? await oturumCoz(token) : null;

  const yoneticiMi = oturum && (oturum.rol === 'IL_YONETICI' || oturum.rol === 'ILCE_YONETICI');

  if (pathname.startsWith('/panel')) {
    if (!oturum) return NextResponse.redirect(new URL('/giris', req.url));
  }
  if (pathname.startsWith('/yonetim')) {
    if (!oturum) return NextResponse.redirect(new URL('/giris?yonetici=1', req.url));
    if (!yoneticiMi) return NextResponse.redirect(new URL('/panel', req.url));
  }
  if (pathname === '/giris' && oturum) {
    return NextResponse.redirect(new URL(yoneticiMi ? '/yonetim' : '/panel', req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/panel/:path*', '/yonetim/:path*', '/giris'],
};
