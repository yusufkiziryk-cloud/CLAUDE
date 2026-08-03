'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Shell from '@/components/Shell';
import { Yukleniyor, UygunlukRozeti, tarihGoster } from '@/components/ui';

interface Ozet {
  kullanici: {
    adSoyad: string; tcMaskeli: string; sicil: string; unvan: string;
    ilce: string; asm: string; birim: string;
  };
  donem: { yil: number; ay: number; ayAdi: string; pencereAcik: boolean; kalanGun: number; pencere: { baslangicGun: number; bitisGun: number } };
  buAyBeyanVerildi: boolean;
  buAyUygunluk: string | null;
  sonBeyan: { donem: string; tarih: string; uygunluk: string } | null;
  uyarilar: { mesaj: string; tip: string }[];
  bildirimler: { id: number; mesaj: string; tip: string; created_at: string }[];
}

export default function PersonelAnaEkran() {
  const [veri, setVeri] = useState<Ozet | null>(null);

  useEffect(() => {
    fetch('/api/personel/ozet').then((r) => r.json()).then(setVeri);
  }, []);

  if (!veri || !veri.kullanici) return <Shell tur="personel"><Yukleniyor /></Shell>;

  const k = veri.kullanici;

  return (
    <Shell tur="personel">
      {/* Uyarılar */}
      {veri.uyarilar.length > 0 && (
        <div className="space-y-2 mb-4">
          {veri.uyarilar.map((u, i) => (
            <div key={i} className="rounded-lg bg-orange-50 border border-orange-300 text-orange-800 px-4 py-3 text-sm font-medium">
              ⚠️ {u.mesaj}
            </div>
          ))}
        </div>
      )}

      {/* Kimlik kartı */}
      <div className="kart mb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">{k.adSoyad}</h2>
            <p className="text-sm text-slate-500">{k.unvan} — T.C. {k.tcMaskeli}</p>
          </div>
          {veri.buAyBeyanVerildi && veri.buAyUygunluk && <UygunlukRozeti durum={veri.buAyUygunluk} />}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-sm">
          <div><div className="text-slate-400 text-xs">İlçe</div>{k.ilce || '-'}</div>
          <div><div className="text-slate-400 text-xs">ASM</div>{k.asm || '-'}</div>
          <div><div className="text-slate-400 text-xs">Birim</div>{k.birim || '-'}</div>
          <div>
            <div className="text-slate-400 text-xs">Son Beyan</div>
            {veri.sonBeyan ? `${veri.sonBeyan.donem}` : 'Yok'}
          </div>
        </div>
      </div>

      {/* Bu ayın durumu */}
      <div className="kart mb-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="font-bold">{veri.donem.ayAdi} {veri.donem.yil} Beyanı</h3>
            <p className="text-sm text-slate-500">
              {veri.buAyBeyanVerildi
                ? 'Bu ay beyanınızı verdiniz. Dilerseniz güncelleyebilirsiniz.'
                : veri.donem.pencereAcik
                  ? `Beyan dönemi açık (ayın ${veri.donem.pencere.baslangicGun}-${veri.donem.pencere.bitisGun}. günleri).`
                  : 'Beyan dönemi şu anda kapalı.'}
            </p>
          </div>
          <span className={`text-sm font-semibold px-3 py-1 rounded-full ${veri.buAyBeyanVerildi ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>
            {veri.buAyBeyanVerildi ? '✓ Beyan verildi' : 'Beyan bekleniyor'}
          </span>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          <Link href="/panel/beyan?mod=ayni" className="btn-success text-lg !py-5">
            Durumumda Değişiklik Yok
          </Link>
          <Link href="/panel/beyan?mod=degisti" className="btn-warning text-lg !py-5">
            Durumumda Değişiklik Var
          </Link>
        </div>
        {veri.buAyBeyanVerildi && (
          <Link href="/panel/gecmis" className="btn-ghost w-full mt-3">Beyanımı Görüntüle</Link>
        )}
      </div>

      {/* Bildirimler */}
      <div className="kart">
        <h3 className="font-bold mb-3">Bildirimler</h3>
        {veri.bildirimler.length === 0 ? (
          <p className="text-sm text-slate-400">Henüz bildiriminiz yok.</p>
        ) : (
          <ul className="space-y-2">
            {veri.bildirimler.map((b) => (
              <li key={b.id} className="text-sm border-b border-slate-100 pb-2 last:border-0">
                <span className="mr-2">{b.tip === 'BASARI' ? '✅' : b.tip === 'UYARI' ? '⚠️' : 'ℹ️'}</span>
                {b.mesaj}
                <span className="block text-xs text-slate-400 mt-0.5">{tarihGoster(b.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Shell>
  );
}
