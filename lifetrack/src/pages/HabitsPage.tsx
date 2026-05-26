import { useState, useMemo } from 'react'
import { Plus, Trash2, Edit3, Flame, Trophy, CheckCircle2, Circle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useStore } from '../lib/store'
import Modal from '../components/common/Modal'
import Empty from '../components/common/Empty'
import { Habit } from '../types'
import clsx from 'clsx'

const ICONS = ['💪', '📚', '🏃', '🧘', '💧', '🥗', '😴', '✍️', '🎯', '🎸', '🧠', '💊', '🌅', '🚶', '🏋️', '🧹', '🙏', '🎨', '🌿', '☕']
const COLORS = ['#ea580c', '#8b5cf6', '#0891b2', '#10b981', '#f59e0b', '#e11d48', '#6366f1', '#06b6d4', '#84cc16', '#ec4899']

function HabitForm({ initial, onSave, onClose }: {
  initial?: Partial<Habit>; onSave: (h: Omit<Habit, 'id' | 'createdAt' | 'streak' | 'bestStreak'>) => void; onClose: () => void
}) {
  const [form, setForm] = useState<Omit<Habit, 'id' | 'createdAt' | 'streak' | 'bestStreak'>>({
    name: '', description: '', icon: '💪', color: '#ea580c',
    frequency: 'daily', targetDays: [1, 2, 3, 4, 5], isActive: true,
    ...initial,
  })
  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm(f => ({ ...f, [k]: v }))
  const dayLabels = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']

  return (
    <div className="p-5 space-y-4">
      <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Alışkanlık adı..." className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
      <textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Açıklama (isteğe bağlı)..." rows={2} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500" />

      <div>
        <label className="block text-xs text-slate-500 mb-2">İkon</label>
        <div className="flex flex-wrap gap-1.5">
          {ICONS.map(icon => (
            <button key={icon} type="button" onClick={() => set('icon', icon)}
              className={clsx('text-xl p-2 rounded-lg transition-all', form.icon === icon ? 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/30 scale-110' : 'hover:bg-slate-100 dark:hover:bg-slate-800')}>
              {icon}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs text-slate-500 mb-2">Renk</label>
        <div className="flex gap-2 flex-wrap">
          {COLORS.map(c => (
            <button key={c} type="button" onClick={() => set('color', c)}
              className={clsx('w-7 h-7 rounded-full transition-all', form.color === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-125' : '')}
              style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs text-slate-500 mb-2">Sıklık</label>
        <div className="flex gap-2">
          {(['daily', 'weekly'] as const).map(f => (
            <button key={f} type="button" onClick={() => set('frequency', f)}
              className={clsx('flex-1 py-2 rounded-lg text-sm border transition-colors', form.frequency === f ? 'bg-primary-600 text-white border-primary-600' : 'border-slate-200 dark:border-slate-700 hover:border-primary-400')}>
              {f === 'daily' ? 'Her Gün' : 'Haftalık'}
            </button>
          ))}
        </div>
      </div>

      {form.frequency === 'weekly' && (
        <div>
          <label className="block text-xs text-slate-500 mb-2">Günler</label>
          <div className="flex gap-1.5">
            {dayLabels.map((day, i) => (
              <button key={i} type="button"
                onClick={() => set('targetDays', form.targetDays.includes(i) ? form.targetDays.filter(d => d !== i) : [...form.targetDays, i])}
                className={clsx('flex-1 py-2 rounded-lg text-xs font-medium transition-colors border', form.targetDays.includes(i) ? 'bg-primary-600 text-white border-primary-600' : 'border-slate-200 dark:border-slate-700')}>
                {day}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
        <button type="button" onClick={onClose} className="flex-1 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm">İptal</button>
        <button type="button" onClick={() => { if (!form.name.trim()) { toast.error('İsim gerekli'); return } onSave(form) }} className="flex-1 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm">Kaydet</button>
      </div>
    </div>
  )
}

// 12-week heatmap for a single habit
function HabitHeatmap({ habitId }: { habitId: string }) {
  const { getHabitLogs } = useStore()
  const logs = getHabitLogs(habitId)
  const logSet = new Set(logs.filter(l => l.done).map(l => l.date))

  const weeks = 12
  const days = weeks * 7
  const today = new Date()
  const cells: { date: string; done: boolean; isFuture: boolean }[] = []

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const iso = d.toISOString().slice(0, 10)
    cells.push({ date: iso, done: logSet.has(iso), isFuture: d > today })
  }

  const weekCols: typeof cells[] = []
  for (let w = 0; w < weeks; w++) weekCols.push(cells.slice(w * 7, (w + 1) * 7))

  return (
    <div className="flex gap-0.5">
      {weekCols.map((week, wi) => (
        <div key={wi} className="flex flex-col gap-0.5">
          {week.map((cell, di) => (
            <div key={di} title={cell.date}
              className={clsx('w-3 h-3 rounded-sm transition-colors',
                cell.isFuture ? 'bg-slate-100 dark:bg-slate-800' :
                  cell.done ? 'opacity-90' : 'bg-slate-100 dark:bg-slate-800'
              )}
              style={cell.done ? { backgroundColor: 'rgb(var(--p-500))' } : {}} />
          ))}
        </div>
      ))}
    </div>
  )
}

export default function HabitsPage() {
  const { habits, addHabit, updateHabit, deleteHabit, toggleHabitLog, getHabitLogsForDate } = useStore()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null)
  const today = new Date().toISOString().slice(0, 10)
  const todayLogs = getHabitLogsForDate(today)
  const todayDone = new Set(todayLogs.map(l => l.habitId))

  const activeHabits = habits.filter(h => h.isActive)
  const completedToday = activeHabits.filter(h => todayDone.has(h.id)).length
  const completionRate = activeHabits.length ? Math.round((completedToday / activeHabits.length) * 100) : 0

  const handleSave = (form: Omit<Habit, 'id' | 'createdAt' | 'streak' | 'bestStreak'>) => {
    if (editingHabit) { updateHabit(editingHabit.id, form); toast.success('Güncellendi') }
    else { addHabit(form); toast.success('Alışkanlık eklendi') }
    setModalOpen(false); setEditingHabit(null)
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header stats */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Alışkanlıklar</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Bugün: {completedToday}/{activeHabits.length} tamamlandı
          </p>
        </div>
        <button onClick={() => { setEditingHabit(null); setModalOpen(true) }}
          className="flex items-center gap-2 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded-lg transition-colors">
          <Plus size={15} /> Yeni Alışkanlık
        </button>
      </div>

      {/* Today's progress bar */}
      {activeHabits.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 mb-5">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Bugünkü İlerleme</span>
            <span className="text-sm font-bold text-primary-500">%{completionRate}</span>
          </div>
          <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${completionRate}%`, backgroundColor: completionRate === 100 ? '#10b981' : 'rgb(var(--p-500))' }} />
          </div>
          {completionRate === 100 && (
            <p className="text-sm text-green-500 mt-2 flex items-center gap-1.5"><Trophy size={14} /> Tüm alışkanlıklar tamamlandı! Harika!</p>
          )}
        </div>
      )}

      {activeHabits.length === 0 ? (
        <Empty icon="💪" title="Henüz alışkanlık yok" description="Günlük alışkanlıkları takip et, seri yap, büyü."
          action={<button onClick={() => setModalOpen(true)} className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg">İlk Alışkanlığı Ekle</button>} />
      ) : (
        <div className="space-y-3">
          {activeHabits.map(h => {
            const done = todayDone.has(h.id)
            return (
              <div key={h.id} className={clsx('bg-white dark:bg-slate-900 rounded-xl border transition-all', done ? 'border-green-200 dark:border-green-800' : 'border-slate-200 dark:border-slate-800')}>
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    {/* Check button */}
                    <button onClick={() => toggleHabitLog(h.id, today)}
                      className={clsx('w-10 h-10 rounded-xl flex items-center justify-center transition-all text-xl shrink-0', done ? 'scale-110' : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700')}>
                      {done ? <CheckCircle2 size={24} className="text-green-500" /> : <Circle size={24} className="text-slate-300 dark:text-slate-600" />}
                    </button>

                    {/* Icon & name */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-2xl">{h.icon}</span>
                      <div>
                        <p className={clsx('font-medium text-sm', done && 'line-through text-slate-400')}>{h.name}</p>
                        {h.description && <p className="text-xs text-slate-400 truncate">{h.description}</p>}
                      </div>
                    </div>

                    {/* Streak */}
                    <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 shrink-0">
                      <Flame size={14} className={h.streak > 0 ? 'text-orange-500' : 'text-slate-300'} />
                      <span className="text-sm font-bold">{h.streak}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => { setEditingHabit(h); setModalOpen(true) }} className="p-1.5 hover:text-primary-500 transition-colors"><Edit3 size={14} /></button>
                      <button onClick={() => { if (confirm('Sil?')) { deleteHabit(h.id); toast.success('Silindi') } }} className="p-1.5 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </div>

                  {/* Heatmap */}
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] text-slate-400">Son 12 hafta</span>
                      <span className="text-[10px] text-slate-400">En uzun seri: {h.bestStreak} gün</span>
                    </div>
                    <HabitHeatmap habitId={h.id} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditingHabit(null) }} title={editingHabit ? 'Alışkanlığı Düzenle' : 'Yeni Alışkanlık'}>
        <HabitForm initial={editingHabit ?? undefined} onSave={handleSave} onClose={() => { setModalOpen(false); setEditingHabit(null) }} />
      </Modal>
    </div>
  )
}
