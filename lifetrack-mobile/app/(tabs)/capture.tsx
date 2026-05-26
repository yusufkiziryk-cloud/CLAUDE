import { View, Text, TextInput, TouchableOpacity, ScrollView, useColorScheme, Alert } from 'react-native'
import { useState } from 'react'
import { Feather } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useStore, Emotion } from '../../src/store/store'
import { useRouter } from 'expo-router'

const ORANGE = '#ea580c'
const EMOTIONS: { key: Emotion; emoji: string; label: string; color: string }[] = [
  { key: 'great', emoji: '😄', label: 'Harika', color: '#10b981' },
  { key: 'good', emoji: '🙂', label: 'İyi', color: '#3b82f6' },
  { key: 'neutral', emoji: '😐', label: 'Normal', color: '#94a3b8' },
  { key: 'bad', emoji: '😔', label: 'Kötü', color: '#f59e0b' },
  { key: 'terrible', emoji: '😢', label: 'Berbat', color: '#ef4444' },
]

export default function CaptureScreen() {
  const isDark = useColorScheme() === 'dark'
  const { addNote } = useStore()
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [emotion, setEmotion] = useState<Emotion | undefined>()
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')

  const bg = isDark ? '#0f172a' : '#f8fafc'
  const card = isDark ? '#1e293b' : '#ffffff'
  const border = isDark ? '#334155' : '#e2e8f0'
  const text = isDark ? '#f1f5f9' : '#0f172a'
  const muted = isDark ? '#94a3b8' : '#64748b'
  const input = isDark ? '#0f172a' : '#f8fafc'

  const addTag = () => {
    const t = tagInput.trim().toLowerCase()
    if (t && !tags.includes(t)) { setTags(prev => [...prev, t]); setTagInput('') }
  }

  const handleSave = async () => {
    if (!content.trim() && !title.trim()) { Alert.alert('Boş not', 'Lütfen bir şeyler yaz.'); return }
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    addNote({
      title: title.trim() || content.slice(0, 60),
      content: content.trim() || title,
      emotion,
      tags,
    })
    setTitle(''); setContent(''); setEmotion(undefined); setTags([])
    router.push('/')
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled">

      {/* Title */}
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Başlık (isteğe bağlı)"
        placeholderTextColor={muted}
        style={{ fontSize: 22, fontWeight: '700', color: text, marginBottom: 12, padding: 0 }}
      />

      {/* Content */}
      <View style={{ backgroundColor: card, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: border, minHeight: 180 }}>
        <TextInput
          value={content}
          onChangeText={setContent}
          placeholder="Ne düşünüyorsun? Bir fikir, gözlem, his..."
          placeholderTextColor={muted}
          multiline
          autoFocus
          style={{ color: text, fontSize: 16, lineHeight: 26, flex: 1, textAlignVertical: 'top' }}
        />
      </View>

      {/* Emotion */}
      <Text style={{ color: muted, fontSize: 12, marginBottom: 10 }}>DUYGU DURUMU</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
        {EMOTIONS.map(e => (
          <TouchableOpacity key={e.key} onPress={() => setEmotion(emotion === e.key ? undefined : e.key)}
            style={{ alignItems: 'center', padding: 10, borderRadius: 14, backgroundColor: emotion === e.key ? e.color + '25' : 'transparent',
              borderWidth: 2, borderColor: emotion === e.key ? e.color : 'transparent' }}>
            <Text style={{ fontSize: 26 }}>{e.emoji}</Text>
            <Text style={{ color: emotion === e.key ? e.color : muted, fontSize: 10, marginTop: 4 }}>{e.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tags */}
      <Text style={{ color: muted, fontSize: 12, marginBottom: 10 }}>ETİKETLER</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        {tags.map(t => (
          <TouchableOpacity key={t} onPress={() => setTags(prev => prev.filter(x => x !== t))}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: ORANGE + '20', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 }}>
            <Text style={{ color: ORANGE, fontSize: 13 }}>#{t}</Text>
            <Feather name="x" size={12} color={ORANGE} />
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24 }}>
        <TextInput value={tagInput} onChangeText={setTagInput} onSubmitEditing={addTag} placeholder="etiket ekle..." placeholderTextColor={muted}
          style={{ flex: 1, backgroundColor: card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: text, borderWidth: 1, borderColor: border }} />
        <TouchableOpacity onPress={addTag} style={{ backgroundColor: border, borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center' }}>
          <Feather name="plus" size={18} color={muted} />
        </TouchableOpacity>
      </View>

      {/* Save */}
      <TouchableOpacity onPress={handleSave}
        style={{ backgroundColor: ORANGE, borderRadius: 16, paddingVertical: 16, alignItems: 'center', shadowColor: ORANGE, shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } }}>
        <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Hafızaya Kaydet ✓</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}
