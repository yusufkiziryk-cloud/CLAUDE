import { View, Text, TextInput, TouchableOpacity, ScrollView, useColorScheme, Alert } from 'react-native'
import { useState } from 'react'
import { Feather } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import * as DocumentPicker from 'expo-document-picker'
import { useStore, Emotion, NoteAttachment } from '../../src/store/store'

const ORANGE = '#ea580c'
const EMOTIONS: { key: Emotion; emoji: string; label: string }[] = [
  { key: 'great', emoji: '😄', label: 'Harika' },
  { key: 'good', emoji: '🙂', label: 'İyi' },
  { key: 'neutral', emoji: '😐', label: 'Normal' },
  { key: 'bad', emoji: '😔', label: 'Kötü' },
  { key: 'terrible', emoji: '😢', label: 'Berbat' },
]

const uid = () => Math.random().toString(36).slice(2, 11)

function fmtSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1048576).toFixed(1) + ' MB'
}

function fileIcon(type: string) {
  if (type.startsWith('image/')) return '🖼️'
  if (type === 'application/pdf') return '📄'
  if (type.includes('word') || type.includes('document')) return '📝'
  if (type.includes('sheet') || type.includes('excel')) return '📊'
  return '📎'
}

export default function JournalScreen() {
  const isDark = useColorScheme() === 'dark'
  const { saveDailyEntry, getDailyEntry } = useStore()

  const today = new Date().toISOString().slice(0, 10)
  const existing = getDailyEntry(today)

  const [title, setTitle] = useState(existing?.title ?? '')
  const [mainNote, setMainNote] = useState(existing?.mainNote ?? '')
  const [emotion, setEmotion] = useState<Emotion | undefined>(existing?.emotion)
  const [energy, setEnergy] = useState(existing?.energy ?? 3)
  const [attachments, setAttachments] = useState<NoteAttachment[]>(existing?.attachments ?? [])
  const [saved, setSaved] = useState(false)

  const bg = isDark ? '#0f172a' : '#f8fafc'
  const card = isDark ? '#1e293b' : '#ffffff'
  const border = isDark ? '#334155' : '#e2e8f0'
  const text = isDark ? '#f1f5f9' : '#0f172a'
  const muted = isDark ? '#94a3b8' : '#64748b'

  const pickDocuments = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true })
      if (!result.canceled) {
        const newAttachments: NoteAttachment[] = result.assets.map(asset => ({
          id: uid(),
          name: asset.name,
          uri: asset.uri,
          type: asset.mimeType ?? 'application/octet-stream',
          size: asset.size ?? 0,
        }))
        setAttachments(prev => [...prev, ...newAttachments])
      }
    } catch {
      Alert.alert('Hata', 'Dosya seçilirken bir sorun oluştu.')
    }
  }

  const removeAttachment = (id: string) => setAttachments(prev => prev.filter(a => a.id !== id))

  const handleSave = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    saveDailyEntry({ date: today, title: title || 'Günlük', mainNote, emotion, energy, tags: [], attachments })
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

      {/* Attachments */}
      <View style={{ backgroundColor: card, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: border }}>
        <Text style={{ color: muted, fontSize: 12, marginBottom: 12 }}>📎 EKLER</Text>
        {attachments.length > 0 && (
          <View style={{ marginBottom: 10, gap: 8 }}>
            {attachments.map(a => (
              <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: bg, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: border, gap: 10 }}>
                <Text style={{ fontSize: 18 }}>{fileIcon(a.type)}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: text, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>{a.name}</Text>
                  <Text style={{ color: muted, fontSize: 11 }}>{fmtSize(a.size)}</Text>
                </View>
                <TouchableOpacity onPress={() => removeAttachment(a.id)}>
                  <Feather name="x" size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
        <TouchableOpacity onPress={pickDocuments}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 12, borderWidth: 2, borderColor: border, borderStyle: 'dashed' }}>
          <Feather name="paperclip" size={16} color={muted} />
          <Text style={{ color: muted, fontSize: 14 }}>Dosya Ekle</Text>
        </TouchableOpacity>
      </View>

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
