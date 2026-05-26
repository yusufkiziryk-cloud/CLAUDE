import { useState } from 'react'
import { useStore } from '../lib/store'
import { monthNames, yearProgress, parseISO, format } from '../utils/dates'
import { Save } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const QUARTERS = [
  { label: 'Q1', months: [0, 1, 2] },
  { label: 'Q2', months: [3, 4, 5] },
  { label: 'Q3', months: [6, 7, 8] },
  { label: 'Q4', months: [9, 10, 11] },
]

const RATINGS = [1, 2, 3, 4, 5]
const ratingEmoji = (r: number) => ['😢', '😔', '😐', '🙂', '😄'][r - 1]

export default function YearlyPage() {
  const year = new Date().getFullYear()
  const { notes, tasks, events, goals, dailyEntries, saveMonthlyReview, getMonthlyReview, saveYearlyReview, getYearlyReview } = useStore()
  const [activeTab, setActiveTab] = useState<'overview' | 'monthly' | 'yearly'>('overview')
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [monthForm, setMonthForm] = useState<Record<string, string>>({})
  const [monthRating, setMonthRating] = useState(3)
  const [yearForm, setYearForm] = useState<Record<string, string>>({})
  const [yearRating, setYearRating] = useState(3)

  const monthlyReview = getMonthlyReview(year, selectedMonth + 1)
  const yearlyReview = getYearlyReview(year)
  const progress = yearProgress()

  const getMonthStats = (monthIdx: number) => {
    const monthNotes = notes.filter(n => { try { const d = parseISO(n.createdAt); return d.getMonth() === monthIdx && d.getFullYear() === year } catch { return false } })
    const monthTasks = tasks.filter(t => { try { const d = parseISO(t.createdAt); return d.getMonth() === monthIdx && d.getFullYear() === year } catch { return false } })
    const monthEvents = events.filter(e => { try { return e.date.startsWith(`${year}-${String(monthIdx + 1).padStart(2, '0')}`) } catch { return false } })
    const monthDaily = dailyEntries.filter(d => { try { return d.date.startsWith(`${year}-${String(monthIdx + 1).padStart(2, '0')}`) } catch { return false } })
    const review = getMonthlyReview(year, monthIdx + 1)
    return { notes: monthNotes.length, tasks: monthTasks.length, events: monthEvents.length, daily: monthDaily.length, review }
  }

  const handleSaveMonthly = () => {
    saveMonthlyReview({
      year, month: selectedMonth + 1,
      goals: monthForm.goals ?? monthlyReview?.goals ?? '',
      achievements: monthForm.achievements ?? monthlyReview?.achievements ?? '',
      challenges: monthForm.challenges ?? monthlyReview?.challenges ?? '',
      keyEvents: monthForm.keyEvents ?? monthlyReview?.keyEvents ?? '',
      nextMonthPlan: monthForm.nextMonthPlan ?? monthlyReview?.nextMonthPlan ?? '',
      rating: monthRating,
    })
    toast.success('Aylık değerlendirme kaydedildi')
    setMonthForm({})
  }

  const handleSaveYearly = () => {
    saveYearlyReview({
      year,
      summary: yearForm.summary ?? yearlyReview?.summary ?? '',
      achievements: yearForm.achievements ?? yearlyReview?.achievements ?? '',
      challenges: yearForm.challenges ?? yearlyReview?.challenges ?? '',
      lessons: yearForm.lessons ?? yearlyReview?.lessons ?? '',
      nextYearGoals: yearForm.nextYearGoals ?? yearlyReview?.nextYearGoals ?? '',
      rating: yearRating,
    })
    toast.success('Yıllık değerlendirme kaydedildi')
    setYearForm({})
  }

  const textarea = (key: string, placeholder: string, source: Record<string, unknown> | undefined, setter: (k: string, v: string) => void) => (
    <textarea
      value={typeof source?.[key] === 'string' ? source[key] as string : ''}
      onChange={(e) => setter(key, e.target.value)}
      placeholder={placeholder}
      rows={4}
      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
    />
  )
  const strVal = (source: Record<string, unknown> | undefined, key: string) => typeof source?.[key] === 'string' ? source[key] as string : ''

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">{year} Yıllık Plan</h1>
        <div className="flex items-center gap-2">
          <div className="text-sm text-slate-500">Yıl: %{progress} tamamlandı</div>
          <div className="w-24 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-primary-500 rounded-full" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {(['overview', 'monthly', 'yearly'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={clsx('px-4 py-2 rounded-lg text-sm font-medium transition-colors', activeTab === tab ? 'bg-primary-600 text-white' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-primary-400')}>
            {tab === 'overview' ? '12 Aylık Görünüm' : tab === 'monthly' ? 'Aylık Değerlendirme' : 'Yıllık Değerlendirme'}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          {QUARTERS.map(q => (
            <div key={q.label} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 font-semibold text-sm">{q.label}</div>
              <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-800">
                {q.months.map(mi => {
                  const stats = getMonthStats(mi)
                  const isPast = mi < new Date().getMonth() || year < new Date().getFullYear()
                  const isCurrent = mi === new Date().getMonth() && year === new Date().getFullYear()
                  return (
                    <div key={mi} onClick={() => { setSelectedMonth(mi); setActiveTab('monthly') }} className={clsx('p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors', isCurrent && 'bg-primary-50/50 dark:bg-primary-950/30')}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={clsx('font-medium text-sm', isCurrent && 'text-primary-600')}>{monthNames[mi]}</span>
                        {stats.review && <span className="text-sm">{ratingEmoji(stats.review.rating)}</span>}
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-xs text-slate-500">
                        <span>{stats.notes} not</span>
                        <span>{stats.tasks} görev</span>
                        <span>{stats.events} etkinlik</span>
                        <span>{stats.daily} günlük</span>
                      </div>
                      {stats.review && (
                        <div className="mt-2 text-[10px] text-slate-400 line-clamp-2">{stats.review.achievements || stats.review.goals}</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'monthly' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {monthNames.map((m, i) => (
              <button key={i} onClick={() => { setSelectedMonth(i); setMonthForm({}); setMonthRating(getMonthlyReview(year, i + 1)?.rating ?? 3) }}
                className={clsx('px-3 py-1.5 rounded-lg text-sm transition-colors', selectedMonth === i ? 'bg-primary-600 text-white' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-primary-400')}>
                {m}
              </button>
            ))}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
            <h2 className="font-semibold mb-4">{monthNames[selectedMonth]} {year} Değerlendirmesi</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {[{ key: 'goals', label: 'Bu Ayki Hedefler' }, { key: 'achievements', label: 'Başarılar' }, { key: 'challenges', label: 'Zorluklar' }, { key: 'keyEvents', label: 'Önemli Olaylar' }].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">{f.label}</label>
                  {textarea(f.key, `${f.label}...`, { ...monthlyReview, ...monthForm }, (k, v) => setMonthForm(m => ({ ...m, [k]: v })))}
                </div>
              ))}
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Gelecek Ay Planı</label>
              {textarea('nextMonthPlan', 'Gelecek ay için planlar...', { ...monthlyReview, ...monthForm }, (k, v) => setMonthForm(m => ({ ...m, [k]: v })))}
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-500 mb-2">Bu Ayın Puanı</label>
              <div className="flex gap-2">
                {RATINGS.map(r => <button key={r} onClick={() => setMonthRating(r)} className={clsx('flex flex-col items-center gap-1 p-2 rounded-lg transition-colors', monthRating === r ? 'bg-primary-100 dark:bg-primary-900/50' : 'hover:bg-slate-100 dark:hover:bg-slate-800')}><span className="text-xl">{ratingEmoji(r)}</span><span className="text-xs">{r}</span></button>)}
              </div>
            </div>
            <button onClick={handleSaveMonthly} className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded-lg transition-colors"><Save size={14} /> Değerlendirmeyi Kaydet</button>
          </div>
        </div>
      )}

      {activeTab === 'yearly' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <h2 className="font-semibold mb-4">{year} Yılı Genel Değerlendirmesi</h2>
          <div className="space-y-4">
            {[{ key: 'summary', label: 'Yıl Özeti' }, { key: 'achievements', label: 'Yılın Başarıları' }, { key: 'challenges', label: 'Yılın Zorlukları' }, { key: 'lessons', label: 'Çıkarılan Dersler' }, { key: 'nextYearGoals', label: 'Gelecek Yıl Hedefleri' }].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">{f.label}</label>
                {textarea(f.key, `${f.label}...`, { ...yearlyReview, ...yearForm }, (k, v) => setYearForm(m => ({ ...m, [k]: v })))}
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-2">Bu Yılın Puanı</label>
              <div className="flex gap-2">
                {RATINGS.map(r => <button key={r} onClick={() => setYearRating(r)} className={clsx('flex flex-col items-center gap-1 p-2 rounded-lg transition-colors', yearRating === r ? 'bg-primary-100 dark:bg-primary-900/50' : 'hover:bg-slate-100 dark:hover:bg-slate-800')}><span className="text-xl">{ratingEmoji(r)}</span><span className="text-xs">{r}</span></button>)}
              </div>
            </div>
            <button onClick={handleSaveYearly} className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded-lg transition-colors"><Save size={14} /> Yıllık Değerlendirmeyi Kaydet</button>
          </div>
        </div>
      )}
    </div>
  )
}
