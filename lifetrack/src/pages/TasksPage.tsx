import { useState } from 'react'
import { Plus, Trash2, Edit3, CheckCircle2, Circle, Clock, AlertTriangle, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { useStore } from '../lib/store'
import { fmtDateShort } from '../utils/dates'
import Modal from '../components/common/Modal'
import Badge, { PriorityBadge, StatusBadge } from '../components/common/Badge'
import Empty from '../components/common/Empty'
import { Task, Priority, TaskStatus } from '../types'
import clsx from 'clsx'

const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'critical']
const STATUSES: TaskStatus[] = ['todo', 'in-progress', 'done', 'postponed', 'cancelled']

function TaskForm({ initial, onSave, onClose }: { initial?: Partial<Task>; onSave: (t: Partial<Task>) => void; onClose: () => void }) {
  const { categories } = useStore()
  const [form, setForm] = useState<Partial<Task>>({ title: '', description: '', priority: 'medium', status: 'todo', tags: [], category: 'İş', ...initial })
  const [tagInput, setTagInput] = useState('')

  const set = (k: keyof Task, v: unknown) => setForm(f => ({ ...f, [k]: v }))
  const addTag = () => { if (tagInput.trim()) { set('tags', [...(form.tags ?? []), tagInput.trim()]); setTagInput('') } }

  return (
    <div className="p-5 space-y-4">
      <input value={form.title ?? ''} onChange={(e) => set('title', e.target.value)} placeholder="Görev başlığı..." className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
      <textarea value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} placeholder="Açıklama..." rows={3} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500" />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Öncelik</label>
          <select value={form.priority} onChange={(e) => set('priority', e.target.value)} className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="low">Düşük</option><option value="medium">Orta</option><option value="high">Yüksek</option><option value="critical">Kritik</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Durum</label>
          <select value={form.status} onChange={(e) => set('status', e.target.value)} className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="todo">Yapılacak</option><option value="in-progress">Devam Ediyor</option><option value="done">Tamamlandı</option><option value="postponed">Ertelendi</option><option value="cancelled">İptal</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Son Tarih</label>
          <input type="date" value={form.dueDate ?? ''} onChange={(e) => set('dueDate', e.target.value)} className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Kategori</label>
          <select value={form.category} onChange={(e) => set('category', e.target.value)} className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">Tekrar</label>
        <select value={form.recurring ?? ''} onChange={(e) => set('recurring', e.target.value || undefined)} className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="">Tekrar yok</option><option value="daily">Günlük</option><option value="weekly">Haftalık</option><option value="monthly">Aylık</option>
        </select>
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">Etiketler</label>
        <div className="flex flex-wrap gap-1 mb-1">{form.tags?.map(t => <Badge key={t} label={t} removable onRemove={() => set('tags', form.tags?.filter(x => x !== t))} />)}</div>
        <div className="flex gap-1">
          <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())} placeholder="Etiket ekle..." className="flex-1 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs focus:outline-none" />
          <button type="button" onClick={addTag} className="px-2 py-1 bg-primary-600 text-white rounded text-xs">+</button>
        </div>
      </div>
      <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
        <button onClick={onClose} className="flex-1 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-800">İptal</button>
        <button onClick={() => onSave(form)} className="flex-1 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm">Kaydet</button>
      </div>
    </div>
  )
}

const statusLabels: Record<TaskStatus, string> = { todo: 'Yapılacak', 'in-progress': 'Devam', done: 'Tamamlandı', postponed: 'Ertelendi', cancelled: 'İptal' }

export default function TasksPage() {
  const { tasks, addTask, updateTask, deleteTask } = useStore()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [q, setQ] = useState('')

  const filtered = tasks.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false
    if (q && !t.title.toLowerCase().includes(q.toLowerCase()) && !t.description.toLowerCase().includes(q.toLowerCase())) return false
    return true
  }).sort((a, b) => {
    const pOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    if (pOrder[a.priority] !== pOrder[b.priority]) return pOrder[a.priority] - pOrder[b.priority]
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  const handleSave = (form: Partial<Task>) => {
    if (!form.title?.trim()) { toast.error('Başlık gerekli'); return }
    if (editingTask) { updateTask(editingTask.id, form); toast.success('Güncellendi') }
    else { addTask({ title: form.title!, description: form.description ?? '', priority: form.priority ?? 'medium', status: form.status ?? 'todo', tags: form.tags ?? [], category: form.category ?? 'İş', dueDate: form.dueDate, recurring: form.recurring }); toast.success('Görev eklendi') }
    setModalOpen(false); setEditingTask(null)
  }

  const toggleDone = (t: Task) => {
    const newStatus = t.status === 'done' ? 'todo' : 'done'
    updateTask(t.id, { status: newStatus, completedAt: newStatus === 'done' ? new Date().toISOString() : undefined })
  }

  const stats = { total: tasks.length, done: tasks.filter(t => t.status === 'done').length, critical: tasks.filter(t => t.priority === 'critical' && t.status !== 'done').length, overdue: tasks.filter(t => t.dueDate && t.dueDate < new Date().toISOString().slice(0, 10) && t.status !== 'done').length }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Görevler</h1>
        <button onClick={() => { setEditingTask(null); setModalOpen(true) }} className="flex items-center gap-2 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded-lg transition-colors">
          <Plus size={15} /> Yeni Görev
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-5">
        {[{ label: 'Toplam', value: stats.total, color: 'text-slate-600' }, { label: 'Tamamlandı', value: stats.done, color: 'text-green-600' }, { label: 'Kritik', value: stats.critical, color: 'text-red-600' }, { label: 'Gecikmiş', value: stats.overdue, color: 'text-orange-600' }].map(s => (
          <div key={s.label} className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800 text-center">
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Görev ara..." className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <div className="flex gap-2">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="all">Tüm Durumlar</option>
            {STATUSES.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}
          </select>
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="all">Tüm Öncelikler</option>
            {PRIORITIES.map(p => <option key={p} value={p}>{p === 'low' ? 'Düşük' : p === 'medium' ? 'Orta' : p === 'high' ? 'Yüksek' : 'Kritik'}</option>)}
          </select>
        </div>
      </div>

      {filtered.length === 0
        ? <Empty icon="✅" title="Görev bulunamadı" description="Yeni görev ekleyin." action={<button onClick={() => setModalOpen(true)} className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg">Yeni Görev</button>} />
        : <div className="space-y-2">
            {filtered.map(t => {
              const isOverdue = t.dueDate && t.dueDate < new Date().toISOString().slice(0, 10) && t.status !== 'done'
              return (
                <div key={t.id} className={clsx('bg-white dark:bg-slate-900 border rounded-xl p-4 flex items-start gap-3 group hover:border-primary-400 dark:hover:border-primary-500 transition-all', t.status === 'done' ? 'opacity-60 border-slate-200 dark:border-slate-800' : isOverdue ? 'border-orange-300 dark:border-orange-800' : 'border-slate-200 dark:border-slate-800')}>
                  <button onClick={() => toggleDone(t)} className="mt-0.5 shrink-0 text-slate-400 hover:text-green-500 transition-colors">
                    {t.status === 'done' ? <CheckCircle2 size={18} className="text-green-500" /> : t.priority === 'critical' ? <AlertTriangle size={18} className="text-red-500" /> : <Circle size={18} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <span className={clsx('font-medium text-sm', t.status === 'done' && 'line-through text-slate-400')}>{t.title}</span>
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingTask(t); setModalOpen(true) }} className="p-1 hover:text-primary-500"><Edit3 size={13} /></button>
                        <button onClick={() => { if (confirm('Silmek istediğinizden emin misiniz?')) { deleteTask(t.id); toast.success('Silindi') } }} className="p-1 hover:text-red-500"><Trash2 size={13} /></button>
                      </div>
                    </div>
                    {t.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{t.description}</p>}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <PriorityBadge priority={t.priority} />
                      <StatusBadge status={t.status} />
                      {t.dueDate && <span className={clsx('flex items-center gap-1 text-xs', isOverdue ? 'text-orange-500' : 'text-slate-400')}><Clock size={11} />{fmtDateShort(t.dueDate)}</span>}
                      {t.recurring && <span className="text-xs text-purple-500">↻ {t.recurring === 'daily' ? 'Günlük' : t.recurring === 'weekly' ? 'Haftalık' : 'Aylık'}</span>}
                      {t.tags.slice(0, 2).map(tag => <Badge key={tag} label={`#${tag}`} />)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
      }

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditingTask(null) }} title={editingTask ? 'Görevi Düzenle' : 'Yeni Görev'}>
        <TaskForm initial={editingTask ?? undefined} onSave={handleSave} onClose={() => { setModalOpen(false); setEditingTask(null) }} />
      </Modal>
    </div>
  )
}
