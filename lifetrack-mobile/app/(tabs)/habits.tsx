import { View, Text, TouchableOpacity, ScrollView, useColorScheme, TextInput, Modal } from 'react-native'
import { useState } from 'react'
import { Feather } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useStore } from '../../src/store/store'

const ORANGE = '#ea580c'
const ICONS = ['💪', '📚', '🏃', '🧘', '💧', '🥗', '😴', '✍️', '🎯', '🎸', '🧠', '🌅', '🚶', '🏋️', '☕', '🎨', '📖', '🧹']

function HabitHeatmap({ habitId, habitLogs }: { habitId: string; habitLogs: any[] }) {
  const isDark = useColorScheme() === 'dark'
  const weeks = 12
  const days: { date: string; done: boolean }[] = []
  for (let i = weeks * 7 - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const date = d.toISOString().slice(0, 10)
    days.push({ date, done: habitLogs.some(l => l.habitId === habitId && l.date === date && l.done) })
  }
  const border = isDark ? '#334155' : '#e2e8f0'
  return (
    <View style={{ marginTop: 12 }}>
      <View style={{ flexDirection: 'row', gap: 3 }}>
        {Array.from({ length: weeks }).map((_, wi) => (
          <View key={wi} style={{ gap: 3 }}>
            {Array.from({ length: 7 }).map((_, di) => {
              const day = days[wi * 7 + di]
              return (
                <View key={di} style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: day?.done ? ORANGE : border, opacity: day?.done ? 1 : 0.5 }} />
              )
            })}
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <Text style={{ color: isDark ? '#475569' : '#94a3b8', fontSize: 10 }}>12 hafta önce</Text>
        <Text style={{ color: isDark ? '#475569' : '#94a3b8', fontSize: 10 }}>Bugün</Text>
      </View>
    </View>
  )
}

export default function HabitsScreen() {
  const isDark = useColorScheme() === 'dark'
  const { habits, habitLogs, addHabit, toggleHabitLog, isTodayDone } = useStore()
  const [modalVisible, setModalVisible] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('💪')

  const bg = isDark ? '#0f172a' : '#f8fafc'
  const card = isDark ? '#1e293b' : '#ffffff'
  const border = isDark ? '#334155' : '#e2e8f0'
  const text = isDark ? '#f1f5f9' : '#0f172a'
  const muted = isDark ? '#94a3b8' : '#64748b'

  const activeHabits = habits.filter(h => h.isActive)
  const completedCount = activeHabits.filter(h => isTodayDone(h.id)).length
  const completionPct = activeHabits.length ? (completedCount / activeHabits.length) * 100 : 0
  const totalDone = habitLogs.filter(l => l.done).length

  const handleToggle = async (habitId: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    toggleHabitLog(habitId)
  }

  const handleAdd = () => {
    if (!name.trim()) return
    addHabit({ name: name.trim(), icon, color: ORANGE, isActive: true })
    setName(''); setIcon('💪'); setModalVisible(false)
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

      {/* Progress card */}
      <View style={{ backgroundColor: card, borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: border }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <View>
            <Text style={{ color: text, fontWeight: '700', fontSize: 17 }}>Bugünkü Durum</Text>
            <Text style={{ color: muted, fontSize: 12, marginTop: 2 }}>{totalDone} toplam tamamlama</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: ORANGE, fontWeight: '800', fontSize: 28 }}>{completedCount}/{activeHabits.length}</Text>
            <Text style={{ color: muted, fontSize: 11 }}>%{Math.round(completionPct)}</Text>
          </View>
        </View>
        <View style={{ height: 10, backgroundColor: border, borderRadius: 5, overflow: 'hidden' }}>
          <View style={{ height: 10, width: `${completionPct}%` as any, backgroundColor: completionPct === 100 ? '#10b981' : ORANGE, borderRadius: 5 }} />
        </View>
        {completionPct === 100 && <Text style={{ color: '#10b981', marginTop: 12, fontWeight: '700' }}>🏆 Hepsi tamamlandı!</Text>}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
          {[
            { label: 'En Uzun Seri', value: Math.max(0, ...habits.map(h => h.bestStreak)), icon: '🏆' },
            { label: 'Aktif Seri', value: activeHabits.filter(h => h.streak > 0).length, icon: '🔥' },
            { label: 'Toplam', value: totalDone, icon: '✅' },
          ].map(s => (
            <View key={s.label} style={{ flex: 1, backgroundColor: isDark ? '#0f172a' : '#f8fafc', borderRadius: 12, padding: 10, alignItems: 'center' }}>
              <Text style={{ fontSize: 18, marginBottom: 2 }}>{s.icon}</Text>
              <Text style={{ color: ORANGE, fontSize: 18, fontWeight: '800' }}>{s.value}</Text>
              <Text style={{ color: muted, fontSize: 10, marginTop: 1, textAlign: 'center' }}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Habits list */}
      {activeHabits.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 40 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>💪</Text>
          <Text style={{ color: text, fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Henüz alışkanlık yok</Text>
          <Text style={{ color: muted, fontSize: 14, textAlign: 'center' }}>Küçük adımlar büyük değişimler yaratır</Text>
        </View>
      ) : activeHabits.map(h => {
        const done = isTodayDone(h.id)
        const expanded = expandedId === h.id
        return (
          <View key={h.id} style={{ backgroundColor: card, borderRadius: 18, marginBottom: 10, borderWidth: 2, borderColor: done ? '#10b981' : border }}>
            <TouchableOpacity onPress={() => handleToggle(h.id)} style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
              <Text style={{ fontSize: 28, marginRight: 14 }}>{h.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: done ? muted : text, fontSize: 16, fontWeight: '600', textDecorationLine: done ? 'line-through' : 'none' }}>{h.name}</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                  <Text style={{ color: h.streak > 0 ? '#f97316' : muted, fontSize: 12 }}>⚡ {h.streak} günlük seri</Text>
                  <Text style={{ color: muted, fontSize: 12 }}>En iyi: {h.bestStreak}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <TouchableOpacity onPress={() => setExpandedId(expanded ? null : h.id)} style={{ padding: 4 }}>
                  <Feather name="activity" size={16} color={expanded ? ORANGE : muted} />
                </TouchableOpacity>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: done ? '#10b981' : border, alignItems: 'center', justifyContent: 'center' }}>
                  {done && <Feather name="check" size={18} color="white" />}
                </View>
              </View>
            </TouchableOpacity>
            {expanded && (
              <View style={{ paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: border }}>
                <Text style={{ color: muted, fontSize: 11, marginTop: 10, marginBottom: 2 }}>SON 12 HAFTA</Text>
                <HabitHeatmap habitId={h.id} habitLogs={habitLogs} />
              </View>
            )}
          </View>
        )
      })}

      <TouchableOpacity onPress={() => setModalVisible(true)}
        style={{ backgroundColor: ORANGE, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 8, flexDirection: 'row', justifyContent: 'center', gap: 8, shadowColor: ORANGE, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 5 } }}>
        <Feather name="plus" size={20} color="white" />
        <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Yeni Alışkanlık</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: bg, padding: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <Text style={{ color: text, fontSize: 20, fontWeight: '700' }}>Yeni Alışkanlık</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}><Feather name="x" size={24} color={muted} /></TouchableOpacity>
          </View>
          <TextInput value={name} onChangeText={setName} placeholder="Alışkanlık adı..." placeholderTextColor={muted}
            style={{ backgroundColor: card, borderRadius: 14, padding: 16, color: text, fontSize: 16, marginBottom: 20, borderWidth: 1, borderColor: border }} />
          <Text style={{ color: muted, fontSize: 12, marginBottom: 12 }}>İKON SEÇ</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
            {ICONS.map(ic => (
              <TouchableOpacity key={ic} onPress={() => setIcon(ic)}
                style={{ padding: 12, borderRadius: 12, backgroundColor: icon === ic ? ORANGE + '20' : card, borderWidth: 2, borderColor: icon === ic ? ORANGE : border }}>
                <Text style={{ fontSize: 24 }}>{ic}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity onPress={handleAdd} style={{ backgroundColor: ORANGE, borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}>
            <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Kaydet</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </ScrollView>
  )
}
