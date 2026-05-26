import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, useColorScheme, TextInput, Alert } from 'react-native'
import { useState, useMemo } from 'react'
import { Feather } from '@expo/vector-icons'
import { useStore } from '../../src/store/store'

const ORANGE = '#ea580c'

async function callClaude(apiKey: string, system: string, user: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-allow-browser': 'true',
    },
    body: JSON.stringify({ model: 'claude-opus-4-7', max_tokens: 700, system, messages: [{ role: 'user', content: user }] }),
  })
  if (!res.ok) throw new Error(`API hatası (${res.status})`)
  const data = await res.json() as { content: { text: string }[] }
  return data.content[0]?.text ?? ''
}

export default function InsightsScreen() {
  const isDark = useColorScheme() === 'dark'
  const { notes, dailyEntries, habits, habitLogs, claudeApiKey, setClaudeApiKey } = useStore()
  const [reflection, setReflection] = useState('')
  const [loading, setLoading] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState(claudeApiKey)
  const [showKeyInput, setShowKeyInput] = useState(false)

  const bg = isDark ? '#0f172a' : '#f8fafc'
  const card = isDark ? '#1e293b' : '#ffffff'
  const border = isDark ? '#334155' : '#e2e8f0'
  const text = isDark ? '#f1f5f9' : '#0f172a'
  const muted = isDark ? '#94a3b8' : '#64748b'

  // Stats
  const totalNotes = notes.length
  const totalJournal = dailyEntries.length
  const activeStreaks = habits.filter(h => h.streak > 0).length
  const bestStreak = habits.reduce((max, h) => Math.max(max, h.bestStreak), 0)

  // On this day
  const onThisDay = useMemo(() => {
    const today = new Date()
    return notes.filter(n => {
      const d = new Date(n.createdAt)
      return d.getMonth() === today.getMonth() && d.getDate() === today.getDate() && d.getFullYear() < today.getFullYear()
    }).slice(0, 3)
  }, [notes])

  const generateReflection = async () => {
    if (!claudeApiKey) { setShowKeyInput(true); return }
    setLoading(true)
    try {
      const recentNotes = notes.slice(0, 10).map(n => `- ${n.title}: ${n.content.slice(0, 100)}`).join('\n')
      const recentJournal = dailyEntries.slice(0, 5).map(d => `${d.date} [${d.emotion ?? '-'}]: ${d.mainNote?.slice(0, 150) ?? ''}`).join('\n')

      const text = await callClaude(claudeApiKey,
        `Sen LifeTrack mobil uygulamasının AI yardımcısısın. Kısa, sıcak, anlayışlı Türkçe yanıtlar ver. Madde listesi değil, doğal konuşma dili kullan.`,
        `Son notlarım:\n${recentNotes}\n\nGünlük kayıtlarım:\n${recentJournal}\n\nBunlara dayanarak 150-200 kelimelik kişisel bir haftalık yansıma yaz.`
      )
      setReflection(text)
    } catch (e) {
      Alert.alert('Hata', (e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

      {/* Stats grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Toplam Not', value: totalNotes, icon: '📝' },
          { label: 'Günlük Kayıt', value: totalJournal, icon: '📔' },
          { label: 'Aktif Seri', value: activeStreaks, icon: '🔥' },
          { label: 'En Uzun Seri', value: bestStreak, icon: '🏆' },
        ].map(s => (
          <View key={s.label} style={{ flex: 1, minWidth: '45%', backgroundColor: card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: border, alignItems: 'center' }}>
            <Text style={{ fontSize: 28, marginBottom: 6 }}>{s.icon}</Text>
            <Text style={{ color: ORANGE, fontSize: 24, fontWeight: '800' }}>{s.value}</Text>
            <Text style={{ color: muted, fontSize: 12, marginTop: 2, textAlign: 'center' }}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* AI Reflection */}
      <View style={{ backgroundColor: card, borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: ORANGE + '40' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Feather name="cpu" size={16} color={ORANGE} />
          <Text style={{ color: text, fontWeight: '700', fontSize: 16 }}>AI Haftalık Yansıma</Text>
        </View>

        {reflection ? (
          <Text style={{ color: text, lineHeight: 24, fontSize: 15 }}>{reflection}</Text>
        ) : (
          <>
            <Text style={{ color: muted, fontSize: 14, lineHeight: 22, marginBottom: 16 }}>
              Claude AI notlarınızı analiz ederek kişisel bir yansıma oluşturacak.
            </Text>
            <TouchableOpacity onPress={generateReflection} disabled={loading}
              style={{ backgroundColor: ORANGE, borderRadius: 14, paddingVertical: 14, alignItems: 'center',
                shadowColor: ORANGE, shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}>
              {loading
                ? <ActivityIndicator color="white" />
                : <Text style={{ color: 'white', fontWeight: '700', fontSize: 15 }}>✨ Yansıma Oluştur</Text>
              }
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* API Key */}
      {(showKeyInput || !claudeApiKey) && (
        <View style={{ backgroundColor: card, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: border }}>
          <Text style={{ color: muted, fontSize: 12, marginBottom: 10 }}>CLAUDE API ANAHTARI</Text>
          <TextInput value={apiKeyInput} onChangeText={setApiKeyInput} placeholder="sk-ant-..." placeholderTextColor={muted}
            secureTextEntry style={{ backgroundColor: isDark ? '#0f172a' : '#f8fafc', borderRadius: 10, padding: 12, color: text, fontSize: 13, fontFamily: 'monospace', marginBottom: 10, borderWidth: 1, borderColor: border }} />
          <TouchableOpacity onPress={() => { setClaudeApiKey(apiKeyInput.trim()); setShowKeyInput(false) }}
            style={{ backgroundColor: ORANGE, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}>
            <Text style={{ color: 'white', fontWeight: '700' }}>Kaydet</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* On this day */}
      {onThisDay.length > 0 && (
        <View style={{ backgroundColor: card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Feather name="calendar" size={16} color={ORANGE} />
            <Text style={{ color: text, fontWeight: '700', fontSize: 16 }}>Bugün Geçmişte</Text>
          </View>
          {onThisDay.map((n, i) => {
            const year = new Date(n.createdAt).getFullYear()
            return (
              <View key={n.id} style={{ borderLeftWidth: 2, borderLeftColor: ORANGE, paddingLeft: 12, marginBottom: i < onThisDay.length - 1 ? 14 : 0 }}>
                <Text style={{ color: muted, fontSize: 11, marginBottom: 2 }}>{year} yılından</Text>
                <Text style={{ color: text, fontWeight: '600', fontSize: 14 }}>{n.title}</Text>
              </View>
            )
          })}
        </View>
      )}
    </ScrollView>
  )
}
