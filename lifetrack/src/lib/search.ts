import Fuse from 'fuse.js'
import { Note, Task, CalendarEvent, Goal, DailyEntry, SearchResult, SearchFilters } from '../types'
import { isWithinInterval, parseISO } from 'date-fns'

function noteToResult(n: Note): SearchResult {
  return { type: 'note', id: n.id, title: n.title, preview: n.content.slice(0, 120).replace(/[#*`]/g, ''), date: n.createdAt, tags: n.tags, category: n.category, score: 0 }
}
function taskToResult(t: Task): SearchResult {
  return { type: 'task', id: t.id, title: t.title, preview: t.description.slice(0, 120), date: t.createdAt, tags: t.tags, category: t.category, score: 0 }
}
function eventToResult(e: CalendarEvent): SearchResult {
  return { type: 'event', id: e.id, title: e.title, preview: e.description.slice(0, 120), date: e.date, tags: [], category: e.category, score: 0 }
}
function goalToResult(g: Goal): SearchResult {
  return { type: 'goal', id: g.id, title: g.title, preview: g.description.slice(0, 120), date: g.createdAt, tags: [], category: g.category, score: 0 }
}
function dailyToResult(d: DailyEntry): SearchResult {
  return { type: 'daily', id: d.id, title: d.title || d.date, preview: (d.summary || d.mainNote).slice(0, 120), date: d.date, tags: d.tags, category: d.category, score: 0 }
}

export function search(
  filters: SearchFilters,
  notes: Note[],
  tasks: Task[],
  events: CalendarEvent[],
  goals: Goal[],
  dailyEntries: DailyEntry[]
): SearchResult[] {
  const { query, types, categories, tags, dateFrom, dateTo, emotion, taskStatus, priority, persons } = filters

  const allTypes = types.length === 0 || types.length === 5

  let results: SearchResult[] = []

  if (allTypes || types.includes('note')) results.push(...notes.filter(n => !n.archived).map(noteToResult))
  if (allTypes || types.includes('task')) results.push(...tasks.map(taskToResult))
  if (allTypes || types.includes('event')) results.push(...events.map(eventToResult))
  if (allTypes || types.includes('goal')) results.push(...goals.map(goalToResult))
  if (allTypes || types.includes('daily')) results.push(...dailyEntries.map(dailyToResult))

  if (categories.length > 0) results = results.filter(r => categories.includes(r.category))
  if (tags.length > 0) results = results.filter(r => tags.some(t => r.tags.includes(t)))

  if (dateFrom || dateTo) {
    results = results.filter(r => {
      try {
        const d = parseISO(r.date)
        if (dateFrom && dateTo) return isWithinInterval(d, { start: parseISO(dateFrom), end: parseISO(dateTo) })
        if (dateFrom) return d >= parseISO(dateFrom)
        if (dateTo) return d <= parseISO(dateTo)
        return true
      } catch { return true }
    })
  }

  if (emotion) {
    const noteIds = notes.filter(n => n.emotion === emotion).map(n => n.id)
    const dailyIds = dailyEntries.filter(d => d.emotion === emotion).map(d => d.id)
    results = results.filter(r => (r.type === 'note' && noteIds.includes(r.id)) || (r.type === 'daily' && dailyIds.includes(r.id)) || (r.type !== 'note' && r.type !== 'daily'))
  }

  if (taskStatus) results = results.filter(r => r.type !== 'task' || tasks.find(t => t.id === r.id)?.status === taskStatus)
  if (priority) results = results.filter(r => {
    if (r.type === 'task') return tasks.find(t => t.id === r.id)?.priority === priority
    if (r.type === 'event') return events.find(e => e.id === r.id)?.importance === priority
    return true
  })

  if (persons.length > 0) {
    const noteIds = notes.filter(n => persons.some(p => n.persons.includes(p))).map(n => n.id)
    const dailyIds = dailyEntries.filter(d => persons.some(p => d.persons.includes(p))).map(d => d.id)
    results = results.filter(r => (r.type === 'note' && noteIds.includes(r.id)) || (r.type === 'daily' && dailyIds.includes(r.id)))
  }

  if (query.trim()) {
    const fuse = new Fuse(results, { keys: ['title', 'preview', 'tags', 'category'], threshold: 0.4, includeScore: true })
    return fuse.search(query).map(r => ({ ...r.item, score: r.score ?? 0 }))
  }

  return results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}
