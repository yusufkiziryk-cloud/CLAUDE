import React, { useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, Dimensions } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Palette } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing, BorderRadius } from '../../constants/spacing';
import { useUserStore } from '../../stores/useUserStore';
import { useProgressStore } from '../../stores/useProgressStore';
import { WellnessScoreRing } from '../../components/home/WellnessScoreRing';
import { GlassmorphicCard } from '../../components/ui/GlassmorphicCard';
import { SESSIONS_DATA } from '../../constants/zones';

const { width: W } = Dimensions.get('window');

const DAILY_TIPS = [
  { emoji: '🌅', text: 'Sabah seansını aksatma — 10 dakika yeter.' },
  { emoji: '💧', text: 'Seans öncesi bol su içmeyi unutma.' },
  { emoji: '🌿', text: 'Nefes egzersizleri refleksolojiyi güçlendirir.' },
  { emoji: '🦶', text: 'Ayaklarını ılık suyla ısıt, daha etkili olur.' },
  { emoji: '🌙', text: 'Uyku öncesi Shen Men noktasını dene.' },
];

function QuickActionCard({
  emoji, title, subtitle, onPress, color = Palette.sage,
}: {
  emoji: string; title: string; subtitle: string; onPress: () => void; color?: string;
}) {
  return (
    <Pressable onPress={onPress} style={styles.quickCard}>
      <BlurView intensity={20} tint="dark" style={styles.quickCardBlur}>
        <Text style={styles.quickEmoji}>{emoji}</Text>
        <Text style={[styles.quickTitle, { color }]}>{title}</Text>
        <Text style={styles.quickSub}>{subtitle}</Text>
      </BlurView>
    </Pressable>
  );
}

export default function HomeScreen() {
  const profile       = useUserStore((s) => s.profile);
  const todayLog      = useProgressStore((s) => s.todayLog);
  const currentStreak = useProgressStore((s) => s.currentStreak);
  const weeklyStats   = useProgressStore((s) => s.weeklyStats);
  const sessionLogs   = useProgressStore((s) => s.sessionLogs);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 6)  return 'Gece geç saatlerde';
    if (h < 12) return 'Günaydın';
    if (h < 18) return 'İyi öğleden sonralar';
    return 'İyi akşamlar';
  };

  const todayStr     = format(new Date(), 'd MMMM yyyy, EEEE', { locale: tr });
  const wellScore    = todayLog?.wellnessScore ?? weeklyStats?.avgWellnessScore ?? 65;
  const dailyTip     = DAILY_TIPS[new Date().getDay() % DAILY_TIPS.length];
  const recentSessions = sessionLogs.slice(0, 3);

  return (
    <LinearGradient colors={['#0A1209', '#0F1E12', Palette.navy]} style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting()},</Text>
            <Text style={styles.userName}>{profile?.name ?? 'Ziyaretçi'} 🌿</Text>
            <Text style={styles.date}>{todayStr}</Text>
          </View>
          <Pressable onPress={() => router.push('/settings')} style={styles.settingsBtn}>
            <Text style={{ fontSize: 24 }}>⚙️</Text>
          </Pressable>
        </Animated.View>

        {/* Wellness Score + Streak */}
        <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.scoreRow}>
          <GlassmorphicCard style={styles.scoreCard} pressable={false}>
            <WellnessScoreRing score={wellScore} size={110} label="Wellness" />
            <View style={styles.scoreInfo}>
              <Text style={styles.scoreTitle}>Günlük Wellness Skoru</Text>
              <Text style={styles.scoreSubtitle}>
                {wellScore >= 70 ? '🌟 Harika gidiyorsun!' : wellScore >= 50 ? '💪 İyi ilerleyen' : '🌱 Bugün kendine iyi bak'}
              </Text>
              <Pressable
                onPress={() => router.push('/progress')}
                style={styles.logDayBtn}
              >
                <Text style={styles.logDayText}>
                  {todayLog ? '✓ Bugün kaydedildi' : '+ Bugün nasılsın?'}
                </Text>
              </Pressable>
            </View>
          </GlassmorphicCard>

          <GlassmorphicCard style={styles.streakCard} pressable={false}>
            <Text style={styles.streakNumber}>{currentStreak}</Text>
            <Text style={styles.streakLabel}>Gün{'\n'}Serisi 🔥</Text>
          </GlassmorphicCard>
        </Animated.View>

        {/* Daily Tip */}
        <Animated.View entering={FadeInDown.delay(150).duration(500)}>
          <GlassmorphicCard style={styles.tipCard} pressable={false}>
            <Text style={styles.tipEmoji}>{dailyTip.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.tipLabel}>GÜNÜN İPUCU</Text>
              <Text style={styles.tipText}>{dailyTip.text}</Text>
            </View>
          </GlassmorphicCard>
        </Animated.View>

        {/* Quick Actions */}
        <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.section}>
          <Text style={styles.sectionTitle}>⚡ Hızlı Başla</Text>
          <View style={styles.quickGrid}>
            <QuickActionCard
              emoji="🦶"
              title="Harita"
              subtitle="Bölgeleri keşfet"
              onPress={() => router.push('/(tabs)/map')}
              color={Palette.sage}
            />
            <QuickActionCard
              emoji="🤖"
              title="AI Asistan"
              subtitle="Semptomlarını sor"
              onPress={() => router.push('/(tabs)/ai')}
              color={Palette.sky}
            />
            <QuickActionCard
              emoji="🌊"
              title="Stres Seans"
              subtitle="10 dk · Başlangıç"
              onPress={() => router.push(`/session/stress-relief`)}
              color={Palette.glowPurple}
            />
            <QuickActionCard
              emoji="🌙"
              title="Uyku Seans"
              subtitle="15 dk · Gece"
              onPress={() => router.push(`/session/sleep-preparation`)}
              color={Palette.sky}
            />
          </View>
        </Animated.View>

        {/* Recent Sessions */}
        {recentSessions.length > 0 && (
          <Animated.View entering={FadeInDown.delay(250).duration(500)} style={styles.section}>
            <Text style={styles.sectionTitle}>🕐 Son Seanslar</Text>
            {recentSessions.map((s) => (
              <GlassmorphicCard key={s.id} style={styles.recentCard} pressable={false}>
                <Text style={styles.recentTitle}>{s.sessionTitle}</Text>
                <Text style={styles.recentMeta}>
                  {Math.round(s.durationSeconds / 60)} dk · {s.completionPercent}% tamamlandı
                </Text>
                <Text style={styles.recentDate}>
                  {format(new Date(s.completedAt), 'd MMM · HH:mm', { locale: tr })}
                </Text>
              </GlassmorphicCard>
            ))}
          </Animated.View>
        )}

        {/* All Sessions */}
        <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.section}>
          <Text style={styles.sectionTitle}>🎯 Tüm Seanslar</Text>
          {SESSIONS_DATA.slice(0, 3).map((session) => (
            <Pressable
              key={session.id}
              onPress={() => {
                if (session.isPremium && !profile?.isPremium) {
                  router.push('/premium');
                } else {
                  router.push(`/session/${session.id}` as any);
                }
              }}
              style={styles.sessionCard}
            >
              <BlurView intensity={15} tint="dark" style={styles.sessionCardBlur}>
                <Text style={styles.sessionEmoji}>{session.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <View style={styles.sessionTitleRow}>
                    <Text style={styles.sessionTitle}>{session.title.tr}</Text>
                    {session.isPremium && <Text style={styles.premiumBadge}>✦ PRİM</Text>}
                  </View>
                  <Text style={styles.sessionDesc}>{session.description.tr}</Text>
                  <Text style={styles.sessionMeta}>
                    ⏱ {session.durationMinutes} dk · {
                      session.difficulty === 'beginner' ? '🌱 Başlangıç' :
                      session.difficulty === 'intermediate' ? '💪 Orta' : '🔥 İleri'
                    }
                  </Text>
                </View>
              </BlurView>
            </Pressable>
          ))}
          <Pressable onPress={() => router.push('/(tabs)/sessions')} style={styles.seeAllBtn}>
            <Text style={styles.seeAllText}>Tüm seansları gör →</Text>
          </Pressable>
        </Animated.View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1 },
  scroll:     { paddingHorizontal: Spacing['5'], paddingTop: 60 },

  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing['6'] },
  greeting:   { ...Typography.body,     color: Palette.slateLight },
  userName:   { ...Typography.h2,       color: Palette.cream,   marginVertical: 2 },
  date:       { ...Typography.bodySmall, color: Palette.slateMid },
  settingsBtn: { padding: Spacing['2'] },

  scoreRow:   { flexDirection: 'row', gap: Spacing['3'], marginBottom: Spacing['4'] },
  scoreCard:  { flex: 3, flexDirection: 'row', alignItems: 'center', gap: Spacing['4'], padding: Spacing['4'] },
  scoreInfo:  { flex: 1 },
  scoreTitle: { ...Typography.label,    color: Palette.sageLight },
  scoreSubtitle: { ...Typography.bodySmall, color: Palette.creamDark, marginVertical: Spacing['1'] },
  logDayBtn:  { backgroundColor: 'rgba(124,152,133,0.20)', borderRadius: BorderRadius.full, paddingHorizontal: Spacing['3'], paddingVertical: Spacing['1'], alignSelf: 'flex-start', marginTop: Spacing['2'] },
  logDayText: { ...Typography.caption, color: Palette.sage },

  streakCard: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing['4'] },
  streakNumber: { fontSize: 36, fontWeight: '200', color: Palette.cream, lineHeight: 40 },
  streakLabel:  { ...Typography.caption, color: Palette.sageLight, textAlign: 'center', marginTop: 2 },

  tipCard:    { flexDirection: 'row', alignItems: 'center', gap: Spacing['3'], padding: Spacing['4'], marginBottom: Spacing['5'] },
  tipEmoji:   { fontSize: 28 },
  tipLabel:   { ...Typography.overline, color: Palette.sageLight, marginBottom: 4 },
  tipText:    { ...Typography.bodySmall, color: Palette.cream },

  section:    { marginBottom: Spacing['6'] },
  sectionTitle: { ...Typography.h4, color: Palette.cream, marginBottom: Spacing['3'] },

  quickGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing['3'] },
  quickCard:  { width: (W - Spacing['5'] * 2 - Spacing['3']) / 2, borderRadius: BorderRadius.xl, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  quickCardBlur: { padding: Spacing['4'], gap: Spacing['2'] },
  quickEmoji: { fontSize: 28 },
  quickTitle: { ...Typography.h4 },
  quickSub:   { ...Typography.caption, color: Palette.slateMid },

  recentCard: { marginBottom: Spacing['3'], padding: Spacing['4'] },
  recentTitle: { ...Typography.body,     color: Palette.cream },
  recentMeta:  { ...Typography.bodySmall, color: Palette.sageLight, marginTop: 2 },
  recentDate:  { ...Typography.caption,   color: Palette.slateMid,  marginTop: 2 },

  sessionCard: { borderRadius: BorderRadius.xl, overflow: 'hidden', marginBottom: Spacing['3'], borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  sessionCardBlur: { flexDirection: 'row', padding: Spacing['4'], alignItems: 'center', gap: Spacing['3'] },
  sessionEmoji: { fontSize: 32 },
  sessionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing['2'], marginBottom: 2 },
  sessionTitle: { ...Typography.body, color: Palette.cream, fontWeight: '500', flex: 1 },
  premiumBadge: { ...Typography.caption, color: '#C49A6C', backgroundColor: 'rgba(196,154,108,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: BorderRadius.full },
  sessionDesc:  { ...Typography.bodySmall, color: Palette.slateMid, marginBottom: 4 },
  sessionMeta:  { ...Typography.caption,   color: Palette.slateLight },

  seeAllBtn:  { alignSelf: 'center', marginTop: Spacing['2'], padding: Spacing['2'] },
  seeAllText: { ...Typography.bodySmall, color: Palette.sageLight },
});
