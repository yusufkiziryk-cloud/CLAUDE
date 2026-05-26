import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

export type Emotion = 'great' | 'good' | 'neutral' | 'bad' | 'terrible'

export interface Note {
  id: string
  title: string
  content: string
  emotion?: Emotion
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface DailyEntry {
  id: string
  date: string
  title: string
  mainNote: string
  emotion?: Emotion
  energy: number
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface Habit {
  id: string
  name: string
  icon: string
  color: string
  streak: number
  bestStreak: number
  isActive: boolean
  createdAt: string
}

export interface HabitLog {
  id: string
  habitId: string
  date: string
  done: boolean
  createdAt: string
}

const uid = () => Math.random().toString(36).slice(2, 11)
const now = () => new Date().toISOString()
const today = () => new Date().toISOString().slice(0, 10)

interface Store {
  // Theme
  isDark: boolean
  toggleTheme: () => void

  // Notes
  notes: Note[]
  addNote: (n: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => string
  updateNote: (id: string, u: Partial<Note>) => void
  deleteNote: (id: string) => void

  // Daily entries
  dailyEntries: DailyEntry[]
  saveDailyEntry: (d: Omit<DailyEntry, 'id' | 'createdAt' | 'updatedAt'>) => void
  getDailyEntry: (date: string) => DailyEntry | undefined

  // Habits
  habits: Habit[]
  habitLogs: HabitLog[]
  addHabit: (h: Omit<Habit, 'id' | 'createdAt' | 'streak' | 'bestStreak'>) => void
  toggleHabitLog: (habitId: string) => void
  isTodayDone: (habitId: string) => boolean

  // AI
  claudeApiKey: string
  setClaudeApiKey: (key: string) => void
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      isDark: true,
      toggleTheme: () => set(s => ({ isDark: !s.isDark })),

      notes: [],
      addNote: (n) => {
        const id = uid()
        set(s => ({ notes: [{ ...n, id, createdAt: now(), updatedAt: now() }, ...s.notes] }))
        return id
      },
      updateNote: (id, u) => set(s => ({ notes: s.notes.map(n => n.id === id ? { ...n, ...u, updatedAt: now() } : n) })),
      deleteNote: (id) => set(s => ({ notes: s.notes.filter(n => n.id !== id) })),

      dailyEntries: [],
      saveDailyEntry: (d) => {
        const existing = get().dailyEntries.find(e => e.date === d.date)
        if (existing) {
          set(s => ({ dailyEntries: s.dailyEntries.map(e => e.date === d.date ? { ...e, ...d, updatedAt: now() } : e) }))
        } else {
          set(s => ({ dailyEntries: [{ ...d, id: uid(), createdAt: now(), updatedAt: now() }, ...s.dailyEntries] }))
        }
      },
      getDailyEntry: (date) => get().dailyEntries.find(e => e.date === date),

      habits: [],
      habitLogs: [],
      addHabit: (h) => set(s => ({ habits: [...s.habits, { ...h, id: uid(), streak: 0, bestStreak: 0, createdAt: now() }] })),
      toggleHabitLog: (habitId) => {
        const date = today()
        const existing = get().habitLogs.find(l => l.habitId === habitId && l.date === date)
        set(s => {
          const habitLogs = existing
            ? s.habitLogs.filter(l => !(l.habitId === habitId && l.date === date))
            : [...s.habitLogs, { id: uid(), habitId, date, done: true, createdAt: now() }]

          // Recalculate streak
          const logs = habitLogs.filter(l => l.habitId === habitId && l.done).map(l => l.date).sort().reverse()
          let streak = 0
          let check = today()
          for (const d of logs) {
            if (d === check) {
              streak++
              const dt = new Date(check)
              dt.setDate(dt.getDate() - 1)
              check = dt.toISOString().slice(0, 10)
            } else if (d < check) break
          }
          const habits = s.habits.map(h => h.id === habitId ? { ...h, streak, bestStreak: Math.max(h.bestStreak, streak) } : h)
          return { habitLogs, habits }
        })
      },
      isTodayDone: (habitId) => get().habitLogs.some(l => l.habitId === habitId && l.date === today() && l.done),

      claudeApiKey: '',
      setClaudeApiKey: (key) => set({ claudeApiKey: key }),
    }),
    {
      name: 'lifetrack-mobile',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)
