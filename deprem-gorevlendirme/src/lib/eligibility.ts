import { getSetting, setSetting } from './db';

// Uygunluk sonuçları
export type Uygunluk = 'UYGUN' | 'UYGUN_DEGIL' | 'DEGERLENDIRME' | 'IZINLI';

// Her sorunun "EVET" cevabının etkisi. ETKISIZ = uygunluğu etkilemez.
export type KuralEtkisi = 'ETKISIZ' | 'DEGERLENDIRME' | 'UYGUN_DEGIL' | 'IZINLI';

export interface UygunlukKurallari {
  gebelik: KuralEtkisi;
  cocuk: KuralEtkisi;
  kronik: KuralEtkisi;
  engel: KuralEtkisi;
  bakim: KuralEtkisi;
  izin: KuralEtkisi;
  diger: KuralEtkisi;
}

export const VARSAYILAN_KURALLAR: UygunlukKurallari = {
  gebelik: 'UYGUN_DEGIL',
  cocuk: 'DEGERLENDIRME',
  kronik: 'DEGERLENDIRME',
  engel: 'DEGERLENDIRME',
  bakim: 'DEGERLENDIRME',
  izin: 'IZINLI',
  diger: 'DEGERLENDIRME',
};

export const KURAL_ALAN_ADLARI: Record<keyof UygunlukKurallari, string> = {
  gebelik: 'Gebelik durumu',
  cocuk: 'Belirlenen yaş aralığında çocuk',
  kronik: 'Görevlendirmeye engel kronik hastalık',
  engel: 'Engellilik / hareket kısıtlılığı',
  bakim: 'Sürekli bakım verme yükümlülüğü',
  izin: 'Aktif rapor / izin / geçici görevlendirme',
  diger: 'Diğer engel durumu',
};

export function getKurallar(): UygunlukKurallari {
  const raw = getSetting('uygunluk_kurallari');
  if (raw) {
    try {
      return { ...VARSAYILAN_KURALLAR, ...JSON.parse(raw) };
    } catch {}
  }
  return { ...VARSAYILAN_KURALLAR };
}

export function saveKurallar(kurallar: UygunlukKurallari) {
  setSetting('uygunluk_kurallari', JSON.stringify(kurallar));
}

export interface BeyanCevaplari {
  gebelik: string; // EVET | HAYIR | UYGULANAMAZ
  cocuk: string;
  kronik: string;
  engel: string;
  bakim: string;
  izin: string;
  diger: string;
}

const SIDDET: Record<Uygunluk, number> = {
  UYGUN: 0,
  DEGERLENDIRME: 1,
  UYGUN_DEGIL: 2,
  IZINLI: 3,
};

// Cevaplara göre otomatik uygunluk hesaplama
export function hesaplaUygunluk(cevaplar: BeyanCevaplari, kurallar?: UygunlukKurallari): Uygunluk {
  const k = kurallar || getKurallar();
  let sonuc: Uygunluk = 'UYGUN';
  (Object.keys(k) as (keyof UygunlukKurallari)[]).forEach((alan) => {
    if (cevaplar[alan] === 'EVET' && k[alan] !== 'ETKISIZ') {
      const etki = k[alan] as Uygunluk;
      if (SIDDET[etki] > SIDDET[sonuc]) sonuc = etki;
    }
  });
  return sonuc;
}

export const UYGUNLUK_ADLARI: Record<string, string> = {
  UYGUN: 'Görevlendirmeye Uygun',
  UYGUN_DEGIL: 'Görevlendirmeye Uygun Değil',
  DEGERLENDIRME: 'Yönetici Değerlendirmesi Gerekli',
  IZINLI: 'İzinli veya Raporlu',
  BEYAN_YOK: 'Bu Ay Beyan Vermedi',
};
