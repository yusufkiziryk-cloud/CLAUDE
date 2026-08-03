'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Shell from '@/components/Shell';
import { Yukleniyor, HataKutusu, UygunlukRozeti } from '@/components/ui';

interface Beyan {
  gebelik: string; cocuk: string; kronik: string; engel: string;
  bakim: string; izin: string; diger: string; aciklama: string | null;
}

const SORULAR: { alan: keyof Omit<Beyan, 'aciklama'>; soru: string; secenekler: [string, string][] }[] = [
  { alan: 'gebelik', soru: '1. Gebelik durumunuz var mı?', secenekler: [['EVET', 'Evet'], ['HAYIR', 'Hayır'], ['UYGULANAMAZ', 'Uygulanamaz']] },
  { alan: 'cocuk', soru: '2. Belirlenen yaş aralığında çocuğunuz var mı?', secenekler: [['EVET', 'Evet'], ['HAYIR', 'Hayır']] },
  { alan: 'kronik', soru: '3. Afet görevlendirmesine engel olabilecek kronik hastalığınız var mı?', secenekler: [['EVET', 'Evet'], ['HAYIR', 'Hayır']] },
  { alan: 'engel', soru: '4. Engellilik veya hareket kısıtlılığı durumunuz var mı?', secenekler: [['EVET', 'Evet'], ['HAYIR', 'Hayır']] },
  { alan: 'bakim', soru: '5. Sürekli bakım vermek zorunda olduğunuz bir kişi var mı?', secenekler: [['EVET', 'Evet'], ['HAYIR', 'Hayır']] },
  { alan: 'izin', soru: '6. Aktif rapor, izin veya geçici görevlendirme durumunuz var mı?', secenekler: [['EVET', 'Evet'], ['HAYIR', 'Hayır']] },
  { alan: 'diger', soru: '7. Görevlendirmeye engel olabilecek başka bir durumunuz var mı?', secenekler: [['EVET', 'Evet'], ['HAYIR', 'Hayır']] },
];

const BOS: Beyan = { gebelik: 'UYGULANAMAZ', cocuk: 'HAYIR', kronik: 'HAYIR', engel: 'HAYIR', bakim: 'HAYIR', izin: 'HAYIR', diger: 'HAYIR', aciklama: '' };

function BeyanIcerik() {
  const router = useRouter();
  const params = useSearchParams();
  const mod = params.get('mod'); // 'ayni' → hızlı onay, 'degisti' → form

  const [yukleniyor, setYukleniyor] = useState(true);
  const [donem, setDonem] = useState<{ yil: number; ay: number; ayAdi: string } | null>(null);
  const [oncekiVar, setOncekiVar] = useState(false);
  const [form, setForm] = useState<Beyan>(BOS);
  const [onay, setOnay] = useState(false);
  const [hata, setHata] = useState('');
  const [bekliyor, setBekliyor] = useState(false);
  const [sonuc, setSonuc] = useState<string | null>(null);
  const [hizliMod, setHizliMod] = useState(mod === 'ayni');

  useEffect(() => {
    fetch('/api/beyan')
      .then((r) => r.json())
      .then((j) => {
        setDonem(j.donem);
        // Önceki (veya bu ayki) beyan formda hazır gelsin
        const kaynak = j.buAy || j.onceki;
        if (kaynak) {
          setForm({
            gebelik: kaynak.gebelik, cocuk: kaynak.cocuk, kronik: kaynak.kronik, engel: kaynak.engel,
            bakim: kaynak.bakim, izin: kaynak.izin, diger: kaynak.diger, aciklama: kaynak.aciklama || '',
          });
        }
        setOncekiVar(!!j.onceki || !!j.buAy);
        // Önceki beyan yoksa hızlı onay kullanılamaz
        if (mod === 'ayni' && !j.onceki && !j.buAy) setHizliMod(false);
        setYukleniyor(false);
      });
  }, [mod]);

  const kaydet = async () => {
    setHata('');
    if (!onay) { setHata('Lütfen beyan onay kutusunu işaretleyin.'); return; }
    setBekliyor(true);
    try {
      const govde = hizliMod
        ? { degisiklikYok: true, onay: true }
        : { ...form, onay: true };
      const r = await fetch('/api/beyan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(govde),
      });
      const j = await r.json();
      if (!r.ok) { setHata(j.hata || 'Beyan kaydedilemedi.'); return; }
      setSonuc(j.uygunluk);
    } finally {
      setBekliyor(false);
    }
  };

  if (yukleniyor) return <Yukleniyor />;

  if (sonuc) {
    return (
      <div className="kart text-center py-10">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-xl font-bold mb-2">Beyanınız Kaydedildi</h2>
        <p className="text-slate-500 mb-4">{donem?.ayAdi} {donem?.yil} dönemi durum beyanınız alınmıştır.</p>
        <div className="mb-6"><UygunlukRozeti durum={sonuc} /></div>
        <button className="btn-primary" onClick={() => router.push('/panel')}>Ana Ekrana Dön</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="kart">
        <h2 className="font-bold text-lg">{donem?.ayAdi} {donem?.yil} Durum Beyanı</h2>
        {oncekiVar && (
          <div className="grid sm:grid-cols-2 gap-2 mt-3">
            <button
              className={hizliMod ? 'btn-success' : 'btn-ghost'}
              onClick={() => setHizliMod(true)}
            >
              Geçen aya göre değişiklik yok
            </button>
            <button
              className={!hizliMod ? 'btn-warning' : 'btn-ghost'}
              onClick={() => setHizliMod(false)}
            >
              Durumumda değişiklik var
            </button>
          </div>
        )}
      </div>

      {hizliMod ? (
        <div className="kart">
          <p className="text-sm text-slate-600 mb-2">
            Önceki döneme ait cevaplarınız aynen bu aya aktarılacaktır. Mevcut cevaplarınız aşağıdadır:
          </p>
          <ul className="text-sm bg-slate-50 rounded-lg p-3 space-y-1 mb-2">
            {SORULAR.map((s) => (
              <li key={s.alan} className="flex justify-between gap-2">
                <span className="text-slate-500">{s.soru.replace(/^\d+\.\s/, '')}</span>
                <b>{s.secenekler.find((x) => x[0] === form[s.alan])?.[1] || form[s.alan]}</b>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="kart space-y-5">
          {SORULAR.map((s) => (
            <div key={s.alan}>
              <p className="font-medium mb-2">{s.soru}</p>
              <div className="flex flex-wrap gap-2">
                {s.secenekler.map(([deger, ad]) => (
                  <button
                    key={deger}
                    type="button"
                    onClick={() => setForm({ ...form, [s.alan]: deger })}
                    className={`px-5 py-2.5 rounded-lg border text-sm font-semibold transition ${
                      form[s.alan] === deger
                        ? deger === 'EVET'
                          ? 'bg-orange-500 border-orange-500 text-white'
                          : 'bg-kurum border-kurum text-white'
                        : 'bg-white border-slate-300 text-slate-600 hover:border-kurum'
                    }`}
                  >
                    {ad}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div>
            <p className="font-medium mb-2">8. Açıklama (isteğe bağlı, en fazla 300 karakter)</p>
            <textarea
              className="girdi" rows={3} maxLength={300}
              placeholder="Sağlık tanısı veya ilaç bilgisi yazmayınız; yalnızca görevlendirmeyi etkileyen genel durumu belirtiniz."
              value={form.aciklama || ''}
              onChange={(e) => setForm({ ...form, aciklama: e.target.value })}
            />
            <p className="text-xs text-slate-400 text-right">{(form.aciklama || '').length}/300</p>
          </div>
        </div>
      )}

      <div className="kart">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox" checked={onay} onChange={(e) => setOnay(e.target.checked)}
            className="mt-1 h-5 w-5 rounded border-slate-300 text-kurum focus:ring-kurum"
          />
          <span className="text-sm font-medium">
            9. Verdiğim bilgilerin güncel ve doğru olduğunu beyan ederim. <span className="text-red-500">*</span>
          </span>
        </label>
        <div className="mt-4 space-y-3">
          <HataKutusu mesaj={hata} />
          <button className="btn-primary w-full text-lg !py-4" onClick={kaydet} disabled={bekliyor}>
            {bekliyor ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BeyanSayfasi() {
  return (
    <Shell tur="personel" baslik="Aylık Durum Beyanı">
      <Suspense fallback={<Yukleniyor />}>
        <BeyanIcerik />
      </Suspense>
    </Shell>
  );
}
