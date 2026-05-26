export type Priority = 'low' | 'medium' | 'high' | 'critical'
export type TaskStatus = 'todo' | 'in-progress' | 'done' | 'postponed' | 'cancelled'
export type Emotion = 'great' | 'good' | 'neutral' | 'bad' | 'terrible'
export type Theme = 'light' | 'dark'

export interface ThemeConfig {
  id: string
  name: string
  isDark: boolean
  preview: string
}

export const THEMES: ThemeConfig[] = [
  { id: 'koyu',      name: 'Koyu',       isDark: true,  preview: '#4f46e5' },
  { id: 'aydinlik',  name: 'Aydınlık',   isDark: false, preview: '#4f46e5' },
  { id: 'okyanus',   name: 'Okyanus',    isDark: true,  preview: '#0891b2' },
  { id: 'orman',     name: 'Orman',      isDark: true,  preview: '#059669' },
  { id: 'gunbatimi', name: 'Gün Batımı', isDark: true,  preview: '#ea580c' },
  { id: 'mor',       name: 'Mor',        isDark: true,  preview: '#7c3aed' },
  { id: 'pembe',     name: 'Pembe',      isDark: false, preview: '#db2777' },
  { id: 'cimen',     name: 'Çimen',      isDark: false, preview: '#16a34a' },
  { id: 'turkuaz',   name: 'Turkuaz',    isDark: true,  preview: '#0d9488' },
  { id: 'kirmizi',   name: 'Kırmızı',   isDark: true,  preview: '#e11d48' },
]
export type EventType = 'event' | 'meeting' | 'reminder' | 'birthday' | 'deadline'
export type GoalStatus = 'active' | 'completed' | 'paused' | 'cancelled'

export interface Note {
  id: string
  title: string
  content: string
  category: string
  tags: string[]
  persons: string[]
  organizations: string[]
  emotion?: Emotion
  createdAt: string
  updatedAt: string
  pinned: boolean
  archived: boolean
  linkedTaskIds: string[]
  linkedEventIds: string[]
}

export interface Task {
  id: string
  title: string
  description: string
  dueDate?: string
  priority: Priority
  status: TaskStatus
  tags: string[]
  category: string
  linkedNoteId?: string
  recurring?: 'daily' | 'weekly' | 'monthly'
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export interface CalendarEvent {
  id: string
  title: string
  description: string
  date: string
  endDate?: string
  time?: string
  type: EventType
  importance: Priority
  category: string
  color: string
  linkedNoteId?: string
  createdAt: string
}

export interface Goal {
  id: string
  title: string
  description: string
  startDate: string
  endDate: string
  progress: number
  status: GoalStatus
  category: string
  linkedNoteIds: string[]
  monthlyReviews: { month: string; note: string; progress: number }[]
  createdAt: string
  updatedAt: string
}

export interface DailyEntry {
  id: string
  date: string
  title: string
  summary: string
  mainNote: string
  importantEvents: string
  learnings: string
  ideas: string
  todos: string
  emotion?: Emotion
  energy: number
  tags: string[]
  category: string
  links: string[]
  persons: string[]
  organizations: string[]
  createdAt: string
  updatedAt: string
}

export interface MonthlyReview {
  id: string
  year: number
  month: number
  goals: string
  achievements: string
  challenges: string
  keyEvents: string
  nextMonthPlan: string
  rating: number
  createdAt: string
  updatedAt: string
}

export interface YearlyReview {
  id: string
  year: number
  summary: string
  achievements: string
  challenges: string
  lessons: string
  nextYearGoals: string
  rating: number
  createdAt: string
  updatedAt: string
}

export interface Category {
  id: string
  name: string
  color: string
  icon: string
  isDefault: boolean
}

export interface Tag {
  name: string
  count: number
}

export interface SearchResult {
  type: 'note' | 'task' | 'event' | 'goal' | 'daily'
  id: string
  title: string
  preview: string
  date: string
  tags: string[]
  category: string
  score: number
}

export interface SearchFilters {
  query: string
  types: string[]
  categories: string[]
  tags: string[]
  dateFrom?: string
  dateTo?: string
  emotion?: Emotion
  taskStatus?: TaskStatus
  priority?: Priority
  persons: string[]
}
