import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeIn, FadeOut, SlideInDown } from 'react-native-reanimated';
import { Palette } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing, BorderRadius } from '../../constants/spacing';
import { TimerRing } from '../../components/session/TimerRing';
import { BreathingOrb } from '../../components/ui/BreathingOrb';
import { Button } from '../../components/ui/Button';
import { SESSIONS_DATA, ALL_ZONES } from '../../constants/zones';
import { useProgressStore } from '../../stores/useProgressStore';
import { HapticService } from '../../services/hapticService';

export default function SessionScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const session = SESSIONS_DATA.find((s) => s.id === sessionId);

  const [started,      setStarted]      = useState(false);
  const [stepIndex,    setStepIndex]    = useState(0);
  const [elapsed,      setElapsed]      = useState(0);
  const [paused,       setPaused]       = useState(false);
  const [sessionDone,  setSessionDone]  = useState(false);
  const [totalElapsed, setTotalElapsed] = useState(0);

  const addSessionLog = useProgressStore((s) => s.addSessionLog);
  const intervalRef   = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  useEffect(() => {
    if (!started || paused || sessionDone) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setElapsed      ((e) => e + 1);
      setTotalElapsed ((t) => t + 1);
    }, 1000);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [started, paused, sessionDone]);

  useEffect(() => {
    if (!session || !started || paused || sessionDone) return;
    const currentStep = session.steps[stepIndex];
    if (!currentStep) return;

    if (elapsed >= currentStep.durationSeconds) {
      handleStepComplete();
    }
  }, [elapsed, stepIndex, started, paused, sessionDone]);

  const handleStepComplete = async () => {
    await HapticService.success();
    if (stepIndex < (session?.steps.length ?? 0) - 1) {
      setStepIndex((i) => i + 1);
      setElapsed(0);
    } else {
      handleSessionComplete();
    }
  };

  const handleSessionComplete = async () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setSessionDone(true);
    await HapticService.success();
    if (session) {
      addSessionLog({
        sessionId:         session.id,
        sessionTitle:      session.title.tr,
        completedAt:       new Date().toISOString(),
        durationSeconds:   totalElapsed,
        completionPercent: 100,
        zonesVisited:      session.steps.map((s) => s.zoneId),
      });
    }
  };

  const handleStart = async () => {
    await HapticService.medium();
    setStarted(true);
  };

  const handlePause = async () => {
    await HapticService.light();
    setPaused((p) => !p);
  };

  const handleExit = () => {
    if (started && !sessionDone) {
      Alert.alert(
        'Seansı Bitir',
        'Seansı erken bitirmek istiyor musunuz?',
        [
          { text: 'Devam Et', style: 'cancel' },
          {
            text: 'Bitir',
            style: 'destructive',
            onPress: () => {
              if (session && totalElapsed > 10) {
                addSessionLog({
                  sessionId:         session.id,
                  sessionTitle:      session.title.tr,
                  completedAt:       new Date().toISOString(),
                  durationSeconds:   totalElapsed,
                  completionPercent: Math.round((stepIndex / (session.steps.length || 1)) * 100),
                  zonesVisited:      session.steps.slice(0, stepIndex).map((s) => s.zoneId),
                });
              }
              router.back();
            },
          },
        ]
      );
    } else {
      router.back();
    }
  };

  if (!session) {
    return (
      <LinearGradient colors={['#0A1209', '#0F1E12']} style={styles.container}>
        <View style={styles.errorCenter}>
          <Text style={styles.errorText}>Seans bulunamadı.</Text>
          <Button label="Geri Dön" onPress={() => router.back()} />
        </View>
      </LinearGradient>
    );
  }

  const currentStep    = session.steps[stepIndex];
  const currentZone    = currentStep ? ALL_ZONES[currentStep.zoneId] : null;
  const progressPercent = ((stepIndex + (elapsed / (currentStep?.durationSeconds ?? 1))) / session.steps.length) * 100;

  // ── Done screen ────────────────────────────────────────────────────────────
  if (sessionDone) {
    return (
      <LinearGradient colors={['#0A1209', '#0F2010', '#0A1209']} style={styles.container}>
        <Animated.View entering={FadeIn.duration(600)} style={styles.doneScreen}>
          <BreathingOrb size={140} running={false} />
          <Text style={styles.doneEmoji}>✨</Text>
          <Text style={styles.doneTitle}>Seans Tamamlandı!</Text>
          <Text style={styles.doneSubtitle}>{session.title.tr}</Text>
          <Text style={styles.doneTime}>
            {Math.round(totalElapsed / 60)} dakika · {session.steps.length} bölge
          </Text>
          <View style={styles.doneBenefits}>
            {session.benefits.tr.map((b) => (
              <Text key={b} style={styles.doneBenefit}>✓ {b}</Text>
            ))}
          </View>
          <Button
            label="Harika! ←"
            onPress={() => router.back()}
            fullWidth
            style={{ marginTop: Spacing['6'] }}
          />
        </Animated.View>
      </LinearGradient>
    );
  }

  // ── Pre-start screen ───────────────────────────────────────────────────────
  if (!started) {
    return (
      <LinearGradient colors={['#0A1209', '#0F1E12', Palette.navy]} style={styles.container}>
        <Pressable onPress={handleExit} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Geri</Text>
        </Pressable>

        <Animated.View entering={SlideInDown.duration(500)} style={styles.preStart}>
          <Text style={styles.sessionEmoji}>{session.emoji}</Text>
          <Text style={styles.sessionTitle}>{session.title.tr}</Text>
          <Text style={styles.sessionDesc}>{session.description.tr}</Text>

          <View style={styles.infoRow}>
            <View style={styles.infoChip}><Text style={styles.infoText}>⏱ {session.durationMinutes} dk</Text></View>
            <View style={styles.infoChip}><Text style={styles.infoText}>📍 {session.steps.length} adım</Text></View>
            <View style={styles.infoChip}><Text style={styles.infoText}>{session.difficulty === 'beginner' ? '🌱' : session.difficulty === 'intermediate' ? '💪' : '🔥'}</Text></View>
          </View>

          <Text style={styles.stepsPreviewTitle}>Seans Adımları:</Text>
          {session.steps.slice(0, 5).map((step, i) => {
            const zone = ALL_ZONES[step.zoneId];
            return (
              <View key={step.id} style={styles.stepPreviewRow}>
                <Text style={styles.stepPreviewNum}>{i + 1}</Text>
                <Text style={styles.stepPreviewEmoji}>{zone?.emoji ?? '🦶'}</Text>
                <Text style={styles.stepPreviewName}>{zone?.tr.name ?? step.zoneId}</Text>
                <Text style={styles.stepPreviewDur}>{step.durationSeconds}s</Text>
              </View>
            );
          })}
          {session.steps.length > 5 && (
            <Text style={styles.moreSteps}>+{session.steps.length - 5} adım daha…</Text>
          )}

          <Button
            label={`▶ Seansı Başlat`}
            onPress={handleStart}
            fullWidth
            size="lg"
            style={{ marginTop: Spacing['6'] }}
          />
        </Animated.View>
      </LinearGradient>
    );
  }

  // ── Active session ─────────────────────────────────────────────────────────
  return (
    <LinearGradient colors={['#060E08', '#0A1A0C', '#060E08']} style={styles.container}>
      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
      </View>

      {/* Step counter */}
      <View style={styles.stepCounter}>
        <Pressable onPress={handleExit} style={styles.exitBtn}>
          <Text style={styles.exitText}>✕</Text>
        </Pressable>
        <Text style={styles.stepCountText}>
          {stepIndex + 1} / {session.steps.length}
        </Text>
        <Pressable onPress={handlePause} style={styles.pauseBtn}>
          <Text style={styles.pauseText}>{paused ? '▶' : '⏸'}</Text>
        </Pressable>
      </View>

      {/* Zone info */}
      <Animated.View key={stepIndex} entering={FadeIn.duration(400)} style={styles.zoneInfo}>
        <Text style={styles.zoneEmoji}>{currentZone?.emoji ?? '🦶'}</Text>
        <Text style={styles.zoneName}>{currentZone?.tr.name ?? currentStep?.zoneId}</Text>
        <Text style={styles.zoneLocation}>{currentZone?.tr.location}</Text>
      </Animated.View>

      {/* Timer ring */}
      <View style={styles.timerCenter}>
        {paused ? (
          <BreathingOrb size={160} running={false} label="Duraklatıldı" />
        ) : (
          <TimerRing
            elapsed={elapsed}
            duration={currentStep?.durationSeconds ?? 60}
            size={180}
            color={currentZone?.color ?? Palette.sage}
            label={currentZone?.tr.name}
          />
        )}
      </View>

      {/* Instruction */}
      <Animated.View key={`inst-${stepIndex}`} entering={FadeIn.duration(500)} style={styles.instruction}>
        <BlurView intensity={20} tint="dark" style={styles.instructionBlur}>
          <Text style={styles.instructionText}>
            {currentStep?.instruction.tr}
          </Text>
        </BlurView>
      </Animated.View>

      {/* Navigation */}
      <View style={styles.navRow}>
        <Pressable
          onPress={() => { if (stepIndex > 0) { setStepIndex((i) => i - 1); setElapsed(0); } }}
          style={[styles.navBtn, stepIndex === 0 && { opacity: 0.3 }]}
          disabled={stepIndex === 0}
        >
          <Text style={styles.navBtnText}>← Önceki</Text>
        </Pressable>
        <Pressable onPress={handleStepComplete} style={styles.skipBtn}>
          <Text style={styles.skipBtnText}>Sonraki →</Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  errorCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing['4'] },
  errorText: { ...Typography.h3, color: Palette.cream },

  progressBar: { height: 3, backgroundColor: 'rgba(255,255,255,0.08)', position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  progressFill: { height: '100%', backgroundColor: Palette.sage, borderRadius: 2 },

  backBtn:     { position: 'absolute', top: 56, left: Spacing['5'], zIndex: 10, padding: Spacing['2'] },
  backBtnText: { ...Typography.body, color: Palette.sageLight },

  preStart:   { flex: 1, paddingHorizontal: Spacing['5'], paddingTop: 100, paddingBottom: Spacing['8'] },
  sessionEmoji: { fontSize: 56, marginBottom: Spacing['4'] },
  sessionTitle: { ...Typography.h1, color: Palette.cream, marginBottom: Spacing['2'] },
  sessionDesc:  { ...Typography.body, color: Palette.slateMid, marginBottom: Spacing['5'], lineHeight: 22 },
  infoRow:    { flexDirection: 'row', gap: Spacing['3'], marginBottom: Spacing['6'] },
  infoChip:   { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: BorderRadius.full, paddingHorizontal: Spacing['4'], paddingVertical: Spacing['2'] },
  infoText:   { ...Typography.label, color: Palette.sageLight },

  stepsPreviewTitle: { ...Typography.label, color: Palette.sageLight, marginBottom: Spacing['3'] },
  stepPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing['3'], marginBottom: Spacing['3'] },
  stepPreviewNum: { ...Typography.caption, color: Palette.slateMid, width: 18 },
  stepPreviewEmoji: { fontSize: 16, width: 22 },
  stepPreviewName: { ...Typography.body, color: Palette.cream, flex: 1 },
  stepPreviewDur:  { ...Typography.caption, color: Palette.slateMid },
  moreSteps: { ...Typography.caption, color: Palette.slateMid, textAlign: 'center', marginTop: Spacing['1'] },

  stepCounter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing['5'], paddingTop: 56, paddingBottom: Spacing['4'] },
  exitBtn:    { padding: Spacing['2'] },
  exitText:   { fontSize: 18, color: Palette.slateLight },
  stepCountText: { ...Typography.label, color: Palette.sageLight },
  pauseBtn:   { padding: Spacing['2'] },
  pauseText:  { fontSize: 18, color: Palette.sage },

  zoneInfo:   { alignItems: 'center', paddingHorizontal: Spacing['5'], marginBottom: Spacing['4'] },
  zoneEmoji:  { fontSize: 40, marginBottom: Spacing['2'] },
  zoneName:   { ...Typography.h2, color: Palette.cream, textAlign: 'center' },
  zoneLocation: { ...Typography.bodySmall, color: Palette.sageLight, textAlign: 'center', marginTop: 4 },

  timerCenter: { alignItems: 'center', marginVertical: Spacing['4'] },

  instruction: { marginHorizontal: Spacing['5'], marginBottom: Spacing['5'], borderRadius: BorderRadius.xl, overflow: 'hidden' },
  instructionBlur: { padding: Spacing['4'] },
  instructionText: { ...Typography.body, color: Palette.cream, textAlign: 'center', lineHeight: 24 },

  navRow:    { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing['5'], paddingBottom: Spacing['8'] },
  navBtn:    { padding: Spacing['3'] },
  navBtnText: { ...Typography.label, color: Palette.slateLight },
  skipBtn:   { backgroundColor: 'rgba(124,152,133,0.20)', borderRadius: BorderRadius.full, paddingHorizontal: Spacing['5'], paddingVertical: Spacing['3'] },
  skipBtnText: { ...Typography.label, color: Palette.sage },

  doneScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing['8'] },
  doneEmoji:  { fontSize: 56, marginBottom: Spacing['4'] },
  doneTitle:  { ...Typography.h1, color: Palette.cream, textAlign: 'center' },
  doneSubtitle: { ...Typography.body, color: Palette.sageLight, marginTop: Spacing['2'], textAlign: 'center' },
  doneTime:   { ...Typography.label, color: Palette.slateMid, marginTop: Spacing['2'] },
  doneBenefits: { gap: Spacing['2'], marginTop: Spacing['5'], alignSelf: 'flex-start', width: '100%' },
  doneBenefit:  { ...Typography.body, color: Palette.creamDark },
});
