import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Save, Cloud } from 'lucide-react'
import toast from 'react-hot-toast'
import { useStore } from '../lib/store'
import { fmtDate, todayISO, format, parseISO, addDays, subDays } from '../utils/dates'
import LifeEditor from '../components/editor/LifeEditor'
import { DailyEntry } from '../types'
import clsx from 'clsx'

const EMOTIONS = [{ key: 'great', emoji: '😄', label: 'Harika' }, { key: 'good', emoji: '🙂', label: 'İyi' }, { key: 'neutral', emoji: '😐', label: 'Normal' }, { key: 'bad', emoji: '😔', label: 'Kötü' }, { key: 'terrible', emoji: '😢', label: 'Berbat' }]

const empty = (date: string): Omit<DailyEntry, 'id' | 'createdAt' | 'updatedAt'> => ({
  date, title: '', summary: '', mainNote: '', importantEvents: '', learnings: '', ideas: '', todos: '',
  emotion: undefined, energy: 3, tags: [], category: 'Günlük', links: [], persons: [], organizations: []
})

export default function DailyPage() {
  const { saveDailyEntry, dailyEntries, categories } = useStore()
  const [date, setDate] = useState(todayISO())
  const [form, setForm] = useState<Omit<DailyEntry, 'id' | 'createdAt' | 'updatedAt'>>(empty(date))
  const [tagInput, setTagInput] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isHydrated = useRef(false)

  // Sync form when the date changes or when the store hydrates from storage.
  useEffect(() => {
    const existing = dailyEntries.find((e) => e.date === date)
    if (existing) {
      // Only replace the form if we just switched dates OR this is the first
      // hydration — not on every auto-save write (which would reset the cursor).
      if (!isHydrated.current) {
        setForm({ ...existing })
        isHydrated.current = true
      }
    } else {
      setForm(empty(date))
      isHydrated.current = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, dailyEntries.length > 0 ? dailyEntries.find((e) => e.date === date)?.updatedAt : null])

  // Reset hydration flag when date changes.
  const changeDate = (d: string) => {
    isHydrated.current = false
    setDate(d)
    setSaveStatus('idle')
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
  }

  const set = (k: keyof typeof form, v: unknown) => {
    setForm(f => ({ ...f, [k]: v }))
    setSaveStatus('idle')
    // Auto-save after 1.5 s of inactivity
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => doSave({ ...form, [k]: v }), 1500)
  }

  const doSave = (data = form) => {
    if (!data.title && !data.mainNote && !data.summary) return // nothing to save
    setSaveStatus('saving')
    saveDailyEntry(data)
    setSaveStatus('saved')
  }

  const handleSave = () => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    doSave()
    toast.success('Günlük kaydedildi')
  }

  const addTag = () => { if (tagInput.trim()) { set('tags', [...form.tags, tagInput.trim()]); setTagInput('') } }

  const recentDates = dailyEntries.slice(0, 7).map(e => e.date)
  const isToday = date === todayISO()

  const statusLabel = saveStatus === 'saving' ? 'Kaydediliyor...'
    : saveStatus === 'saved' ? 'Kaydedildi ✓'
    : 'Kaydet'

  return (
    <div className="max-w-3xl mx-auto">
      {/* Date navigation */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <button onClick={() => changeDate(format(subDays(parseISO(date), 1), 'yyyy-MM-dd'))} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"><ChevronLeft size={16} /></button>
          <div className="text-center">
            <div className="font-semibold">{fmtDate(date)}</div>
            {isToday && <div className="text-xs text-primary-500">Bugün</div>}
          </div>
          <button onClick={() => changeDate(format(addDays(parseISO(date), 1), 'yyyy-MM-dd'))} disabled={date >= todayISO()} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"><ChevronRight size={16} /></button>
        </div>
        <div className="flex items-center gap-2">
          {saveStatus === 'saved' && <span className="text-xs text-emerald-500 flex items-center gap-1"><Cloud size={12} /> Kaydedildi</span>}
          <input type="date" value={date} onChange={(e) => changeDate(e.target.value)} max={todayISO()} className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          <button onClick={handleSave} className={clsx('flex items-center gap-2 px-4 py-2 text-white text-sm rounded-lg transition-colors', saveStatus === 'saved' ? 'bg-emerald-600' : 'bg-primary-600 hover:bg-primary-700')}>
            <Save size={14} /> {statusLabel}
          </button>
        </div>
      </div>

      {/* Recent entries shortcuts */}
      {recentDates.length > 0 && (
        <div className="flex gap-1.5 mb-4 flex-wrap">
          {recentDates.map(d => (
            <button key={d} onClick={() => changeDate(d)} className={clsx('px-2 py-1 rounded-lg text-xs transition-colors', d === date ? 'bg-primary-600 text-white' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-primary-400')}>
              {format(parseISO(d), 'd MMM')}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-4">
        {/* Title & Summary */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800">
          <input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Bugünün başlığı..." className="w-full text-lg font-semibold bg-transparent border-0 border-b border-slate-200 dark:border-slate-700 pb-2 mb-4 focus:outline-none focus:border-primary-500" />
          <textarea value={form.summary} onChange={(e) => set('summary', e.target.value)} placeholder="Kısa özet..." rows={2} className="w-full px-0 py-1 bg-transparent text-slate-600 dark:text-slate-400 text-sm resize-none focus:outline-none placeholder:text-slate-400" />
        </div>

        {/* Emotion & Energy */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-2">Duygu Durumu</label>
              <div className="flex gap-2">
                {EMOTIONS.map(e => (
                  <button key={e.key} type="button" onClick={() => set('emotion', form.emotion === e.key ? undefined : e.key)} title={e.label} className={clsx('flex-1 py-2 rounded-xl text-lg transition-all', form.emotion === e.key ? 'bg-primary-100 dark:bg-primary-900/50 scale-110' : 'hover:bg-slate-100 dark:hover:bg-slate-800')}>
                    {e.emoji}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-2">Enerji Seviyesi: {form.energy}/5</label>
              <input type="range" min={1} max={5} value={form.energy} onChange={(e) => set('energy', Number(e.target.value))} className="w-full accent-primary-600" />
              <div className="flex justify-between text-xs text-slate-400 mt-1"><span>Düşük</span><span>Yüksek</span></div>
            </div>
          </div>
        </div>

        {/* Main Note */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-medium mb-3">📝 Günlük Not</h3>
          <LifeEditor value={form.mainNote} onChange={(v) => set('mainNote', v)} placeholder="Bugün ne oldu? Düşüncelerini, gözlemlerini yaz..." minHeight={180} />
        </div>

        {/* Grid sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-medium mb-2">⭐ Önemli Olaylar</h3>
            <textarea value={form.importantEvents} onChange={(e) => set('importantEvents', e.target.value)} placeholder="Bugünün önemli olayları..." rows={4} className="w-full text-sm bg-transparent resize-none focus:outline-none placeholder:text-slate-400 text-slate-700 dark:text-slate-300" />
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-medium mb-2">🎓 Öğrendiklerim</h3>
            <textarea value={form.learnings} onChange={(e) => set('learnings', e.target.value)} placeholder="Bugün ne öğrendim?..." rows={4} className="w-full text-sm bg-transparent resize-none focus:outline-none placeholder:text-slate-400 text-slate-700 dark:text-slate-300" />
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-medium mb-2">💡 Fikirler</h3>
            <textarea value={form.ideas} onChange={(e) => set('ideas', e.target.value)} placeholder="Aklıma gelen fikirler..." rows={4} className="w-full text-sm bg-transparent resize-none focus:outline-none placeholder:text-slate-400 text-slate-700 dark:text-slate-300" />
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-medium mb-2">✅ Yapılacaklar</h3>
            <textarea value={form.todos} onChange={(e) => set('todos', e.target.value)} placeholder="- [ ] Görev 1&#10;- [ ] Görev 2" rows={4} className="w-full text-sm bg-transparent resize-none focus:outline-none placeholder:text-slate-400 text-slate-700 dark:text-slate-300 font-mono" />
          </div>
        </div>

        {/* Tags & Persons */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-2">Etiketler</label>
              <div className="flex flex-wrap gap-1 mb-2">{form.tags.map(t => <span key={t} className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-300 rounded-full text-xs flex items-center gap-1">{t}<button onClick={() => set('tags', form.tags.filter(x => x !== t))}>×</button></span>)}</div>
              <div className="flex gap-1">
                <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())} placeholder="Etiket ekle..." className="flex-1 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs focus:outline-none" />
                <button onClick={addTag} className="px-2 py-1 bg-primary-600 text-white rounded text-xs">+</button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-2">Kategori</label>
              <select value={form.category} onChange={(e) => set('category', e.target.value)} className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none">
                {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end pb-4">
          <button onClick={handleSave} className={clsx('flex items-center gap-2 px-6 py-2.5 text-white rounded-lg transition-colors', saveStatus === 'saved' ? 'bg-emerald-600' : 'bg-primary-600 hover:bg-primary-700')}>
            <Save size={15} /> {statusLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
