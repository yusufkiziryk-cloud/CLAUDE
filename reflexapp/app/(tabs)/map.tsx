import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, Dimensions } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ReflexZone, FootSide, Language } from '../../types';
import { FOOT_ZONES, EAR_ZONES } from '../../constants/zones';
import { Palette } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing, BorderRadius } from '../../constants/spacing';
import { FootMapSVG } from '../../components/map/FootMapSVG';
import { ZoneDetailSheet } from '../../components/map/ZoneDetailSheet';
import { useUserStore } from '../../stores/useUserStore';

type AreaTab = 'foot' | 'ear';

export default function MapScreen() {
  const [activeArea, setActiveArea] = useState<AreaTab>('foot');
  const [footSide,   setFootSide]   = useState<FootSide>('left');
  const [selectedZone, setSelectedZone] = useState<ReflexZone | null>(null);
  const [highlightZoneId, setHighlightZoneId] = useState<string | undefined>();

  const lang = (useUserStore((s) => s.profile?.language) ?? 'tr') as Language;

  const handleZonePress = useCallback((zone: ReflexZone) => {
    setSelectedZone(zone);
    setHighlightZoneId(zone.id);
  }, []);

  const handleClose = useCallback(() => {
    setSelectedZone(null);
    setHighlightZoneId(undefined);
  }, []);

  const earZones = EAR_ZONES;

  return (
    <LinearGradient colors={['#0A1209', '#0F1E12', Palette.navy]} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>🗺 Refleks Haritası</Text>
          <Text style={styles.subtitle}>Organınıza dokunun, öğrenin</Text>
        </View>
      </View>

      {/* Area Tabs */}
      <View style={styles.areaTabs}>
        {(['foot', 'ear'] as AreaTab[]).map((area) => (
          <Pressable
            key={area}
            onPress={() => setActiveArea(area)}
            style={[styles.areaTab, activeArea === area && styles.areaTabActive]}
          >
            <Text style={[styles.areaTabText, activeArea === area && styles.areaTabTextActive]}>
              {area === 'foot' ? '🦶 Ayak' : '👂 Kulak'}
            </Text>
          </Pressable>
        ))}
      </View>

      {activeArea === 'foot' && (
        <>
          {/* Foot side toggle */}
          <View style={styles.sideToggle}>
            {(['left', 'right'] as FootSide[]).map((side) => (
              <Pressable
                key={side}
                onPress={() => setFootSide(side)}
                style={[styles.sideBtn, footSide === side && styles.sideBtnActive]}
              >
                <Text style={[styles.sideBtnText, footSide === side && styles.sideBtnTextActive]}>
                  {side === 'left' ? '← Sol' : 'Sağ →'}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Foot map */}
          <Animated.View entering={FadeIn.duration(350)} style={styles.mapContainer}>
            <ScrollView
              contentContainerStyle={styles.mapScroll}
              showsVerticalScrollIndicator={false}
            >
              <FootMapSVG
                side={footSide}
                onZonePress={handleZonePress}
                activeZoneId={highlightZoneId}
              />

              {/* Legend */}
              <View style={styles.legend}>
                <Text style={styles.legendTitle}>Dokunarak öğren</Text>
                <View style={styles.legendItems}>
                  {FOOT_ZONES.slice(0, 6).map((z) => (
                    <Pressable
                      key={z.id}
                      onPress={() => handleZonePress(z)}
                      style={styles.legendItem}
                    >
                      <View style={[styles.legendDot, { backgroundColor: z.color }]} />
                      <Text style={styles.legendText}>
                        {lang === 'tr' ? z.tr.name : z.en.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={{ height: 120 }} />
            </ScrollView>
          </Animated.View>
        </>
      )}

      {activeArea === 'ear' && (
        <Animated.View entering={FadeIn.duration(350)} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.earList}>
            <Text style={styles.earHeader}>👂 Kulak Refleksolojisi</Text>
            <Text style={styles.earDesc}>
              Kulak refleksolojisi (auriculoterapi), kulak üzerindeki noktalara basınç uygulayarak vücudun farklı bölgelerini uyarır.
            </Text>
            {earZones.map((zone) => (
              <Pressable
                key={zone.id}
                onPress={() => handleZonePress(zone)}
                style={styles.earZoneCard}
              >
                <View style={[styles.earZoneDot, { backgroundColor: zone.color }]}>
                  <Text style={{ fontSize: 18 }}>{zone.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.earZoneName}>
                    {lang === 'tr' ? zone.tr.name : zone.en.name}
                  </Text>
                  <Text style={styles.earZoneLocation}>
                    {lang === 'tr' ? zone.tr.location : zone.en.location}
                  </Text>
                  <Text style={styles.earZoneBenefit}>
                    {lang === 'tr' ? zone.tr.benefits[0] : zone.en.benefits[0]}
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
            <View style={{ height: 120 }} />
          </ScrollView>
        </Animated.View>
      )}

      {/* Zone Detail Sheet */}
      <ZoneDetailSheet
        zone={selectedZone}
        language={lang}
        onClose={handleClose}
        onStartSession={(zoneId) => router.push(`/zone/${zoneId}` as any)}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1 },
  header:     { paddingHorizontal: Spacing['5'], paddingTop: 60, paddingBottom: Spacing['4'] },
  title:      { ...Typography.h2,       color: Palette.cream },
  subtitle:   { ...Typography.bodySmall, color: Palette.sageLight, marginTop: 2 },

  areaTabs:   { flexDirection: 'row', marginHorizontal: Spacing['5'], marginBottom: Spacing['3'], backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: BorderRadius.xl, padding: 4 },
  areaTab:    { flex: 1, paddingVertical: Spacing['2'], alignItems: 'center', borderRadius: BorderRadius.lg },
  areaTabActive: { backgroundColor: 'rgba(124,152,133,0.25)' },
  areaTabText:   { ...Typography.label, color: Palette.slateMid },
  areaTabTextActive: { color: Palette.sage },

  sideToggle: { flexDirection: 'row', marginHorizontal: Spacing['5'], marginBottom: Spacing['4'], gap: Spacing['3'] },
  sideBtn:    { flex: 1, paddingVertical: Spacing['2'], alignItems: 'center', borderRadius: BorderRadius.full, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  sideBtnActive: { backgroundColor: 'rgba(124,152,133,0.20)', borderColor: Palette.sage },
  sideBtnText:   { ...Typography.label, color: Palette.slateMid },
  sideBtnTextActive: { color: Palette.sage },

  mapContainer: { flex: 1 },
  mapScroll:    { alignItems: 'center', paddingHorizontal: Spacing['5'] },

  legend:       { width: '100%', marginTop: Spacing['5'] },
  legendTitle:  { ...Typography.overline, color: Palette.sageLight, marginBottom: Spacing['3'] },
  legendItems:  { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing['2'] },
  legendItem:   { flexDirection: 'row', alignItems: 'center', gap: Spacing['2'], backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: Spacing['3'], paddingVertical: Spacing['2'], borderRadius: BorderRadius.full, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  legendDot:    { width: 8, height: 8, borderRadius: 4 },
  legendText:   { ...Typography.caption, color: Palette.creamDark },

  earList:     { paddingHorizontal: Spacing['5'], paddingTop: Spacing['3'] },
  earHeader:   { ...Typography.h3, color: Palette.cream, marginBottom: Spacing['2'] },
  earDesc:     { ...Typography.body, color: Palette.slateMid, marginBottom: Spacing['5'], lineHeight: 22 },
  earZoneCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing['3'], backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: BorderRadius.xl, padding: Spacing['4'], marginBottom: Spacing['3'], borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  earZoneDot:  { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', opacity: 0.85 },
  earZoneName: { ...Typography.body, color: Palette.cream, fontWeight: '500' },
  earZoneLocation: { ...Typography.caption, color: Palette.sageLight, marginTop: 2 },
  earZoneBenefit:  { ...Typography.caption, color: Palette.slateMid,  marginTop: 2, fontStyle: 'italic' },
  chevron: { fontSize: 22, color: Palette.slateMid },
});
