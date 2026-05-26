import { NavLink } from 'react-router-dom'
import { LayoutDashboard, BookOpen, CalendarDays, CheckSquare, Target, Search, BarChart3, Settings, Notebook, X, GitBranch, Brain, Flame } from 'lucide-react'
import clsx from 'clsx'

const nav = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/notes', label: 'Notlar', icon: BookOpen },
  { to: '/daily', label: 'Günlük', icon: Notebook },
  { to: '/tasks', label: 'Görevler', icon: CheckSquare },
  { to: '/habits', label: 'Alışkanlıklar', icon: Flame },
  { to: '/calendar', label: 'Takvim', icon: CalendarDays },
  { to: '/goals', label: 'Hedefler', icon: Target },
  { to: '/search', label: 'Arama', icon: Search },
  { to: '/yearly', label: 'Yıllık Plan', icon: BarChart3 },
  { to: '/knowledge', label: 'Bilgi Grafiği', icon: GitBranch },
  { to: '/ai', label: 'AI Hafıza', icon: Brain },
  { to: '/settings', label: 'Ayarlar', icon: Settings },
]

interface Props { open: boolean; onClose: () => void }

export default function Sidebar({ open, onClose }: Props) {
  return (
    <>
      {open && <div className="fixed inset-0 bg-black/50 z-20 md:hidden" onClick={onClose} />}
      <aside className={clsx(
        'fixed md:relative z-30 h-screen flex flex-col w-60 bg-slate-100 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 transition-transform duration-200',
        open ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:w-0 md:overflow-hidden'
      )}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary-600 flex items-center justify-center text-white font-bold text-sm">LT</div>
            <span className="font-semibold text-slate-900 dark:text-white">LifeTrack</span>
          </div>
          <button onClick={onClose} className="md:hidden text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white p-1"><X size={16} /></button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary-600 text-white'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800'
            )}>
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-600">
          v1.0 — Kişisel Hafıza Merkezi
        </div>
      </aside>
    </>
  )
}
