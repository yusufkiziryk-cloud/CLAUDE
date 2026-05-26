import { useState, useRef } from 'react'
import { Download, Upload, Trash2, Plus, Moon, Sun, Database, Folder, Lock, Unlock } from 'lucide-react'
import toast from 'react-hot-toast'
import { useStore } from '../lib/store'
import { exportJSON, importJSON } from '../utils/export'

export default function SettingsPage() {
  const { theme, toggleTheme, categories, addCategory, deleteCategory, exportAll, importAll, resetAll, notes, tasks, events, goals, dailyEntries, hasDemoData, loadDemoData, clearDemoData, password, setPassword, removePassword } = useStore()
  const [newCatName, setNewCatName] = useState('')
  const [newCatColor, setNewCatColor] = useState('#6366f1')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [passType, setPassType] = useState<'pin' | 'text'>('pin')
  const [newCatIcon, setNewCatIcon] = useState('📁')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleSetPassword = () => {
    if (!newPass) { toast.error('Şifre boş olamaz'); return }
    if (newPass !== confirmPass) { toast.error('Şifreler eşleşmiyor'); return }
    if (passType === 'pin' && !/^\d+$/.test(newPass)) { toast.error('PIN sadece rakam içermeli'); return }
    if (passType === 'pin' && (newPass.length < 4 || newPass.length > 8)) { toast.error('PIN 4-8 rakam olmalı'); return }
    setPassword(newPass)
    sessionStorage.setItem('lt_unlocked', '1')
    setNewPass(''); setConfirmPass('')
    toast.success('Şifre ayarlandı')
  }

  const handleRemovePassword = () => {
    if (!confirm('Şifreyi kaldırmak istediğinizden emin misiniz?')) return
    removePassword()
    sessionStorage.removeItem('lt_unlocked')
    toast.success('Şifre kaldırıldı')
  }

  const handleExport = () => {
    exportJSON(exportAll())
    toast.success('Veriler dışa aktarıldı')
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const data = await importJSON(file)
      importAll(data)
      toast.success('Veriler içe aktarıldı')
    } catch (err) {
      toast.error('Geçersiz dosya formatı')
    }
    e.target.value = ''
  }

  const handleReset = () => {
    if (!confirm('Tüm veriler silinecek. Bu işlem geri alınamaz. Devam etmek istiyor musunuz?')) return
    const confirm2 = prompt('Onaylamak için "SİL" yazın:')
    if (confirm2 !== 'SİL') { toast.error('İptal edildi'); return }
    resetAll()
    toast.success('Tüm veriler sıfırlandı')
  }

  const handleAddCategory = () => {
    if (!newCatName.trim()) { toast.error('Kategori adı gerekli'); return }
    addCategory({ name: newCatName.trim(), color: newCatColor, icon: newCatIcon, isDefault: false })
    setNewCatName('')
    toast.success('Kategori eklendi')
  }

  const totalRecords = notes.length + tasks.length + events.length + goals.length + dailyEntries.length

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-xl font-bold">Ayarlar</h1>

      {/* Password */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
        <h2 className="font-semibold mb-4 flex items-center gap-2"><Lock size={16} /> Şifre Koruması</h2>
        {password ? (
          <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <Lock size={15} />
              <span className="text-sm font-medium">Şifre aktif</span>
            </div>
            <button onClick={handleRemovePassword} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 text-sm rounded-lg hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors">
              <Unlock size={13} /> Kaldır
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <button onClick={() => setPassType('pin')} className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${passType === 'pin' ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-400'}`}>PIN (4-8 rakam)</button>
              <button onClick={() => setPassType('text')} className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${passType === 'text' ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-400'}`}>Metin Şifresi</button>
            </div>
            <input
              type={passType === 'pin' ? 'number' : 'password'}
              value={newPass} onChange={(e) => setNewPass(e.target.value)}
              placeholder={passType === 'pin' ? '4-8 haneli PIN...' : 'Şifre...'}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type={passType === 'pin' ? 'number' : 'password'}
              value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSetPassword()}
              placeholder="Tekrar gir..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button onClick={handleSetPassword} className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors flex items-center justify-center gap-2">
              <Lock size={14} /> Şifreyi Ayarla
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
        <h2 className="font-semibold mb-4 flex items-center gap-2"><Database size={16} /> Veri İstatistikleri</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[{ label: 'Not', value: notes.length }, { label: 'Görev', value: tasks.length }, { label: 'Etkinlik', value: events.length }, { label: 'Hedef', value: goals.length }, { label: 'Günlük', value: dailyEntries.length }].map(s => (
            <div key={s.label} className="text-center bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
              <div className="text-xl font-bold text-indigo-500">{s.value}</div>
              <div className="text-xs text-slate-500">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 text-sm text-slate-500">Toplam kayıt: <strong>{totalRecords}</strong></div>
      </div>

      {/* Theme */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
        <h2 className="font-semibold mb-4">Tema</h2>
        <div className="flex gap-3">
          <button onClick={() => theme === 'light' || toggleTheme()} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all ${theme === 'light' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}>
            <Sun size={18} /> Aydınlık
          </button>
          <button onClick={() => theme === 'dark' || toggleTheme()} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all ${theme === 'dark' ? 'border-indigo-600 bg-indigo-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}>
            <Moon size={18} /> Koyu
          </button>
        </div>
      </div>

      {/* Data Management */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
        <h2 className="font-semibold mb-4">Veri Yönetimi</h2>
        <div className="space-y-3">
          <button onClick={handleExport} className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors text-left">
            <div className="w-9 h-9 bg-green-100 dark:bg-green-900/40 rounded-lg flex items-center justify-center"><Download size={16} className="text-green-600" /></div>
            <div>
              <div className="font-medium text-sm">Dışa Aktar (JSON)</div>
              <div className="text-xs text-slate-500">Tüm verileri JSON dosyası olarak indir</div>
            </div>
          </button>

          <button onClick={() => fileRef.current?.click()} className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors text-left">
            <div className="w-9 h-9 bg-blue-100 dark:bg-blue-900/40 rounded-lg flex items-center justify-center"><Upload size={16} className="text-blue-600" /></div>
            <div>
              <div className="font-medium text-sm">İçe Aktar (JSON)</div>
              <div className="text-xs text-slate-500">Yedek dosyasından verileri geri yükle</div>
            </div>
          </button>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />

          <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
            {!hasDemoData ? (
              <button onClick={loadDemoData} className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors text-left">
                <div className="w-9 h-9 bg-purple-100 dark:bg-purple-900/40 rounded-lg flex items-center justify-center"><Database size={16} className="text-purple-600" /></div>
                <div>
                  <div className="font-medium text-sm">Demo Verileri Yükle</div>
                  <div className="text-xs text-slate-500">Uygulamayı keşfetmek için örnek veriler ekle</div>
                </div>
              </button>
            ) : (
              <button onClick={clearDemoData} className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors text-left">
                <div className="w-9 h-9 bg-yellow-100 dark:bg-yellow-900/40 rounded-lg flex items-center justify-center"><Trash2 size={16} className="text-yellow-600" /></div>
                <div>
                  <div className="font-medium text-sm">Demo Verilerini Temizle</div>
                  <div className="text-xs text-slate-500">Örnek verileri kaldır, kendi verilerini kullan</div>
                </div>
              </button>
            )}
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
            <button onClick={handleReset} className="w-full flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 rounded-xl transition-colors text-left">
              <div className="w-9 h-9 bg-red-100 dark:bg-red-900/40 rounded-lg flex items-center justify-center"><Trash2 size={16} className="text-red-600" /></div>
              <div>
                <div className="font-medium text-sm text-red-600">Tüm Verileri Sıfırla</div>
                <div className="text-xs text-red-400">Bu işlem geri alınamaz — dikkatli olun</div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
        <h2 className="font-semibold mb-4 flex items-center gap-2"><Folder size={16} /> Kategoriler</h2>
        <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
          {categories.map(c => (
            <div key={c.id} className="flex items-center justify-between py-2 px-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                <span className="text-sm">{c.icon} {c.name}</span>
                {c.isDefault && <span className="text-[10px] text-slate-400 bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded">Varsayılan</span>}
              </div>
              {!c.isDefault && (
                <button onClick={() => { if (confirm('Bu kategoriyi silmek istediğinizden emin misiniz?')) deleteCategory(c.id) }} className="p-1 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          <input type="text" value={newCatIcon} onChange={(e) => setNewCatIcon(e.target.value)} placeholder="📁" className="w-14 px-2 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <input type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()} placeholder="Kategori adı..." className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <input type="color" value={newCatColor} onChange={(e) => setNewCatColor(e.target.value)} className="w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer" />
          <button onClick={handleAddCategory} className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors"><Plus size={14} /> Ekle</button>
        </div>
      </div>

      {/* Info */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 text-sm text-slate-500 space-y-1">
        <div className="font-semibold text-slate-700 dark:text-slate-300 mb-2">Hakkında</div>
        <div>LifeTrack v1.0 — Kişisel Hafıza Merkezi</div>
        <div>React + TypeScript + Tailwind CSS + Zustand</div>
        <div>Veriler tarayıcının LocalStorage'ında güvenle saklanır.</div>
        <div className="text-xs">İleride Supabase/PostgreSQL backend'e taşınabilir mimari.</div>
      </div>
    </div>
  )
}
