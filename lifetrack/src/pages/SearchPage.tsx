import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Search, Filter, FileText, CheckSquare, CalendarDays, Target, Notebook, X, Clock, Tag } from 'lucide-react'
import { useStore } from '../lib/store'
import { search } from '../lib/search'
import { SearchFilters, SearchResult } from '../types'
import { fmtDate } from '../utils/dates'
import Empty from '../components/common/Empty'
import Badge from '../components/common/Badge'
import clsx from 'clsx'

const TYPE_ICONS: Record<string, React.ElementType> = { note: FileText, task: CheckSquare, event: CalendarDays, goal: Target, daily: Notebook }
const TYPE_LABELS: Record<string, string> = { note: 'Not', task: 'Görev', event: 'Etkinlik', goal: 'Hedef', daily: 'Günlük' }
const TYPE_COLORS: Record<string, string> = { note: 'text-primary-500 bg-primary-100 dark:bg-primary-900/40', task: 'text-green-500 bg-green-100 dark:bg-green-900/40', event: 'text-blue-500 bg-blue-100 dark:bg-blue-900/40', goal: 'text-purple-500 bg-purple-100 dark:bg-purple-900/40', daily: 'text-orange-500 bg-orange-100 dark:bg-orange-900/40' }

const QUICK_FILTERS = [
  { label: 'Bugünkü notlar', filter: { query: '', types: ['note', 'daily'], categories: [], tags: [], dateFrom: new Date().toISOString().slice(0, 10), dateTo: new Date().toISOString().slice(0, 10), persons: [] } },
  { label: 'Tamamlanmamış görevler', filter: { query: '', types: ['task'], categories: [], tags: [], persons: [], taskStatus: 'todo' as const } },
  { label: 'Kritik görevler', filter: { query: '', types: ['task'], categories: [], tags: [], persons: [], priority: 'critical' as const } },
  { label: 'Son 7 gün', filter: { query: '', types: [], categories: [], tags: [], persons: [], dateFrom: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10) } },
  { label: 'Son 30 gün', filter: { query: '', types: [], categories: [], tags: [], persons: [], dateFrom: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10) } },
  { label: 'Bu yılın notları', filter: { query: '', types: ['note'], categories: [], tags: [], persons: [], dateFrom: `${new Date().getFullYear()}-01-01` } },
  { label: 'Devam eden görevler', filter: { query: '', types: ['task'], categories: [], tags: [], persons: [], taskStatus: 'in-progress' as const } },
  { label: 'Harika günler', filter: { query: '', types: ['daily', 'note'], categories: [], tags: [], persons: [], emotion: 'great' as const } },
]

const defaultFilters: SearchFilters = { query: '', types: [], categories: [], tags: [], persons: [] }

export default function SearchPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { notes, tasks, events, goals, dailyEntries, categories, allTags, allPersons, tagCounts } = useStore()
  const [filters, setFilters] = useState<SearchFilters>({ ...defaultFilters, query: params.get('q') ?? '', tags: params.get('tag') ? [params.get('tag')!] : [] })
  const [showFilters, setShowFilters] = useState(false)

  const setF = (k: keyof SearchFilters, v: unknown) => setFilters(f => ({ ...f, [k]: v }))
  const toggleType = (t: string) => setFilters(f => ({ ...f, types: f.types.includes(t) ? f.types.filter(x => x !== t) : [...f.types, t] }))
  const toggleTag = (t: string) => setFilters(f => ({ ...f, tags: f.tags.includes(t) ? f.tags.filter(x => x !== t) : [...f.tags, t] }))

  const results = useMemo(() => search(filters, notes, tasks, events, goals, dailyEntries), [filters, notes, tasks, events, goals, dailyEntries])
  const hasActiveFilters = filters.query || filters.types.length || filters.categories.length || filters.tags.length || filters.dateFrom || filters.dateTo || filters.emotion || filters.taskStatus || filters.priority || filters.persons.length

  const handleResultClick = (r: SearchResult) => {
    if (r.type === 'note') navigate('/notes?id=' + r.id)
    else if (r.type === 'task') navigate('/tasks')
    else if (r.type === 'event') navigate('/calendar')
    else if (r.type === 'goal') navigate('/goals')
    else if (r.type === 'daily') navigate('/daily')
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-xl font-bold mb-6">Akıllı Arama</h1>

      {/* Search bar */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            value={filters.query}
            onChange={(e) => setF('query', e.target.value)}
            placeholder="Tüm kayıtlarda ara: kişi, konu, etiket, tarih..."
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            autoFocus
          />
          {filters.query && <button onClick={() => setF('query', '')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={14} /></button>}
        </div>
        <button onClick={() => setShowFilters(!showFilters)} className={clsx('px-3 py-2 rounded-xl border text-sm flex items-center gap-1.5 transition-colors', showFilters ? 'bg-primary-600 text-white border-primary-600' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-primary-400')}>
          <Filter size={14} /> Filtreler
        </button>
        {hasActiveFilters && <button onClick={() => setFilters(defaultFilters)} className="px-3 py-2 text-xs text-red-500 hover:text-red-400 border border-red-200 dark:border-red-800 rounded-xl transition-colors">Temizle</button>}
      </div>

      {/* Quick filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {QUICK_FILTERS.map(qf => (
          <button key={qf.label} onClick={() => setFilters({ ...defaultFilters, ...qf.filter })} className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-full text-xs hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors flex items-center gap-1">
            <Clock size={11} /> {qf.label}
          </button>
        ))}
      </div>

      {/* Advanced filters panel */}
      {showFilters && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 mb-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-2">İçerik Türü</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(TYPE_LABELS).map(([type, label]) => {
                const Icon = TYPE_ICONS[type]
                return (
                  <button key={type} onClick={() => toggleType(type)} className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border', filters.types.includes(type) ? 'bg-primary-600 text-white border-primary-600' : 'border-slate-200 dark:border-slate-700 hover:border-primary-400')}>
                    <Icon size={12} /> {label}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Başlangıç Tarihi</label>
              <input type="date" value={filters.dateFrom ?? ''} onChange={(e) => setF('dateFrom', e.target.value || undefined)} className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Bitiş Tarihi</label>
              <input type="date" value={filters.dateTo ?? ''} onChange={(e) => setF('dateTo', e.target.value || undefined)} className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Görev Durumu</label>
              <select value={filters.taskStatus ?? ''} onChange={(e) => setF('taskStatus', e.target.value || undefined)} className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary-500">
                <option value="">Tümü</option><option value="todo">Yapılacak</option><option value="in-progress">Devam</option><option value="done">Tamamlandı</option><option value="postponed">Ertelendi</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Duygu Durumu</label>
              <select value={filters.emotion ?? ''} onChange={(e) => setF('emotion', e.target.value || undefined)} className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary-500">
                <option value="">Tümü</option><option value="great">😄 Harika</option><option value="good">🙂 İyi</option><option value="neutral">😐 Normal</option><option value="bad">😔 Kötü</option><option value="terrible">😢 Berbat</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-2 flex items-center gap-1"><Tag size={11} /> Etiketler</label>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {tagCounts().slice(0, 30).map(t => (
                <button key={t.name} onClick={() => toggleTag(t.name)} className={clsx('px-2 py-0.5 rounded-full text-xs transition-colors', filters.tags.includes(t.name) ? 'bg-primary-600 text-white' : 'bg-slate-100 dark:bg-slate-800 hover:bg-primary-100 dark:hover:bg-primary-900/40 hover:text-primary-600')}>
                  #{t.name} <span className="opacity-60">{t.count}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-slate-500">{hasActiveFilters ? `${results.length} sonuç bulundu` : 'Aramak için yazmaya başlayın'}</span>
        {results.length > 0 && <span className="text-xs text-slate-400">{[...new Set(results.map(r => r.type))].map(t => `${results.filter(r => r.type === t).length} ${TYPE_LABELS[t]}`).join(' · ')}</span>}
      </div>

      {!hasActiveFilters
        ? <Empty icon="🔍" title="Arama yapın" description="Notlar, görevler, etkinlikler, hedefler ve günlük kayıtlarınızı arayın." />
        : results.length === 0
          ? <Empty icon="📭" title="Sonuç bulunamadı" description="Farklı anahtar kelimeler veya filtreler deneyin." />
          : <div className="space-y-2">
              {results.map(r => {
                const Icon = TYPE_ICONS[r.type]
                return (
                  <div key={`${r.type}-${r.id}`} onClick={() => handleResultClick(r)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 cursor-pointer hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-md transition-all group">
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${TYPE_COLORS[r.type]}`}>
                        <Icon size={15} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{r.title}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${TYPE_COLORS[r.type]}`}>{TYPE_LABELS[r.type]}</span>
                        </div>
                        {r.preview && <p className="text-xs text-slate-500 line-clamp-2">{r.preview}</p>}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="text-[10px] text-slate-400">{fmtDate(r.date)}</span>
                          <span className="text-[10px] text-slate-400">•</span>
                          <span className="text-[10px] text-slate-400">{r.category}</span>
                          {r.tags.slice(0, 3).map(t => <Badge key={t} label={`#${t}`} />)}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
      }
    </div>
  )
}
