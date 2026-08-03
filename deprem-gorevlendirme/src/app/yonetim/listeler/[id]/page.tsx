'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Shell from '@/components/Shell';
import { Yukleniyor, HataKutusu, BasariKutusu, tarihGoster, AY_ADLARI } from '@/components/ui';

interface Uye {
  userId: number; ad: string; soyad: string; unvan: string; ilce: string | null;
  asm: string | null; birim: string | null; telefon: string | null;
  tip: 'ASIL' | 'YEDEK'; manuel: number; toplamGorev: number; sonGorevTarih: string | null;
}

interface Detay {
  id: number; yil: number; ay: number; baslik: string; durum: string;
  created_at: string; onay_at: string | null; uyeler: Uye[];
}

interface Aday { id: number; ad: string; soyad: string; unvan: string | null; ilce: string | null; asm: string | null; uygunluk: string }

export default function GorevlendirmeDetaySayfasi() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [detay, setDetay] = useState<Detay | null>(null);
  const [hata, setHata] = useState('');
  const [mesaj, setMesaj] = useState('');
  const [adayArama, setAdayArama] = useState('');
  const [adaylar, setAdaylar] = useState<Aday[]>([]);
  const [ekleTip, setEkleTip] = useState<'ASIL' | 'YEDEK'>('ASIL');
  const [bekliyor, setBekliyor] = useState(false);

  const yukle = useCallback(() => {
    fetch(`/api/admin/gorevlendirme/${id}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.hata) setHata(j.hata);
        else setDetay(j.gorevlendirme);
      });
  }, [id]);

  useEffect(() => { yukle(); }, [yukle]);

  // Manuel ekleme için uygun personel arama
  useEffect(() => {
    if (!detay || adayArama.length < 2) { setAdaylar([]); return; }
    const p = new URLSearchParams({
      yil: String(detay.yil), ay: String(detay.ay), uygunluk: 'UYGUN', arama: adayArama,
    });
    const t = setTimeout(() => {
      fetch(`/api/admin/personel?${p}`)
        .then((r) => r.json())
        .then((j) => setAdaylar((j.personel || []).slice(0, 8)));
    }, 300);
    return () => clearTimeout(t);
  }, [adayArama, detay]);

  const islem = async (govde: Record<string, unknown>, onayMesaji?: string) => {
    if (onayMesaji && !confirm(onayMesaji)) return;
    setHata(''); setMesaj(''); setBekliyor(true);
    try {
      const r = await fetch(`/api/admin/gorevlendirme/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(govde),
      });
      const j = await r.json();
      if (!r.ok) { setHata(j.hata || 'İşlem başarısız.'); return; }
      if (govde.islem === 'onayla') setMesaj('Liste onaylandı. Seçilen personellere bildirim gönderildi.');
      yukle();
    } finally {
      setBekliyor(false);
    }
  };

  const sil = async () => {
    if (!confirm('Bu taslak görevlendirme silinecek. Emin misiniz?')) return;
    const r = await fetch(`/api/admin/gorevlendirme/${id}`, { method: 'DELETE' });
    if (r.ok) router.push('/yonetim/listeler');
    else setHata((await r.json()).hata || 'Silinemedi.');
  };

  if (!detay) return <Shell tur="yonetici">{hata ? <HataKutusu mesaj={hata} /> : <Yukleniyor />}</Shell>;

  const taslak = detay.durum === 'TASLAK';
  const donemEtiketi = `${AY_ADLARI[detay.ay - 1]} ${detay.yil}`;

  const Grup = ({ baslikMetni, tip, unvan }: { baslikMetni: string; tip: 'ASIL' | 'YEDEK'; unvan: string }) => {
    const uyeler = detay.uyeler.filter((u) => u.tip === tip && u.unvan === unvan);
    return (
      <div className="kart !p-0 overflow-hidden">
        <div className={`px-4 py-2.5 font-bold text-sm text-white ${tip === 'ASIL' ? 'bg-kurum' : 'bg-slate-500'}`}>
          {baslikMetni} ({uyeler.length})
        </div>
        <div className="overflow-x-auto">
          <table className="tablo">
            <thead>
              <tr>
                <th>#</th><th>Ad Soyad</th><th>İlçe</th><th>ASM</th><th>Birim</th><th>Telefon</th>
                <th>Son Görev</th><th>Toplam</th>{taslak && <th className="!text-right">İşlem</th>}
              </tr>
            </thead>
            <tbody>
              {uyeler.length === 0 && (
                <tr><td colSpan={taslak ? 9 : 8} className="text-center text-slate-400 py-4">Personel yok.</td></tr>
              )}
              {uyeler.map((u, i) => (
                <tr key={u.userId}>
                  <td>{i + 1}</td>
                  <td className="font-medium whitespace-nowrap">
                    {u.ad} {u.soyad}
                    {!!u.manuel && <span className="ml-1.5 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full align-middle">manuel</span>}
                  </td>
                  <td>{u.ilce}</td><td>{u.asm}</td><td>{u.birim}</td>
                  <td className="whitespace-nowrap">{u.telefon}</td>
                  <td className="whitespace-nowrap">{u.sonGorevTarih ? u.sonGorevTarih.slice(0, 10) : '-'}</td>
                  <td>{u.toplamGorev}</td>
                  {taslak && (
                    <td className="whitespace-nowrap text-right">
                      <button
                        className="text-xs font-semibold text-kurum hover:underline mr-3"
                        onClick={() => islem({ islem: 'tip-degistir', userId: u.userId })}
                        disabled={bekliyor}
                      >
                        {tip === 'ASIL' ? 'Yedek Yap' : 'Asıl Yap'}
                      </button>
                      <button
                        className="text-xs font-semibold text-red-600 hover:underline"
                        onClick={() => islem({ islem: 'cikar', userId: u.userId }, `${u.ad} ${u.soyad} listeden çıkarılsın mı?`)}
                        disabled={bekliyor}
                      >
                        Çıkar
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <Shell tur="yonetici" baslik={detay.baslik}>
      <div className="space-y-4">
        <div className="kart flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold mr-3 ${taslak ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
              {taslak ? 'Taslak — Önizleme' : 'Onaylandı'}
            </span>
            <span className="text-sm text-slate-500">
              {donemEtiketi} — Oluşturma: {tarihGoster(detay.created_at)}
              {detay.onay_at && ` — Onay: ${tarihGoster(detay.onay_at)}`}
            </span>
          </div>
          <div className="flex gap-2">
            {taslak && (
              <>
                <button className="btn-danger !py-2" onClick={sil} disabled={bekliyor}>Taslağı Sil</button>
                <button
                  className="btn-success !py-2"
                  onClick={() => islem({ islem: 'onayla' }, 'Liste onaylanacak ve personellere bildirim gönderilecek. Onaylıyor musunuz?')}
                  disabled={bekliyor}
                >
                  ✓ Listeyi Onayla
                </button>
              </>
            )}
          </div>
        </div>

        <HataKutusu mesaj={hata} />
        <BasariKutusu mesaj={mesaj} />

        {taslak && (
          <div className="kart">
            <h3 className="font-bold text-sm mb-2">Listeye Manuel Personel Ekle</h3>
            <div className="flex flex-wrap gap-2 items-start">
              <input
                className="girdi !w-64" placeholder="Uygun personel ara (en az 2 harf)..."
                value={adayArama} onChange={(e) => setAdayArama(e.target.value)}
              />
              <select className="girdi !w-auto" value={ekleTip} onChange={(e) => setEkleTip(e.target.value as 'ASIL' | 'YEDEK')}>
                <option value="ASIL">Asıl olarak</option>
                <option value="YEDEK">Yedek olarak</option>
              </select>
            </div>
            {adaylar.length > 0 && (
              <ul className="mt-2 border border-slate-200 rounded-lg divide-y divide-slate-100">
                {adaylar.map((a) => (
                  <li key={a.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span>
                      <b>{a.ad} {a.soyad}</b> — {a.unvan === 'AILE_HEKIMI' ? 'Aile Hekimi' : 'ASÇ'} — {a.ilce} / {a.asm}
                    </span>
                    <button
                      className="text-kurum font-semibold text-xs hover:underline"
                      onClick={() => { islem({ islem: 'ekle', userId: a.id, tip: ekleTip }); setAdayArama(''); }}
                      disabled={bekliyor}
                    >
                      + Ekle
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-slate-400 mt-2">Yalnızca bu dönem &quot;Görevlendirmeye Uygun&quot; durumundaki personel aranır. Manuel eklenen kişiler kayıt altına alınır.</p>
          </div>
        )}

        <Grup baslikMetni="Asıl Aile Hekimi Listesi" tip="ASIL" unvan="AILE_HEKIMI" />
        <Grup baslikMetni="Asıl Aile Sağlığı Çalışanı Listesi" tip="ASIL" unvan="AILE_SAGLIGI_CALISANI" />
        <Grup baslikMetni="Yedek Aile Hekimi Listesi" tip="YEDEK" unvan="AILE_HEKIMI" />
        <Grup baslikMetni="Yedek Aile Sağlığı Çalışanı Listesi" tip="YEDEK" unvan="AILE_SAGLIGI_CALISANI" />

        <div className="kart">
          <h3 className="font-bold text-sm mb-3">Bu Listenin Çıktıları</h3>
          <div className="flex flex-wrap gap-2">
            <a className="btn-ghost !py-2 text-sm" href={`/api/admin/export?format=excel&tur=asil-liste&gorevId=${detay.id}&yil=${detay.yil}&ay=${detay.ay}`}>📊 Excel — Asıl Liste</a>
            <a className="btn-ghost !py-2 text-sm" href={`/api/admin/export?format=excel&tur=yedek-liste&gorevId=${detay.id}&yil=${detay.yil}&ay=${detay.ay}`}>📊 Excel — Yedek Liste</a>
            <a className="btn-ghost !py-2 text-sm" href={`/api/admin/export?format=word&tur=resmi&gorevId=${detay.id}&yil=${detay.yil}&ay=${detay.ay}`}>📝 Word — Resmî Yazı Listesi</a>
            <a className="btn-ghost !py-2 text-sm" href={`/api/admin/export?format=word&tur=teblig&gorevId=${detay.id}&yil=${detay.yil}&ay=${detay.ay}`}>📝 Word — Tebliğ Listesi</a>
            <a className="btn-ghost !py-2 text-sm" href={`/api/admin/export?format=pdf&tur=gorevlendirme&gorevId=${detay.id}&yil=${detay.yil}&ay=${detay.ay}`}>📄 PDF — Görevlendirme Listesi</a>
          </div>
          <p className="text-xs text-slate-400 mt-2">Çıktılarda sağlık, gebelik veya kronik hastalık bilgisi yer almaz.</p>
        </div>
      </div>
    </Shell>
  );
}
