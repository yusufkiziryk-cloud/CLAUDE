'use client';

import { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { HataKutusu, BasariKutusu } from '@/components/ui';

type Sekme = 'sifre' | 'sms' | 'ilk';

function GirisIcerik() {
  const router = useRouter();
  const [sekme, setSekme] = useState<Sekme>('sifre');
  const [hata, setHata] = useState('');
  const [mesaj, setMesaj] = useState('');
  const [bekliyor, setBekliyor] = useState(false);

  // Şifreli giriş
  const [kimlik, setKimlik] = useState('');
  const [sifre, setSifre] = useState('');

  // SMS girişi
  const [telefon, setTelefon] = useState('');
  const [kod, setKod] = useState('');
  const [kodIstendi, setKodIstendi] = useState(false);
  const [demoKod, setDemoKod] = useState('');

  // İlk giriş
  const [ilkKimlik, setIlkKimlik] = useState('');
  const [ilkTelefon, setIlkTelefon] = useState('');
  const [yeniSifre, setYeniSifre] = useState('');
  const [yeniSifre2, setYeniSifre2] = useState('');

  const temizle = () => { setHata(''); setMesaj(''); };

  const girisYap = async (e: React.FormEvent) => {
    e.preventDefault();
    temizle(); setBekliyor(true);
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kimlik, sifre }),
      });
      const j = await r.json();
      if (!r.ok) {
        setHata(j.hata || 'Giriş yapılamadı.');
        if (j.ilkGiris) setSekme('ilk');
        return;
      }
      router.push(j.yonlendir);
      router.refresh();
    } finally {
      setBekliyor(false);
    }
  };

  const kodIste = async (e: React.FormEvent) => {
    e.preventDefault();
    temizle(); setBekliyor(true);
    try {
      const r = await fetch('/api/auth/sms-kod', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefon }),
      });
      const j = await r.json();
      if (!r.ok) { setHata(j.hata || 'Kod gönderilemedi.'); return; }
      setKodIstendi(true);
      setDemoKod(j.demoKod || '');
      setMesaj('Doğrulama kodu oluşturuldu. Telefonunuza gelen 6 haneli kodu girin.');
    } finally {
      setBekliyor(false);
    }
  };

  const kodDogrula = async (e: React.FormEvent) => {
    e.preventDefault();
    temizle(); setBekliyor(true);
    try {
      const r = await fetch('/api/auth/sms-dogrula', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefon, kod }),
      });
      const j = await r.json();
      if (!r.ok) { setHata(j.hata || 'Doğrulama başarısız.'); return; }
      router.push(j.yonlendir);
      router.refresh();
    } finally {
      setBekliyor(false);
    }
  };

  const ilkSifreOlustur = async (e: React.FormEvent) => {
    e.preventDefault();
    temizle();
    if (yeniSifre !== yeniSifre2) { setHata('Şifreler birbiriyle aynı değil.'); return; }
    setBekliyor(true);
    try {
      const r = await fetch('/api/auth/ilk-sifre', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kimlik: ilkKimlik, telefon: ilkTelefon, yeniSifre }),
      });
      const j = await r.json();
      if (!r.ok) { setHata(j.hata || 'Şifre oluşturulamadı.'); return; }
      setMesaj('Şifreniz oluşturuldu. Şimdi giriş yapabilirsiniz.');
      setKimlik(ilkKimlik);
      setSekme('sifre');
    } finally {
      setBekliyor(false);
    }
  };

  const sekmeSinifi = (s: Sekme) =>
    `flex-1 py-2.5 text-center text-sm font-semibold rounded-lg transition ${
      sekme === s ? 'bg-kurum text-white' : 'text-slate-600 hover:bg-slate-100'
    }`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-kurum to-kurum-koyu px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center text-white mb-6">
          <div className="mx-auto mb-3 h-16 w-16 rounded-full bg-white/15 flex items-center justify-center">
            <svg className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z" />
              <path strokeLinecap="round" d="M12 8v6M9 11h6" />
            </svg>
          </div>
          <h1 className="text-xl font-bold">Şanlıurfa İl Sağlık Müdürlüğü</h1>
          <p className="text-blue-100 text-sm mt-1">Deprem Görevlendirme Takip Sistemi</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-5">
          <div className="flex gap-1 bg-slate-50 rounded-xl p-1 mb-5">
            <button className={sekmeSinifi('sifre')} onClick={() => { setSekme('sifre'); temizle(); }}>Şifre ile</button>
            <button className={sekmeSinifi('sms')} onClick={() => { setSekme('sms'); temizle(); }}>SMS ile</button>
            <button className={sekmeSinifi('ilk')} onClick={() => { setSekme('ilk'); temizle(); }}>İlk Giriş</button>
          </div>

          <div className="space-y-3 mb-3">
            <HataKutusu mesaj={hata} />
            <BasariKutusu mesaj={mesaj} />
          </div>

          {sekme === 'sifre' && (
            <form onSubmit={girisYap} className="space-y-4">
              <div>
                <label className="etiket">T.C. Kimlik No veya Sicil No</label>
                <input className="girdi" value={kimlik} onChange={(e) => setKimlik(e.target.value)} autoComplete="username" required />
              </div>
              <div>
                <label className="etiket">Şifre</label>
                <input type="password" className="girdi" value={sifre} onChange={(e) => setSifre(e.target.value)} autoComplete="current-password" required />
              </div>
              <button className="btn-primary w-full" disabled={bekliyor}>
                {bekliyor ? 'Giriş yapılıyor...' : 'Giriş Yap'}
              </button>
            </form>
          )}

          {sekme === 'sms' && (
            <form onSubmit={kodIstendi ? kodDogrula : kodIste} className="space-y-4">
              <div>
                <label className="etiket">Telefon Numarası</label>
                <input
                  className="girdi" placeholder="05xx xxx xx xx" value={telefon}
                  onChange={(e) => setTelefon(e.target.value)} disabled={kodIstendi} inputMode="tel" required
                />
              </div>
              {kodIstendi && (
                <div>
                  <label className="etiket">Doğrulama Kodu</label>
                  <input
                    className="girdi text-center text-xl tracking-[0.5em]" maxLength={6} value={kod}
                    onChange={(e) => setKod(e.target.value.replace(/\D/g, ''))} inputMode="numeric" required
                  />
                  {demoKod && (
                    <p className="mt-2 text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded-lg p-2">
                      Demo modu: SMS entegrasyonu kapalı olduğu için kodunuz: <b className="text-base">{demoKod}</b>
                    </p>
                  )}
                </div>
              )}
              <button className="btn-primary w-full" disabled={bekliyor}>
                {bekliyor ? 'İşleniyor...' : kodIstendi ? 'Doğrula ve Giriş Yap' : 'Kod Gönder'}
              </button>
              {kodIstendi && (
                <button type="button" className="btn-ghost w-full" onClick={() => { setKodIstendi(false); setKod(''); setDemoKod(''); temizle(); }}>
                  Numarayı Değiştir
                </button>
              )}
            </form>
          )}

          {sekme === 'ilk' && (
            <form onSubmit={ilkSifreOlustur} className="space-y-4">
              <p className="text-xs text-slate-500">
                İlk kez giriş yapıyorsanız, kimlik ve telefon bilgilerinizle kendinize bir şifre oluşturun.
              </p>
              <div>
                <label className="etiket">T.C. Kimlik No veya Sicil No</label>
                <input className="girdi" value={ilkKimlik} onChange={(e) => setIlkKimlik(e.target.value)} required />
              </div>
              <div>
                <label className="etiket">Sistemde Kayıtlı Telefon Numaranız</label>
                <input className="girdi" placeholder="05xx xxx xx xx" value={ilkTelefon} onChange={(e) => setIlkTelefon(e.target.value)} inputMode="tel" required />
              </div>
              <div>
                <label className="etiket">Yeni Şifre (en az 6 karakter)</label>
                <input type="password" className="girdi" value={yeniSifre} onChange={(e) => setYeniSifre(e.target.value)} minLength={6} required />
              </div>
              <div>
                <label className="etiket">Yeni Şifre (tekrar)</label>
                <input type="password" className="girdi" value={yeniSifre2} onChange={(e) => setYeniSifre2(e.target.value)} minLength={6} required />
              </div>
              <button className="btn-primary w-full" disabled={bekliyor}>
                {bekliyor ? 'Oluşturuluyor...' : 'Şifre Oluştur'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-blue-100 text-xs mt-4">
          Sorun yaşarsanız kurumunuzun afet koordinasyon birimiyle iletişime geçin.
        </p>
      </div>
    </div>
  );
}

export default function GirisSayfasi() {
  return (
    <Suspense>
      <GirisIcerik />
    </Suspense>
  );
}
