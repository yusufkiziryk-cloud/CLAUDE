import React, { useState, useRef, useCallback } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TextInput,
  Pressable, KeyboardAvoidingView, Platform, Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Palette } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing, BorderRadius } from '../../constants/spacing';
import { ChatBubble } from '../../components/ai/ChatBubble';
import { TypingIndicator } from '../../components/ai/TypingIndicator';
import { useAIStore } from '../../stores/useAIStore';
import { useUserStore } from '../../stores/useUserStore';
import { getAIResponse } from '../../services/aiService';
import { HapticService } from '../../services/hapticService';

const QUICK_PROMPTS = [
  '😰 Stres içindeyim',
  '😴 Uyuyamıyorum',
  '🤕 Başım ağrıyor',
  '😣 Sırtım ağrıyor',
  '🤢 Midem kötü',
  '🦶 Tüm bölgeleri listele',
];

export default function AIScreen() {
  const [input,    setInput]    = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const messages  = useAIStore((s) => s.messages);
  const isTyping  = useAIStore((s) => s.isTyping);
  const addUser   = useAIStore((s) => s.addUserMessage);
  const addAI     = useAIStore((s) => s.addAssistantMessage);
  const setTyping = useAIStore((s) => s.setTyping);
  const clearChat = useAIStore((s) => s.clearChat);
  const profile   = useUserStore((s) => s.profile);

  const handleSend = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || isTyping) return;

    setInput('');
    Keyboard.dismiss();
    await HapticService.light();

    addUser(msg);
    setTyping(true);

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const response = await getAIResponse(msg, messages, profile?.apiKey);
      addAI(response.content, response.suggestedZones);
    } catch (err) {
      addAI('Üzgünüm, şu anda bir sorun oluştu. Lütfen tekrar deneyin. 🙏');
    }

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
  }, [input, messages, isTyping, profile?.apiKey]);

  return (
    <LinearGradient colors={['#0A1209', '#0F1E12', Palette.navy]} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>🤖 AI Asistan</Text>
          <Text style={styles.subtitle}>Refleks — Refleksoloji Rehberiniz</Text>
        </View>
        <Pressable onPress={clearChat} style={styles.clearBtn}>
          <Text style={styles.clearText}>🗑 Temizle</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Chat scroll */}
        <ScrollView
          ref={scrollRef}
          style={styles.chatScroll}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((msg) => (
            <ChatBubble
              key={msg.id}
              message={msg}
              onZonePress={(zoneId) => router.push(`/zone/${zoneId}` as any)}
            />
          ))}
          {isTyping && <TypingIndicator />}
        </ScrollView>

        {/* Quick prompts */}
        {messages.length <= 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickRow}
          >
            {QUICK_PROMPTS.map((p) => (
              <Pressable key={p} onPress={() => handleSend(p)} style={styles.quickChip}>
                <Text style={styles.quickChipText}>{p}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Semptomlarınızı yazın…"
            placeholderTextColor={Palette.slateMid}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={() => handleSend()}
          />
          <Pressable
            onPress={() => handleSend()}
            style={[styles.sendBtn, (!input.trim() || isTyping) && styles.sendBtnDisabled]}
            disabled={!input.trim() || isTyping}
          >
            <Text style={styles.sendIcon}>➤</Text>
          </Pressable>
        </View>

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>
          ⚠️ Destekleyici rahatlama amaçlıdır. Tıbbi tedavi yerine geçmez.
        </Text>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1 },
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing['5'], paddingTop: 60, paddingBottom: Spacing['3'] },
  title:      { ...Typography.h2, color: Palette.cream },
  subtitle:   { ...Typography.caption, color: Palette.sageLight, marginTop: 2 },
  clearBtn:   { padding: Spacing['2'] },
  clearText:  { ...Typography.caption, color: Palette.slateMid },

  chatScroll:  { flex: 1 },
  chatContent: { paddingTop: Spacing['3'], paddingBottom: Spacing['3'] },

  quickRow:   { paddingHorizontal: Spacing['4'], paddingVertical: Spacing['3'], gap: Spacing['2'] },
  quickChip:  { backgroundColor: 'rgba(124,152,133,0.15)', borderWidth: 1, borderColor: 'rgba(124,152,133,0.25)', borderRadius: BorderRadius.full, paddingHorizontal: Spacing['4'], paddingVertical: Spacing['2'] },
  quickChipText: { ...Typography.bodySmall, color: Palette.sageLight },

  inputBar:   { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: Spacing['4'], paddingVertical: Spacing['3'], gap: Spacing['3'], borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  input:      { flex: 1, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: BorderRadius.xl, paddingHorizontal: Spacing['4'], paddingVertical: Spacing['3'], color: Palette.cream, ...Typography.body, maxHeight: 100, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  sendBtn:    { width: 44, height: 44, borderRadius: 22, backgroundColor: Palette.sage, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: 'rgba(124,152,133,0.25)', opacity: 0.5 },
  sendIcon:   { fontSize: 18, color: Palette.navy, marginLeft: 2 },

  disclaimer: { ...Typography.caption, color: Palette.slateMid, textAlign: 'center', paddingHorizontal: Spacing['5'], paddingBottom: Spacing['4'], fontStyle: 'italic' },
});
