import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Palette } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing, BorderRadius } from '../../constants/spacing';
import { GlassmorphicCard } from '../../components/ui/GlassmorphicCard';
import { WellnessScoreRing } from '../../components/home/WellnessScoreRing';
import { MoodPicker } from '../../components/progress/MoodPicker';
import { Button } from '../../components/ui/Button';
import { useProgressStore } from '../../stores/useProgressStore';
import { HapticService } from '../../services/hapticService';

export default function ProgressScreen() {
  const [mood,  setMood]  = useState<number | null>(null);
  const [stress, setStress] = useState<number | null>(null);
  const [sleep,  setSleep]  = useState<number | null>(null);
  const [saved,  setSaved]  = useState(false);

  const { addDailyLog, todayLog, dailyLogs, sessionLogs, weeklyStats, computeWellnessScore } = useProgressStore();

  const previewScore = mood && stress && sleep
    ? computeWellnessScore({ moodLevel: mood as any, stressLevel: stress as any, sleepQuality: sleep as any })
    : null;

  const handleSave = async () => {
    if (!mood || !stress || !sleep) {
      Alert.alert('Eksik bilgi', 'Lütfen tüm alanları doldurun.');
      return;
    }
    await HapticService.success();
    addDailyLog({
      date:         format(new Date(), 'yyyy-MM-dd'),
      moodLevel:    mood    as 1 | 2 | 3 | 4 | 5,
      stressLevel:  stress  as 1 | 2 | 3 | 4 | 5,
      sleepQuality: sleep   as 1 | 2 | 3 | 4 | 5,
      painAreas:    [],
    });
    setSaved(true);
    setMood(null); setStress(null); setSleep(null);
    setTimeout(() => setSaved(false), 3000);
  };

  // Last 7 days wellness trend
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = format(d, 'yyyy-MM-dd');
    const log     = dailyLogs.find((l) => l.date === dateStr);
    return { date: dateStr, label: format(d, 'EEEEE', { locale: tr }), score: log?.wellnessScore ?? null };
  });

  const maxBarScore = 100;

  return (
    <LinearGradient colors={['#0A1209', '#0F1E12', Palette.navy]} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>📊 İlerleme Takibi</Text>
          <Text style={styles.subtitle}>{format(new Date(), 'd MMMM yyyy', { locale: tr })}</Text>
        </View>

        {/* Weekly score ring + streak */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.overviewRow}>
          <GlassmorphicCard style={styles.scoreCard} pressable={false}>
            <WellnessScoreRing
              score={weeklyStats?.avgWellnessScore ?? todayLog?.wellnessScore ?? 65}
              size={110}
              label="Haftalık Ort."
            />
          </GlassmorphicCard>
          <View style={styles.statsCol}>
            <GlassmorphicCard style={styles.miniCard} pressable={false}>
              <Text style={styles.miniNum}>{weeklyStats?.streakDays ?? 0}</Text>
              <Text style={styles.miniLabel}>🔥 Gün Serisi</Text>
            </GlassmorphicCard>
            <GlassmorphicCard style={styles.miniCard} pressable={false}>
              <Text style={styles.miniNum}>{weeklyStats?.totalSessions ?? 0}</Text>
              <Text style={styles.miniLabel}>⏱ Bu Hafta</Text>
            </GlassmorphicCard>
            <GlassmorphicCard style={styles.miniCard} pressable={false}>
              <Text style={styles.miniNum}>{weeklyStats?.totalMinutes ?? 0}</Text>
              <Text style={styles.miniLabel}>🕐 Toplam dk</Text>
            </GlassmorphicCard>
          </View>
        </Animated.View>

        {/* 7-day bar chart */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <GlassmorphicCard style={styles.chartCard} pressable={false} padding={Spacing['4']}>
            <Text style={styles.chartTitle}>Son 7 Gün Wellness</Text>
            <View style={styles.bars}>
              {last7.map((day) => (
                <View key={day.date} style={styles.barCol}>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: `${day.score !== null ? (day.score / maxBarScore) * 100 : 0}%`,
                          backgroundColor: day.score
                            ? (day.score >= 70 ? Palette.sage : day.score >= 50 ? '#C4A840' : '#C44040')
                            : 'rgba(255,255,255,0.08)',
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.barLabel}>{day.label}</Text>
                  <Text style={styles.barScore}>{day.score ?? '–'}</Text>
                </View>
              ))}
            </View>
          </GlassmorphicCard>
        </Animated.View>

        {/* Today's log form */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <GlassmorphicCard style={styles.logCard} pressable={false} padding={Spacing['5']}>
            <Text style={styles.logTitle}>
              {todayLog ? '✓ Bugün Kaydedildi' : '📝 Bugünkü Durumun'}
            </Text>

            {todayLog && !saved ? (
              <View style={styles.todayLogDisplay}>
                <LogRow emoji="😊" label="Ruh Hali" value={todayLog.moodLevel} total={5} color={Palette.sage} />
                <LogRow emoji="⚡" label="Stres" value={6 - todayLog.stressLevel} total={5} color="#C4A840" />
                <LogRow emoji="🌙" label="Uyku" value={todayLog.sleepQuality} total={5} color={Palette.sky} />
                <Text style={styles.wellnessScoreText}>
                  Wellness Skoru: <Text style={styles.wellnessScoreNum}>{todayLog.wellnessScore}</Text>
                </Text>
              </View>
            ) : (
              <>
                {saved && (
                  <View style={styles.savedBanner}>
                    <Text style={styles.savedText}>✓ Bugünkü durum kaydedildi!</Text>
                  </View>
                )}
                <MoodPicker
                  moodLevel={mood}
                  stressLevel={stress}
                  sleepQuality={sleep}
                  onMoodChange={setMood}
                  onStressChange={setStress}
                  onSleepChange={setSleep}
                />

                {previewScore !== null && (
                  <View style={styles.previewScore}>
                    <Text style={styles.previewText}>
                      Tahmini Wellness Skoru: <Text style={[styles.previewNum, { color: previewScore >= 70 ? Palette.sage : previewScore >= 50 ? '#C4A840' : '#C44040' }]}>{previewScore}</Text>
                    </Text>
                  </View>
                )}

                <Button
                  label={saved ? '✓ Kaydedildi' : 'Bugünü Kaydet'}
                  onPress={handleSave}
                  fullWidth
                  style={{ marginTop: Spacing['4'] }}
                  disabled={!mood || !stress || !sleep}
                />
              </>
            )}
          </GlassmorphicCard>
        </Animated.View>

        {/* Weekly summary */}
        {weeklyStats && (
          <Animated.View entering={FadeInDown.delay(300).duration(400)}>
            <GlassmorphicCard style={styles.weekCard} pressable={false} padding={Spacing['5']}>
              <Text style={styles.logTitle}>📈 Haftalık Özet</Text>
              <View style={styles.weekGrid}>
                <WeekStat label="Ort. Ruh Hali" value={`${weeklyStats.avgMoodLevel}/5`} emoji="😊" />
                <WeekStat label="Ort. Stres" value={`${weeklyStats.avgStressLevel}/5`} emoji="⚡" />
                <WeekStat label="Ort. Uyku" value={`${weeklyStats.avgSleepQuality}/5`} emoji="🌙" />
                <WeekStat label="Wellness" value={`${weeklyStats.avgWellnessScore}`} emoji="🌟" />
              </View>
            </GlassmorphicCard>
          </Animated.View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </LinearGradient>
  );
}

function LogRow({ emoji, label, value, total, color }: { emoji: string; label: string; value: number; total: number; color: string }) {
  return (
    <View style={styles.logRow}>
      <Text style={styles.logRowEmoji}>{emoji}</Text>
      <Text style={styles.logRowLabel}>{label}</Text>
      <View style={styles.logRowBar}>
        <View style={[styles.logRowFill, { width: `${(value / total) * 100}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.logRowVal, { color }]}>{value}/{total}</Text>
    </View>
  );
}

function WeekStat({ label, value, emoji }: { label: string; value: string; emoji: string }) {
  return (
    <View style={styles.weekStat}>
      <Text style={styles.weekStatEmoji}>{emoji}</Text>
      <Text style={styles.weekStatVal}>{value}</Text>
      <Text style={styles.weekStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll:    { paddingHorizontal: Spacing['5'], paddingTop: 60 },

  header:   { marginBottom: Spacing['5'] },
  title:    { ...Typography.h2, color: Palette.cream },
  subtitle: { ...Typography.bodySmall, color: Palette.sageLight, marginTop: 2 },

  overviewRow: { flexDirection: 'row', gap: Spacing['3'], marginBottom: Spacing['4'] },
  scoreCard:   { padding: Spacing['4'], alignItems: 'center', justifyContent: 'center', flex: 1 },
  statsCol:    { flex: 1, gap: Spacing['2'] },
  miniCard:    { flex: 1, padding: Spacing['3'], alignItems: 'center', justifyContent: 'center' },
  miniNum:     { ...Typography.h3, color: Palette.cream, fontWeight: '300' },
  miniLabel:   { ...Typography.caption, color: Palette.slateMid, textAlign: 'center' },

  chartCard:  { marginBottom: Spacing['4'] },
  chartTitle: { ...Typography.label, color: Palette.sageLight, marginBottom: Spacing['3'] },
  bars:       { flexDirection: 'row', gap: Spacing['2'], height: 100, alignItems: 'flex-end' },
  barCol:     { flex: 1, alignItems: 'center', gap: 4 },
  barTrack:   { flex: 1, width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end' },
  barFill:    { width: '100%', borderRadius: 4, minHeight: 4 },
  barLabel:   { ...Typography.caption, color: Palette.slateMid },
  barScore:   { ...Typography.caption, color: Palette.slateLight, fontSize: 10 },

  logCard:    { marginBottom: Spacing['4'] },
  logTitle:   { ...Typography.h4, color: Palette.cream, marginBottom: Spacing['4'] },
  todayLogDisplay: { gap: Spacing['3'] },
  logRow:     { flexDirection: 'row', alignItems: 'center', gap: Spacing['2'] },
  logRowEmoji: { width: 20, textAlign: 'center' },
  logRowLabel: { ...Typography.bodySmall, color: Palette.slateMid, width: 70 },
  logRowBar:  { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' },
  logRowFill: { height: '100%', borderRadius: 3 },
  logRowVal:  { ...Typography.caption, width: 30, textAlign: 'right' },
  wellnessScoreText: { ...Typography.body, color: Palette.slateMid, marginTop: Spacing['3'], textAlign: 'center' },
  wellnessScoreNum:  { fontWeight: '700', color: Palette.sage },

  savedBanner: { backgroundColor: 'rgba(82,199,122,0.12)', borderRadius: BorderRadius.lg, padding: Spacing['3'], marginBottom: Spacing['4'], borderWidth: 1, borderColor: 'rgba(82,199,122,0.25)' },
  savedText:   { ...Typography.body, color: '#52C77A', textAlign: 'center' },

  previewScore: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: BorderRadius.lg, padding: Spacing['3'], marginTop: Spacing['3'], alignItems: 'center' },
  previewText:  { ...Typography.bodySmall, color: Palette.slateMid },
  previewNum:   { fontWeight: '700', fontSize: 18 },

  weekCard: { marginBottom: Spacing['4'] },
  weekGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing['3'] },
  weekStat: { width: '47%', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: BorderRadius.lg, padding: Spacing['3'], alignItems: 'center', gap: Spacing['1'] },
  weekStatEmoji: { fontSize: 22 },
  weekStatVal:   { ...Typography.h4, color: Palette.cream, fontWeight: '300' },
  weekStatLabel: { ...Typography.caption, color: Palette.slateMid, textAlign: 'center' },
});
