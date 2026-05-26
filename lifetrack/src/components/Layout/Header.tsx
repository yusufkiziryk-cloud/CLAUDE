import { useNavigate } from 'react-router-dom'
import { Menu, Search, Sun, Moon, Plus } from 'lucide-react'
import { useStore } from '../../lib/store'
import { THEMES } from '../../types'
import { fmtDate } from '../../utils/dates'
import { useState } from 'react'

interface Props { onMenuToggle: () => void; sidebarOpen: boolean }

export default function Header({ onMenuToggle }: Props) {
  const { themeId, setTheme } = useStore()
  const theme = THEMES.find(t => t.id === themeId) ?? THEMES[0]
  const navigate = useNavigate()
  const [q, setQ] = useState('')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (q.trim()) { navigate(`/search?q=${encodeURIComponent(q)}`) }
  }

  return (
    <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 px-4 shrink-0">
      <button onClick={onMenuToggle} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
        <Menu size={18} />
      </button>

      <form onSubmit={handleSearch} className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Tüm notlarda ara..."
            className="w-full pl-9 pr-4 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder:text-slate-400"
          />
        </div>
      </form>

      <div className="ml-auto flex items-center gap-2">
        <span className="hidden sm:block text-xs text-slate-400">{fmtDate(new Date())}</span>
        <button
          onClick={() => navigate('/notes?new=1')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded-lg transition-colors"
        >
          <Plus size={15} />
          <span className="hidden sm:block">Yeni Not</span>
        </button>
        <button onClick={() => setTheme(theme.isDark ? 'aydinlik' : 'karanlik')} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          {theme.isDark ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </div>
    </header>
  )
}
