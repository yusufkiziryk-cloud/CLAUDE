import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { BookOpen, CheckSquare, Target, CalendarDays, TrendingUp, Pin, Plus, ArrowRight } from 'lucide-react'
import { useStore } from '../lib/store'
import { fmtDate, fmtDateShort, yearProgress, todayISO, parseISO, isThisWeek, isThisMonth, monthNames } from '../utils/dates'
import Badge, { PriorityBadge, StatusBadge } from '../components/common/Badge'
import Empty from '../components/common/Empty'
import ReactMarkdown from 'react-markdown'

function StatCard({ icon: Icon, label, value, color, sub }: { icon: React.ElementType; label: string; value: number | string; color: string; sub?: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-slate-500">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={16} className="text-white" />
        </div>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { notes, tasks, events, goals, dailyEntries, tagCounts, loadDemoData, hasDemoData } = useStore()
  const [quickNote, setQuickNote] = useState('')

  const today = todayISO()
  const totalNotes = notes.filter(n => !n.archived).length
  const weekNotes = notes.filter(n => { try { return isThisWeek(parseISO(n.createdAt), { weekStartsOn: 1 }) } catch { return false } }).length
  const monthTasks = tasks.filter(t => { try { return isThisMonth(parseISO(t.createdAt)) } catch { return false } }).length
  const doneTasks = tasks.filter(t => t.status === 'done').length
  const totalTasks = tasks.length
  const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

  const todayEvents = events.filter(e => e.date === today)
  const upcomingEvents = events.filter(e => e.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5)
  const pinnedNotes = notes.filter(n => n.pinned && !n.archived).slice(0, 3)
  const recentNotes = notes.filter(n => !n.archived).slice(0, 5)
  const topTags = tagCounts().slice(0, 12)
  const progress = yearProgress()

  const taskPieData = [
    { name: 'Tamamlandı', value: doneTasks, color: '#10b981' },
    { name: 'Devam', value: tasks.filter(t => t.status === 'in-progress').length, color: '#6366f1' },
    { name: 'Yapılacak', value: tasks.filter(t => t.status === 'todo').length, color: '#94a3b8' },
    { name: 'Ertelendi', value: tasks.filter(t => t.status === 'postponed').length, color: '#f59e0b' },
  ].filter(d => d.value > 0)

  const monthlyNotesData = monthNames.slice(0, new Date().getMonth() + 1).map((month, i) => ({
    month: month.slice(0, 3),
    notes: notes.filter(n => { try { const d = parseISO(n.createdAt); return d.getMonth() === i && d.getFullYear() === new Date().getFullYear() } catch { return false } }).length,
  }))

  const handleQuickNote = () => {
    if (!quickNote.trim()) return
    navigate(`/notes?new=1&content=${encodeURIComponent(quickNote)}`)
    setQuickNote('')
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Dashboard</h1>
          <p className="text-sm text-slate-500">{fmtDate(new Date())}</p>
        </div>
        {!hasDemoData && notes.length === 0 && (
          <button onClick={loadDemoData} className="text-sm px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors">
            Demo veriyi yükle
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={BookOpen} label="Toplam Not" value={totalNotes} color="bg-indigo-500" sub={`Bu hafta +${weekNotes}`} />
        <StatCard icon={CheckSquare} label="Görev Tamamlama" value={`%${completionRate}`} color="bg-green-500" sub={`${doneTasks}/${totalTasks} tamamlandı`} />
        <StatCard icon={CalendarDays} label="Bu Ay Görev" value={monthTasks} color="bg-blue-500" sub={`${todayEvents.length} bugün etkinlik`} />
        <StatCard icon={Target} label="Aktif Hedef" value={goals.filter(g => g.status === 'active').length} color="bg-purple-500" sub={`Toplam ${goals.length} hedef`} />
      </div>

      {/* Year Progress */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium flex items-center gap-2"><TrendingUp size={15} /> Yıllık İlerleme</span>
          <span className="text-sm font-bold text-indigo-500">%{progress}</span>
        </div>
        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5">
          <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex justify-between text-xs text-slate-400 mt-1">
          <span>1 Ocak</span><span>31 Aralık</span>
        </div>
      </div>

      {/* Quick Note */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
        <h3 className="text-sm font-medium mb-3 flex items-center gap-2"><Plus size={15} /> Hızlı Not</h3>
        <div className="flex gap-2">
          <input value={quickNote} onChange={(e) => setQuickNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleQuickNote()}
            placeholder="Düşünceni yaz, Enter ile kaydet..."
            className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <button onClick={handleQuickNote} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors">Kaydet</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Notes */}
        <div className="lg:col-span-2 space-y-4">
          {pinnedNotes.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 mb-3">
                <Pin size={14} className="text-indigo-400" />
                <h3 className="text-sm font-medium">Sabitlenmiş Notlar</h3>
              </div>
              <div className="space-y-2">
                {pinnedNotes.map(n => (
                  <div key={n.id} onClick={() => navigate('/notes?id=' + n.id)} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                    <div className="font-medium text-sm">{n.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">{n.content.replace(/[#*`]/g, '').slice(0, 80)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">Son Notlar</h3>
              <button onClick={() => navigate('/notes')} className="text-xs text-indigo-500 hover:text-indigo-400 flex items-center gap-1">Tümü <ArrowRight size={12} /></button>
            </div>
            {recentNotes.length === 0
              ? <Empty icon="📝" title="Henüz not yok" description="İlk notunu ekle." action={<button onClick={() => navigate('/notes?new=1')} className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg">Not Ekle</button>} />
              : <div className="space-y-2">
                  {recentNotes.map(n => (
                    <div key={n.id} onClick={() => navigate('/notes?id=' + n.id)} className="flex items-start justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors group">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{n.title}</div>
                        <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">{n.content.replace(/[#*`]/g, '').slice(0, 100)}</div>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="text-[10px] text-slate-400">{fmtDateShort(n.createdAt)}</span>
                          <span className="text-[10px] text-slate-400">•</span>
                          <span className="text-[10px] text-slate-400">{n.category}</span>
                          {n.tags.slice(0, 2).map(t => <Badge key={t} label={t} />)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
            }
          </div>

          {/* Monthly Notes Chart */}
          {monthlyNotesData.some(d => d.notes > 0) && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-medium mb-4">Aylık Not Sayısı</h3>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={monthlyNotesData}>
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="notes" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Upcoming Events */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">Yaklaşan Etkinlikler</h3>
              <button onClick={() => navigate('/calendar')} className="text-xs text-indigo-500 hover:text-indigo-400"><ArrowRight size={12} /></button>
            </div>
            {upcomingEvents.length === 0
              ? <p className="text-xs text-slate-400">Yaklaşan etkinlik yok.</p>
              : <div className="space-y-2">
                  {upcomingEvents.map(e => (
                    <div key={e.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{e.title}</div>
                        <div className="text-xs text-slate-400">{fmtDateShort(e.date)} {e.time && `• ${e.time}`}</div>
                      </div>
                    </div>
                  ))}
                </div>
            }
          </div>

          {/* Task Completion */}
          {taskPieData.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-medium mb-3">Görev Dağılımı</h3>
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie data={taskPieData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={3} dataKey="value">
                    {taskPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-2">
                {taskPieData.map(d => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} /><span className="text-slate-400">{d.name}</span></div>
                    <span className="font-medium">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Tags */}
          {topTags.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-medium mb-3">Popüler Etiketler</h3>
              <div className="flex flex-wrap gap-1.5">
                {topTags.map(t => (
                  <button key={t.name} onClick={() => navigate(`/search?tag=${t.name}`)} className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 hover:text-indigo-600 dark:hover:text-indigo-300 rounded-full text-xs transition-colors">
                    #{t.name}<span className="text-slate-400">{t.count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Goals Progress */}
          {goals.filter(g => g.status === 'active').length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium">Aktif Hedefler</h3>
                <button onClick={() => navigate('/goals')} className="text-xs text-indigo-500"><ArrowRight size={12} /></button>
              </div>
              <div className="space-y-3">
                {goals.filter(g => g.status === 'active').slice(0, 3).map(g => (
                  <div key={g.id}>
                    <div className="flex justify-between text-xs mb-1"><span className="truncate font-medium">{g.title}</span><span className="text-slate-400 shrink-0 ml-2">%{g.progress}</span></div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
                      <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${g.progress}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
