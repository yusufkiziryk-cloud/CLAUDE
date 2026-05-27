import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Palette } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing, BorderRadius } from '../../constants/spacing';
import { SESSIONS_DATA } from '../../constants/zones';
import { useUserStore } from '../../stores/useUserStore';
import { useProgressStore } from '../../stores/useProgressStore';

type CategoryFilter = 'all' | 'stress' | 'sleep' | 'energy' | 'digestion' | 'pain' | 'full';

const CATEGORIES: { id: CategoryFilter; label: string; emoji: string }[] = [
  { id: 'all',       label: 'Tümü',     emoji: '🌟' },
  { id: 'stress',    label: 'Stres',    emoji: '🌊' },
  { id: 'sleep',     label: 'Uyku',     emoji: '🌙' },
  { id: 'energy',    label: 'Enerji',   emoji: '⚡' },
  { id: 'digestion', label: 'Sindirim', emoji: '🌿' },
  { id: 'full',      label: 'Tam',      emoji: '🦶' },
];

export default function SessionsScreen() {
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const profile    = useUserStore((s) => s.profile);
  const sessionLogs = useProgressStore((s) => s.sessionLogs);

  const filtered = SESSIONS_DATA.filter(
    (s) => filter === 'all' || s.category === filter
  );

  const totalMinutes = Math.round(
    sessionLogs.reduce((acc, s) => acc + s.durationSeconds / 60, 0)
  );

  return (
    <LinearGradient colors={['#0A1209', '#0F1E12', Palette.navy]} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>⏱ Refleks Seansları</Text>
        <Text style={styles.subtitle}>Rehberli refleksoloji uygulamaları</Text>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statChip}>
          <Text style={styles.statNum}>{sessionLogs.length}</Text>
          <Text style={styles.statLabel}>Tamamlanan</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={styles.statNum}>{totalMinutes}</Text>
          <Text style={styles.statLabel}>Toplam Dakika</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={styles.statNum}>{SESSIONS_DATA.length}</Text>
          <Text style={styles.statLabel}>Mevcut Seans</Text>
        </View>
      </View>

      {/* Category filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat.id}
            onPress={() => setFilter(cat.id)}
            style={[styles.filterChip, filter === cat.id && styles.filterChipActive]}
          >
            <Text style={styles.filterEmoji}>{cat.emoji}</Text>
            <Text style={[styles.filterLabel, filter === cat.id && styles.filterLabelActive]}>
              {cat.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Sessions list */}
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {filtered.map((session, index) => {
          const isLocked = session.isPremium && !profile?.isPremium;
          return (
            <Animated.View
              key={session.id}
              entering={FadeInDown.delay(index * 80).duration(400)}
            >
              <Pressable
                onPress={() => {
                  if (isLocked) {
                    router.push('/premium');
                  } else {
                    router.push(`/session/${session.id}` as any);
                  }
                }}
                style={styles.sessionCard}
              >
                <BlurView intensity={18} tint="dark" style={styles.sessionBlur}>
                  {/* Left: emoji + info */}
                  <View style={styles.sessionLeft}>
                    <View style={[styles.sessionIconBg, { opacity: isLocked ? 0.5 : 1 }]}>
                      <Text style={styles.sessionEmoji}>{session.emoji}</Text>
                    </View>
                    <View style={styles.sessionInfo}>
                      <View style={styles.sessionTitleRow}>
                        <Text style={[styles.sessionName, isLocked && styles.lockedText]}>
                          {session.title.tr}
                        </Text>
                        {session.isPremium && (
                          <View style={styles.premiumBadge}>
                            <Text style={styles.premiumText}>✦</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.sessionDesc} numberOfLines={2}>
                        {session.description.tr}
                      </Text>
                      <View style={styles.sessionMeta}>
                        <Text style={styles.metaText}>⏱ {session.durationMinutes} dk</Text>
                        <Text style={styles.metaDot}>·</Text>
                        <Text style={styles.metaText}>
                          {session.steps.length} adım
                        </Text>
                        <Text style={styles.metaDot}>·</Text>
                        <Text style={styles.metaText}>
                          {session.difficulty === 'beginner' ? '🌱 Başlangıç'
                          : session.difficulty === 'intermediate' ? '💪 Orta' : '🔥 İleri'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Right: action */}
                  <View style={styles.sessionRight}>
                    {isLocked ? (
                      <Text style={styles.lockIcon}>🔒</Text>
                    ) : (
                      <View style={styles.playBtn}>
                        <Text style={styles.playIcon}>▶</Text>
                      </View>
                    )}
                  </View>
                </BlurView>
              </Pressable>
            </Animated.View>
          );
        })}

        <View style={styles.premiumPromo}>
          <Text style={styles.promoText}>✦ Premium ile tüm seansların kilidini aç</Text>
          <Pressable onPress={() => router.push('/premium')} style={styles.promoBtn}>
            <Text style={styles.promoBtnText}>Premium'u Keşfet →</Text>
          </Pressable>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header:    { paddingHorizontal: Spacing['5'], paddingTop: 60, paddingBottom: Spacing['3'] },
  title:     { ...Typography.h2, color: Palette.cream },
  subtitle:  { ...Typography.bodySmall, color: Palette.sageLight, marginTop: 2 },

  statsRow:  { flexDirection: 'row', paddingHorizontal: Spacing['5'], gap: Spacing['3'], marginBottom: Spacing['4'] },
  statChip:  { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: BorderRadius.lg, padding: Spacing['3'], alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  statNum:   { ...Typography.h3, color: Palette.cream, fontWeight: '300' },
  statLabel: { ...Typography.caption, color: Palette.slateMid, textAlign: 'center' },

  filterRow: { paddingHorizontal: Spacing['5'], paddingBottom: Spacing['4'], gap: Spacing['2'] },
  filterChip:      { flexDirection: 'row', alignItems: 'center', gap: Spacing['1'], paddingHorizontal: Spacing['3'], paddingVertical: Spacing['2'], borderRadius: BorderRadius.full, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  filterChipActive: { backgroundColor: 'rgba(124,152,133,0.25)', borderColor: Palette.sage },
  filterEmoji: { fontSize: 14 },
  filterLabel: { ...Typography.caption, color: Palette.slateMid },
  filterLabelActive: { color: Palette.sage },

  list: { paddingHorizontal: Spacing['5'] },

  sessionCard: { marginBottom: Spacing['3'], borderRadius: BorderRadius.xl, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  sessionBlur: { flexDirection: 'row', padding: Spacing['4'], alignItems: 'center', gap: Spacing['3'] },

  sessionLeft: { flex: 1, flexDirection: 'row', gap: Spacing['3'], alignItems: 'center' },
  sessionIconBg: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  sessionEmoji:  { fontSize: 26 },

  sessionInfo:    { flex: 1 },
  sessionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing['2'] },
  sessionName:    { ...Typography.body, color: Palette.cream, fontWeight: '500', flex: 1 },
  lockedText:     { opacity: 0.5 },
  premiumBadge:   { backgroundColor: 'rgba(196,154,108,0.20)', borderRadius: BorderRadius.full, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  premiumText:    { fontSize: 10, color: '#C49A6C' },

  sessionDesc:  { ...Typography.bodySmall, color: Palette.slateMid, marginTop: 2, lineHeight: 18 },
  sessionMeta:  { flexDirection: 'row', alignItems: 'center', gap: Spacing['2'], marginTop: 4 },
  metaText:     { ...Typography.caption, color: Palette.slateLight },
  metaDot:      { ...Typography.caption, color: Palette.slateMid },

  sessionRight:  { alignItems: 'center', justifyContent: 'center' },
  lockIcon:      { fontSize: 20 },
  playBtn:       { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(124,152,133,0.25)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(124,152,133,0.40)' },
  playIcon:      { fontSize: 14, color: Palette.sage, marginLeft: 2 },

  premiumPromo:  { backgroundColor: 'rgba(196,154,108,0.08)', borderRadius: BorderRadius.xl, padding: Spacing['5'], alignItems: 'center', gap: Spacing['3'], marginTop: Spacing['4'], borderWidth: 1, borderColor: 'rgba(196,154,108,0.20)' },
  promoText:     { ...Typography.body, color: '#C49A6C', textAlign: 'center' },
  promoBtn:      { backgroundColor: 'rgba(196,154,108,0.20)', paddingHorizontal: Spacing['5'], paddingVertical: Spacing['2'], borderRadius: BorderRadius.full, borderWidth: 1, borderColor: 'rgba(196,154,108,0.40)' },
  promoBtnText:  { ...Typography.label, color: '#C49A6C' },
});
