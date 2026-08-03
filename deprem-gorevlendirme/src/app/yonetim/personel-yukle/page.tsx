'use client';

import { useState } from 'react';
import Shell from '@/components/Shell';
import { HataKutusu, BasariKutusu } from '@/components/ui';

export default function PersonelYukleSayfasi() {
  const [dosya, setDosya] = useState<File | null>(null);
  const [bekliyor, setBekliyor] = useState(false);
  const [hata, setHata] = useState('');
  const [mesaj, setMesaj] = useState('');
  const [hatalar, setHatalar] = useState<{ satir: number; hata: string }[]>([]);

  const yukle = async () => {
    if (!dosya) { setHata('Lütfen bir Excel dosyası seçin.'); return; }
    setHata(''); setMesaj(''); setHatalar([]); setBekliyor(true);
    try {
      const form = new FormData();
      form.append('dosya', dosya);
      const r = await fetch('/api/admin/personel/yukle', { method: 'POST', body: form });
      const j = await r.json();
      if (!r.ok) { setHata(j.hata || 'Yükleme başarısız.'); return; }
      setMesaj(`Aktarma tamamlandı: ${j.eklenen} yeni personel eklendi, ${j.guncellenen} personel güncellendi.`);
      setHatalar(j.hatalar || []);
    } finally {
      setBekliyor(false);
    }
  };

  return (
    <Shell tur="yonetici" baslik="Excel ile Personel Yükleme">
      <div className="space-y-4 max-w-2xl">
        <div className="kart space-y-3">
          <p className="text-sm text-slate-600">
            Mevcut aile hekimi ve aile sağlığı çalışanı listenizi Excel dosyasından toplu olarak aktarabilirsiniz.
            Aynı kişi (T.C. veya sicil numarası eşleşen) tekrar yüklenirse bilgileri <b>güncellenir</b>, mükerrer kayıt oluşturulmaz.
          </p>
          <a href="/api/admin/sablon" className="btn-ghost">📄 Boş Excel Şablonunu İndir</a>
        </div>

        <div className="kart space-y-4">
          <div>
            <label className="etiket">Excel Dosyası (.xlsx)</label>
            <input
              type="file" accept=".xlsx"
              className="block w-full text-sm file:mr-3 file:btn-ghost file:!py-2 file:!px-4"
              onChange={(e) => setDosya(e.target.files?.[0] || null)}
            />
          </div>
          <HataKutusu mesaj={hata} />
          <BasariKutusu mesaj={mesaj} />
          {hatalar.length > 0 && (
            <div className="rounded-lg bg-orange-50 border border-orange-200 p-3 text-sm">
              <b>Aktarılamayan satırlar:</b>
              <ul className="list-disc ml-5 mt-1">
                {hatalar.map((h, i) => (
                  <li key={i}>Satır {h.satir}: {h.hata}</li>
                ))}
              </ul>
            </div>
          )}
          <button className="btn-primary w-full" onClick={yukle} disabled={bekliyor}>
            {bekliyor ? 'Aktarılıyor...' : 'Dosyayı Yükle ve Aktar'}
          </button>
        </div>
      </div>
    </Shell>
  );
}
