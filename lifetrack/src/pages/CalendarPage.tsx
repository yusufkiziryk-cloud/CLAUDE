import { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Trash2, Edit3, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useStore } from '../lib/store'
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addDays, todayISO, monthNames, dayNames, fmtDate } from '../utils/dates'
import Modal from '../components/common/Modal'
import { CalendarEvent, EventType } from '../types'
import clsx from 'clsx'

const EVENT_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899']
const EVENT_TYPES: { value: EventType; label: string }[] = [{ value: 'event', label: 'Etkinlik' }, { value: 'meeting', label: 'Toplantı' }, { value: 'reminder', label: 'Hatırlatma' }, { value: 'birthday', label: 'Doğum Günü' }, { value: 'deadline', label: 'Son Tarih' }]

function EventForm({ initial, onSave, onClose }: { initial?: Partial<CalendarEvent>; onSave: (e: Partial<CalendarEvent>) => void; onClose: () => void }) {
  const { categories } = useStore()
  const [form, setForm] = useState<Partial<CalendarEvent>>({ title: '', description: '', date: todayISO(), time: '', type: 'event', importance: 'medium', category: 'Kişisel', color: '#6366f1', ...initial })
  const set = (k: keyof CalendarEvent, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="p-5 space-y-4">
      <input value={form.title ?? ''} onChange={(e) => set('title', e.target.value)} placeholder="Etkinlik başlığı..." className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      <textarea value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} placeholder="Açıklama..." rows={2} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Tarih</label>
          <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Saat</label>
          <input type="time" value={form.time ?? ''} onChange={(e) => set('time', e.target.value)} className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Tür</label>
          <select value={form.type} onChange={(e) => set('type', e.target.value)} className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Önem</label>
          <select value={form.importance} onChange={(e) => set('importance', e.target.value)} className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="low">Düşük</option><option value="medium">Orta</option><option value="high">Yüksek</option><option value="critical">Kritik</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Kategori</label>
          <select value={form.category} onChange={(e) => set('category', e.target.value)} className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Renk</label>
          <div className="flex gap-1 flex-wrap">
            {EVENT_COLORS.map(c => <button key={c} type="button" onClick={() => set('color', c)} className={clsx('w-6 h-6 rounded-full transition-transform', form.color === c && 'ring-2 ring-offset-2 ring-slate-400 scale-110')} style={{ backgroundColor: c }} />)}
          </div>
        </div>
      </div>
      <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
        <button onClick={onClose} className="flex-1 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-800">İptal</button>
        <button onClick={() => onSave(form)} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm">Kaydet</button>
      </div>
    </div>
  )
}

export default function CalendarPage() {
  const { events, addEvent, updateEvent, deleteEvent } = useStore()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [detailDate, setDetailDate] = useState<string | null>(null)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

  const startPad = (getDay(monthStart) + 6) % 7
  const paddedDays = [...Array(startPad).fill(null), ...days]
  while (paddedDays.length % 7 !== 0) paddedDays.push(null)

  const getEventsForDate = (d: Date) => {
    const ds = format(d, 'yyyy-MM-dd')
    return events.filter(e => e.date === ds)
  }

  const handleSave = (form: Partial<CalendarEvent>) => {
    if (!form.title?.trim()) { toast.error('Başlık gerekli'); return }
    if (editingEvent) { updateEvent(editingEvent.id, form); toast.success('Güncellendi') }
    else { addEvent({ title: form.title!, description: form.description ?? '', date: form.date ?? todayISO(), time: form.time, type: form.type ?? 'event', importance: form.importance ?? 'medium', category: form.category ?? 'Kişisel', color: form.color ?? '#6366f1' }); toast.success('Etkinlik eklendi') }
    setModalOpen(false); setEditingEvent(null)
  }

  const selectedDayEvents = detailDate ? events.filter(e => e.date === detailDate).sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '')) : []
  const today = todayISO()
  const upcomingEvents = events.filter(e => e.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 10)

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Takvim</h1>
        <button onClick={() => { setEditingEvent(null); setModalOpen(true) }} className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors">
          <Plus size={15} /> Etkinlik Ekle
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"><ChevronLeft size={16} /></button>
            <h2 className="font-semibold">{monthNames[month]} {year}</h2>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"><ChevronRight size={16} /></button>
          </div>
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800">
            {dayNames.map(d => <div key={d} className="py-2 text-center text-xs font-medium text-slate-400">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {paddedDays.map((day, i) => {
              if (!day) return <div key={i} className="h-24 border-r border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50" />
              const ds = format(day, 'yyyy-MM-dd')
              const dayEvents = getEventsForDate(day)
              const isToday = ds === today
              const isSelected = ds === detailDate
              return (
                <div key={ds} onClick={() => setDetailDate(ds === detailDate ? null : ds)} className={clsx('h-24 border-r border-b border-slate-100 dark:border-slate-800 p-1.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors overflow-hidden', isSelected && 'bg-indigo-50 dark:bg-indigo-950/40')}>
                  <div className={clsx('w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium mb-1', isToday ? 'bg-indigo-600 text-white' : 'text-slate-700 dark:text-slate-300')}>
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 2).map(e => (
                      <div key={e.id} className="text-[10px] truncate px-1 rounded" style={{ backgroundColor: e.color + '33', color: e.color }}>
                        {e.time && `${e.time} `}{e.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && <div className="text-[10px] text-slate-400 pl-1">+{dayEvents.length - 2} daha</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Side panel */}
        <div className="space-y-4">
          {detailDate && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium">{fmtDate(detailDate)}</h3>
                <div className="flex gap-1">
                  <button onClick={() => { setEditingEvent(null); setModalOpen(true) }} className="p-1 text-indigo-500 hover:text-indigo-400"><Plus size={14} /></button>
                  <button onClick={() => setDetailDate(null)} className="p-1 text-slate-400 hover:text-slate-600"><X size={14} /></button>
                </div>
              </div>
              {selectedDayEvents.length === 0
                ? <p className="text-xs text-slate-400">Bu gün için etkinlik yok.</p>
                : <div className="space-y-2">
                    {selectedDayEvents.map(e => (
                      <div key={e.id} className="p-2.5 rounded-lg border-l-2 bg-slate-50 dark:bg-slate-800 group" style={{ borderLeftColor: e.color }}>
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-sm font-medium">{e.title}</div>
                            {e.time && <div className="text-xs text-slate-400">{e.time}</div>}
                            {e.description && <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">{e.description}</div>}
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setEditingEvent(e); setModalOpen(true) }} className="p-0.5 hover:text-indigo-500"><Edit3 size={12} /></button>
                            <button onClick={() => { deleteEvent(e.id); toast.success('Silindi') }} className="p-0.5 hover:text-red-500"><Trash2 size={12} /></button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
              }
            </div>
          )}

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <h3 className="text-sm font-medium mb-3">Yaklaşan Etkinlikler</h3>
            {upcomingEvents.length === 0
              ? <p className="text-xs text-slate-400">Yaklaşan etkinlik yok.</p>
              : <div className="space-y-2">
                  {upcomingEvents.map(e => (
                    <div key={e.id} onClick={() => setDetailDate(e.date)} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors">
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">{e.title}</div>
                        <div className="text-[10px] text-slate-400">{fmtDate(e.date)} {e.time && `• ${e.time}`}</div>
                      </div>
                    </div>
                  ))}
                </div>
            }
          </div>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditingEvent(null) }} title={editingEvent ? 'Etkinliği Düzenle' : 'Yeni Etkinlik'}>
        <EventForm initial={editingEvent ? editingEvent : (detailDate ? { date: detailDate } : undefined)} onSave={handleSave} onClose={() => { setModalOpen(false); setEditingEvent(null) }} />
      </Modal>
    </div>
  )
}
