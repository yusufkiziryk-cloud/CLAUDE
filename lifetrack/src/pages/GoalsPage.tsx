import { useState } from 'react'
import { Plus, Trash2, Edit3, Target, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useStore } from '../lib/store'
import { fmtDate, fmtDateShort } from '../utils/dates'
import Modal from '../components/common/Modal'
import Empty from '../components/common/Empty'
import { Goal, GoalStatus } from '../types'
import clsx from 'clsx'

function GoalForm({ initial, onSave, onClose }: { initial?: Partial<Goal>; onSave: (g: Partial<Goal>) => void; onClose: () => void }) {
  const { categories } = useStore()
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState<Partial<Goal>>({ title: '', description: '', startDate: today, endDate: `${new Date().getFullYear()}-12-31`, progress: 0, status: 'active', category: 'Hedefler', linkedNoteIds: [], monthlyReviews: [], ...initial })
  const set = (k: keyof Goal, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="p-5 space-y-4">
      <input value={form.title ?? ''} onChange={(e) => set('title', e.target.value)} placeholder="Hedef adı..." className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      <textarea value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} placeholder="Hedefini detaylı açıkla..." rows={3} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Başlangıç</label>
          <input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Bitiş</label>
          <input type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Kategori</label>
          <select value={form.category} onChange={(e) => set('category', e.target.value)} className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Durum</label>
          <select value={form.status} onChange={(e) => set('status', e.target.value)} className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="active">Aktif</option><option value="completed">Tamamlandı</option><option value="paused">Durduruldu</option><option value="cancelled">İptal</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">İlerleme: %{form.progress}</label>
        <input type="range" min={0} max={100} value={form.progress} onChange={(e) => set('progress', Number(e.target.value))} className="w-full accent-indigo-600" />
      </div>
      <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
        <button onClick={onClose} className="flex-1 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-800">İptal</button>
        <button onClick={() => onSave(form)} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm">Kaydet</button>
      </div>
    </div>
  )
}

function ReviewModal({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const { updateGoal } = useStore()
  const currentMonth = new Date().toISOString().slice(0, 7)
  const existing = goal.monthlyReviews.find(r => r.month === currentMonth)
  const [note, setNote] = useState(existing?.note ?? '')
  const [progress, setProgress] = useState(existing?.progress ?? goal.progress)

  const handleSave = () => {
    const reviews = goal.monthlyReviews.filter(r => r.month !== currentMonth)
    updateGoal(goal.id, { monthlyReviews: [...reviews, { month: currentMonth, note, progress }], progress })
    toast.success('Değerlendirme kaydedildi')
    onClose()
  }

  return (
    <div className="p-5 space-y-4">
      <div>
        <label className="block text-xs text-slate-500 mb-1">Bu Ayki İlerleme: %{progress}</label>
        <input type="range" min={0} max={100} value={progress} onChange={(e) => setProgress(Number(e.target.value))} className="w-full accent-indigo-600" />
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">Aylık Değerlendirme Notu</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Bu ay ne yaptım? Engeller nelerdi?" rows={4} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm">İptal</button>
        <button onClick={handleSave} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm">Kaydet</button>
      </div>
    </div>
  )
}

const statusConfig: Record<GoalStatus, { label: string; color: string }> = {
  active: { label: 'Aktif', color: 'text-green-600 bg-green-100 dark:bg-green-900/40' },
  completed: { label: 'Tamamlandı', color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/40' },
  paused: { label: 'Durduruldu', color: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/40' },
  cancelled: { label: 'İptal', color: 'text-red-600 bg-red-100 dark:bg-red-900/40' },
}

export default function GoalsPage() {
  const { goals, addGoal, updateGoal, deleteGoal } = useStore()
  const [modalOpen, setModalOpen] = useState(false)
  const [reviewModal, setReviewModal] = useState<Goal | null>(null)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const filtered = goals.filter(g => statusFilter === 'all' || g.status === statusFilter)

  const handleSave = (form: Partial<Goal>) => {
    if (!form.title?.trim()) { toast.error('Başlık gerekli'); return }
    if (editingGoal) { updateGoal(editingGoal.id, form); toast.success('Güncellendi') }
    else { addGoal({ title: form.title!, description: form.description ?? '', startDate: form.startDate!, endDate: form.endDate!, progress: form.progress ?? 0, status: form.status ?? 'active', category: form.category ?? 'Hedefler', linkedNoteIds: [], monthlyReviews: [] }); toast.success('Hedef eklendi') }
    setModalOpen(false); setEditingGoal(null)
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Hedefler</h1>
        <button onClick={() => { setEditingGoal(null); setModalOpen(true) }} className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors">
          <Plus size={15} /> Yeni Hedef
        </button>
      </div>

      <div className="flex gap-2 mb-5">
        {['all', 'active', 'completed', 'paused', 'cancelled'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors', statusFilter === s ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-indigo-400')}>
            {s === 'all' ? 'Tümü' : statusConfig[s as GoalStatus]?.label}
          </button>
        ))}
      </div>

      {filtered.length === 0
        ? <Empty icon="🎯" title="Hedef yok" description="Yıllık hedeflerini belirle ve takip et." action={<button onClick={() => setModalOpen(true)} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg">Hedef Ekle</button>} />
        : <div className="space-y-4">
            {filtered.map(g => {
              const cfg = statusConfig[g.status]
              return (
                <div key={g.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{g.title}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
                      </div>
                      {g.description && <p className="text-sm text-slate-500 line-clamp-2">{g.description}</p>}
                    </div>
                    <div className="flex gap-1 ml-3 shrink-0">
                      <button onClick={() => setReviewModal(g)} title="Aylık Değerlendirme" className="px-2 py-1 text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors">Değerlendirme</button>
                      <button onClick={() => { setEditingGoal(g); setModalOpen(true) }} className="p-1.5 hover:text-indigo-500"><Edit3 size={14} /></button>
                      <button onClick={() => { if (confirm('Silmek istediğinizden emin misiniz?')) { deleteGoal(g.id); toast.success('Silindi') } }} className="p-1.5 hover:text-red-500"><Trash2 size={14} /></button>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                      <span>İlerleme</span>
                      <span className="font-semibold text-indigo-500">%{g.progress}</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                      <div className={clsx('h-2 rounded-full transition-all', g.status === 'completed' ? 'bg-green-500' : 'bg-indigo-500')} style={{ width: `${g.progress}%` }} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-3">
                      <span>{g.category}</span>
                      <span>{fmtDateShort(g.startDate)} — {fmtDateShort(g.endDate)}</span>
                    </div>
                    {g.monthlyReviews.length > 0 && <span>{g.monthlyReviews.length} aylık değerlendirme</span>}
                  </div>

                  {g.monthlyReviews.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <div className="text-xs text-slate-500 mb-2">Son Değerlendirme</div>
                      <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
                        {g.monthlyReviews[g.monthlyReviews.length - 1].note || '—'}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
      }

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditingGoal(null) }} title={editingGoal ? 'Hedefi Düzenle' : 'Yeni Hedef'}>
        <GoalForm initial={editingGoal ?? undefined} onSave={handleSave} onClose={() => { setModalOpen(false); setEditingGoal(null) }} />
      </Modal>

      <Modal open={!!reviewModal} onClose={() => setReviewModal(null)} title={`Aylık Değerlendirme — ${reviewModal?.title}`}>
        {reviewModal && <ReviewModal goal={reviewModal} onClose={() => setReviewModal(null)} />}
      </Modal>
    </div>
  )
}
