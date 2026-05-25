import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Save, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'
import { useStore } from '../lib/store'
import { fmtDate, todayISO, format, parseISO, addDays, subDays } from '../utils/dates'
import MarkdownEditor from '../components/common/MarkdownEditor'
import { DailyEntry } from '../types'
import clsx from 'clsx'

const EMOTIONS = [{ key: 'great', emoji: '😄', label: 'Harika' }, { key: 'good', emoji: '🙂', label: 'İyi' }, { key: 'neutral', emoji: '😐', label: 'Normal' }, { key: 'bad', emoji: '😔', label: 'Kötü' }, { key: 'terrible', emoji: '😢', label: 'Berbat' }]

const empty = (date: string): Omit<DailyEntry, 'id' | 'createdAt' | 'updatedAt'> => ({
  date, title: '', summary: '', mainNote: '', importantEvents: '', learnings: '', ideas: '', todos: '',
  emotion: undefined, energy: 3, tags: [], category: 'Günlük', links: [], persons: [], organizations: []
})

export default function DailyPage() {
  const { saveDailyEntry, getDailyEntry, dailyEntries, categories } = useStore()
  const [date, setDate] = useState(todayISO())
  const [form, setForm] = useState<Omit<DailyEntry, 'id' | 'createdAt' | 'updatedAt'>>(empty(date))
  const [tagInput, setTagInput] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const existing = getDailyEntry(date)
    setForm(existing ? { ...existing } : empty(date))
    setSaved(false)
  }, [date])

  const set = (k: keyof typeof form, v: unknown) => { setForm(f => ({ ...f, [k]: v })); setSaved(false) }
  const addTag = () => { if (tagInput.trim()) { set('tags', [...form.tags, tagInput.trim()]); setTagInput('') } }

  const handleSave = () => {
    saveDailyEntry(form)
    setSaved(true)
    toast.success('Günlük kaydedildi')
  }

  const recentDates = dailyEntries.slice(0, 7).map(e => e.date)
  const isToday = date === todayISO()

  return (
    <div className="max-w-3xl mx-auto">
      {/* Date navigation */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <button onClick={() => setDate(format(subDays(parseISO(date), 1), 'yyyy-MM-dd'))} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"><ChevronLeft size={16} /></button>
          <div className="text-center">
            <div className="font-semibold">{fmtDate(date)}</div>
            {isToday && <div className="text-xs text-indigo-500">Bugün</div>}
          </div>
          <button onClick={() => setDate(format(addDays(parseISO(date), 1), 'yyyy-MM-dd'))} disabled={date >= todayISO()} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"><ChevronRight size={16} /></button>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} max={todayISO()} className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors">
            <Save size={14} /> {saved ? 'Kaydedildi ✓' : 'Kaydet'}
          </button>
        </div>
      </div>

      {/* Recent entries shortcuts */}
      {recentDates.length > 0 && (
        <div className="flex gap-1.5 mb-4 flex-wrap">
          {recentDates.map(d => (
            <button key={d} onClick={() => setDate(d)} className={clsx('px-2 py-1 rounded-lg text-xs transition-colors', d === date ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-indigo-400')}>
              {format(parseISO(d), 'd MMM')}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-4">
        {/* Title & Summary */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800">
          <input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Bugünün başlığı..." className="w-full text-lg font-semibold bg-transparent border-0 border-b border-slate-200 dark:border-slate-700 pb-2 mb-4 focus:outline-none focus:border-indigo-500" />
          <textarea value={form.summary} onChange={(e) => set('summary', e.target.value)} placeholder="Kısa özet..." rows={2} className="w-full px-0 py-1 bg-transparent text-slate-600 dark:text-slate-400 text-sm resize-none focus:outline-none placeholder:text-slate-400" />
        </div>

        {/* Emotion & Energy */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-2">Duygu Durumu</label>
              <div className="flex gap-2">
                {EMOTIONS.map(e => (
                  <button key={e.key} type="button" onClick={() => set('emotion', form.emotion === e.key ? undefined : e.key)} title={e.label} className={clsx('flex-1 py-2 rounded-xl text-lg transition-all', form.emotion === e.key ? 'bg-indigo-100 dark:bg-indigo-900/50 scale-110' : 'hover:bg-slate-100 dark:hover:bg-slate-800')}>
                    {e.emoji}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-2">Enerji Seviyesi: {form.energy}/5</label>
              <input type="range" min={1} max={5} value={form.energy} onChange={(e) => set('energy', Number(e.target.value))} className="w-full accent-indigo-600" />
              <div className="flex justify-between text-xs text-slate-400 mt-1"><span>Düşük</span><span>Yüksek</span></div>
            </div>
          </div>
        </div>

        {/* Main Note */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-medium mb-3">📝 Günlük Not</h3>
          <MarkdownEditor value={form.mainNote} onChange={(v) => set('mainNote', v)} placeholder="Bugün ne oldu? Düşüncelerini, gözlemlerini yaz..." minHeight={150} />
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
              <div className="flex flex-wrap gap-1 mb-2">{form.tags.map(t => <span key={t} className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 rounded-full text-xs flex items-center gap-1">{t}<button onClick={() => set('tags', form.tags.filter(x => x !== t))}>×</button></span>)}</div>
              <div className="flex gap-1">
                <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())} placeholder="Etiket ekle..." className="flex-1 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs focus:outline-none" />
                <button onClick={addTag} className="px-2 py-1 bg-indigo-600 text-white rounded text-xs">+</button>
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
          <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors">
            <Save size={15} /> {saved ? 'Kaydedildi ✓' : 'Günlüğü Kaydet'}
          </button>
        </div>
      </div>
    </div>
  )
}
