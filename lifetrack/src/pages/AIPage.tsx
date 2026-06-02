import { useState, useMemo } from 'react'
import { useStore } from '../lib/store'
import { Sparkles, Brain, CalendarDays, TrendingUp, AlertCircle, Loader2, Lock, RefreshCw, Activity } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { fmtDate, parseISO } from '../utils/dates'
import clsx from 'clsx'

// ─── Constants ────────────────────────────────────────────────

const EMOTION_COLORS: Record<string, string> = { great: '#10b981', good: '#3b82f6', neutral: '#94a3b8', bad: '#f59e0b', terrible: '#ef4444' }
const EMOTION_LABELS: Record<string, string> = { great: 'Harika 😄', good: 'İyi 🙂', neutral: 'Normal 😐', bad: 'Kötü 😔', terrible: 'Berbat 😢' }

const LIFE_LABELS: Record<string, string> = {
  career: 'Kariyer', health: 'Sağlık', relationships: 'İlişki', personal: 'Kişisel',
  finance: 'Finans', creativity: 'Yaratı', fun: 'Eğlence', balance: 'Denge',
}
const LIFE_PALETTE = ['#6366f1', '#10b981', '#ec4899', '#8b5cf6', '#f59e0b', '#3b82f6', '#ef4444', '#06b6d4']

const EMOTION_CFG: Record<string, { label: string; icon: string; color: string }> = {
  joy: { label: 'Neşe', icon: '😄', color: '#10b981' },
  focus: { label: 'Odak', icon: '🎯', color: '#6366f1' },
  motivation: { label: 'Motivasyon', icon: '⚡', color: '#8b5cf6' },
  calm: { label: 'Sakinlik', icon: '🌊', color: '#3b82f6' },
  anxiety: { label: 'Kaygı', icon: '😰', color: '#f59e0b' },
  fatigue: { label: 'Yorgunluk', icon: '😴', color: '#ef4444' },
}

// ─── API helpers ──────────────────────────────────────────────

async function callClaude(apiKey: string, system: string, user: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-allow-browser': 'true' },
    body: JSON.stringify({ model: 'claude-opus-4-7', max_tokens: 700, system, messages: [{ role: 'user', content: user }] }),
  })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as { error?: { message?: string } }).error?.message ?? `API hatası (${res.status})`) }
  const data = await res.json() as { content: { type: string; text: string }[] }
  return data.content[0]?.text ?? ''
}

async function callChatGPT(apiKey: string, system: string, user: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 700, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
  })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as { error?: { message?: string } }).error?.message ?? `API hatası (${res.status})`) }
  const data = await res.json() as { choices: { message: { content: string } }[] }
  return data.choices[0]?.message?.content ?? ''
}

const callAI = (ck: string, ok: string, sys: string, usr: string) =>
  ok ? callChatGPT(ok, sys, usr) : callClaude(ck, sys, usr)

// ─── Interfaces ───────────────────────────────────────────────

interface ReflectionData {
  weekScore: number
  momentum: 'rising' | 'stable' | 'falling'
  moodFlow: number[]
  lifeBalance: Record<string, number>
  emotionMap: Record<string, number>
  themes: { label: string; size: number }[]
  timeEnergy: { morning: number; afternoon: number; evening: number }
  riskLevel: number
}

interface PatternData {
  consistencyScore: number
  growthVector: number
  habitChain: number[]
  focusAreas: { label: string; score: number }[]
  activityRhythm: number[]
  streakDays: number
  peakBlock: 'morning' | 'afternoon' | 'evening'
  weekCompare: { notes: number; tasks: number; focus: number }
}

// ─── Parsers ──────────────────────────────────────────────────

function parseReflection(text: string): ReflectionData | null {
  try {
    const m = text.replace(/```json\n?/g, '').replace(/```/g, '').match(/\{[\s\S]*\}/)
    if (!m) return null
    const o = JSON.parse(m[0]) as Record<string, unknown>
    if (typeof o.weekScore !== 'number') return null
    const te = (o.timeEnergy ?? {}) as Record<string, number>
    return {
      weekScore: Math.min(100, Math.max(0, o.weekScore as number)),
      momentum: (['rising', 'stable', 'falling'] as const).includes(o.momentum as 'rising') ? o.momentum as ReflectionData['momentum'] : 'stable',
      moodFlow: Array.isArray(o.moodFlow) ? (o.moodFlow as number[]).slice(0, 7) : [3, 3, 3, 3, 3, 3, 3],
      lifeBalance: typeof o.lifeBalance === 'object' && o.lifeBalance ? o.lifeBalance as Record<string, number> : {},
      emotionMap: typeof o.emotionMap === 'object' && o.emotionMap ? o.emotionMap as Record<string, number> : {},
      themes: Array.isArray(o.themes) ? (o.themes as { label: string; size: number }[]).slice(0, 7) : [],
      timeEnergy: { morning: te.morning ?? 5, afternoon: te.afternoon ?? 5, evening: te.evening ?? 5 },
      riskLevel: Math.min(10, Math.max(0, (o.riskLevel ?? 3) as number)),
    }
  } catch { return null }
}

function parsePattern(text: string): PatternData | null {
  try {
    const m = text.replace(/```json\n?/g, '').replace(/```/g, '').match(/\{[\s\S]*\}/)
    if (!m) return null
    const o = JSON.parse(m[0]) as Record<string, unknown>
    if (typeof o.consistencyScore !== 'number') return null
    const wc = (o.weekCompare ?? {}) as Record<string, number>
    return {
      consistencyScore: Math.min(100, Math.max(0, o.consistencyScore as number)),
      growthVector: Math.min(5, Math.max(-5, (o.growthVector ?? 0) as number)),
      habitChain: Array.isArray(o.habitChain) ? (o.habitChain as number[]).slice(0, 21) : [],
      focusAreas: Array.isArray(o.focusAreas) ? (o.focusAreas as { label: string; score: number }[]).slice(0, 4) : [],
      activityRhythm: Array.isArray(o.activityRhythm) ? (o.activityRhythm as number[]).slice(0, 12) : Array(12).fill(5) as number[],
      streakDays: Math.max(0, (o.streakDays ?? 0) as number),
      peakBlock: (['morning', 'afternoon', 'evening'] as const).includes(o.peakBlock as 'morning') ? o.peakBlock as PatternData['peakBlock'] : 'morning',
      weekCompare: { notes: wc.notes ?? 0, tasks: wc.tasks ?? 0, focus: wc.focus ?? 0 },
    }
  } catch { return null }
}

// ─── Visual components ────────────────────────────────────────

function ScoreRing({ score, size = 88, label }: { score: number; size?: number; label?: string }) {
  const r = size * 0.37, circ = 2 * Math.PI * r
  const dash = (Math.min(100, Math.max(0, score)) / 100) * circ
  const color = score >= 70 ? '#10b981' : score >= 45 ? '#6366f1' : '#f59e0b'
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth="7" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="7"
          strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="middle"
          fontSize={size * 0.22} fontWeight="700" fill={color}>{score}</text>
      </svg>
      {label && <span className="text-[9px] text-slate-400 uppercase tracking-wide">{label}</span>}
    </div>
  )
}

function MoodBars7({ flow }: { flow: number[] }) {
  const colors = ['#ef4444', '#f59e0b', '#94a3b8', '#3b82f6', '#10b981']
  const days = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz']
  const padded = Array.from({ length: 7 }, (_, i) => Math.min(5, Math.max(1, flow[i] ?? 3)))
  return (
    <div className="flex items-end gap-1 h-11">
      {padded.map((v, i) => (
        <div key={i} className="flex flex-col items-center gap-0.5 flex-1">
          <div className="w-full rounded-t" style={{ height: `${(v / 5) * 36}px`, backgroundColor: colors[v - 1] }} />
          <span className="text-[7px] text-slate-500">{days[i]}</span>
        </div>
      ))}
    </div>
  )
}

function MomentumBadge({ m }: { m: ReflectionData['momentum'] }) {
  const cfg = {
    rising: { icon: '↗', color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20', label: 'Yükseliş' },
    stable: { icon: '→', color: 'text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', label: 'Dengeli' },
    falling: { icon: '↘', color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20', label: 'Düşüş' },
  }
  const c = cfg[m] ?? cfg.stable
  return (
    <div className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl ${c.bg}`}>
      <span className={`text-3xl font-black leading-none ${c.color}`}>{c.icon}</span>
      <span className={`text-[8px] font-bold uppercase tracking-wider ${c.color}`}>{c.label}</span>
    </div>
  )
}

// Polar area / Nightingale Rose chart for life balance
function LifeWheel({ data }: { data: Record<string, number> }) {
  const [hov, setHov] = useState<string | null>(null)
  const items = Object.keys(LIFE_LABELS).map((k, idx) => ({ key: k, label: LIFE_LABELS[k], v: Math.min(10, Math.max(0, data[k] ?? 0)), color: LIFE_PALETTE[idx] }))
  const n = items.length, size = 190, cx = 95, cy = 95, maxR = 72
  const sliceAngle = (2 * Math.PI) / n
  const ang = (i: number) => i * sliceAngle - Math.PI / 2
  return (
    <div className="flex justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {[0.25, 0.5, 0.75, 1].map(ring => (
          <circle key={ring} cx={cx} cy={cy} r={maxR * ring} fill="none" stroke="rgba(148,163,184,0.07)" strokeWidth="1" />
        ))}
        {items.map((item, i) => {
          const sa = ang(i), ea = ang(i + 1) - 0.03
          const bgx1 = cx + Math.cos(sa) * maxR, bgy1 = cy + Math.sin(sa) * maxR
          const bgx2 = cx + Math.cos(ea) * maxR, bgy2 = cy + Math.sin(ea) * maxR
          const r = (item.v / 10) * maxR
          const x1 = cx + Math.cos(sa) * r, y1 = cy + Math.sin(sa) * r
          const x2 = cx + Math.cos(ea) * r, y2 = cy + Math.sin(ea) * r
          const mid = ang(i) + sliceAngle / 2
          const lx = cx + (maxR + 13) * Math.cos(mid), ly = cy + (maxR + 13) * Math.sin(mid)
          const vx = cx + r * 0.55 * Math.cos(mid), vy = cy + r * 0.55 * Math.sin(mid)
          const isHov = hov === item.key
          return (
            <g key={item.key} onMouseEnter={() => setHov(item.key)} onMouseLeave={() => setHov(null)} style={{ cursor: 'pointer' }}>
              <path d={`M ${cx} ${cy} L ${bgx1} ${bgy1} A ${maxR} ${maxR} 0 0 1 ${bgx2} ${bgy2} Z`} fill={item.color} opacity={0.04} />
              {item.v > 0 && (
                <path d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`}
                  fill={item.color} opacity={isHov ? 0.9 : 0.65} style={{ transition: 'opacity 0.15s' }} />
              )}
              {item.v >= 3 && <text x={vx} y={vy} textAnchor="middle" dominantBaseline="middle" fontSize="8" fontWeight="700" fill="white">{item.v}</text>}
              <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="7.5" fill={isHov ? item.color : 'rgb(148,163,184)'}>{item.label}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// Emotion state grid with icons + mini bars
function EmotionMap({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(EMOTION_CFG).map(([k, cfg]) => ({ ...cfg, key: k, v: Math.min(10, Math.max(0, data[k] ?? 0)) }))
  return (
    <div className="grid grid-cols-3 gap-2">
      {entries.map(e => (
        <div key={e.key} className="flex flex-col items-center gap-1">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
            style={{ backgroundColor: e.color + '18', border: `1px solid ${e.color}30` }}>{e.icon}</div>
          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(e.v / 10) * 100}%`, backgroundColor: e.color }} />
          </div>
          <span className="text-[8px] font-bold" style={{ color: e.color }}>{e.v}</span>
        </div>
      ))}
    </div>
  )
}

// Theme clusters — variable-size bubbles
function ThemeBubbles({ themes }: { themes: { label: string; size: number }[] }) {
  const palette = ['#6366f1', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899']
  return (
    <div className="flex flex-wrap gap-2 items-center justify-center py-1">
      {[...themes].sort((a, b) => b.size - a.size).slice(0, 7).map((t, i) => {
        const dim = 24 + t.size * 7, fs = Math.max(7, 7 + t.size * 0.4)
        return (
          <div key={i} className="rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0"
            style={{ width: dim, height: dim, backgroundColor: palette[i % palette.length], fontSize: fs }}>
            {t.label.slice(0, 5)}
          </div>
        )
      })}
    </div>
  )
}

// Time-of-day energy bars
function EnergyRhythm({ te }: { te: ReflectionData['timeEnergy'] }) {
  const vals = [te.morning, te.afternoon, te.evening]
  const icons = ['🌅', '☀️', '🌙']
  const max = Math.max(...vals, 1)
  const grads = ['from-amber-300 to-yellow-400', 'from-orange-400 to-amber-500', 'from-indigo-400 to-purple-500']
  return (
    <div className="space-y-2">
      {vals.map((v, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-sm w-5">{icons[i]}</span>
          <div className="flex-1 h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full bg-gradient-to-r ${grads[i]}`} style={{ width: `${(v / max) * 100}%` }} />
          </div>
          <span className="text-[9px] text-slate-400 font-mono w-3 text-right">{v}</span>
        </div>
      ))}
    </div>
  )
}

// Semi-circle risk gauge
function RiskMeter({ level }: { level: number }) {
  const W = 68, cy = 38, r = 26, circ = Math.PI * r
  const dash = (level / 10) * circ
  const color = level <= 3 ? '#10b981' : level <= 6 ? '#f59e0b' : '#ef4444'
  const na = Math.PI - (level / 10) * Math.PI
  const nx = W / 2 + r * Math.cos(na), ny = cy - r * Math.sin(na)
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={W} height={44} viewBox={`0 0 ${W} 44`}>
        <path d={`M ${W / 2 - r} ${cy} A ${r} ${r} 0 0 1 ${W / 2 + r} ${cy}`} fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth="6" strokeLinecap="round" />
        <path d={`M ${W / 2 - r} ${cy} A ${r} ${r} 0 0 1 ${W / 2 + r} ${cy}`} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${dash} ${circ}`} opacity="0.7" />
        <line x1={W / 2} y1={cy} x2={nx} y2={ny} stroke={color} strokeWidth="2" strokeLinecap="round" />
        <circle cx={W / 2} cy={cy} r="3" fill={color} />
        <text x={W / 2} y={cy + 10} textAnchor="middle" fontSize="9" fill={color} fontWeight="700">{level}/10</text>
      </svg>
      <span className="text-[8px] text-slate-400 uppercase tracking-wide">Risk</span>
    </div>
  )
}

// Growth vector bar (positive/negative)
function GrowthVector({ v }: { v: number }) {
  const isPos = v >= 0, pct = Math.abs(v) / 5 * 100
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-20 h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className="absolute top-0 left-1/2 h-full w-px bg-slate-400 -translate-x-px" />
        <div className={`absolute top-0 h-full rounded-full ${isPos ? 'bg-emerald-500' : 'bg-red-500'}`}
          style={{ width: `${pct / 2}%`, ...(isPos ? { left: '50%' } : { right: '50%' }) }} />
      </div>
      <span className={`text-base font-black leading-none ${isPos ? 'text-emerald-500' : 'text-red-500'}`}>{isPos ? '+' : ''}{v}</span>
      <span className="text-[8px] text-slate-400 uppercase tracking-wide">Büyüme</span>
    </div>
  )
}

// Habit chain — row of colored squares (like GitHub)
function HabitChain({ chain }: { chain: number[] }) {
  const cells = Array.from({ length: 21 }, (_, i) => chain[chain.length - 21 + i] ?? null)
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1">
        {cells.map((v, i) => (
          <div key={i} className="w-4 h-4 rounded-sm flex-shrink-0"
            style={{ backgroundColor: v === 1 ? '#6366f1' : v === 0 ? 'rgba(148,163,184,0.12)' : 'transparent' }} />
        ))}
      </div>
      <div className="flex justify-between text-[7px] text-slate-500">
        <span>3 hafta önce</span><span>bugün</span>
      </div>
    </div>
  )
}

// Streak dots
function StreakDots({ count }: { count: number }) {
  const show = Math.min(count, 10)
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex flex-wrap gap-1 justify-center max-w-[64px]">
        {Array.from({ length: show }, (_, i) => <div key={i} className="w-2 h-2 rounded-full bg-primary-500" />)}
        {count > 10 && <span className="text-[8px] text-primary-500 font-bold">+{count - 10}</span>}
      </div>
      <span className="text-sm font-black text-primary-500 leading-none">{count}</span>
      <span className="text-[8px] text-slate-400 uppercase tracking-wide">Gün Serisi</span>
    </div>
  )
}

// Focus area horizontal bars
function FocusAreaBars({ areas }: { areas: { label: string; score: number }[] }) {
  const palette = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6']
  return (
    <div className="space-y-2">
      {areas.slice(0, 4).map((a, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-14 text-[9px] text-slate-500 truncate">{a.label}</div>
          <div className="flex-1 h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(a.score / 10) * 100}%`, backgroundColor: palette[i % palette.length] }} />
          </div>
          <span className="text-[9px] text-slate-400 font-mono w-3 text-right">{a.score}</span>
        </div>
      ))}
    </div>
  )
}

// Activity sparkline
function ActivitySparkline({ rhythm }: { rhythm: number[] }) {
  const W = 160, H = 30
  const n = Math.max(rhythm.length, 2), max = Math.max(...rhythm, 1)
  const pts = rhythm.map((v, i) => [i / (n - 1) * W, H - (v / max) * H] as [number, number])
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={[`0,${H}`, ...pts.map(p => p.join(',')), `${W},${H}`].join(' ')} fill="url(#spark-fill)" />
      <polyline points={pts.map(p => p.join(',')).join(' ')} fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

// Week-over-week delta badges
function WeekDelta({ wc }: { wc: PatternData['weekCompare'] }) {
  const items = [
    { label: 'Not', v: wc.notes, icon: '📝' },
    { label: 'Görev', v: wc.tasks, icon: '✅' },
    { label: 'Odak', v: wc.focus, icon: '🎯' },
  ]
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map(item => {
        const isPos = item.v >= 0
        const color = item.v === 0 ? 'text-slate-400' : isPos ? 'text-emerald-500' : 'text-red-500'
        return (
          <div key={item.label} className="flex flex-col items-center gap-1 bg-slate-50 dark:bg-slate-800/40 rounded-xl py-2.5 px-1">
            <span className="text-base">{item.icon}</span>
            <span className={`text-sm font-black leading-none ${color}`}>{isPos ? '+' : ''}{item.v}</span>
            <span className="text-[8px] text-slate-400">{item.label}</span>
          </div>
        )
      })}
    </div>
  )
}

// GitHub-style mood heatmap (from real data, no AI)
function MoodHeatmap({ entries }: { entries: { date: string; emotion?: string }[] }) {
  const weeks = 12
  const today = new Date()
  const grid: { date: string; emotion: string | null }[][] = []
  for (let w = weeks - 1; w >= 0; w--) {
    const week: { date: string; emotion: string | null }[] = []
    for (let d = 0; d < 7; d++) {
      const dt = new Date(today)
      dt.setDate(dt.getDate() - (w * 7 + (6 - d)))
      const ds = dt.toISOString().split('T')[0]
      const found = entries.find(e => e.date === ds)
      week.push({ date: ds, emotion: found?.emotion ?? null })
    }
    grid.push(week)
  }
  return (
    <div className="flex gap-0.5" title="Son 12 hafta duygu haritası">
      {grid.map((week, wi) => (
        <div key={wi} className="flex flex-col gap-0.5">
          {week.map((day, di) => (
            <div key={di} className="w-3 h-3 rounded-sm"
              title={day.date + (day.emotion ? ': ' + day.emotion : '')}
              style={{ backgroundColor: day.emotion ? EMOTION_COLORS[day.emotion] + 'cc' : 'rgba(148,163,184,0.12)' }} />
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── InsightCard ──────────────────────────────────────────────

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

// ─── Main page ────────────────────────────────────────────────

export default function AIPage() {
  const { notes, dailyEntries, tasks, goals, claudeApiKey, openaiApiKey } = useStore()
  const navigate = useNavigate()
  const [reflection, setReflection] = useState<ReflectionData | null>(null)
  const [pattern, setPattern] = useState<PatternData | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const hasKey = !!(claudeApiKey || openaiApiKey)

  const onThisDay = useMemo(() => {
    const today = new Date(), month = today.getMonth(), day = today.getDate(), year = today.getFullYear()
    return [...notes, ...dailyEntries]
      .filter(item => {
        const d = parseISO((item as { createdAt?: string; date?: string }).createdAt ?? (item as { date?: string }).date ?? '')
        return d.getMonth() === month && d.getDate() === day && d.getFullYear() < year
      })
      .sort((a, b) => new Date((a as { createdAt?: string; date?: string }).createdAt ?? (a as { date?: string }).date ?? '').getTime()
        - new Date((b as { createdAt?: string; date?: string }).createdAt ?? (b as { date?: string }).date ?? '').getTime())
      .slice(0, 5)
  }, [notes, dailyEntries])

  const moodTrend = useMemo(() => {
    const s: Record<string, number> = { great: 5, good: 4, neutral: 3, bad: 2, terrible: 1 }
    return dailyEntries.filter(d => d.emotion).sort((a, b) => a.date.localeCompare(b.date)).slice(-30)
      .map(d => ({ date: d.date, emotion: d.emotion!, score: s[d.emotion!] ?? 3 }))
  }, [dailyEntries])

  const avgMood = moodTrend.length ? (moodTrend.reduce((s, d) => s + d.score, 0) / moodTrend.length).toFixed(1) : null
  const neglectedGoals = goals.filter(g => g.status === 'active' && g.progress < 50).slice(0, 3)
  const personCounts = useMemo(() => {
    const c: Record<string, number> = {}
    ;[...notes, ...dailyEntries].forEach(item => ((item as { persons?: string[] }).persons ?? []).forEach(p => { c[p] = (c[p] ?? 0) + 1 }))
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [notes, dailyEntries])

  const buildCtx = () => ({
    recentNotes: notes.slice(0, 15).map(n => `- ${n.title}: ${n.content.replace(/<[^>]*>/g, '').slice(0, 100)}`).join('\n'),
    recentJournal: dailyEntries.slice(0, 7).map(d => `${d.date}[${d.emotion ?? '?'}]: ${d.mainNote?.replace(/<[^>]*>/g, '').slice(0, 150) ?? ''}`).join('\n'),
    taskSummary: `${tasks.filter(t => t.status === 'done').length}/${tasks.length} tamamlandı`,
    goalSummary: goals.map(g => `${g.title}(%${g.progress})`).join(','),
  })

  const generateReflection = async () => {
    if (!hasKey) { navigate('/settings'); return }
    setLoading('reflection'); setError('')
    try {
      const { recentNotes, recentJournal, taskSummary, goalSummary } = buildCtx()
      const sys = 'Sadece geçerli JSON döndür. Hiçbir açıklama veya metin ekleme.'
      const prompt = `Verileri analiz et, SADECE bu JSON şemasında yanıt ver (başka hiçbir şey):
{"weekScore":<0-100>,"momentum":"<rising|stable|falling>","moodFlow":[<7 günlük 1-5>],"lifeBalance":{"career":<0-10>,"health":<0-10>,"relationships":<0-10>,"personal":<0-10>,"finance":<0-10>,"creativity":<0-10>,"fun":<0-10>,"balance":<0-10>},"emotionMap":{"joy":<0-10>,"focus":<0-10>,"motivation":<0-10>,"calm":<0-10>,"anxiety":<0-10>,"fatigue":<0-10>},"themes":[{"label":"<max6kr>","size":<1-10>}],"timeEnergy":{"morning":<0-10>,"afternoon":<0-10>,"evening":<0-10>},"riskLevel":<0-10>}

VERİLER:
NOTLAR:${recentNotes || 'yok'}
GÜNLÜK:${recentJournal || 'yok'}
GÖREVLER:${taskSummary}
HEDEFLER:${goalSummary || 'yok'}`
      const text = await callAI(claudeApiKey, openaiApiKey, sys, prompt)
      const data = parseReflection(text)
      if (!data) throw new Error('Yanıt işlenemedi — tekrar deneyin.')
      setReflection(data)
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(null) }
  }

  const generatePattern = async () => {
    if (!hasKey) { navigate('/settings'); return }
    setLoading('pattern'); setError('')
    try {
      const { recentNotes, recentJournal, taskSummary, goalSummary } = buildCtx()
      const sys = 'Sadece geçerli JSON döndür. Hiçbir açıklama ekleme.'
      const prompt = `Davranış örüntülerini analiz et, SADECE bu JSON şemasında yanıt ver:
{"consistencyScore":<0-100>,"growthVector":<-5..+5>,"habitChain":[<21 günlük 0/1 aktif>],"focusAreas":[{"label":"<kısa>","score":<0-10>},{"label":"<kısa>","score":<0-10>},{"label":"<kısa>","score":<0-10>},{"label":"<kısa>","score":<0-10>}],"activityRhythm":[<12 değer 0-10, 06:00'dan 24:00'a 2'şer saat>],"streakDays":<0-30>,"peakBlock":"<morning|afternoon|evening>","weekCompare":{"notes":<delta>,"tasks":<delta>,"focus":<delta>}}

VERİLER:
NOTLAR:${recentNotes || 'yok'}
GÜNLÜK:${recentJournal || 'yok'}
GÖREVLER:${taskSummary}
HEDEFLER:${goalSummary || 'yok'}`
      const text = await callAI(claudeApiKey, openaiApiKey, sys, prompt)
      const data = parsePattern(text)
      if (!data) throw new Error('Yanıt işlenemedi — tekrar deneyin.')
      setPattern(data)
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(null) }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Brain size={20} className="text-primary-500" /> AI Hafıza Merkezi</h1>
          <p className="text-xs text-slate-400 mt-0.5">Hayatınızı anlayan zeka</p>
        </div>
        {!hasKey && (
          <button onClick={() => navigate('/settings')} className="flex items-center gap-2 px-3 py-2 bg-primary-600 text-white text-sm rounded-lg">
            <Lock size={13} /> API Anahtarı Ekle
          </button>
        )}
      </div>

      {/* ── Panel 1: Haftalık Görsel Rapor ── */}
      <InsightCard title="Haftalık Görsel Rapor" icon={Sparkles} accent>
        {reflection ? (
          <div className="space-y-5">
            {/* Row 1: Score + Momentum + 7-day mood */}
            <div className="grid grid-cols-3 gap-3 items-center">
              <ScoreRing score={reflection.weekScore} label="Hafta Skoru" />
              <MomentumBadge m={reflection.momentum} />
              <div>
                <div className="text-[8px] text-slate-400 uppercase tracking-wide mb-1.5 text-center">Duygu Akışı</div>
                <MoodBars7 flow={reflection.moodFlow} />
              </div>
            </div>
            {/* Row 2: Life Wheel + Emotion Map */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[8px] text-slate-400 uppercase tracking-wide mb-1 text-center">Yaşam Dengesi</div>
                <LifeWheel data={reflection.lifeBalance} />
              </div>
              <div>
                <div className="text-[8px] text-slate-400 uppercase tracking-wide mb-2 text-center">Duygu Haritası</div>
                <EmotionMap data={reflection.emotionMap} />
              </div>
            </div>
            {/* Row 3: Themes + Energy + Risk */}
            <div className="grid grid-cols-3 gap-3 items-center">
              <div className="col-span-1">
                <div className="text-[8px] text-slate-400 uppercase tracking-wide mb-1 text-center">Temalar</div>
                <ThemeBubbles themes={reflection.themes} />
              </div>
              <div>
                <div className="text-[8px] text-slate-400 uppercase tracking-wide mb-2">Enerji Ritmi</div>
                <EnergyRhythm te={reflection.timeEnergy} />
              </div>
              <div className="flex justify-center">
                <RiskMeter level={reflection.riskLevel} />
              </div>
            </div>
            <div className="flex justify-end border-t border-slate-100 dark:border-slate-800 pt-2">
              <button onClick={generateReflection} disabled={loading !== null}
                className="flex items-center gap-1 text-xs text-primary-500 hover:text-primary-400 disabled:opacity-50">
                {loading === 'reflection' ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />} Yenile
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            {error && <p className="text-xs text-red-500 mb-3 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
            <button onClick={generateReflection} disabled={loading !== null}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded-xl mx-auto transition-colors disabled:opacity-60">
              {loading === 'reflection' ? <><Loader2 size={15} className="animate-spin" /> Analiz ediliyor...</> : <><Sparkles size={15} /> Görsel Rapor Oluştur</>}
            </button>
          </div>
        )}
      </InsightCard>

      {/* ── Panel 2: Örüntü Analizi ── */}
      <InsightCard title="Örüntü & Davranış Analizi" icon={Activity}>
        {pattern ? (
          <div className="space-y-5">
            {/* Row 1: Consistency + Growth + Streak + Peak */}
            <div className="grid grid-cols-4 gap-3 items-center">
              <ScoreRing score={pattern.consistencyScore} size={76} label="Tutarlılık" />
              <GrowthVector v={pattern.growthVector} />
              <StreakDots count={pattern.streakDays} />
              <div className="flex flex-col items-center gap-1">
                <span className="text-3xl leading-none">
                  {pattern.peakBlock === 'morning' ? '🌅' : pattern.peakBlock === 'afternoon' ? '☀️' : '🌙'}
                </span>
                <span className="text-[8px] text-slate-400 uppercase tracking-wide">Pik Zaman</span>
              </div>
            </div>
            {/* Row 2: Habit chain + Week-over-week */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[8px] text-slate-400 uppercase tracking-wide mb-2">Alışkanlık Zinciri (21 gün)</div>
                <HabitChain chain={pattern.habitChain} />
              </div>
              <div>
                <div className="text-[8px] text-slate-400 uppercase tracking-wide mb-2">Haftalık Δ</div>
                <WeekDelta wc={pattern.weekCompare} />
              </div>
            </div>
            {/* Row 3: Focus areas + Activity rhythm */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[8px] text-slate-400 uppercase tracking-wide mb-2">Odak Alanları</div>
                <FocusAreaBars areas={pattern.focusAreas} />
              </div>
              <div>
                <div className="text-[8px] text-slate-400 uppercase tracking-wide mb-2">Gün İçi Aktivite</div>
                <ActivitySparkline rhythm={pattern.activityRhythm} />
                <div className="flex justify-between text-[7px] text-slate-500 mt-0.5 px-0.5">
                  <span>06</span><span>10</span><span>14</span><span>18</span><span>22</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end border-t border-slate-100 dark:border-slate-800 pt-2">
              <button onClick={generatePattern} disabled={loading !== null}
                className="flex items-center gap-1 text-xs text-primary-500 hover:text-primary-400 disabled:opacity-50">
                {loading === 'pattern' ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />} Yenile
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <button onClick={generatePattern} disabled={loading !== null}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded-xl mx-auto transition-colors disabled:opacity-60">
              {loading === 'pattern' ? <><Loader2 size={15} className="animate-spin" /> Analiz ediliyor...</> : <><Activity size={15} /> Örüntü Analizi Yap</>}
            </button>
          </div>
        )}
      </InsightCard>

      {/* ── Data panels grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Duygu Trendi — enhanced with heatmap */}
        <InsightCard title="Duygu Trendi (12 hafta)" icon={TrendingUp}>
          {dailyEntries.length === 0 ? (
            <p className="text-sm text-slate-400">Günlük kaydı eklendikçe duygu trendi burada görünecek.</p>
          ) : (
            <div className="space-y-3">
              <MoodHeatmap entries={dailyEntries} />
              <div className="flex items-end gap-0.5 h-10">
                {moodTrend.slice(-20).map((d, i) => (
                  <div key={i} className="flex-1 rounded-sm hover:opacity-80" title={`${d.date}: ${EMOTION_LABELS[d.emotion]}`}
                    style={{ height: `${(d.score / 5) * 100}%`, backgroundColor: EMOTION_COLORS[d.emotion] ?? '#94a3b8' }} />
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>20 gün önce</span>
                {avgMood && <span>Ort <strong className="text-slate-600 dark:text-slate-300">{avgMood}/5</strong></span>}
                <span>Bugün</span>
              </div>
            </div>
          )}
        </InsightCard>

        {/* Bugün Geçmişte */}
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

        {/* Dikkat Gereken Hedefler */}
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

        {/* Sık Bahsettiğiniz Kişiler */}
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
