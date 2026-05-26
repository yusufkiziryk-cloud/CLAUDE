import clsx from 'clsx'

interface Props {
  label: string
  color?: string
  onClick?: () => void
  size?: 'sm' | 'md'
  removable?: boolean
  onRemove?: () => void
}

export default function Badge({ label, color, onClick, size = 'sm', removable, onRemove }: Props) {
  return (
    <span
      onClick={onClick}
      className={clsx(
        'inline-flex items-center gap-1 rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        onClick && 'cursor-pointer',
        color ? '' : 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
      )}
      style={color ? { backgroundColor: color + '22', color } : undefined}
    >
      {label}
      {removable && (
        <button onClick={(e) => { e.stopPropagation(); onRemove?.() }} className="ml-0.5 hover:opacity-70">×</button>
      )}
    </span>
  )
}

export function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = { low: 'text-slate-500 bg-slate-100 dark:bg-slate-800', medium: 'text-blue-600 bg-blue-100 dark:bg-blue-900/40', high: 'text-orange-600 bg-orange-100 dark:bg-orange-900/40', critical: 'text-red-600 bg-red-100 dark:bg-red-900/40' }
  const labels: Record<string, string> = { low: 'Düşük', medium: 'Orta', high: 'Yüksek', critical: 'Kritik' }
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${map[priority] ?? map.low}`}>{labels[priority] ?? priority}</span>
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = { todo: 'text-slate-500 bg-slate-100 dark:bg-slate-800', 'in-progress': 'text-blue-600 bg-blue-100 dark:bg-blue-900/40', done: 'text-green-600 bg-green-100 dark:bg-green-900/40', postponed: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/40', cancelled: 'text-red-600 bg-red-100 dark:bg-red-900/40' }
  const labels: Record<string, string> = { todo: 'Yapılacak', 'in-progress': 'Devam', done: 'Tamamlandı', postponed: 'Ertelendi', cancelled: 'İptal' }
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? map.todo}`}>{labels[status] ?? status}</span>
}

export function EmotionBadge({ emotion }: { emotion: string }) {
  const map: Record<string, { emoji: string; label: string }> = {
    great: { emoji: '😄', label: 'Harika' }, good: { emoji: '🙂', label: 'İyi' },
    neutral: { emoji: '😐', label: 'Normal' }, bad: { emoji: '😔', label: 'Kötü' }, terrible: { emoji: '😢', label: 'Berbat' }
  }
  const e = map[emotion]
  return e ? <span className="inline-flex items-center gap-1 text-xs">{e.emoji} {e.label}</span> : null
}
