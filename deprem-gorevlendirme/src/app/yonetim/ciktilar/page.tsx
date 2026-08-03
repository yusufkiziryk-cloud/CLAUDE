'use client';

import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { DonemSecici, AY_ADLARI } from '@/components/ui';

interface GorevOzet { id: number; baslik: string; durum: string; yil: number; ay: number }

export default function CiktilarSayfasi() {
  const simdi = new Date();
  const [yil, setYil] = useState(simdi.getFullYear());
  const [ay, setAy] = useState(simdi.getMonth() + 1);
  const [gorevler, setGorevler] = useState<GorevOzet[]>([]);
  const [gorevId, setGorevId] = useState<number | 0>(0);

  useEffect(() => {
    fetch('/api/admin/gorevlendirme')
      .then((r) => r.json())
      .then((j) => {
        const liste: GorevOzet[] = j.gorevlendirmeler || [];
        setGorevler(liste);
        if (liste.length > 0) setGorevId(liste[0].id);
      });
  }, []);

  const url = (format: string, tur: string, gerekGorev = false) => {
    let u = `/api/admin/export?format=${format}&tur=${tur}&yil=${yil}&ay=${ay}`;
    if (gerekGorev && gorevId) u += `&gorevId=${gorevId}`;
    return u;
  };

  const Baglanti = ({ format, tur, ad, gerekGorev = false }: { format: string; tur: string; ad: string; gerekGorev?: boolean }) => {
    const pasif = gerekGorev && !gorevId;
    return (
      <a
        className={`btn-ghost !py-2.5 text-sm justify-start ${pasif ? 'pointer-events-none opacity-40' : ''}`}
        href={pasif ? undefined : url(format, tur, gerekGorev)}
      >
        {ad}
      </a>
    );
  };

  return (
    <Shell tur="yonetici" baslik="Excel, Word ve PDF Çıktıları">
      <div className="space-y-4">
        <div className="kart flex flex-wrap gap-3 items-end">
          <div>
            <label className="etiket">Dönem</label>
            <DonemSecici yil={yil} ay={ay} onChange={(y, a) => { setYil(y); setAy(a); }} />
          </div>
          <div className="flex-1 min-w-[260px]">
            <label className="etiket">Görevlendirme listesi (liste çıktıları için)</label>
            <select className="girdi" value={gorevId} onChange={(e) => setGorevId(Number(e.target.value))}>
              {gorevler.length === 0 && <option value={0}>Henüz görevlendirme yok</option>}
              {gorevler.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.baslik} ({AY_ADLARI[g.ay - 1]} {g.yil} — {g.durum === 'ONAYLANDI' ? 'Onaylı' : 'Taslak'})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="kart">
            <h3 className="font-bold mb-3 text-green-700">📊 Excel</h3>
            <div className="grid gap-2">
              <Baglanti format="excel" tur="tum-personel" ad="Tüm personel listesi" />
              <Baglanti format="excel" tur="beyan-verenler" ad="Bu ay beyan verenler" />
              <Baglanti format="excel" tur="beyan-vermeyenler" ad="Beyan vermeyenler" />
              <Baglanti format="excel" tur="uygun" ad="Görevlendirmeye uygun personel" />
              <Baglanti format="excel" tur="uygun-degil" ad="Uygun olmayan personel" />
              <Baglanti format="excel" tur="asil-liste" ad="Asıl görevlendirme listesi" gerekGorev />
              <Baglanti format="excel" tur="yedek-liste" ad="Yedek görevlendirme listesi" gerekGorev />
              <Baglanti format="excel" tur="ilce-bazli" ad="İlçe bazlı personel listesi" />
              <Baglanti format="excel" tur="asm-bazli" ad="ASM bazlı personel listesi" />
            </div>
          </div>

          <div className="kart">
            <h3 className="font-bold mb-3 text-blue-700">📝 Word</h3>
            <div className="grid gap-2">
              <Baglanti format="word" tur="resmi" ad="Resmî yazı görevlendirme listesi" gerekGorev />
              <Baglanti format="word" tur="asil-yedek" ad="Asıl ve yedek personel tablosu" gerekGorev />
              <Baglanti format="word" tur="ilce" ad="İlçe bazlı görevlendirme çizelgesi" gerekGorev />
              <Baglanti format="word" tur="teblig" ad="Personel tebliğ listesi" gerekGorev />
            </div>
            <p className="text-xs text-slate-400 mt-3">Word çıktıları için görevlendirme listesi seçilmelidir.</p>
          </div>

          <div className="kart">
            <h3 className="font-bold mb-3 text-red-700">📄 PDF</h3>
            <div className="grid gap-2">
              <Baglanti format="pdf" tur="aylik-durum" ad="Aylık durum raporu" />
              <Baglanti format="pdf" tur="gorevlendirme" ad="Görevlendirme listesi" gerekGorev />
              <Baglanti format="pdf" tur="asil-yedek" ad="Asıl ve yedek personel listesi" gerekGorev />
              <Baglanti format="pdf" tur="beyan-tamamlama" ad="Beyan tamamlama raporu" />
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-400">
          Tüm çıktılarda kurum adı, rapor başlığı, ay/yıl, oluşturma tarihi, sayfa numarası, onay alanı ve logo alanı bulunur.
          Görevlendirme listelerinde sağlık bilgisi yer almaz; T.C. kimlik numaraları kısmi (maskeli) gösterilir.
        </p>
      </div>
    </Shell>
  );
}
