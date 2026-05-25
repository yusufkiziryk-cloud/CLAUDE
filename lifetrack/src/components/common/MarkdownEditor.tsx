import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Eye, Edit3, Bold, Italic, Heading2, List, Link, Code, Quote, CheckSquare } from 'lucide-react'

interface Props {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  minHeight?: number
}

export default function MarkdownEditor({ value, onChange, placeholder = 'Markdown desteklenir...', minHeight = 200 }: Props) {
  const [preview, setPreview] = useState(false)

  const wrap = (before: string, after: string, sample: string) => {
    const ta = document.getElementById('md-editor') as HTMLTextAreaElement
    if (!ta) return
    const { selectionStart: s, selectionEnd: e } = ta
    const selected = value.slice(s, e) || sample
    const next = value.slice(0, s) + before + selected + after + value.slice(e)
    onChange(next)
    setTimeout(() => { ta.selectionStart = s + before.length; ta.selectionEnd = s + before.length + selected.length; ta.focus() }, 0)
  }

  const insertLine = (prefix: string, sample: string) => {
    const ta = document.getElementById('md-editor') as HTMLTextAreaElement
    if (!ta) return
    const { selectionStart: s } = ta
    const lineStart = value.lastIndexOf('\n', s - 1) + 1
    const next = value.slice(0, lineStart) + prefix + value.slice(lineStart)
    onChange(next)
    setTimeout(() => { ta.selectionStart = ta.selectionEnd = lineStart + prefix.length + (value.slice(lineStart) ? 0 : sample.length); ta.focus() }, 0)
  }

  const tools = [
    { icon: Bold, title: 'Kalın', action: () => wrap('**', '**', 'kalın') },
    { icon: Italic, title: 'İtalik', action: () => wrap('*', '*', 'italik') },
    { icon: Heading2, title: 'Başlık', action: () => insertLine('## ', 'Başlık') },
    { icon: List, title: 'Liste', action: () => insertLine('- ', 'öğe') },
    { icon: CheckSquare, title: 'Görev', action: () => insertLine('- [ ] ', 'görev') },
    { icon: Quote, title: 'Alıntı', action: () => insertLine('> ', 'alıntı') },
    { icon: Code, title: 'Kod', action: () => wrap('`', '`', 'kod') },
    { icon: Link, title: 'Link', action: () => wrap('[', '](url)', 'link') },
  ]

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-0.5">
          {!preview && tools.map(({ icon: Icon, title, action }) => (
            <button key={title} type="button" title={title} onClick={action} className="p-1.5 rounded text-slate-500 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              <Icon size={14} />
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setPreview(!preview)} className="flex items-center gap-1 px-2 py-1 rounded text-xs text-slate-500 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
          {preview ? <><Edit3 size={13} /> Düzenle</> : <><Eye size={13} /> Önizle</>}
        </button>
      </div>
      {preview ? (
        <div className="p-4 prose prose-sm dark:prose-invert max-w-none min-h-[200px]" style={{ minHeight }}>
          {value ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown> : <p className="text-slate-400 italic">Önizlenecek içerik yok.</p>}
        </div>
      ) : (
        <textarea
          id="md-editor"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full p-4 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm resize-none focus:outline-none font-mono"
          style={{ minHeight }}
        />
      )}
    </div>
  )
}
