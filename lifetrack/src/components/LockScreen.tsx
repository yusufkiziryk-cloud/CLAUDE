import { useState, useEffect, useRef } from 'react'
import { Lock, Delete } from 'lucide-react'
import clsx from 'clsx'

interface Props {
  onUnlock: () => void
  storedPassword: string
}

export default function LockScreen({ onUnlock, storedPassword }: Props) {
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)

  const isPin = /^\d+$/.test(storedPassword)

  useEffect(() => {
    if (isPin && input.length === storedPassword.length) {
      check(input)
    }
  }, [input])

  const check = (val: string) => {
    if (val === storedPassword) {
      onUnlock()
    } else {
      setShake(true)
      setError(true)
      setInput('')
      setTimeout(() => { setShake(false); setError(false) }, 600)
    }
  }

  const press = (d: string) => {
    if (input.length < storedPassword.length) setInput(p => p + d)
  }

  const dots = Array.from({ length: storedPassword.length }, (_, i) => i)

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 select-none">
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="w-16 h-16 rounded-2xl bg-primary-600 flex items-center justify-center">
          <Lock size={28} className="text-white" />
        </div>
        <h1 className="text-xl font-semibold text-white">LifeTrack</h1>
        <p className="text-sm text-slate-400">{isPin ? 'PIN kodunu gir' : 'Şifreni gir'}</p>
      </div>

      {isPin ? (
        <>
          {/* PIN dots */}
          <div className={clsx('flex gap-4 mb-10 transition-transform', shake && 'animate-bounce')}>
            {dots.map(i => (
              <div key={i} className={clsx('w-4 h-4 rounded-full border-2 transition-all duration-150', i < input.length ? (error ? 'bg-red-500 border-red-500' : 'bg-primary-400 border-primary-400') : 'border-slate-600')} />
            ))}
          </div>

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-3 w-64">
            {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((k, i) => {
              if (k === '') return <div key={i} />
              return (
                <button
                  key={i}
                  onClick={() => k === '⌫' ? setInput(p => p.slice(0, -1)) : press(String(k))}
                  className={clsx(
                    'h-16 rounded-2xl text-xl font-medium transition-all active:scale-95',
                    k === '⌫'
                      ? 'text-slate-400 hover:bg-slate-800 flex items-center justify-center'
                      : 'bg-slate-800 text-white hover:bg-slate-700'
                  )}
                >
                  {k === '⌫' ? <Delete size={20} /> : k}
                </button>
              )
            })}
          </div>
        </>
      ) : (
        /* Text password */
        <div className={clsx('w-72 space-y-3', shake && 'animate-bounce')}>
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && check(input)}
            placeholder="Şifre..."
            autoFocus
            className={clsx(
              'w-full px-4 py-3 rounded-xl bg-slate-800 text-white text-center text-lg tracking-widest border-2 focus:outline-none transition-colors',
              error ? 'border-red-500' : 'border-slate-700 focus:border-primary-500'
            )}
          />
          {error && <p className="text-red-400 text-sm text-center">Yanlış şifre</p>}
          <button
            onClick={() => check(input)}
            className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium transition-colors"
          >
            Giriş
          </button>
        </div>
      )}

      {error && isPin && <p className="mt-6 text-red-400 text-sm">Yanlış PIN</p>}
    </div>
  )
}
