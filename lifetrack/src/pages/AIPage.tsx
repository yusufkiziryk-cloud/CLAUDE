import { useState, useMemo } from 'react'
import { useStore } from '../lib/store'
import { Sparkles, Brain, CalendarDays, TrendingUp, AlertCircle, Loader2, Lock, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { fmtDate, parseISO } from '../utils/dates'
import clsx from 'clsx'

const EMOTION_LABELS: Record<string, string> = { great: 'Harika 😄', good: 'İyi 🙂', neutral: 'Normal 😐', bad: 'Kötü 😔', terrible: 'Berbat 😢' }
const EMOTION_COLORS: Record<string, string> = { great: '#10b981', good: '#3b82f6', neutral: '#94a3b8', bad: '#f59e0b', terrible: '#ef4444' }

async function callClaude(apiKey: string, system: string, user: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-allow-browser': 'true',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-7',
      max_tokens: 900,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: { message?: string } }).error?.message ?? `API hatası (${res.status})`)
  }
  const data = await res.json() as { content: { type: string; text: string }[] }
  return data.content[0]?.text ?? ''
}

function InsightCard({ title, icon: Icon, children, accent = false }: {
  title: string; icon: React.ElementType; children: React.ReactNode; accent?: boolean
}) {
  return (
    <div className={clsx('rounded-xl border p-5', accent
      ? 'bg-primary-50 dark:bg-primary-950/30 border-primary-200 dark:border-primary-800'
      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800')}>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={16} className="text-primary-500" />
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      {children}
    </div>
  )
}

export default function AIPage() {
  const { notes, dailyEntries, tasks, goals, claudeApiKey } = useStore()
  const navigate = useNavigate()
  const [reflection, setReflection] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

  // On This Day
  const onThisDay = useMemo(() => {
    const today = new Date()
    const month = today.getMonth()
    const day = today.getDate()
    const year = today.getFullYear()
    return [...notes, ...dailyEntries]
      .filter(item => {
        const d = parseISO((item as { createdAt?: string; date?: string }).createdAt ?? (item as { date?: string }).date ?? '')
        return d.getMonth() === month && d.getDate() === day && d.getFullYear() < year
      })
      .sort((a, b) => {
        const da = new Date((a as { createdAt?: string; date?: string }).createdAt ?? (a as { date?: string }).date ?? '')
        const db = new Date((b as { createdAt?: string; date?: string }).createdAt ?? (b as { date?: string }).date ?? '')
        return da.getTime() - db.getTime()
      })
      .slice(0, 5)
  }, [notes, dailyEntries])

  // Mood trend (last 30 days)
  const moodTrend = useMemo(() => {
    const scoreMap: Record<string, number> = { great: 5, good: 4, neutral: 3, bad: 2, terrible: 1 }
    return dailyEntries
      .filter(d => d.emotion)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30)
      .map(d => ({ date: d.date, emotion: d.emotion!, score: scoreMap[d.emotion!] ?? 3 }))
  }, [dailyEntries])

  const avgMood = moodTrend.length
    ? (moodTrend.reduce((s, d) => s + d.score, 0) / moodTrend.length).toFixed(1)
    : null

  // Neglected goals
  const neglectedGoals = goals.filter(g => g.status === 'active' && g.progress < 50).slice(0, 3)

  // Top persons mentioned
  const personCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    ;[...notes, ...dailyEntries].forEach(item => {
      ((item as { persons?: string[] }).persons ?? []).forEach(p => { counts[p] = (counts[p] ?? 0) + 1 })
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [notes, dailyEntries])

  const generateWeeklyReflection = async () => {
    if (!claudeApiKey) { navigate('/settings'); return }
    setLoading('reflection'); setError('')
    try {
      const recentNotes = notes.slice(0, 15).map(n => `- ${n.title}: ${n.content.replace(/<[^>]*>/g, '').slice(0, 120)}`).join('\n')
      const recentJournal = dailyEntries.slice(0, 7).map(d => `${d.date} [${d.emotion ?? 'belirsiz'}]: ${d.mainNote?.replace(/<[^>]*>/g, '').slice(0, 200) ?? ''}`).join('\n')
      const taskSummary = `Toplam: ${tasks.length}, Tamamlanan: ${tasks.filter(t => t.status === 'done').length}, Bekleyen: ${tasks.filter(t => t.status === 'todo').length}`
      const goalSummary = goals.map(g => `${g.title} (%${g.progress})`).join(', ')

      const system = `Sen LifeTrack'in Hafıza Zekası'sın — bilge, sakin, derin biçimde empatik bir gözlemcisin.
Kullanıcının yazdıklarını yargılamadan gözlemler, yansıtır ve aydınlatırsın.
Türkçe konuş. Sıcak, anlayışlı, hiçbir zaman robotik değil. Madde listesi değil, akıcı paragraflar yaz.`

      const prompt = `Bu haftanın verileri:

NOTLAR (son 15):
${recentNotes || 'Yok'}

GÜNLÜK KAYITLAR (son 7 gün):
${recentJournal || 'Yok'}

GÖREVLER: ${taskSummary}
HEDEFLER: ${goalSummary || 'Yok'}

Bu verilere dayanarak 250-350 kelimelik bir haftalık değerlendirme yaz.
Şunları içermeli:
1. Bu haftanın özünü yakalayan güçlü bir gözlemle başla
2. 2-3 anlamlı örüntü (duygusal, davranışsal veya bilişsel)
3. Unutulmuş bir niyet veya tekrarlayan tema
4. Bir önerme (buyurgan değil, nazik)
5. Kullanıcının kendini anlaşılmış hissedeceği bir kapanış cümlesi

Ton: Sıcak, anlayışlı, hiçbir zaman buyurgan değil. Bir akıl hocası gibi, koç gibi değil.`

      const text = await callClaude(claudeApiKey, system, prompt)
      setReflection(text)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Brain size={20} className="text-primary-500" /> AI Hafıza Merkezi</h1>
          <p className="text-xs text-slate-400 mt-0.5">Hayatınızı anlayan zeka</p>
        </div>
        {!claudeApiKey && (
          <button onClick={() => navigate('/settings')} className="flex items-center gap-2 px-3 py-2 bg-primary-600 text-white text-sm rounded-lg">
            <Lock size={13} /> API Anahtarı Ekle
          </button>
        )}
      </div>

      {/* Weekly Reflection */}
      <InsightCard title="Haftalık Yansıma" icon={Sparkles} accent>
        {reflection ? (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{reflection}</p>
            <button onClick={generateWeeklyReflection} disabled={loading !== null}
              className="flex items-center gap-1.5 text-xs text-primary-500 hover:text-primary-400 transition-colors">
              <RefreshCw size={12} /> Yenile
            </button>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-slate-400 mb-4">Claude AI son notlarınızı, günlüklerinizi ve hedeflerinizi analiz ederek kişisel bir haftalık yansıma üretecek.</p>
            {error && <p className="text-xs text-red-500 mb-3 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
            <button onClick={generateWeeklyReflection} disabled={loading !== null}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded-xl mx-auto transition-colors disabled:opacity-60">
              {loading === 'reflection' ? <><Loader2 size={15} className="animate-spin" /> Oluşturuluyor...</> : <><Sparkles size={15} /> Haftalık Yansıma Oluştur</>}
            </button>
          </div>
        )}
      </InsightCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* On This Day */}
        <InsightCard title="Bugün Geçmişte" icon={CalendarDays}>
          {onThisDay.length === 0 ? (
            <p className="text-sm text-slate-400">Geçen yıllardan kayıt yok. Bugün bir şeyler yaz!</p>
          ) : (
            <div className="space-y-3">
              {onThisDay.map((item, i) => {
                const isNote = 'title' in item
                const date = (item as { createdAt?: string; date?: string }).createdAt ?? (item as { date?: string }).date ?? ''
                return (
                  <div key={i} className="border-l-2 border-primary-300 pl-3">
                    <div className="text-[10px] text-slate-400 mb-0.5">{fmtDate(date)} yılından</div>
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      {isNote ? (item as { title: string }).title : (item as { title?: string }).title || 'Günlük kaydı'}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </InsightCard>

        {/* Mood Trend */}
        <InsightCard title="Duygu Trendi (30 gün)" icon={TrendingUp}>
          {moodTrend.length === 0 ? (
            <p className="text-sm text-slate-400">Günlük kaydı eklendikçe duygu trendi burada görünecek.</p>
          ) : (
            <div>
              <div className="flex items-end gap-0.5 h-16 mb-3">
                {moodTrend.slice(-20).map((d, i) => (
                  <div key={i} className="flex-1 rounded-sm transition-all hover:opacity-80" title={`${d.date}: ${EMOTION_LABELS[d.emotion]}`}
                    style={{ height: `${(d.score / 5) * 100}%`, backgroundColor: EMOTION_COLORS[d.emotion] ?? '#94a3b8' }} />
                ))}
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>20 gün önce</span>
                {avgMood && <span>Ortalama: <strong className="text-slate-600 dark:text-slate-300">{avgMood}/5</strong></span>}
                <span>Bugün</span>
              </div>
            </div>
          )}
        </InsightCard>

        {/* Neglected Goals */}
        <InsightCard title="Dikkat Gereken Hedefler" icon={AlertCircle}>
          {neglectedGoals.length === 0 ? (
            <p className="text-sm text-slate-400">Tüm hedefleriniz yolunda! 🎉</p>
          ) : (
            <div className="space-y-3">
              {neglectedGoals.map(g => (
                <div key={g.id}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium">{g.title}</span>
                    <span className="text-slate-400">%{g.progress}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full">
                    <div className="h-1.5 bg-amber-500 rounded-full" style={{ width: `${g.progress}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </InsightCard>

        {/* Top Persons */}
        <InsightCard title="Sık Bahsettiğiniz Kişiler" icon={Brain}>
          {personCounts.length === 0 ? (
            <p className="text-sm text-slate-400">Notlarda kişi ekleyince burada görünecek.</p>
          ) : (
            <div className="space-y-2">
              {personCounts.map(([person, count]) => (
                <div key={person} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{person}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full">
                      <div className="h-1.5 bg-primary-500 rounded-full" style={{ width: `${Math.min(100, (count / (personCounts[0][1] || 1)) * 100)}%` }} />
                    </div>
                    <span className="text-xs text-slate-400 w-6 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </InsightCard>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Toplam Not', value: notes.length, icon: '📝' },
          { label: 'Günlük Kayıt', value: dailyEntries.length, icon: '📔' },
          { label: 'Aktif Hedef', value: goals.filter(g => g.status === 'active').length, icon: '🎯' },
          { label: 'Tamamlanan Görev', value: tasks.filter(t => t.status === 'done').length, icon: '✅' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 text-center">
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className="text-2xl font-bold text-primary-500">{s.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
