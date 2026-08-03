'use client';

import { useCallback, useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { Yukleniyor, DonemSecici, BasariKutusu, HataKutusu } from '@/components/ui';

interface Vermeyen {
  id: number; ad: string; soyad: string; unvan: string | null;
  ilce: string | null; asm: string | null; telefon: string | null; email: string | null;
}

export default function BeyanVermeyenlerSayfasi() {
  const simdi = new Date();
  const [yil, setYil] = useState(simdi.getFullYear());
  const [ay, setAy] = useState(simdi.getMonth() + 1);
  const [veri, setVeri] = useState<{
    vermeyenler: Vermeyen[]; telefonListesi: string[]; epostaListesi: string[]; hatirlatmaMetni: string;
  } | null>(null);
  const [mesajMetni, setMesajMetni] = useState('');
  const [sonuc, setSonuc] = useState('');
  const [hata, setHata] = useState('');
  const [bekliyor, setBekliyor] = useState(false);

  const yukle = useCallback(() => {
    setVeri(null);
    fetch(`/api/admin/vermeyenler?yil=${yil}&ay=${ay}`)
      .then((r) => r.json())
      .then((j) => { setVeri(j); setMesajMetni(j.hatirlatmaMetni || ''); });
  }, [yil, ay]);

  useEffect(() => { yukle(); }, [yukle]);

  const kopyala = (metin: string, ad: string) => {
    navigator.clipboard.writeText(metin);
    setSonuc(`${ad} panoya kopyalandı.`);
    setTimeout(() => setSonuc(''), 2500);
  };

  const hatirlatmaGonder = async () => {
    setHata(''); setSonuc(''); setBekliyor(true);
    try {
      const r = await fetch('/api/admin/vermeyenler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yil, ay, mesaj: mesajMetni }),
      });
      const j = await r.json();
      if (!r.ok) { setHata(j.hata || 'Hatırlatma oluşturulamadı.'); return; }
      setSonuc(`Hatırlatma kuyruğa alındı: ${j.sms} SMS, ${j.eposta} e-posta, ${j.bildirim} sistem bildirimi. (Gerçek SMS/e-posta gönderimi entegrasyon sonrası yapılır.)`);
    } finally {
      setBekliyor(false);
    }
  };

  return (
    <Shell tur="yonetici" baslik="Beyan Vermeyenlerin Takibi">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <DonemSecici yil={yil} ay={ay} onChange={(y, a) => { setYil(y); setAy(a); }} />
        <a href={`/api/admin/export?format=excel&tur=beyan-vermeyenler&yil=${yil}&ay=${ay}`} className="btn-ghost">
          📊 Excel Listesi İndir
        </a>
      </div>

      {!veri ? (
        <Yukleniyor />
      ) : (
        <div className="space-y-4">
          <BasariKutusu mesaj={sonuc} />
          <HataKutusu mesaj={hata} />

          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 kart !p-0 overflow-x-auto">
              <table className="tablo">
                <thead>
                  <tr><th>#</th><th>Ad Soyad</th><th>Unvan</th><th>İlçe</th><th>ASM</th><th>Telefon</th><th>E-posta</th></tr>
                </thead>
                <tbody>
                  {veri.vermeyenler.length === 0 && (
                    <tr><td colSpan={7} className="text-center text-slate-400 py-8">Bu ay beyan vermeyen personel yok. 🎉</td></tr>
                  )}
                  {veri.vermeyenler.map((p, i) => (
                    <tr key={p.id}>
                      <td>{i + 1}</td>
                      <td className="font-medium whitespace-nowrap">{p.ad} {p.soyad}</td>
                      <td>{p.unvan === 'AILE_HEKIMI' ? 'Aile Hekimi' : 'ASÇ'}</td>
                      <td>{p.ilce}</td><td>{p.asm}</td>
                      <td className="whitespace-nowrap">{p.telefon}</td>
                      <td>{p.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-4">
              <div className="kart space-y-2">
                <h3 className="font-bold text-sm">Hızlı Listeler</h3>
                <button className="btn-ghost w-full !py-2 text-sm" onClick={() => kopyala(veri.telefonListesi.join('\n'), 'Telefon listesi')}>
                  📱 SMS Telefon Listesini Kopyala ({veri.telefonListesi.length})
                </button>
                <button className="btn-ghost w-full !py-2 text-sm" onClick={() => kopyala(veri.epostaListesi.join('; '), 'E-posta listesi')}>
                  ✉️ E-posta Listesini Kopyala ({veri.epostaListesi.length})
                </button>
              </div>

              <div className="kart space-y-3">
                <h3 className="font-bold text-sm">Toplu Hatırlatma</h3>
                <textarea className="girdi text-sm" rows={5} value={mesajMetni} onChange={(e) => setMesajMetni(e.target.value)} />
                <button className="btn-primary w-full" onClick={hatirlatmaGonder} disabled={bekliyor || veri.vermeyenler.length === 0}>
                  {bekliyor ? 'Oluşturuluyor...' : 'Hatırlatma Oluştur'}
                </button>
                <p className="text-xs text-slate-400">
                  Hatırlatmalar sistem bildirimine ve SMS/e-posta kuyruğuna yazılır. İlk sürümde gerçek SMS gönderimi yapılmaz; altyapı hazırdır.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
