import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Note, Task, CalendarEvent, Goal, DailyEntry, MonthlyReview, YearlyReview, Category, Theme } from '../types'
import { nowISO } from '../utils/dates'
import { demoNotes, demoTasks, demoEvents, demoGoals, demoDailyEntries } from '../utils/demo'

const uid = () => Math.random().toString(36).slice(2, 11)

const defaultCategories: Category[] = [
  { id: '1', name: 'Kişisel', color: '#3b82f6', icon: '👤', isDefault: true },
  { id: '2', name: 'İş', color: '#6366f1', icon: '💼', isDefault: true },
  { id: '3', name: 'Sağlık', color: '#10b981', icon: '❤️', isDefault: true },
  { id: '4', name: 'Finans', color: '#f59e0b', icon: '💰', isDefault: true },
  { id: '5', name: 'Proje', color: '#8b5cf6', icon: '📁', isDefault: true },
  { id: '6', name: 'Eğitim', color: '#06b6d4', icon: '🎓', isDefault: true },
  { id: '7', name: 'Kitap', color: '#f97316', icon: '📚', isDefault: true },
  { id: '8', name: 'Toplantı', color: '#ef4444', icon: '🤝', isDefault: true },
  { id: '9', name: 'Fikir', color: '#ec4899', icon: '💡', isDefault: true },
  { id: '10', name: 'Araştırma', color: '#14b8a6', icon: '🔍', isDefault: true },
  { id: '11', name: 'Resmi İşler', color: '#6b7280', icon: '📋', isDefault: true },
  { id: '12', name: 'Aile', color: '#f43f5e', icon: '🏠', isDefault: true },
  { id: '13', name: 'Sosyal', color: '#a855f7', icon: '🌐', isDefault: true },
  { id: '14', name: 'Hedefler', color: '#eab308', icon: '🎯', isDefault: true },
  { id: '15', name: 'Günlük', color: '#64748b', icon: '📔', isDefault: true },
]

interface AppStore {
  themeId: string
  setTheme: (id: string) => void

  notes: Note[]
  addNote: (n: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => string
  updateNote: (id: string, u: Partial<Note>) => void
  deleteNote: (id: string) => void

  tasks: Task[]
  addTask: (t: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => string
  updateTask: (id: string, u: Partial<Task>) => void
  deleteTask: (id: string) => void

  events: CalendarEvent[]
  addEvent: (e: Omit<CalendarEvent, 'id' | 'createdAt'>) => string
  updateEvent: (id: string, u: Partial<CalendarEvent>) => void
  deleteEvent: (id: string) => void

  goals: Goal[]
  addGoal: (g: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>) => string
  updateGoal: (id: string, u: Partial<Goal>) => void
  deleteGoal: (id: string) => void

  dailyEntries: DailyEntry[]
  saveDailyEntry: (d: Omit<DailyEntry, 'id' | 'createdAt' | 'updatedAt'>) => void
  getDailyEntry: (date: string) => DailyEntry | undefined

  monthlyReviews: MonthlyReview[]
  saveMonthlyReview: (r: Omit<MonthlyReview, 'id' | 'createdAt' | 'updatedAt'>) => void
  getMonthlyReview: (year: number, month: number) => MonthlyReview | undefined

  yearlyReviews: YearlyReview[]
  saveYearlyReview: (r: Omit<YearlyReview, 'id' | 'createdAt' | 'updatedAt'>) => void
  getYearlyReview: (year: number) => YearlyReview | undefined

  categories: Category[]
  addCategory: (c: Omit<Category, 'id'>) => void
  deleteCategory: (id: string) => void

  password: string
  setPassword: (p: string) => void
  removePassword: () => void

  hasDemoData: boolean
  loadDemoData: () => void
  clearDemoData: () => void

  exportAll: () => object
  importAll: (data: unknown) => void
  resetAll: () => void

  allTags: () => string[]
  allPersons: () => string[]
  tagCounts: () => { name: string; count: number }[]
}

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
      themeId: 'koyu',
      setTheme: (id) => set({ themeId: id }),

      notes: [],
      addNote: (n) => {
        const id = uid()
        set((s) => ({ notes: [{ ...n, id, createdAt: nowISO(), updatedAt: nowISO() }, ...s.notes] }))
        return id
      },
      updateNote: (id, u) => set((s) => ({ notes: s.notes.map((n) => n.id === id ? { ...n, ...u, updatedAt: nowISO() } : n) })),
      deleteNote: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),

      tasks: [],
      addTask: (t) => {
        const id = uid()
        set((s) => ({ tasks: [{ ...t, id, createdAt: nowISO(), updatedAt: nowISO() }, ...s.tasks] }))
        return id
      },
      updateTask: (id, u) => set((s) => ({ tasks: s.tasks.map((t) => t.id === id ? { ...t, ...u, updatedAt: nowISO() } : t) })),
      deleteTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

      events: [],
      addEvent: (e) => {
        const id = uid()
        set((s) => ({ events: [{ ...e, id, createdAt: nowISO() }, ...s.events] }))
        return id
      },
      updateEvent: (id, u) => set((s) => ({ events: s.events.map((e) => e.id === id ? { ...e, ...u } : e) })),
      deleteEvent: (id) => set((s) => ({ events: s.events.filter((e) => e.id !== id) })),

      goals: [],
      addGoal: (g) => {
        const id = uid()
        set((s) => ({ goals: [{ ...g, id, createdAt: nowISO(), updatedAt: nowISO() }, ...s.goals] }))
        return id
      },
      updateGoal: (id, u) => set((s) => ({ goals: s.goals.map((g) => g.id === id ? { ...g, ...u, updatedAt: nowISO() } : g) })),
      deleteGoal: (id) => set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),

      dailyEntries: [],
      saveDailyEntry: (d) => {
        const existing = get().dailyEntries.find((e) => e.date === d.date)
        if (existing) {
          set((s) => ({ dailyEntries: s.dailyEntries.map((e) => e.date === d.date ? { ...e, ...d, updatedAt: nowISO() } : e) }))
        } else {
          set((s) => ({ dailyEntries: [{ ...d, id: uid(), createdAt: nowISO(), updatedAt: nowISO() }, ...s.dailyEntries] }))
        }
      },
      getDailyEntry: (date) => get().dailyEntries.find((e) => e.date === date),

      monthlyReviews: [],
      saveMonthlyReview: (r) => {
        const existing = get().monthlyReviews.find((m) => m.year === r.year && m.month === r.month)
        if (existing) {
          set((s) => ({ monthlyReviews: s.monthlyReviews.map((m) => m.year === r.year && m.month === r.month ? { ...m, ...r, updatedAt: nowISO() } : m) }))
        } else {
          set((s) => ({ monthlyReviews: [{ ...r, id: uid(), createdAt: nowISO(), updatedAt: nowISO() }, ...s.monthlyReviews] }))
        }
      },
      getMonthlyReview: (year, month) => get().monthlyReviews.find((m) => m.year === year && m.month === month),

      yearlyReviews: [],
      saveYearlyReview: (r) => {
        const existing = get().yearlyReviews.find((y) => y.year === r.year)
        if (existing) {
          set((s) => ({ yearlyReviews: s.yearlyReviews.map((y) => y.year === r.year ? { ...y, ...r, updatedAt: nowISO() } : y) }))
        } else {
          set((s) => ({ yearlyReviews: [{ ...r, id: uid(), createdAt: nowISO(), updatedAt: nowISO() }, ...s.yearlyReviews] }))
        }
      },
      getYearlyReview: (year) => get().yearlyReviews.find((y) => y.year === year),

      categories: defaultCategories,
      addCategory: (c) => set((s) => ({ categories: [...s.categories, { ...c, id: uid() }] })),
      deleteCategory: (id) => set((s) => ({ categories: s.categories.filter((c) => c.id !== id) })),

      password: '',
      setPassword: (p) => set({ password: p }),
      removePassword: () => set({ password: '' }),

      hasDemoData: false,
      loadDemoData: () => {
        set({ notes: demoNotes, tasks: demoTasks, events: demoEvents, goals: demoGoals, dailyEntries: demoDailyEntries, hasDemoData: true })
      },
      clearDemoData: () => {
        set({ notes: [], tasks: [], events: [], goals: [], dailyEntries: [], hasDemoData: false })
      },

      exportAll: () => {
        const s = get()
        return { notes: s.notes, tasks: s.tasks, events: s.events, goals: s.goals, dailyEntries: s.dailyEntries, monthlyReviews: s.monthlyReviews, yearlyReviews: s.yearlyReviews, categories: s.categories, exportedAt: nowISO() }
      },
      importAll: (data) => {
        const d = data as Partial<AppStore>
        set({
          notes: d.notes ?? [],
          tasks: d.tasks ?? [],
          events: d.events ?? [],
          goals: d.goals ?? [],
          dailyEntries: d.dailyEntries ?? [],
          monthlyReviews: d.monthlyReviews ?? [],
          yearlyReviews: d.yearlyReviews ?? [],
          categories: (d.categories as Category[])?.length ? d.categories as Category[] : defaultCategories,
        })
      },
      resetAll: () => set({ notes: [], tasks: [], events: [], goals: [], dailyEntries: [], monthlyReviews: [], yearlyReviews: [], categories: defaultCategories, hasDemoData: false }),

      allTags: () => {
        const s = get()
        const all = [...s.notes, ...s.tasks, ...s.dailyEntries, ...s.goals].flatMap((x) => (x as { tags?: string[] }).tags ?? [])
        return [...new Set(all)]
      },
      allPersons: () => {
        const s = get()
        const all = [...s.notes, ...s.dailyEntries].flatMap((x) => (x as { persons?: string[] }).persons ?? [])
        return [...new Set(all)]
      },
      tagCounts: () => {
        const s = get()
        const counts: Record<string, number> = {}
        const all = [...s.notes, ...s.tasks, ...s.dailyEntries, ...s.goals].flatMap((x) => (x as { tags?: string[] }).tags ?? [])
        all.forEach((t) => { counts[t] = (counts[t] ?? 0) + 1 })
        return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }))
      },
    }),
    { name: 'lifetrack-store' }
  )
)
