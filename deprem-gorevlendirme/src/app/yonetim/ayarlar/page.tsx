'use client';

import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { Yukleniyor, HataKutusu, BasariKutusu, DonemSecici } from '@/components/ui';

type Etki = 'ETKISIZ' | 'DEGERLENDIRME' | 'UYGUN_DEGIL' | 'IZINLI';
type Kurallar = Record<string, Etki>;

const ALAN_ADLARI: Record<string, string> = {
  gebelik: 'Gebelik durumu "Evet" ise',
  cocuk: 'Belirlenen yaş aralığında çocuk "Evet" ise',
  kronik: 'Kronik hastalık "Evet" ise',
  engel: 'Engellilik / hareket kısıtlılığı "Evet" ise',
  bakim: 'Sürekli bakım yükümlülüğü "Evet" ise',
  izin: 'Aktif rapor / izin "Evet" ise',
  diger: 'Diğer engel durumu "Evet" ise',
};

const ETKI_ADLARI: Record<Etki, string> = {
  ETKISIZ: 'Uygunluğu etkilemesin',
  DEGERLENDIRME: 'Yönetici değerlendirmesi gereksin',
  UYGUN_DEGIL: 'Görevlendirmeye uygun olmasın',
  IZINLI: 'İzinli / raporlu sayılsın',
};

export default function AyarlarSayfasi() {
  const simdi = new Date();
  const [kurallar, setKurallar] = useState<Kurallar | null>(null);
  const [hatirlatma, setHatirlatma] = useState('');
  const [pencereBas, setPencereBas] = useState(1);
  const [pencereBit, setPencereBit] = useState(31);
  const [pencereYil, setPencereYil] = useState(simdi.getFullYear());
  const [pencereAy, setPencereAy] = useState(simdi.getMonth() + 1);
  const [varsayilanMi, setVarsayilanMi] = useState(true);
  const [hata, setHata] = useState('');
  const [mesaj, setMesaj] = useState('');
  const [bekliyor, setBekliyor] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/ayarlar?yil=${pencereYil}&ay=${pencereAy}`)
      .then((r) => r.json())
      .then((j) => {
        if (!kurallar) setKurallar(j.kurallar);
        if (!hatirlatma) setHatirlatma(j.hatirlatmaMetni || '');
        setPencereBas(j.beyanPenceresi?.baslangicGun ?? 1);
        setPencereBit(j.beyanPenceresi?.bitisGun ?? 31);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pencereYil, pencereAy]);

  const kaydet = async (govde: Record<string, unknown>, basari: string) => {
    setHata(''); setMesaj(''); setBekliyor(true);
    try {
      const r = await fetch('/api/admin/ayarlar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(govde),
      });
      const j = await r.json();
      if (!r.ok) { setHata(j.hata || 'Kaydedilemedi.'); return; }
      setMesaj(basari);
    } finally {
      setBekliyor(false);
    }
  };

  if (!kurallar) return <Shell tur="yonetici" baslik="Ayarlar"><Yukleniyor /></Shell>;

  return (
    <Shell tur="yonetici" baslik="Ayarlar">
      <div className="max-w-3xl space-y-4">
        <HataKutusu mesaj={hata} />
        <BasariKutusu mesaj={mesaj} />

        <div className="kart space-y-3">
          <h3 className="font-bold">Otomatik Uygunluk Kuralları</h3>
          <p className="text-sm text-slate-500">
            Her sorunun &quot;Evet&quot; cevabının uygunluk sonucuna etkisini belirleyin. En ağır etki geçerli olur.
          </p>
          {Object.keys(ALAN_ADLARI).map((alan) => (
            <div key={alan} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <span className="text-sm font-medium">{ALAN_ADLARI[alan]}</span>
              <select
                className="girdi !w-auto text-sm"
                value={kurallar[alan]}
                onChange={(e) => setKurallar({ ...kurallar, [alan]: e.target.value as Etki })}
              >
                {(Object.keys(ETKI_ADLARI) as Etki[]).map((k) => (
                  <option key={k} value={k}>{ETKI_ADLARI[k]}</option>
                ))}
              </select>
            </div>
          ))}
          <button className="btn-primary" onClick={() => kaydet({ kurallar }, 'Uygunluk kuralları kaydedildi. Yeni beyanlar bu kurallara göre değerlendirilecek.')} disabled={bekliyor}>
            Kuralları Kaydet
          </button>
        </div>

        <div className="kart space-y-3">
          <h3 className="font-bold">Beyan Dönemi (Başlangıç / Bitiş)</h3>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={varsayilanMi} onChange={(e) => setVarsayilanMi(e.target.checked)} className="h-4 w-4 rounded text-kurum" />
            Tüm aylar için varsayılan pencereyi ayarla
          </label>
          {!varsayilanMi && (
            <DonemSecici yil={pencereYil} ay={pencereAy} onChange={(y, a) => { setPencereYil(y); setPencereAy(a); }} />
          )}
          <div className="flex items-center gap-3 text-sm">
            <span>Ayın</span>
            <input type="number" min={1} max={31} className="girdi !w-20" value={pencereBas} onChange={(e) => setPencereBas(Number(e.target.value))} />
            <span>. gününden</span>
            <input type="number" min={1} max={31} className="girdi !w-20" value={pencereBit} onChange={(e) => setPencereBit(Number(e.target.value))} />
            <span>. gününe kadar beyan verilebilir.</span>
          </div>
          <button
            className="btn-primary"
            onClick={() =>
              kaydet(
                { beyanPenceresi: varsayilanMi ? { baslangicGun: pencereBas, bitisGun: pencereBit } : { baslangicGun: pencereBas, bitisGun: pencereBit, yil: pencereYil, ay: pencereAy } },
                'Beyan dönemi kaydedildi.'
              )
            }
            disabled={bekliyor}
          >
            Beyan Dönemini Kaydet
          </button>
        </div>

        <div className="kart space-y-3">
          <h3 className="font-bold">Hazır Hatırlatma Metni</h3>
          <textarea className="girdi text-sm" rows={4} value={hatirlatma} onChange={(e) => setHatirlatma(e.target.value)} maxLength={500} />
          <button className="btn-primary" onClick={() => kaydet({ hatirlatmaMetni: hatirlatma }, 'Hatırlatma metni kaydedildi.')} disabled={bekliyor}>
            Metni Kaydet
          </button>
        </div>
      </div>
    </Shell>
  );
}
