import { View, Text, ScrollView, TouchableOpacity, TextInput, useColorScheme } from 'react-native'
import { useState } from 'react'
import { Feather } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useStore } from '../../src/store/store'

const ORANGE = '#ea580c'
const EMOTIONS = [
  { key: 'great', emoji: '😄', label: 'Harika', color: '#10b981' },
  { key: 'good', emoji: '🙂', label: 'İyi', color: '#3b82f6' },
  { key: 'neutral', emoji: '😐', label: 'Normal', color: '#94a3b8' },
  { key: 'bad', emoji: '😔', label: 'Kötü', color: '#f59e0b' },
  { key: 'terrible', emoji: '😢', label: 'Berbat', color: '#ef4444' },
] as const

const QUOTES = [
  'Küçük adımlar büyük değişimlere yol açar.',
  'Her gün yeni bir başlangıç fırsatıdır.',
  'Alışkanlıklar karakteri şekillendirir.',
  'Bugünkü emeklerin yarının başarısıdır.',
  'Zihnini besle, ruhunu dinle.',
]

export default function TodayScreen() {
  const isDark = useColorScheme() === 'dark'
  const { notes, habits, habitLogs, toggleHabitLog, addNote, dailyEntries, saveDailyEntry, getDailyEntry } = useStore()
  const [quickNote, setQuickNote] = useState('')

  const today = new Date().toISOString().slice(0, 10)
  const todayEntry = getDailyEntry(today)
  const todayDone = new Set(habitLogs.filter(l => l.date === today && l.done).map(l => l.habitId))
  const activeHabits = habits.filter(h => h.isActive)
  const completionPct = activeHabits.length ? (todayDone.size / activeHabits.length) * 100 : 0
  const todayNotes = notes.filter(n => n.createdAt.startsWith(today))
  const quote = QUOTES[new Date().getDay() % QUOTES.length]

  const bg = isDark ? '#0f172a' : '#f8fafc'
  const card = isDark ? '#1e293b' : '#ffffff'
  const border = isDark ? '#334155' : '#e2e8f0'
  const text = isDark ? '#f1f5f9' : '#0f172a'
  const muted = isDark ? '#94a3b8' : '#64748b'

  const hour = new Date().getHours()
  const greeting = hour < 6 ? 'Gece yarısı' : hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar'

  const handleQuickSave = async () => {
    if (!quickNote.trim()) return
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    addNote({ title: quickNote.slice(0, 60), content: quickNote, emotion: undefined, tags: [] })
    setQuickNote('')
  }

  const handleHabitToggle = async (habitId: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    toggleHabitLog(habitId)
  }

  const handleEmotionPick = async (key: typeof EMOTIONS[number]['key']) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    saveDailyEntry({ date: today, title: 'Günlük', mainNote: todayEntry?.mainNote ?? '', emotion: key, energy: todayEntry?.energy ?? 3, tags: [] })
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={{ paddingBottom: 40 }}>

      {/* Hero */}
      <View style={{ padding: 20, paddingBottom: 0 }}>
        <View style={{ backgroundColor: ORANGE, borderRadius: 24, padding: 20, marginBottom: 16, overflow: 'hidden' }}>
          <View style={{ position: 'absolute', right: -20, top: -20, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.1)' }} />
          <View style={{ position: 'absolute', right: 30, bottom: -30, width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.08)' }} />
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '500', marginBottom: 4 }}>
            {new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>
          <Text style={{ color: 'white', fontSize: 26, fontWeight: '800', marginBottom: 8 }}>{greeting} 👋</Text>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 20, fontStyle: 'italic' }}>"{quote}"</Text>
        </View>

        {/* Stats grid */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Not', value: notes.length, icon: '📝' },
            { label: 'Günlük', value: dailyEntries.length, icon: '📔' },
            { label: 'Seri', value: Math.max(0, ...habits.map(h => h.streak)), icon: '🔥' },
            { label: 'Alışkanlık', value: `${todayDone.size}/${activeHabits.length}`, icon: '⚡' },
          ].map(s => (
            <View key={s.label} style={{ flex: 1, backgroundColor: card, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: border, alignItems: 'center' }}>
              <Text style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</Text>
              <Text style={{ color: ORANGE, fontSize: 18, fontWeight: '800' }}>{s.value}</Text>
              <Text style={{ color: muted, fontSize: 10, marginTop: 2 }}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, gap: 14 }}>

        {/* Mood */}
        <View style={{ backgroundColor: card, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: border }}>
          <Text style={{ color: muted, fontSize: 12, fontWeight: '600', marginBottom: 12 }}>BUGÜN NASIL HİSSEDİYORSUN?</Text>
          {todayEntry?.emotion ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ fontSize: 32 }}>{EMOTIONS.find(e => e.key === todayEntry.emotion)?.emoji}</Text>
              <View>
                <Text style={{ color: text, fontWeight: '700', fontSize: 16 }}>{EMOTIONS.find(e => e.key === todayEntry.emotion)?.label}</Text>
                <Text style={{ color: muted, fontSize: 12 }}>Bugünkü duygu durumun kaydedildi</Text>
              </View>
              <TouchableOpacity onPress={() => handleEmotionPick(todayEntry.emotion!)} style={{ marginLeft: 'auto' }}>
                <Feather name="edit-2" size={16} color={muted} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {EMOTIONS.map(e => (
                <TouchableOpacity key={e.key} onPress={() => handleEmotionPick(e.key)} style={{ alignItems: 'center', padding: 8 }}>
                  <Text style={{ fontSize: 30 }}>{e.emoji}</Text>
                  <Text style={{ color: muted, fontSize: 10, marginTop: 4 }}>{e.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Habits progress */}
        {activeHabits.length > 0 && (
          <View style={{ backgroundColor: card, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: border }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ color: text, fontWeight: '700', fontSize: 15 }}>Alışkanlıklar</Text>
              <Text style={{ color: ORANGE, fontWeight: '800', fontSize: 16 }}>{todayDone.size}/{activeHabits.length}</Text>
            </View>
            <View style={{ height: 8, backgroundColor: border, borderRadius: 4, overflow: 'hidden', marginBottom: 14 }}>
              <View style={{ height: 8, width: `${completionPct}%` as any, backgroundColor: completionPct === 100 ? '#10b981' : ORANGE, borderRadius: 4 }} />
            </View>
            {completionPct === 100 && (
              <Text style={{ color: '#10b981', fontWeight: '700', marginBottom: 10 }}>🏆 Hepsi tamamlandı!</Text>
            )}
            {activeHabits.slice(0, 5).map(h => {
              const done = todayDone.has(h.id)
              return (
                <TouchableOpacity key={h.id} onPress={() => handleHabitToggle(h.id)}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: border }}>
                  <Text style={{ fontSize: 22, marginRight: 12 }}>{h.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: done ? muted : text, fontSize: 14, fontWeight: '600', textDecorationLine: done ? 'line-through' : 'none' }}>{h.name}</Text>
                    {h.streak > 0 && <Text style={{ color: '#f97316', fontSize: 11, marginTop: 2 }}>⚡ {h.streak} günlük seri</Text>}
                  </View>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: done ? '#10b981' : border, alignItems: 'center', justifyContent: 'center' }}>
                    {done && <Feather name="check" size={15} color="white" />}
                  </View>
                </TouchableOpacity>
              )
            })}
          </View>
        )}

        {/* Quick capture */}
        <View style={{ backgroundColor: card, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: border }}>
          <Text style={{ color: muted, fontSize: 12, fontWeight: '600', marginBottom: 12 }}>⚡ HIZLI NOT</Text>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
            <TextInput value={quickNote} onChangeText={setQuickNote} placeholder="Aklındakini hızlıca yaz..." placeholderTextColor={muted}
              multiline style={{ flex: 1, color: text, fontSize: 15, minHeight: 44, lineHeight: 22 }} />
            <TouchableOpacity onPress={handleQuickSave} disabled={!quickNote.trim()}
              style={{ backgroundColor: quickNote.trim() ? ORANGE : border, borderRadius: 12, padding: 12 }}>
              <Feather name="send" size={18} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Today's notes */}
        {todayNotes.length > 0 && (
          <View>
            <Text style={{ color: muted, fontSize: 12, fontWeight: '600', marginBottom: 10 }}>BUGÜNÜN NOTLARI</Text>
            {todayNotes.map(n => (
              <View key={n.id} style={{ backgroundColor: card, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: border, borderLeftWidth: 3, borderLeftColor: ORANGE }}>
                <Text style={{ color: text, fontWeight: '700', fontSize: 14 }}>{n.title}</Text>
                {n.content !== n.title && <Text style={{ color: muted, fontSize: 13, marginTop: 4 }} numberOfLines={2}>{n.content}</Text>}
              </View>
            ))}
          </View>
        )}

        {/* Journal prompt */}
        {!todayEntry?.mainNote && (
          <View style={{ backgroundColor: card, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: border + '80', borderStyle: 'dashed' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Feather name="book-open" size={20} color={ORANGE} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: text, fontWeight: '700', fontSize: 14 }}>Günlük yazmadın henüz</Text>
                <Text style={{ color: muted, fontSize: 12, marginTop: 2 }}>Bugünü kayıt altına al</Text>
              </View>
              <Feather name="chevron-right" size={18} color={muted} />
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  )
}
