import { View, Text, TextInput, TouchableOpacity, ScrollView, useColorScheme } from 'react-native'
import { useState, useEffect } from 'react'
import { Feather } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useStore, Emotion } from '../../src/store/store'

const ORANGE = '#ea580c'
const EMOTIONS: { key: Emotion; emoji: string; label: string }[] = [
  { key: 'great', emoji: '😄', label: 'Harika' },
  { key: 'good', emoji: '🙂', label: 'İyi' },
  { key: 'neutral', emoji: '😐', label: 'Normal' },
  { key: 'bad', emoji: '😔', label: 'Kötü' },
  { key: 'terrible', emoji: '😢', label: 'Berbat' },
]

export default function JournalScreen() {
  const isDark = useColorScheme() === 'dark'
  const { saveDailyEntry, getDailyEntry } = useStore()

  const today = new Date().toISOString().slice(0, 10)
  const existing = getDailyEntry(today)

  const [title, setTitle] = useState(existing?.title ?? '')
  const [mainNote, setMainNote] = useState(existing?.mainNote ?? '')
  const [emotion, setEmotion] = useState<Emotion | undefined>(existing?.emotion)
  const [energy, setEnergy] = useState(existing?.energy ?? 3)
  const [saved, setSaved] = useState(false)

  const bg = isDark ? '#0f172a' : '#f8fafc'
  const card = isDark ? '#1e293b' : '#ffffff'
  const border = isDark ? '#334155' : '#e2e8f0'
  const text = isDark ? '#f1f5f9' : '#0f172a'
  const muted = isDark ? '#94a3b8' : '#64748b'

  const handleSave = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    saveDailyEntry({ date: today, title: title || 'Günlük', mainNote, emotion, energy, tags: [] })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const prompts = [
    'Bugün seni en çok ne etkiledi?',
    'Bugün ne için şükrediyorsun?',
    'Bugün ne öğrendin?',
    'Yarın için en önemli şey ne?',
  ]

  return (
    <ScrollView style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled">

      {/* Date header */}
      <Text style={{ color: muted, fontSize: 13, marginBottom: 4 }}>
        {new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </Text>

      {/* Title */}
      <TextInput value={title} onChangeText={setTitle} placeholder="Bugünün başlığı..." placeholderTextColor={muted}
        style={{ fontSize: 22, fontWeight: '700', color: text, marginBottom: 16, padding: 0 }} />

      {/* Emotion */}
      <View style={{ backgroundColor: card, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: border }}>
        <Text style={{ color: muted, fontSize: 12, marginBottom: 12 }}>DUYGU DURUMU</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {EMOTIONS.map(e => (
            <TouchableOpacity key={e.key} onPress={() => setEmotion(emotion === e.key ? undefined : e.key)}
              style={{ alignItems: 'center', padding: 8, borderRadius: 12,
                backgroundColor: emotion === e.key ? ORANGE + '20' : 'transparent',
                transform: [{ scale: emotion === e.key ? 1.1 : 1 }] }}>
              <Text style={{ fontSize: 26 }}>{e.emoji}</Text>
              <Text style={{ color: emotion === e.key ? ORANGE : muted, fontSize: 10, marginTop: 4 }}>{e.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Energy */}
      <View style={{ backgroundColor: card, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: border }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={{ color: muted, fontSize: 12 }}>ENERJİ SEVİYESİ</Text>
          <Text style={{ color: ORANGE, fontSize: 12, fontWeight: '700' }}>{energy}/5</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[1, 2, 3, 4, 5].map(n => (
            <TouchableOpacity key={n} onPress={() => setEnergy(n)} style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: n <= energy ? ORANGE : border }} />
          ))}
        </View>
      </View>

      {/* Main note */}
      <View style={{ backgroundColor: card, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: border, minHeight: 220 }}>
        <Text style={{ color: muted, fontSize: 12, marginBottom: 10 }}>📝 GÜNLÜK NOT</Text>
        <TextInput value={mainNote} onChangeText={setMainNote} multiline placeholder="Bugün ne oldu? Düşüncelerini, hislerini, gözlemlerini yaz..."
          placeholderTextColor={muted} style={{ color: text, fontSize: 15, lineHeight: 24, textAlignVertical: 'top', flex: 1 }} />
      </View>

      {/* Writing prompts */}
      <Text style={{ color: muted, fontSize: 12, marginBottom: 10 }}>💡 YAZMANA YARDIMCI OLACAK SORULAR</Text>
      {prompts.map((p, i) => (
        <TouchableOpacity key={i} onPress={() => setMainNote(prev => prev ? prev + '\n\n' + p + '\n' : p + '\n')}
          style={{ backgroundColor: card, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: border, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Feather name="corner-down-right" size={14} color={muted} />
          <Text style={{ color: muted, flex: 1, fontSize: 14 }}>{p}</Text>
        </TouchableOpacity>
      ))}

      {/* Save */}
      <TouchableOpacity onPress={handleSave} style={{
        backgroundColor: saved ? '#10b981' : ORANGE, borderRadius: 16, paddingVertical: 16,
        alignItems: 'center', marginTop: 8,
        shadowColor: saved ? '#10b981' : ORANGE, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }
      }}>
        <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>
          {saved ? '✓ Kaydedildi' : 'Günlüğü Kaydet'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  )
}
