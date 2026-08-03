import { NextRequest, NextResponse } from 'next/server';
import { yoneticiOturum } from '@/lib/auth';
import { getSetting, setSetting, getBeyanPenceresi } from '@/lib/db';
import { getKurallar, saveKurallar, VARSAYILAN_KURALLAR, UygunlukKurallari, KuralEtkisi } from '@/lib/eligibility';
import { logla } from '@/lib/audit';
import { VARSAYILAN_HATIRLATMA } from '@/lib/messages';

export const dynamic = 'force-dynamic';

// Ayarları getir: uygunluk kuralları, beyan penceresi, hatırlatma metni
export async function GET(req: NextRequest) {
  const o = await yoneticiOturum();
  if (!o) return NextResponse.json({ hata: 'Yetkisiz.' }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  const simdi = new Date();
  const yil = Number(sp.get('yil')) || simdi.getFullYear();
  const ay = Number(sp.get('ay')) || simdi.getMonth() + 1;
  return NextResponse.json({
    kurallar: getKurallar(),
    varsayilanKurallar: VARSAYILAN_KURALLAR,
    beyanPenceresi: getBeyanPenceresi(yil, ay),
    hatirlatmaMetni: getSetting('hatirlatma_metni') || VARSAYILAN_HATIRLATMA,
  });
}

const GECERLI_ETKILER: KuralEtkisi[] = ['ETKISIZ', 'DEGERLENDIRME', 'UYGUN_DEGIL', 'IZINLI'];

// Ayarları kaydet (yalnızca il yöneticisi)
export async function POST(req: NextRequest) {
  const o = await yoneticiOturum();
  if (!o) return NextResponse.json({ hata: 'Yetkisiz.' }, { status: 403 });
  if (o.rol !== 'IL_YONETICI') {
    return NextResponse.json({ hata: 'Ayarları yalnızca il yöneticisi değiştirebilir.' }, { status: 403 });
  }
  const b = await req.json();

  if (b.kurallar) {
    const yeni: UygunlukKurallari = { ...VARSAYILAN_KURALLAR };
    for (const alan of Object.keys(VARSAYILAN_KURALLAR) as (keyof UygunlukKurallari)[]) {
      const deger = b.kurallar[alan];
      if (GECERLI_ETKILER.includes(deger)) yeni[alan] = deger;
    }
    saveKurallar(yeni);
    logla(o.uid, 'KURALLAR_GUNCELLENDI', JSON.stringify(yeni));
  }

  if (b.beyanPenceresi) {
    const bas = Math.min(31, Math.max(1, Number(b.beyanPenceresi.baslangicGun) || 1));
    const bit = Math.min(31, Math.max(bas, Number(b.beyanPenceresi.bitisGun) || 31));
    const deger = JSON.stringify({ baslangicGun: bas, bitisGun: bit });
    if (b.beyanPenceresi.yil && b.beyanPenceresi.ay) {
      setSetting(`beyan_penceresi_${Number(b.beyanPenceresi.yil)}_${Number(b.beyanPenceresi.ay)}`, deger);
    } else {
      setSetting('beyan_penceresi_varsayilan', deger);
    }
    logla(o.uid, 'BEYAN_PENCERESI_GUNCELLENDI', deger);
  }

  if (typeof b.hatirlatmaMetni === 'string' && b.hatirlatmaMetni.trim()) {
    setSetting('hatirlatma_metni', b.hatirlatmaMetni.trim().slice(0, 500));
    logla(o.uid, 'HATIRLATMA_METNI_GUNCELLENDI');
  }

  return NextResponse.json({ tamam: true });
}
