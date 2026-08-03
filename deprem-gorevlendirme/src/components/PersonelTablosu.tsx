'use client';

import { useCallback, useEffect, useState } from 'react';
import { Yukleniyor, UygunlukRozeti, DonemSecici } from '@/components/ui';

export interface PersonelSatir {
  id: number; tc: string; sicil: string | null; ad: string; soyad: string;
  unvan: string | null; ilce: string | null; asm: string | null; birim: string | null;
  telefon: string | null; beyanVerdi: boolean; uygunluk: string;
  toplamGorev: number; sonGorevTarih: string | null;
}

interface Sabitler { uygunluk?: string; beyan?: string }

// Filtreli personel tablosu: personel listesi, beyan sonuçları ve uygun havuz
// ekranlarında ortak kullanılır.
export default function PersonelTablosu({
  sabitFiltre = {},
  seciliDonem,
  onDonem,
  ekSutun,
}: {
  sabitFiltre?: Sabitler;
  seciliDonem?: { yil: number; ay: number };
  onDonem?: (yil: number, ay: number) => void;
  ekSutun?: (p: PersonelSatir) => React.ReactNode;
}) {
  const simdi = new Date();
  const [yil, setYil] = useState(seciliDonem?.yil || simdi.getFullYear());
  const [ay, setAy] = useState(seciliDonem?.ay || simdi.getMonth() + 1);
  const [ilce, setIlce] = useState('');
  const [asm, setAsm] = useState('');
  const [birim, setBirim] = useState('');
  const [unvan, setUnvan] = useState('');
  const [uygunluk, setUygunluk] = useState('');
  const [beyan, setBeyan] = useState('');
  const [gorev, setGorev] = useState('');
  const [arama, setArama] = useState('');
  const [secenekler, setSecenekler] = useState<{ ilceler: string[]; asmler: string[]; birimler: string[] }>({ ilceler: [], asmler: [], birimler: [] });
  const [veri, setVeri] = useState<PersonelSatir[] | null>(null);

  useEffect(() => {
    fetch(`/api/admin/dashboard?yil=${yil}&ay=${ay}`)
      .then((r) => r.json())
      .then((j) => setSecenekler({ ilceler: j.ilceler || [], asmler: j.asmler || [], birimler: j.birimler || [] }));
  }, [yil, ay]);

  const yukle = useCallback(() => {
    setVeri(null);
    const p = new URLSearchParams({ yil: String(yil), ay: String(ay) });
    if (ilce) p.set('ilce', ilce);
    if (asm) p.set('asm', asm);
    if (birim) p.set('birim', birim);
    if (unvan) p.set('unvan', unvan);
    if (sabitFiltre.uygunluk) p.set('uygunluk', sabitFiltre.uygunluk);
    else if (uygunluk) p.set('uygunluk', uygunluk);
    if (sabitFiltre.beyan) p.set('beyan', sabitFiltre.beyan);
    else if (beyan) p.set('beyan', beyan);
    if (gorev) p.set('gorev', gorev);
    if (arama) p.set('arama', arama);
    fetch(`/api/admin/personel?${p}`)
      .then((r) => r.json())
      .then((j) => setVeri(j.personel || []));
  }, [yil, ay, ilce, asm, birim, unvan, uygunluk, beyan, gorev, arama, sabitFiltre.uygunluk, sabitFiltre.beyan]);

  useEffect(() => { yukle(); }, [yukle]);

  return (
    <div className="space-y-4">
      <div className="kart">
        <div className="flex flex-wrap gap-2 items-end">
          <DonemSecici yil={yil} ay={ay} onChange={(y, a) => { setYil(y); setAy(a); onDonem?.(y, a); }} />
          <select className="girdi !w-auto" value={ilce} onChange={(e) => setIlce(e.target.value)}>
            <option value="">Tüm İlçeler</option>
            {secenekler.ilceler.map((i) => <option key={i}>{i}</option>)}
          </select>
          <select className="girdi !w-auto max-w-[220px]" value={asm} onChange={(e) => setAsm(e.target.value)}>
            <option value="">Tüm ASM&apos;ler</option>
            {secenekler.asmler.map((i) => <option key={i}>{i}</option>)}
          </select>
          <select className="girdi !w-auto" value={birim} onChange={(e) => setBirim(e.target.value)}>
            <option value="">Tüm Birimler</option>
            {secenekler.birimler.map((i) => <option key={i}>{i}</option>)}
          </select>
          <select className="girdi !w-auto" value={unvan} onChange={(e) => setUnvan(e.target.value)}>
            <option value="">Tüm Unvanlar</option>
            <option value="AILE_HEKIMI">Aile Hekimi</option>
            <option value="AILE_SAGLIGI_CALISANI">Aile Sağlığı Çalışanı</option>
          </select>
          {!sabitFiltre.uygunluk && (
            <select className="girdi !w-auto" value={uygunluk} onChange={(e) => setUygunluk(e.target.value)}>
              <option value="">Tüm Uygunluk Durumları</option>
              <option value="UYGUN">Uygun</option>
              <option value="UYGUN_DEGIL">Uygun Değil</option>
              <option value="DEGERLENDIRME">Değerlendirme Gerekli</option>
              <option value="IZINLI">İzinli / Raporlu</option>
              <option value="BEYAN_YOK">Beyan Vermedi</option>
            </select>
          )}
          {!sabitFiltre.beyan && (
            <select className="girdi !w-auto" value={beyan} onChange={(e) => setBeyan(e.target.value)}>
              <option value="">Beyan (hepsi)</option>
              <option value="VERDI">Beyan Verdi</option>
              <option value="VERMEDI">Beyan Vermedi</option>
            </select>
          )}
          <select className="girdi !w-auto" value={gorev} onChange={(e) => setGorev(e.target.value)}>
            <option value="">Görev Geçmişi (hepsi)</option>
            <option value="VAR">Daha Önce Görevlendirildi</option>
            <option value="YOK">Hiç Görevlendirilmedi</option>
          </select>
          <input
            className="girdi !w-48" placeholder="Ad, soyad, sicil ara..."
            value={arama} onChange={(e) => setArama(e.target.value)}
          />
        </div>
      </div>

      {!veri ? (
        <Yukleniyor />
      ) : (
        <div className="kart !p-0 overflow-x-auto">
          <table className="tablo">
            <thead>
              <tr>
                <th>#</th><th>Ad Soyad</th><th>Unvan</th><th>İlçe</th><th>ASM</th><th>Birim</th>
                <th>Telefon</th><th>Beyan</th><th>Uygunluk</th><th>Görev</th>
                {ekSutun && <th></th>}
              </tr>
            </thead>
            <tbody>
              {veri.length === 0 && (
                <tr><td colSpan={ekSutun ? 11 : 10} className="text-center text-slate-400 py-8">Kayıt bulunamadı.</td></tr>
              )}
              {veri.map((p, i) => (
                <tr key={p.id}>
                  <td>{i + 1}</td>
                  <td className="font-medium whitespace-nowrap">{p.ad} {p.soyad}</td>
                  <td className="whitespace-nowrap">{p.unvan === 'AILE_HEKIMI' ? 'Aile Hekimi' : 'ASÇ'}</td>
                  <td>{p.ilce}</td>
                  <td>{p.asm}</td>
                  <td>{p.birim}</td>
                  <td className="whitespace-nowrap">{p.telefon}</td>
                  <td>{p.beyanVerdi ? '✓' : '—'}</td>
                  <td><UygunlukRozeti durum={p.uygunluk} /></td>
                  <td className="whitespace-nowrap">{p.toplamGorev} kez{p.sonGorevTarih ? ` (${p.sonGorevTarih.slice(0, 10)})` : ''}</td>
                  {ekSutun && <td>{ekSutun(p)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {veri && <p className="text-xs text-slate-400">{veri.length} kayıt listelendi.</p>}
    </div>
  );
}
