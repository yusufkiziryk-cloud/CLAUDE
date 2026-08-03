'use client';

// Uygunluk durumu renk ve etiketleri (kurumsal renk kodu)
export const UYGUNLUK_GORUNUM: Record<string, { ad: string; sinif: string; nokta: string }> = {
  UYGUN: { ad: 'Görevlendirmeye Uygun', sinif: 'bg-green-100 text-green-800 border-green-300', nokta: 'bg-green-500' },
  UYGUN_DEGIL: { ad: 'Uygun Değil', sinif: 'bg-red-100 text-red-800 border-red-300', nokta: 'bg-red-500' },
  DEGERLENDIRME: { ad: 'Değerlendirme Gerekli', sinif: 'bg-orange-100 text-orange-800 border-orange-300', nokta: 'bg-orange-500' },
  IZINLI: { ad: 'İzinli / Raporlu', sinif: 'bg-purple-100 text-purple-800 border-purple-300', nokta: 'bg-purple-500' },
  BEYAN_YOK: { ad: 'Beyan Vermedi', sinif: 'bg-slate-200 text-slate-600 border-slate-300', nokta: 'bg-slate-400' },
  GOREVLI: { ad: 'Görevlendirildi', sinif: 'bg-blue-100 text-blue-800 border-blue-300', nokta: 'bg-blue-500' },
};

export function UygunlukRozeti({ durum }: { durum: string }) {
  const g = UYGUNLUK_GORUNUM[durum] || UYGUNLUK_GORUNUM.BEYAN_YOK;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${g.sinif}`}>
      <span className={`h-2 w-2 rounded-full ${g.nokta}`} />
      {g.ad}
    </span>
  );
}

export function Yukleniyor() {
  return (
    <div className="flex items-center justify-center py-16 text-slate-500">
      <svg className="animate-spin h-6 w-6 mr-3 text-kurum" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
      Yükleniyor...
    </div>
  );
}

export function HataKutusu({ mesaj }: { mesaj: string }) {
  if (!mesaj) return null;
  return <div className="rounded-lg bg-red-50 border border-red-300 text-red-800 px-4 py-3 text-sm">{mesaj}</div>;
}

export function BasariKutusu({ mesaj }: { mesaj: string }) {
  if (!mesaj) return null;
  return <div className="rounded-lg bg-green-50 border border-green-300 text-green-800 px-4 py-3 text-sm">{mesaj}</div>;
}

export const AY_ADLARI = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

export function DonemSecici({
  yil, ay, onChange,
}: {
  yil: number;
  ay: number;
  onChange: (yil: number, ay: number) => void;
}) {
  const buYil = new Date().getFullYear();
  const yillar = [buYil - 2, buYil - 1, buYil, buYil + 1];
  return (
    <div className="flex gap-2">
      <select className="girdi !w-auto" value={ay} onChange={(e) => onChange(yil, Number(e.target.value))}>
        {AY_ADLARI.map((a, i) => (
          <option key={a} value={i + 1}>{a}</option>
        ))}
      </select>
      <select className="girdi !w-auto" value={yil} onChange={(e) => onChange(Number(e.target.value), ay)}>
        {yillar.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </div>
  );
}

export function tarihGoster(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
