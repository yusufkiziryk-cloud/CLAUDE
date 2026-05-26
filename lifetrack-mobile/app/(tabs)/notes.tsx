import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, Alert, useColorScheme } from 'react-native'
import { useState, useMemo } from 'react'
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

export default function NotesScreen() {
  const isDark = useColorScheme() === 'dark'
  const { notes, addNote, deleteNote } = useStore()
  const [search, setSearch] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [filterEmotion, setFilterEmotion] = useState<Emotion | ''>('')
  const [showAdd, setShowAdd] = useState(false)
  const [viewNote, setViewNote] = useState<typeof notes[0] | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [emotion, setEmotion] = useState<Emotion | undefined>()
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])

  const bg = isDark ? '#0f172a' : '#f8fafc'
  const card = isDark ? '#1e293b' : '#ffffff'
  const border = isDark ? '#334155' : '#e2e8f0'
  const text = isDark ? '#f1f5f9' : '#0f172a'
  const muted = isDark ? '#94a3b8' : '#64748b'

  const allTags = useMemo(() => {
    const set = new Set<string>()
    notes.forEach(n => n.tags.forEach(t => set.add(t)))
    return Array.from(set)
  }, [notes])

  const filtered = useMemo(() => notes.filter(n => {
    if (search && !n.title.toLowerCase().includes(search.toLowerCase()) && !n.content.toLowerCase().includes(search.toLowerCase())) return false
    if (filterTag && !n.tags.includes(filterTag)) return false
    if (filterEmotion && n.emotion !== filterEmotion) return false
    return true
  }), [notes, search, filterTag, filterEmotion])

  const handleSave = async () => {
    if (!content.trim() && !title.trim()) { Alert.alert('Boş not', 'Bir şeyler yaz.'); return }
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    addNote({ title: title.trim() || content.slice(0, 60), content: content.trim() || title, emotion, tags })
    setTitle(''); setContent(''); setEmotion(undefined); setTags([]); setTagInput(''); setShowAdd(false)
  }

  const handleDelete = (id: string) => {
    Alert.alert('Notu Sil', 'Bu not kalıcı olarak silinecek.', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: () => { deleteNote(id); setViewNote(null) } },
    ])
  }

  const addTag = () => {
    const t = tagInput.trim().toLowerCase()
    if (t && !tags.includes(t)) { setTags(p => [...p, t]); setTagInput('') }
  }

  const emotionColor: Record<Emotion, string> = {
    great: '#10b981', good: '#3b82f6', neutral: '#94a3b8', bad: '#f59e0b', terrible: '#ef4444',
  }

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {/* Search */}
      <View style={{ padding: 16, paddingBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: card, borderRadius: 14, paddingHorizontal: 14, borderWidth: 1, borderColor: border, marginBottom: 10 }}>
          <Feather name="search" size={16} color={muted} style={{ marginRight: 8 }} />
          <TextInput value={search} onChangeText={setSearch} placeholder="Notlarda ara..." placeholderTextColor={muted}
            style={{ flex: 1, color: text, fontSize: 15, paddingVertical: 12 }} />
          {search ? <TouchableOpacity onPress={() => setSearch('')}><Feather name="x" size={16} color={muted} /></TouchableOpacity> : null}
        </View>

        {/* Emotion filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {EMOTIONS.map(e => (
              <TouchableOpacity key={e.key} onPress={() => setFilterEmotion(filterEmotion === e.key ? '' : e.key)}
                style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: filterEmotion === e.key ? ORANGE + '30' : card, borderWidth: 1, borderColor: filterEmotion === e.key ? ORANGE : border }}>
                <Text style={{ fontSize: 13, color: filterEmotion === e.key ? ORANGE : muted }}>{e.emoji} {e.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Tag filter */}
        {allTags.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {allTags.map(t => (
                <TouchableOpacity key={t} onPress={() => setFilterTag(filterTag === t ? '' : t)}
                  style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: filterTag === t ? ORANGE + '20' : card, borderWidth: 1, borderColor: filterTag === t ? ORANGE : border }}>
                  <Text style={{ fontSize: 12, color: filterTag === t ? ORANGE : muted }}>#{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}
      </View>

      {/* Notes list */}
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 100 }}>
        {filtered.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 60 }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>📝</Text>
            <Text style={{ color: text, fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Henüz not yok</Text>
            <Text style={{ color: muted, fontSize: 14 }}>Sağ alttaki + butona bas</Text>
          </View>
        ) : filtered.map(n => (
          <TouchableOpacity key={n.id} onPress={() => setViewNote(n)}
            style={{ backgroundColor: card, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: border, borderLeftWidth: 4, borderLeftColor: n.emotion ? emotionColor[n.emotion] : ORANGE }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <Text style={{ color: text, fontWeight: '700', fontSize: 15, flex: 1, marginRight: 8 }} numberOfLines={1}>{n.title}</Text>
              {n.emotion && <Text style={{ fontSize: 16 }}>{EMOTIONS.find(e => e.key === n.emotion)?.emoji}</Text>}
            </View>
            {n.content !== n.title && (
              <Text style={{ color: muted, fontSize: 13, lineHeight: 20, marginBottom: 8 }} numberOfLines={2}>{n.content}</Text>
            )}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {n.tags.slice(0, 3).map(t => (
                  <View key={t} style={{ backgroundColor: ORANGE + '15', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                    <Text style={{ color: ORANGE, fontSize: 11 }}>#{t}</Text>
                  </View>
                ))}
              </View>
              <Text style={{ color: muted, fontSize: 11 }}>
                {new Date(n.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity onPress={() => setShowAdd(true)}
        style={{ position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', shadowColor: ORANGE, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}>
        <Feather name="plus" size={28} color="white" />
      </TouchableOpacity>

      {/* Add Modal */}
      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: bg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 12 }}>
            <Text style={{ color: text, fontSize: 20, fontWeight: '700' }}>Yeni Not</Text>
            <TouchableOpacity onPress={() => setShowAdd(false)}><Feather name="x" size={24} color={muted} /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <TextInput value={title} onChangeText={setTitle} placeholder="Başlık (isteğe bağlı)" placeholderTextColor={muted}
              style={{ fontSize: 20, fontWeight: '700', color: text, marginBottom: 12 }} />
            <View style={{ backgroundColor: card, borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: border, minHeight: 160 }}>
              <TextInput value={content} onChangeText={setContent} placeholder="Ne düşünüyorsun? Bir fikir, gözlem, his..." placeholderTextColor={muted}
                multiline autoFocus style={{ color: text, fontSize: 15, lineHeight: 24, textAlignVertical: 'top' }} />
            </View>

            <Text style={{ color: muted, fontSize: 12, marginBottom: 10 }}>DUYGU DURUMU</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
              {EMOTIONS.map(e => (
                <TouchableOpacity key={e.key} onPress={() => setEmotion(emotion === e.key ? undefined : e.key)}
                  style={{ alignItems: 'center', padding: 10, borderRadius: 14, backgroundColor: emotion === e.key ? emotionColor[e.key] + '25' : 'transparent', borderWidth: 2, borderColor: emotion === e.key ? emotionColor[e.key] : 'transparent' }}>
                  <Text style={{ fontSize: 26 }}>{e.emoji}</Text>
                  <Text style={{ color: emotion === e.key ? emotionColor[e.key] : muted, fontSize: 10, marginTop: 4 }}>{e.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={{ color: muted, fontSize: 12, marginBottom: 8 }}>ETİKETLER</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              {tags.map(t => (
                <TouchableOpacity key={t} onPress={() => setTags(p => p.filter(x => x !== t))}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: ORANGE + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
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

            <TouchableOpacity onPress={handleSave}
              style={{ backgroundColor: ORANGE, borderRadius: 16, paddingVertical: 16, alignItems: 'center', shadowColor: ORANGE, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}>
              <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Hafızaya Kaydet ✓</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* View Note Modal */}
      {viewNote && (
        <Modal visible={!!viewNote} animationType="slide" presentationStyle="pageSheet">
          <View style={{ flex: 1, backgroundColor: bg }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 }}>
              <TouchableOpacity onPress={() => setViewNote(null)}><Feather name="arrow-left" size={24} color={muted} /></TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(viewNote.id)}><Feather name="trash-2" size={20} color="#ef4444" /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0 }}>
              <Text style={{ color: muted, fontSize: 12, marginBottom: 8 }}>
                {new Date(viewNote.createdAt).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </Text>
              <Text style={{ color: text, fontSize: 24, fontWeight: '800', marginBottom: 16 }}>{viewNote.title}</Text>
              {viewNote.emotion && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, backgroundColor: card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: border }}>
                  <Text style={{ fontSize: 24 }}>{EMOTIONS.find(e => e.key === viewNote.emotion)?.emoji}</Text>
                  <Text style={{ color: text, fontSize: 15 }}>{EMOTIONS.find(e => e.key === viewNote.emotion)?.label}</Text>
                </View>
              )}
              <Text style={{ color: text, fontSize: 16, lineHeight: 28 }}>{viewNote.content}</Text>
              {viewNote.tags.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 24 }}>
                  {viewNote.tags.map(t => (
                    <View key={t} style={{ backgroundColor: ORANGE + '20', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 }}>
                      <Text style={{ color: ORANGE, fontSize: 13 }}>#{t}</Text>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        </Modal>
      )}
    </View>
  )
}
