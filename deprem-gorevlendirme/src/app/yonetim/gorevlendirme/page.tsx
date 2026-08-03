'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Shell from '@/components/Shell';
import { DonemSecici, HataKutusu } from '@/components/ui';

export default function OtomatikGorevlendirmeSayfasi() {
  const router = useRouter();
  const simdi = new Date();
  const [yil, setYil] = useState(simdi.getFullYear());
  const [ay, setAy] = useState(simdi.getMonth() + 1);
  const [asilHekim, setAsilHekim] = useState(5);
  const [asilAsc, setAsilAsc] = useState(5);
  const [yedekHekim, setYedekHekim] = useState(2);
  const [yedekAsc, setYedekAsc] = useState(2);
  const [asmLimit, setAsmLimit] = useState(2);
  const [ilceler, setIlceler] = useState<string[]>([]);
  const [tumIlceler, setTumIlceler] = useState<string[]>([]);
  const [hata, setHata] = useState('');
  const [uyarilar, setUyarilar] = useState<string[]>([]);
  const [bekliyor, setBekliyor] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/dashboard?yil=${yil}&ay=${ay}`)
      .then((r) => r.json())
      .then((j) => setTumIlceler(j.ilceler || []));
  }, [yil, ay]);

  const ilceDegistir = (ilce: string) => {
    setIlceler((eski) => (eski.includes(ilce) ? eski.filter((i) => i !== ilce) : [...eski, ilce]));
  };

  const calistir = async () => {
    setHata(''); setUyarilar([]); setBekliyor(true);
    try {
      const r = await fetch('/api/admin/gorevlendir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yil, ay, asilHekim, asilAsc, yedekHekim, yedekAsc, asmLimit, ilceler }),
      });
      const j = await r.json();
      if (!r.ok) { setHata(j.hata || 'Görevlendirme oluşturulamadı.'); return; }
      if (j.uyarilar?.length) setUyarilar(j.uyarilar);
      router.push(`/yonetim/listeler/${j.gorevId}`);
    } finally {
      setBekliyor(false);
    }
  };

  const SayiGirdi = ({ deger, setDeger, etiket }: { deger: number; setDeger: (n: number) => void; etiket: string }) => (
    <div>
      <label className="etiket">{etiket}</label>
      <input
        type="number" min={0} max={500} className="girdi"
        value={deger} onChange={(e) => setDeger(Math.max(0, Number(e.target.value)))}
      />
    </div>
  );

  return (
    <Shell tur="yonetici" baslik="Otomatik Görevlendirme">
      <div className="max-w-3xl space-y-4">
        <div className="kart space-y-4">
          <div>
            <label className="etiket">Görevlendirme Dönemi</label>
            <DonemSecici yil={yil} ay={ay} onChange={(y, a) => { setYil(y); setAy(a); }} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SayiGirdi deger={asilHekim} setDeger={setAsilHekim} etiket="Asıl Aile Hekimi" />
            <SayiGirdi deger={asilAsc} setDeger={setAsilAsc} etiket="Asıl Aile Sağ. Çal." />
            <SayiGirdi deger={yedekHekim} setDeger={setYedekHekim} etiket="Yedek Aile Hekimi" />
            <SayiGirdi deger={yedekAsc} setDeger={setYedekAsc} etiket="Yedek Aile Sağ. Çal." />
          </div>

          <div>
            <label className="etiket">Aynı ASM&apos;den en fazla kaç kişi seçilsin?</label>
            <input type="number" min={1} max={20} className="girdi !w-32" value={asmLimit} onChange={(e) => setAsmLimit(Math.max(1, Number(e.target.value)))} />
          </div>

          <div>
            <label className="etiket">Hangi ilçelerden seçim yapılsın? (boş bırakılırsa tüm ilçeler)</label>
            <div className="flex flex-wrap gap-2">
              {tumIlceler.map((i) => (
                <button
                  key={i} type="button" onClick={() => ilceDegistir(i)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                    ilceler.includes(i) ? 'bg-kurum text-white border-kurum' : 'bg-white text-slate-600 border-slate-300 hover:border-kurum'
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="kart bg-blue-50/50">
          <h3 className="font-bold text-sm mb-2">Seçim Kuralları</h3>
          <ul className="text-sm text-slate-600 list-disc ml-5 space-y-1">
            <li>Yalnızca <b>&quot;Görevlendirmeye Uygun&quot;</b> durumundaki personel arasından seçim yapılır.</li>
            <li>Daha az görevlendirilmiş ve son görevlendirmesi daha eski olanlara öncelik verilir.</li>
            <li>Önceki ay görevlendirilenler (havuz yeterliyse) tekrar seçilmez.</li>
            <li>Aynı ASM&apos;den en fazla belirlenen sayıda kişi, ilçeler arasında dengeli dağılımla seçilir.</li>
            <li>Sonuç <b>taslak</b> olarak oluşur; önizlemede düzenleyip onaylayabilirsiniz.</li>
          </ul>
        </div>

        <HataKutusu mesaj={hata} />
        {uyarilar.map((u, i) => (
          <div key={i} className="rounded-lg bg-orange-50 border border-orange-300 text-orange-800 px-4 py-2 text-sm">{u}</div>
        ))}

        <button className="btn-primary w-full text-lg !py-5" onClick={calistir} disabled={bekliyor}>
          {bekliyor ? 'Seçim yapılıyor...' : '⚡ Otomatik Görevlendir'}
        </button>
      </div>
    </Shell>
  );
}
