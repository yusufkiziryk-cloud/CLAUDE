import { View, Text, ScrollView, TouchableOpacity, TextInput, useColorScheme, StyleSheet } from 'react-native'
import { useState } from 'react'
import { Feather } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useStore } from '../../src/store/store'

const ORANGE = '#ea580c'
const EMOTIONS = [
  { key: 'great', emoji: '😄', label: 'Harika' },
  { key: 'good', emoji: '🙂', label: 'İyi' },
  { key: 'neutral', emoji: '😐', label: 'Normal' },
  { key: 'bad', emoji: '😔', label: 'Kötü' },
  { key: 'terrible', emoji: '😢', label: 'Berbat' },
] as const

export default function TodayScreen() {
  const isDark = useColorScheme() === 'dark'
  const { notes, habits, habitLogs, toggleHabitLog, addNote, dailyEntries } = useStore()
  const [quickNote, setQuickNote] = useState('')

  const today = new Date().toISOString().slice(0, 10)
  const todayNotes = notes.filter(n => n.createdAt.startsWith(today))
  const todayEntry = dailyEntries.find(e => e.date === today)
  const todayDone = new Set(habitLogs.filter(l => l.date === today && l.done).map(l => l.habitId))
  const activeHabits = habits.filter(h => h.isActive)

  const handleQuickSave = async () => {
    if (!quickNote.trim()) return
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    addNote({ title: quickNote.slice(0, 50), content: quickNote, emotion: undefined, tags: [] })
    setQuickNote('')
  }

  const handleHabitToggle = async (habitId: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    toggleHabitLog(habitId)
  }

  const bg = isDark ? '#0f172a' : '#f8fafc'
  const card = isDark ? '#1e293b' : '#ffffff'
  const border = isDark ? '#334155' : '#e2e8f0'
  const text = isDark ? '#f1f5f9' : '#0f172a'
  const muted = isDark ? '#94a3b8' : '#64748b'

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 6) return 'Gece yarısı'
    if (h < 12) return 'Günaydın'
    if (h < 18) return 'İyi günler'
    return 'İyi akşamlar'
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      {/* Greeting */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{ fontSize: 26, fontWeight: '800', color: text }}>{greeting()} 👋</Text>
        <Text style={{ color: muted, marginTop: 4, fontSize: 14 }}>
          {new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </Text>
      </View>

      {/* Mood for today */}
      {!todayEntry && (
        <View style={{ backgroundColor: card, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: border }}>
          <Text style={{ color: muted, fontSize: 12, marginBottom: 10 }}>BUGÜN NASIL HİSSEDİYORSUN?</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {EMOTIONS.map(e => (
              <TouchableOpacity key={e.key} style={{ alignItems: 'center', padding: 8 }}>
                <Text style={{ fontSize: 28 }}>{e.emoji}</Text>
                <Text style={{ color: muted, fontSize: 10, marginTop: 4 }}>{e.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Quick capture */}
      <View style={{ backgroundColor: card, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: border }}>
        <Text style={{ color: muted, fontSize: 12, marginBottom: 10 }}>⚡ HIZLI NOT</Text>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
          <TextInput
            value={quickNote}
            onChangeText={setQuickNote}
            placeholder="Aklındakini yaz..."
            placeholderTextColor={muted}
            multiline
            style={{ flex: 1, color: text, fontSize: 15, minHeight: 44, lineHeight: 22 }}
            onSubmitEditing={handleQuickSave}
          />
          <TouchableOpacity onPress={handleQuickSave} disabled={!quickNote.trim()}
            style={{ backgroundColor: quickNote.trim() ? ORANGE : border, borderRadius: 12, padding: 12 }}>
            <Feather name="send" size={18} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Today's habits */}
      {activeHabits.length > 0 && (
        <View style={{ backgroundColor: card, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: border }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ color: muted, fontSize: 12 }}>BUGÜNKÜ ALIŞKANLIKLAR</Text>
            <Text style={{ color: ORANGE, fontSize: 12, fontWeight: '700' }}>{todayDone.size}/{activeHabits.length}</Text>
          </View>
          {activeHabits.map(h => {
            const done = todayDone.has(h.id)
            return (
              <TouchableOpacity key={h.id} onPress={() => handleHabitToggle(h.id)}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: border }}>
                <Text style={{ fontSize: 22, marginRight: 12 }}>{h.icon}</Text>
                <Text style={{ flex: 1, color: done ? muted : text, fontSize: 15, textDecorationLine: done ? 'line-through' : 'none' }}>{h.name}</Text>
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: done ? '#10b981' : border, alignItems: 'center', justifyContent: 'center' }}>
                  {done && <Feather name="check" size={16} color="white" />}
                </View>
              </TouchableOpacity>
            )
          })}
        </View>
      )}

      {/* Today's notes */}
      {todayNotes.length > 0 && (
        <View>
          <Text style={{ color: muted, fontSize: 12, marginBottom: 10 }}>BUGÜNÜN NOTLARI</Text>
          {todayNotes.map(n => (
            <View key={n.id} style={{ backgroundColor: card, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: border }}>
              <Text style={{ color: text, fontWeight: '600', fontSize: 14 }}>{n.title}</Text>
              {n.content !== n.title && <Text style={{ color: muted, fontSize: 13, marginTop: 4 }} numberOfLines={2}>{n.content}</Text>}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  )
}
