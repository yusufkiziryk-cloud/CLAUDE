import { View, Text, TouchableOpacity, ScrollView, useColorScheme, Alert, TextInput, Modal } from 'react-native'
import { useState } from 'react'
import { Feather } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useStore } from '../../src/store/store'

const ORANGE = '#ea580c'
const ICONS = ['💪', '📚', '🏃', '🧘', '💧', '🥗', '😴', '✍️', '🎯', '🎸', '🧠', '🌅', '🚶', '🏋️', '☕']

export default function HabitsScreen() {
  const isDark = useColorScheme() === 'dark'
  const { habits, addHabit, toggleHabitLog, isTodayDone } = useStore()
  const [modalVisible, setModalVisible] = useState(false)
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

  const handleToggle = async (habitId: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    toggleHabitLog(habitId)
  }

  const handleAdd = () => {
    if (!name.trim()) return
    addHabit({ name: name.trim(), icon, color: ORANGE, frequency: 'daily', targetDays: [0,1,2,3,4,5,6], isActive: true })
    setName(''); setIcon('💪'); setModalVisible(false)
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {/* Progress ring (simplified bar) */}
      <View style={{ backgroundColor: card, borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: border }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }}>
          <Text style={{ color: text, fontWeight: '700', fontSize: 16 }}>Bugünkü Durum</Text>
          <Text style={{ color: ORANGE, fontWeight: '800', fontSize: 18 }}>{completedCount}/{activeHabits.length}</Text>
        </View>
        <View style={{ height: 12, backgroundColor: border, borderRadius: 6, overflow: 'hidden' }}>
          <View style={{ height: 12, width: `${completionPct}%`, backgroundColor: completionPct === 100 ? '#10b981' : ORANGE, borderRadius: 6 }} />
        </View>
        {completionPct === 100 && (
          <Text style={{ color: '#10b981', marginTop: 10, fontWeight: '600' }}>🏆 Tüm alışkanlıklar tamamlandı!</Text>
        )}
      </View>

      {/* Habits list */}
      {activeHabits.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 40 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>💪</Text>
          <Text style={{ color: text, fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Henüz alışkanlık yok</Text>
          <Text style={{ color: muted, fontSize: 14, textAlign: 'center' }}>Küçük adımlar büyük değişimler yaratır</Text>
        </View>
      ) : (
        activeHabits.map(h => {
          const done = isTodayDone(h.id)
          return (
            <TouchableOpacity key={h.id} onPress={() => handleToggle(h.id)}
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: card, borderRadius: 16, padding: 16, marginBottom: 10,
                borderWidth: 2, borderColor: done ? '#10b981' : border }}>
              <Text style={{ fontSize: 28, marginRight: 14 }}>{h.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: done ? muted : text, fontSize: 16, fontWeight: '600', textDecorationLine: done ? 'line-through' : 'none' }}>{h.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <Feather name="zap" size={12} color={h.streak > 0 ? '#f97316' : muted} />
                  <Text style={{ color: h.streak > 0 ? '#f97316' : muted, fontSize: 12 }}>{h.streak} günlük seri</Text>
                </View>
              </View>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: done ? '#10b981' : border, alignItems: 'center', justifyContent: 'center' }}>
                {done && <Feather name="check" size={18} color="white" />}
              </View>
            </TouchableOpacity>
          )
        })
      )}

      {/* Add button */}
      <TouchableOpacity onPress={() => setModalVisible(true)}
        style={{ backgroundColor: ORANGE, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 8,
          shadowColor: ORANGE, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 5 } }}>
        <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>+ Yeni Alışkanlık</Text>
      </TouchableOpacity>

      {/* Add modal */}
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
                style={{ padding: 12, borderRadius: 12, backgroundColor: icon === ic ? ORANGE + '20' : card,
                  borderWidth: 2, borderColor: icon === ic ? ORANGE : border }}>
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
