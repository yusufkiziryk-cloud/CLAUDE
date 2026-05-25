import { format, formatRelative, isToday, isThisWeek, isThisMonth, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addDays, subDays, startOfWeek, endOfWeek } from 'date-fns'
import { tr } from 'date-fns/locale'

export const fmtDate = (d: string | Date) => format(typeof d === 'string' ? parseISO(d) : d, 'd MMMM yyyy', { locale: tr })
export const fmtDateShort = (d: string | Date) => format(typeof d === 'string' ? parseISO(d) : d, 'd MMM', { locale: tr })
export const fmtDateISO = (d: Date) => format(d, 'yyyy-MM-dd')
export const fmtDateTime = (d: string | Date) => format(typeof d === 'string' ? parseISO(d) : d, 'd MMM yyyy, HH:mm', { locale: tr })
export const fmtMonth = (d: string | Date) => format(typeof d === 'string' ? parseISO(d) : d, 'MMMM yyyy', { locale: tr })
export const fmtRelative = (d: string) => formatRelative(parseISO(d), new Date(), { locale: tr })
export const todayISO = () => format(new Date(), 'yyyy-MM-dd')
export const nowISO = () => new Date().toISOString()

export { isToday, isThisWeek, isThisMonth, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addDays, subDays, startOfWeek, endOfWeek, format }

export const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
export const dayNames = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']

export function yearProgress(): number {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  const end = new Date(now.getFullYear() + 1, 0, 1)
  return Math.round(((now.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100)
}

export function weekRange(date: Date) {
  const start = startOfWeek(date, { weekStartsOn: 1 })
  const end = endOfWeek(date, { weekStartsOn: 1 })
  return { start, end }
}
