import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useStore } from './lib/store'
import { THEMES } from './types'
import Layout from './components/Layout/Layout'
import LockScreen from './components/LockScreen'
import DashboardPage from './pages/DashboardPage'
import NotesPage from './pages/NotesPage'
import DailyPage from './pages/DailyPage'
import CalendarPage from './pages/CalendarPage'
import TasksPage from './pages/TasksPage'
import GoalsPage from './pages/GoalsPage'
import SearchPage from './pages/SearchPage'
import YearlyPage from './pages/YearlyPage'
import KnowledgePage from './pages/KnowledgePage'
import AIPage from './pages/AIPage'
import HabitsPage from './pages/HabitsPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  const themeId = useStore((s) => s.themeId)
  const password = useStore((s) => s.password)
  const [unlocked, setUnlocked] = useState(() => !password || sessionStorage.getItem('lt_unlocked') === '1')

  const theme = THEMES.find(t => t.id === themeId) ?? THEMES[0]

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeId)
    document.documentElement.classList.toggle('dark', theme.isDark)
  }, [themeId, theme.isDark])

  useEffect(() => {
    if (!password) setUnlocked(true)
  }, [password])

  const handleUnlock = () => {
    sessionStorage.setItem('lt_unlocked', '1')
    setUnlocked(true)
  }

  return (
    <>
      {password && !unlocked && <LockScreen storedPassword={password} onUnlock={handleUnlock} />}
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
        <Toaster position="top-right" toastOptions={{ className: '!bg-slate-800 !text-white !border !border-slate-700', duration: 3000 }} />
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="notes" element={<NotesPage />} />
            <Route path="daily" element={<DailyPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="goals" element={<GoalsPage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="yearly" element={<YearlyPage />} />
            <Route path="knowledge" element={<KnowledgePage />} />
            <Route path="ai" element={<AIPage />} />
            <Route path="habits" element={<HabitsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </div>
    </>
  )
}
