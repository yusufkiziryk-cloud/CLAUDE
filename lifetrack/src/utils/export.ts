import { format } from 'date-fns'

export function exportJSON(data: object, filename?: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename ?? `lifetrack-backup-${format(new Date(), 'yyyy-MM-dd')}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function importJSON(file: File): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        resolve(JSON.parse(e.target?.result as string))
      } catch {
        reject(new Error('Geçersiz JSON dosyası'))
      }
    }
    reader.onerror = () => reject(new Error('Dosya okunamadı'))
    reader.readAsText(file)
  })
}
