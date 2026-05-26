import { useEditor, EditorContent } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import UnderlineExt from '@tiptap/extension-underline'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Highlight from '@tiptap/extension-highlight'
import Typography from '@tiptap/extension-typography'
import CharacterCount from '@tiptap/extension-character-count'
import LinkExt from '@tiptap/extension-link'
import {
  Bold, Italic, Underline, Strikethrough,
  Heading1, Heading2, Heading3,
  List, ListOrdered, CheckSquare,
  Quote, Code, Braces, Highlighter,
  Link, Undo2, Redo2, Minus,
} from 'lucide-react'
import clsx from 'clsx'

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: number
  showWordCount?: boolean
}

function ToolBtn({ onClick, active, title, children }: {
  onClick: () => void; active?: boolean; title: string; children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      className={clsx(
        'p-1.5 rounded transition-colors',
        active
          ? 'bg-primary-600 text-white'
          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700'
      )}
    >
      {children}
    </button>
  )
}

function Sep() {
  return <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" />
}

export default function LifeEditor({ value, onChange, placeholder = 'Yazmaya başla...', minHeight = 200, showWordCount = true }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      UnderlineExt,
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: false }),
      Typography,
      CharacterCount,
      Placeholder.configure({ placeholder }),
      LinkExt.configure({ openOnClick: false, autolink: true }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: { class: 'life-editor-content focus:outline-none' },
    },
  })

  const setLink = () => {
    if (!editor) return
    const prev = editor.getAttributes('link').href ?? ''
    const url = window.prompt('URL:', prev)
    if (url === null) return
    if (url === '') { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  if (!editor) return null

  const words = editor.storage.characterCount?.words?.() ?? 0

  return (
    <div className="life-editor border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
        <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Kalın (Ctrl+B)">
          <Bold size={14} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="İtalik (Ctrl+I)">
          <Italic size={14} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Altı Çizili (Ctrl+U)">
          <Underline size={14} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Üstü Çizili">
          <Strikethrough size={14} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} title="Vurgula">
          <Highlighter size={14} />
        </ToolBtn>
        <Sep />
        <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Başlık 1">
          <Heading1 size={14} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Başlık 2">
          <Heading2 size={14} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Başlık 3">
          <Heading3 size={14} />
        </ToolBtn>
        <Sep />
        <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Madde Listesi">
          <List size={14} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numaralı Liste">
          <ListOrdered size={14} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')} title="Görev Listesi">
          <CheckSquare size={14} />
        </ToolBtn>
        <Sep />
        <ToolBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Alıntı">
          <Quote size={14} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Satır İçi Kod">
          <Code size={14} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Kod Bloğu">
          <Braces size={14} />
        </ToolBtn>
        <ToolBtn onClick={setLink} active={editor.isActive('link')} title="Link Ekle">
          <Link size={14} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} active={false} title="Yatay Çizgi">
          <Minus size={14} />
        </ToolBtn>
        <Sep />
        <ToolBtn onClick={() => editor.chain().focus().undo().run()} active={false} title="Geri Al (Ctrl+Z)">
          <Undo2 size={14} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().redo().run()} active={false} title="İleri Al (Ctrl+Y)">
          <Redo2 size={14} />
        </ToolBtn>
      </div>

      {/* Bubble menu on selection */}
      <BubbleMenu editor={editor}>
        <div className="flex items-center gap-0.5 bg-slate-900 dark:bg-slate-700 text-white rounded-lg shadow-xl px-1.5 py-1 border border-slate-700">
          {[
            { icon: <Bold size={13} />, action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold'), title: 'Kalın' },
            { icon: <Italic size={13} />, action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic'), title: 'İtalik' },
            { icon: <Underline size={13} />, action: () => editor.chain().focus().toggleUnderline().run(), active: editor.isActive('underline'), title: 'Altı Çizili' },
            { icon: <Highlighter size={13} />, action: () => editor.chain().focus().toggleHighlight().run(), active: editor.isActive('highlight'), title: 'Vurgula' },
            { icon: <Link size={13} />, action: setLink, active: editor.isActive('link'), title: 'Link' },
          ].map((btn, i) => (
            <button key={i} type="button" onMouseDown={(e) => { e.preventDefault(); btn.action() }} title={btn.title}
              className={clsx('p-1.5 rounded transition-colors', btn.active ? 'bg-primary-600' : 'hover:bg-slate-700')}
            >
              {btn.icon}
            </button>
          ))}
        </div>
      </BubbleMenu>

      {/* Editor content */}
      <div style={{ minHeight }} className="bg-white dark:bg-slate-900 cursor-text" onClick={() => editor.commands.focus()}>
        <EditorContent editor={editor} className="h-full" />
      </div>

      {/* Footer */}
      {showWordCount && (
        <div className="flex justify-end px-4 py-1.5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-700">
          <span className="text-[11px] text-slate-400">{words} kelime</span>
        </div>
      )}
    </div>
  )
}
