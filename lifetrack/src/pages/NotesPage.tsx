import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Search, Pin, Archive, Trash2, Edit3, Tag, User, Building2, X, Paperclip, FileText, Image, File, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { useStore } from '../lib/store'
import { fmtDateTime, fmtDateShort } from '../utils/dates'
import Modal from '../components/common/Modal'
import Badge, { EmotionBadge } from '../components/common/Badge'
import Empty from '../components/common/Empty'
import LifeEditor from '../components/editor/LifeEditor'
import { Note, NoteAttachment } from '../types'
import clsx from 'clsx'

function fileIcon(type: string) {
  if (type.startsWith('image/')) return <Image size={14} />
  if (type.includes('pdf')) return <FileText size={14} />
  return <File size={14} />
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const EMOTIONS = ['great', 'good', 'neutral', 'bad', 'terrible'] as const
const emojis: Record<string, string> = { great: '😄', good: '🙂', neutral: '😐', bad: '😔', terrible: '😢' }

function NoteForm({ initial, onSave, onClose }: { initial?: Partial<Note>; onSave: (n: Partial<Note>) => void; onClose: () => void }) {
  const { categories, allTags, allPersons } = useStore()
  const [form, setForm] = useState<Partial<Note>>({ title: '', content: '', category: 'Kişisel', tags: [], persons: [], organizations: [], pinned: false, archived: false, linkedTaskIds: [], linkedEventIds: [], attachments: [], ...initial })
  const [tagInput, setTagInput] = useState('')
  const [personInput, setPersonInput] = useState('')
  const [orgInput, setOrgInput] = useState('')
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    const MAX = 5 * 1024 * 1024
    Array.from(files).forEach(file => {
      if (file.size > MAX) { toast.error(`${file.name} çok büyük (max 5 MB)`); return }
      const reader = new FileReader()
      reader.onload = (e) => {
        const att: NoteAttachment = { id: Math.random().toString(36).slice(2), name: file.name, type: file.type, size: file.size, data: e.target!.result as string }
        set('attachments', [...(form.attachments ?? []), att])
      }
      reader.readAsDataURL(file)
    })
  }

  const removeAttachment = (id: string) => set('attachments', (form.attachments ?? []).filter(a => a.id !== id))

  const set = (k: keyof Note, v: unknown) => setForm(f => ({ ...f, [k]: v }))
  const addTag = () => { if (tagInput.trim() && !form.tags?.includes(tagInput.trim())) { set('tags', [...(form.tags ?? []), tagInput.trim()]); setTagInput('') } }
  const addPerson = () => { if (personInput.trim() && !form.persons?.includes(personInput.trim())) { set('persons', [...(form.persons ?? []), personInput.trim()]); setPersonInput('') } }
  const addOrg = () => { if (orgInput.trim() && !form.organizations?.includes(orgInput.trim())) { set('organizations', [...(form.organizations ?? []), orgInput.trim()]); setOrgInput('') } }

  return (
    <div className="p-5 space-y-4">
      <input value={form.title ?? ''} onChange={(e) => set('title', e.target.value)} placeholder="Başlık..." className="w-full px-0 py-1 text-lg font-semibold bg-transparent border-0 border-b border-slate-200 dark:border-slate-700 focus:outline-none focus:border-primary-500" />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Kategori</label>
          <select value={form.category} onChange={(e) => set('category', e.target.value)} className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Duygu Durumu</label>
          <div className="flex gap-1">
            {EMOTIONS.map(e => <button key={e} type="button" onClick={() => set('emotion', form.emotion === e ? undefined : e)} className={clsx('flex-1 py-1 rounded text-sm transition-colors', form.emotion === e ? 'bg-primary-100 dark:bg-primary-900/50' : 'hover:bg-slate-100 dark:hover:bg-slate-700')} title={e}>{emojis[e]}</button>)}
          </div>
        </div>
      </div>

      <LifeEditor value={form.content ?? ''} onChange={(v) => set('content', v)} placeholder="Notunu yaz..." minHeight={280} />

      <div className="grid grid-cols-1 gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1 flex items-center gap-1"><Tag size={11} /> Etiketler</label>
          <div className="flex flex-wrap gap-1 mb-1">{form.tags?.map(t => <Badge key={t} label={`#${t}`} removable onRemove={() => set('tags', form.tags?.filter(x => x !== t))} />)}</div>
          <div className="flex gap-1">
            <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())} placeholder="Etiket ekle..." className="flex-1 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500" />
            <button type="button" onClick={addTag} className="px-2 py-1 bg-primary-600 text-white rounded text-xs">+</button>
          </div>
          {allTags().filter(t => tagInput && t.includes(tagInput) && !form.tags?.includes(t)).slice(0, 5).map(t => (
            <button key={t} type="button" onClick={() => { set('tags', [...(form.tags ?? []), t]); setTagInput('') }} className="mr-1 mt-1 text-xs text-primary-500 hover:underline">#{t}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1 flex items-center gap-1"><User size={11} /> Kişiler</label>
            <div className="flex flex-wrap gap-1 mb-1">{form.persons?.map(p => <Badge key={p} label={p} removable onRemove={() => set('persons', form.persons?.filter(x => x !== p))} />)}</div>
            <div className="flex gap-1">
              <input value={personInput} onChange={(e) => setPersonInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPerson())} placeholder="Kişi ekle..." className="flex-1 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500" />
              <button type="button" onClick={addPerson} className="px-2 py-1 bg-primary-600 text-white rounded text-xs">+</button>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1 flex items-center gap-1"><Building2 size={11} /> Kurumlar</label>
            <div className="flex flex-wrap gap-1 mb-1">{form.organizations?.map(o => <Badge key={o} label={o} removable onRemove={() => set('organizations', form.organizations?.filter(x => x !== o))} />)}</div>
            <div className="flex gap-1">
              <input value={orgInput} onChange={(e) => setOrgInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addOrg())} placeholder="Kurum ekle..." className="flex-1 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500" />
              <button type="button" onClick={addOrg} className="px-2 py-1 bg-primary-600 text-white rounded text-xs">+</button>
            </div>
          </div>
        </div>
      </div>

      {/* File upload area */}
      <div>
        <label className="block text-xs text-slate-500 mb-2 flex items-center gap-1"><Paperclip size={11} /> Belgeler & Dosyalar</label>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
          onClick={() => fileRef.current?.click()}
          className={clsx('border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors', dragging ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-primary-400 dark:hover:border-primary-500')}
        >
          <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
          <Paperclip size={20} className="mx-auto mb-2 text-slate-400" />
          <p className="text-xs text-slate-500">Dosyaları buraya sürükle veya tıkla</p>
          <p className="text-xs text-slate-400 mt-1">PDF, Word, resim, vb. — max 5 MB</p>
        </div>
        {(form.attachments ?? []).length > 0 && (
          <div className="mt-2 space-y-1.5">
            {(form.attachments ?? []).map(att => (
              <div key={att.id} className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs">
                <span className="text-slate-500">{fileIcon(att.type)}</span>
                <span className="flex-1 truncate font-medium">{att.name}</span>
                <span className="text-slate-400">{fmtSize(att.size)}</span>
                <button type="button" onClick={() => removeAttachment(att.id)} className="text-slate-400 hover:text-red-500 ml-1"><X size={12} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={form.pinned} onChange={(e) => set('pinned', e.target.checked)} className="rounded" />
          <Pin size={14} /> Sabitle
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={form.archived} onChange={(e) => set('archived', e.target.checked)} className="rounded" />
          <Archive size={14} /> Arşivle
        </label>
      </div>

      <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
        <button type="button" onClick={onClose} className="flex-1 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">İptal</button>
        <button type="button" onClick={() => onSave(form)} className="flex-1 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm transition-colors">Kaydet</button>
      </div>
    </div>
  )
}

export default function NotesPage() {
  const { notes, addNote, updateNote, deleteNote, categories } = useStore()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [catFilter, setCatFilter] = useState('Tümü')
  const [showArchived, setShowArchived] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [viewNote, setViewNote] = useState<Note | null>(null)

  useEffect(() => {
    if (params.get('new') === '1') { setEditingNote(null); setModalOpen(true); setParams({}) }
    const id = params.get('id')
    if (id) { const n = notes.find(x => x.id === id); if (n) setViewNote(n); setParams({}) }
  }, [params])

  const filtered = notes.filter(n => {
    if (n.archived !== showArchived) return false
    if (catFilter !== 'Tümü' && n.category !== catFilter) return false
    if (q) {
      const lq = q.toLowerCase()
      return n.title.toLowerCase().includes(lq) || n.content.toLowerCase().includes(lq) || n.tags.some(t => t.toLowerCase().includes(lq)) || n.persons.some(p => p.toLowerCase().includes(lq))
    }
    return true
  }).sort((a, b) => {
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })

  const handleSave = (form: Partial<Note>) => {
    if (!form.title?.trim()) { toast.error('Başlık gerekli'); return }
    if (editingNote) {
      updateNote(editingNote.id, form)
      toast.success('Not güncellendi')
    } else {
      addNote({ title: form.title!, content: form.content ?? '', category: form.category ?? 'Kişisel', tags: form.tags ?? [], persons: form.persons ?? [], organizations: form.organizations ?? [], emotion: form.emotion, pinned: form.pinned ?? false, archived: form.archived ?? false, linkedTaskIds: [], linkedEventIds: [], attachments: form.attachments ?? [] })
      toast.success('Not eklendi')
    }
    setModalOpen(false)
    setEditingNote(null)
  }

  const handleDelete = (id: string) => {
    if (!confirm('Bu notu silmek istediğinizden emin misiniz?')) return
    deleteNote(id)
    toast.success('Not silindi')
    if (viewNote?.id === id) setViewNote(null)
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Notlar</h1>
        <button onClick={() => { setEditingNote(null); setModalOpen(true) }} className="flex items-center gap-2 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded-lg transition-colors">
          <Plus size={15} /> Yeni Not
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Notlarda ara..." className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['Tümü', ...categories.map(c => c.name)].map(c => (
            <button key={c} onClick={() => setCatFilter(c)} className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors', catFilter === c ? 'bg-primary-600 text-white' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-primary-400 text-slate-600 dark:text-slate-400')}>
              {c}
            </button>
          ))}
          <button onClick={() => setShowArchived(!showArchived)} className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border', showArchived ? 'bg-slate-600 text-white border-slate-600' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400')}>
            Arşiv
          </button>
        </div>
      </div>

      {filtered.length === 0
        ? <Empty icon="📝" title={q ? 'Eşleşen not bulunamadı' : 'Henüz not yok'} description={q ? 'Farklı bir arama deneyin.' : 'İlk notunu ekle.'} action={!q ? <button onClick={() => setModalOpen(true)} className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg">Yeni Not</button> : undefined} />
        : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(n => (
              <div key={n.id} onClick={() => setViewNote(n)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 cursor-pointer hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-md transition-all group">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-sm line-clamp-1 flex-1">{n.pinned && <Pin size={11} className="inline mr-1 text-primary-400" />}{n.title}</h3>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => { setEditingNote(n); setModalOpen(true) }} className="p-1 hover:text-primary-500"><Edit3 size={13} /></button>
                    <button onClick={() => handleDelete(n.id)} className="p-1 hover:text-red-500"><Trash2 size={13} /></button>
                  </div>
                </div>
                <p className="text-xs text-slate-500 line-clamp-3 mb-3">{n.content.replace(/<[^>]*>/g, '').replace(/[#*`>\-\[\]]/g, '').trim()}</p>
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-1">{n.tags.slice(0, 2).map(t => <Badge key={t} label={`#${t}`} />)}</div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    {n.emotion && <EmotionBadge emotion={n.emotion} />}
                    <span>{fmtDateShort(n.updatedAt)}</span>
                  </div>
                </div>
                <div className="mt-2 text-[10px] text-slate-400">{n.category}</div>
              </div>
            ))}
          </div>
      }

      {/* Note Detail Modal */}
      <Modal open={!!viewNote && !modalOpen} onClose={() => setViewNote(null)} title={viewNote?.title ?? ''} size="lg">
        {viewNote && (
          <div className="p-5">
            <div className="flex flex-wrap items-center gap-3 mb-4 text-xs text-slate-400">
              <span>{fmtDateTime(viewNote.updatedAt)}</span>
              <span>•</span>
              <span>{viewNote.category}</span>
              {viewNote.emotion && <><span>•</span><EmotionBadge emotion={viewNote.emotion} /></>}
            </div>
            <div className="life-editor-content prose prose-sm dark:prose-invert max-w-none mb-4 px-0"
              dangerouslySetInnerHTML={{ __html: viewNote.content }} />
            <div className="flex flex-wrap gap-1 mb-3">{viewNote.tags.map(t => <Badge key={t} label={`#${t}`} />)}</div>
            {viewNote.persons.length > 0 && <div className="text-xs text-slate-400 mb-1"><User className="inline mr-1" size={11} />{viewNote.persons.join(', ')}</div>}
            {viewNote.organizations.length > 0 && <div className="text-xs text-slate-400 mb-3"><Building2 className="inline mr-1" size={11} />{viewNote.organizations.join(', ')}</div>}
            {(viewNote.attachments ?? []).length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-slate-500 mb-2 flex items-center gap-1"><Paperclip size={11} /> Ekler ({viewNote.attachments!.length})</p>
                <div className="space-y-1.5">
                  {viewNote.attachments!.map(att => (
                    <a key={att.id} href={att.data} download={att.name}
                      className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors group">
                      <span className="text-slate-500 group-hover:text-primary-500">{fileIcon(att.type)}</span>
                      <span className="flex-1 truncate font-medium">{att.name}</span>
                      <span className="text-slate-400">{fmtSize(att.size)}</span>
                      <Download size={12} className="text-slate-400 group-hover:text-primary-500" />
                    </a>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2 mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button onClick={() => { setEditingNote(viewNote); setViewNote(null); setModalOpen(true) }} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white text-sm rounded-lg"><Edit3 size={13} /> Düzenle</button>
              <button onClick={() => handleDelete(viewNote.id)} className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 dark:border-red-800 text-red-600 text-sm rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 size={13} /> Sil</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create/Edit Modal */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditingNote(null) }} title={editingNote ? 'Notu Düzenle' : 'Yeni Not'} size="xl">
        <NoteForm initial={editingNote ?? undefined} onSave={handleSave} onClose={() => { setModalOpen(false); setEditingNote(null) }} />
      </Modal>
    </div>
  )
}
