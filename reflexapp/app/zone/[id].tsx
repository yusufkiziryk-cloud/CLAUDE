import React from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Palette } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing, BorderRadius } from '../../constants/spacing';
import { ALL_ZONES } from '../../constants/zones';
import { Button } from '../../components/ui/Button';
import { GlassmorphicCard } from '../../components/ui/GlassmorphicCard';
import { useUserStore } from '../../stores/useUserStore';
import { Language } from '../../types';

export default function ZoneDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const zone   = ALL_ZONES[id ?? ''];
  const lang   = (useUserStore((s) => s.profile?.language) ?? 'tr') as Language;

  if (!zone) {
    return (
      <LinearGradient colors={['#0A1209', '#0F1E12']} style={styles.container}>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Bölge bulunamadı</Text>
          <Button label="Geri" onPress={() => router.back()} />
        </View>
      </LinearGradient>
    );
  }

  const data = zone[lang];

  return (
    <LinearGradient
      colors={['#0A1209', '#0F1E12', Palette.navy]}
      style={styles.container}
    >
      {/* Back */}
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>← Haritaya Dön</Text>
      </Pressable>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.hero}>
          <View style={[styles.iconBg, { backgroundColor: zone.color + '22' }]}>
            <Text style={styles.emoji}>{zone.emoji}</Text>
          </View>
          <Text style={styles.zoneName}>{data.name}</Text>
          <Text style={styles.organName}>{zone.organ}</Text>
          <View style={[styles.areaBadge, { backgroundColor: zone.color + '22', borderColor: zone.color + '44' }]}>
            <Text style={[styles.areaBadgeText, { color: zone.color }]}>
              {zone.area === 'foot' ? '🦶 Ayak' : zone.area === 'hand' ? '🤲 El' : '👂 Kulak'} Refleksolojisi
            </Text>
          </View>
        </Animated.View>

        {/* Description */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <GlassmorphicCard style={styles.card} pressable={false} padding={Spacing['5']}>
            <Text style={styles.cardTitle}>
              {lang === 'tr' ? '📖 Hakkında' : '📖 About'}
            </Text>
            <Text style={styles.cardText}>{data.description}</Text>
          </GlassmorphicCard>
        </Animated.View>

        {/* Location */}
        <Animated.View entering={FadeInDown.delay(150).duration(400)}>
          <GlassmorphicCard style={styles.card} pressable={false} padding={Spacing['5']}>
            <Text style={styles.cardTitle}>
              {lang === 'tr' ? '📍 Konum' : '📍 Location'}
            </Text>
            <Text style={styles.cardText}>{data.location}</Text>
          </GlassmorphicCard>
        </Animated.View>

        {/* Benefits */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <GlassmorphicCard style={styles.card} pressable={false} padding={Spacing['5']}>
            <Text style={styles.cardTitle}>
              {lang === 'tr' ? '✨ Faydalar' : '✨ Benefits'}
            </Text>
            <View style={styles.benefitList}>
              {data.benefits.map((b, i) => (
                <View key={i} style={styles.benefitItem}>
                  <View style={[styles.benefitDot, { backgroundColor: zone.color }]} />
                  <Text style={styles.benefitText}>{b}</Text>
                </View>
              ))}
            </View>
          </GlassmorphicCard>
        </Animated.View>

        {/* Technique */}
        <Animated.View entering={FadeInDown.delay(250).duration(400)}>
          <GlassmorphicCard style={styles.card} pressable={false} padding={Spacing['5']}>
            <Text style={styles.cardTitle}>
              {lang === 'tr' ? '💆 Teknik' : '💆 Technique'}
            </Text>
            <View style={[styles.techniqueBox, { borderLeftColor: zone.color }]}>
              <Text style={styles.cardText}>{data.technique}</Text>
            </View>
            <View style={styles.durationChip}>
              <Text style={[styles.durationText, { color: zone.color }]}>
                ⏱ {zone.pressureDuration} {lang === 'tr' ? 'saniye' : 'seconds'}
              </Text>
            </View>
          </GlassmorphicCard>
        </Animated.View>

        {/* Caution */}
        {data.caution && (
          <Animated.View entering={FadeInDown.delay(300).duration(400)}>
            <View style={styles.cautionBox}>
              <Text style={styles.cautionText}>⚠️ {data.caution}</Text>
            </View>
          </Animated.View>
        )}

        {/* Related zones */}
        {zone.relatedZones && zone.relatedZones.length > 0 && (
          <Animated.View entering={FadeInDown.delay(350).duration(400)}>
            <GlassmorphicCard style={styles.card} pressable={false} padding={Spacing['5']}>
              <Text style={styles.cardTitle}>
                {lang === 'tr' ? '🔗 İlgili Bölgeler' : '🔗 Related Zones'}
              </Text>
              <View style={styles.relatedList}>
                {zone.relatedZones.map((relId) => {
                  const rel = ALL_ZONES[relId];
                  if (!rel) return null;
                  return (
                    <Pressable
                      key={relId}
                      onPress={() => router.push(`/zone/${relId}` as any)}
                      style={styles.relatedChip}
                    >
                      <Text style={styles.relatedEmoji}>{rel.emoji}</Text>
                      <Text style={styles.relatedName}>{rel[lang].name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </GlassmorphicCard>
          </Animated.View>
        )}

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>
          {lang === 'tr'
            ? 'Bu bilgiler destekleyici rahatlama amaçlıdır. Tıbbi tanı veya tedavi yerine geçmez.'
            : 'This information is for supportive relaxation purposes only. Not a substitute for medical treatment.'}
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backBtn:   { paddingHorizontal: Spacing['5'], paddingTop: 56, paddingBottom: Spacing['3'] },
  backText:  { ...Typography.body, color: Palette.sageLight },
  notFound:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing['4'] },
  notFoundText: { ...Typography.h3, color: Palette.cream },

  scroll:    { paddingHorizontal: Spacing['5'], paddingBottom: Spacing['8'] },

  hero:      { alignItems: 'center', marginBottom: Spacing['6'] },
  iconBg:    { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing['4'] },
  emoji:     { fontSize: 50 },
  zoneName:  { ...Typography.h1, color: Palette.cream, textAlign: 'center' },
  organName: { ...Typography.body, color: Palette.sageLight, textAlign: 'center', marginTop: Spacing['1'] },
  areaBadge: { borderWidth: 1, borderRadius: BorderRadius.full, paddingHorizontal: Spacing['4'], paddingVertical: Spacing['1'], marginTop: Spacing['3'] },
  areaBadgeText: { ...Typography.label },

  card:       { marginBottom: Spacing['4'] },
  cardTitle:  { ...Typography.label, color: Palette.sageLight, marginBottom: Spacing['3'] },
  cardText:   { ...Typography.body, color: Palette.cream, lineHeight: 24 },

  benefitList: { gap: Spacing['2'] },
  benefitItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing['3'] },
  benefitDot:  { width: 6, height: 6, borderRadius: 3 },
  benefitText: { ...Typography.body, color: Palette.creamDark, flex: 1 },

  techniqueBox: { borderLeftWidth: 3, paddingLeft: Spacing['3'], backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: BorderRadius.sm, padding: Spacing['3'], marginBottom: Spacing['3'] },
  durationChip: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: BorderRadius.full, paddingHorizontal: Spacing['3'], paddingVertical: Spacing['1'] },
  durationText: { ...Typography.label },

  cautionBox: { backgroundColor: 'rgba(240,165,0,0.08)', borderWidth: 1, borderColor: 'rgba(240,165,0,0.25)', borderRadius: BorderRadius.xl, padding: Spacing['4'], marginBottom: Spacing['4'] },
  cautionText: { ...Typography.body, color: '#F5A623', lineHeight: 22 },

  relatedList: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing['2'] },
  relatedChip: { flexDirection: 'row', alignItems: 'center', gap: Spacing['2'], backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: BorderRadius.full, paddingHorizontal: Spacing['3'], paddingVertical: Spacing['2'], borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  relatedEmoji: { fontSize: 16 },
  relatedName:  { ...Typography.caption, color: Palette.sageLight },

  disclaimer: { ...Typography.caption, color: Palette.slateMid, textAlign: 'center', fontStyle: 'italic', lineHeight: 18, marginTop: Spacing['4'] },
});
