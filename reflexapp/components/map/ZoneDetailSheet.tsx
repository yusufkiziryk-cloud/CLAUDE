import React, { useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, Dimensions } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { ReflexZone, Language } from '../../types';
import { Palette } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing, BorderRadius } from '../../constants/spacing';
import { Button } from '../ui/Button';
import { router } from 'expo-router';

interface Props {
  zone:      ReflexZone | null;
  language:  Language;
  onClose:   () => void;
  onStartSession?: (zoneId: string) => void;
}

const SCREEN_H = Dimensions.get('window').height;
const SHEET_H  = SCREEN_H * 0.72;

export function ZoneDetailSheet({ zone, language, onClose, onStartSession }: Props) {
  const translateY = useSharedValue(SHEET_H);
  const backdropO  = useSharedValue(0);

  useEffect(() => {
    if (zone) {
      translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
      backdropO.value  = withTiming(1, { duration: 250 });
    } else {
      translateY.value = withSpring(SHEET_H, { damping: 20, stiffness: 200 });
      backdropO.value  = withTiming(0, { duration: 250 });
    }
  }, [zone]);

  const sheetStyle   = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropO.value }));

  if (!zone) return null;

  const data     = zone[language];
  const isLeft   = language === 'tr';

  return (
    <>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View style={[styles.sheet, { height: SHEET_H }, sheetStyle]}>
        <LinearGradient
          colors={['#1A2A1E', '#0F1E13', '#0A160D']}
          style={styles.sheetGradient}
        >
          {/* Drag handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.emoji}>{zone.emoji}</Text>
            <View style={styles.headerText}>
              <Text style={styles.zoneName}>{data.name}</Text>
              <Text style={styles.organName}>{zone.organ}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Location */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                {isLeft ? '📍 KONUM' : '📍 LOCATION'}
              </Text>
              <Text style={styles.sectionText}>{data.location}</Text>
            </View>

            {/* Benefits */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                {isLeft ? '✨ FAYDALARI' : '✨ BENEFITS'}
              </Text>
              {data.benefits.map((b, i) => (
                <View key={i} style={styles.benefitRow}>
                  <View style={[styles.dot, { backgroundColor: zone.color }]} />
                  <Text style={styles.benefitText}>{b}</Text>
                </View>
              ))}
            </View>

            {/* Technique */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                {isLeft ? '💆 TEKNİK' : '💆 TECHNIQUE'}
              </Text>
              <View style={[styles.techniqueBox, { borderLeftColor: zone.color }]}>
                <Text style={styles.techniqueText}>{data.technique}</Text>
              </View>
            </View>

            {/* Duration chip */}
            <View style={styles.durationRow}>
              <View style={[styles.durationChip, { backgroundColor: zone.color + '22', borderColor: zone.color + '55' }]}>
                <Text style={[styles.durationText, { color: zone.color }]}>
                  ⏱ {zone.pressureDuration} {isLeft ? 'saniye' : 'seconds'}
                </Text>
              </View>
            </View>

            {/* Caution */}
            {data.caution ? (
              <View style={styles.caution}>
                <Text style={styles.cautionText}>⚠️  {data.caution}</Text>
              </View>
            ) : null}

            {/* Disclaimer */}
            <Text style={styles.disclaimer}>
              {isLeft
                ? 'Bu bilgiler destekleyici rahatlama amaçlıdır. Tıbbi tedavi yerine geçmez.'
                : 'This information is for supportive relaxation purposes only. Not a substitute for medical treatment.'}
            </Text>

            <Button
              label={isLeft ? 'Bu Noktayı Uygula' : 'Apply This Zone'}
              onPress={() => { onClose(); onStartSession?.(zone.id); }}
              fullWidth
              style={{ marginTop: Spacing['4'] }}
            />
          </ScrollView>
        </LinearGradient>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex:          90,
  },
  sheet: {
    position:     'absolute',
    bottom:       0,
    left:         0,
    right:        0,
    zIndex:       100,
    borderTopLeftRadius:  BorderRadius['3xl'],
    borderTopRightRadius: BorderRadius['3xl'],
    overflow:     'hidden',
  },
  sheetGradient: {
    flex:    1,
    padding: Spacing['5'],
    paddingBottom: Spacing['10'],
  },
  handle: {
    alignSelf:       'center',
    width:           44,
    height:          4,
    backgroundColor: 'rgba(255,255,255,0.20)',
    borderRadius:    BorderRadius.full,
    marginBottom:    Spacing['4'],
  },
  header: {
    flexDirection:   'row',
    alignItems:      'center',
    marginBottom:    Spacing['5'],
  },
  emoji: {
    fontSize: 38,
    marginRight: Spacing['3'],
  },
  headerText: {
    flex: 1,
  },
  zoneName: {
    ...Typography.h3,
    color: Palette.cream,
  },
  organName: {
    ...Typography.bodySmall,
    color:  Palette.sageLight,
    marginTop: 2,
  },
  closeBtn: {
    width:           32,
    height:          32,
    borderRadius:    16,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  closeBtnText: {
    color:    Palette.slateLight,
    fontSize: 14,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing['8'],
  },
  section: {
    marginBottom: Spacing['4'],
  },
  sectionLabel: {
    ...Typography.overline,
    color:        Palette.sageLight,
    marginBottom: Spacing['2'],
  },
  sectionText: {
    ...Typography.body,
    color: Palette.cream,
  },
  benefitRow: {
    flexDirection:  'row',
    alignItems:     'center',
    marginBottom:   Spacing['1'],
  },
  dot: {
    width:        6,
    height:       6,
    borderRadius: 3,
    marginRight:  Spacing['2'],
  },
  benefitText: {
    ...Typography.body,
    color: Palette.creamDark,
    flex:  1,
  },
  techniqueBox: {
    borderLeftWidth:  3,
    paddingLeft:      Spacing['3'],
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius:    BorderRadius.sm,
    padding:         Spacing['3'],
  },
  techniqueText: {
    ...Typography.body,
    color:      Palette.cream,
    lineHeight: 22,
  },
  durationRow: {
    flexDirection: 'row',
    marginBottom:  Spacing['4'],
  },
  durationChip: {
    borderWidth:  1,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing['4'],
    paddingVertical:   Spacing['2'],
  },
  durationText: {
    ...Typography.label,
    fontWeight: '600',
  },
  caution: {
    backgroundColor: 'rgba(240,165,0,0.08)',
    borderWidth:      1,
    borderColor:     'rgba(240,165,0,0.25)',
    borderRadius:    BorderRadius.md,
    padding:         Spacing['3'],
    marginBottom:    Spacing['3'],
  },
  cautionText: {
    ...Typography.bodySmall,
    color: '#F5A623',
  },
  disclaimer: {
    ...Typography.caption,
    color:     Palette.slateMid,
    textAlign: 'center',
    marginVertical: Spacing['3'],
    fontStyle: 'italic',
  },
});
