import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useStore } from './lib/store'
import Layout from './components/Layout/Layout'
import DashboardPage from './pages/DashboardPage'
import NotesPage from './pages/NotesPage'
import DailyPage from './pages/DailyPage'
import CalendarPage from './pages/CalendarPage'
import TasksPage from './pages/TasksPage'
import GoalsPage from './pages/GoalsPage'
import SearchPage from './pages/SearchPage'
import YearlyPage from './pages/YearlyPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  const theme = useStore((s) => s.theme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
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
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </div>
    </div>
  )
}
