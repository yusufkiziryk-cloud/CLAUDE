import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  interpolateColor,
  useDerivedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Palette } from '../../constants/colors';
import { Typography } from '../../constants/typography';

interface Props {
  size?:     number;
  inhale?:   number; // seconds
  hold?:     number;
  exhale?:   number;
  running?:  boolean;
  label?:    string;
}

type Phase = 'inhale' | 'hold' | 'exhale';

export function BreathingOrb({
  size    = 160,
  inhale  = 4,
  hold    = 2,
  exhale  = 6,
  running = true,
  label,
}: Props) {
  const scale   = useSharedValue(0.7);
  const opacity = useSharedValue(0.5);
  const phase   = useSharedValue(0); // 0=inhale, 0.5=hold, 1=exhale

  useEffect(() => {
    if (!running) { scale.value = withTiming(0.7); return; }

    const total = inhale + hold + exhale;
    const inhaleMs = inhale * 1000;
    const holdMs   = hold * 1000;
    const exhaleMs = exhale * 1000;

    scale.value = withRepeat(
      withSequence(
        withTiming(1.0, { duration: inhaleMs, easing: Easing.inOut(Easing.sine) }),
        withTiming(1.0, { duration: holdMs }),
        withTiming(0.7, { duration: exhaleMs, easing: Easing.inOut(Easing.sine) }),
      ),
      -1,
      false
    );

    opacity.value = withRepeat(
      withSequence(
        withTiming(0.9, { duration: inhaleMs, easing: Easing.inOut(Easing.sine) }),
        withTiming(1.0, { duration: holdMs }),
        withTiming(0.4, { duration: exhaleMs, easing: Easing.inOut(Easing.sine) }),
      ),
      -1,
      false
    );
  }, [running, inhale, hold, exhale]);

  const outerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity:   opacity.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * 1.2 }],
    opacity:   opacity.value * 0.4,
  }));

  const innerSize  = size;
  const glowSize   = size * 1.4;

  return (
    <View style={[styles.wrapper, { width: glowSize, height: glowSize }]}>
      {/* Outer glow */}
      <Animated.View style={[
        styles.glow,
        { width: glowSize, height: glowSize, borderRadius: glowSize / 2 },
        glowStyle,
      ]} />

      {/* Main orb */}
      <Animated.View style={[
        styles.orbOuter,
        { width: innerSize, height: innerSize, borderRadius: innerSize / 2 },
        outerStyle,
      ]}>
        <LinearGradient
          colors={[Palette.sageLight, Palette.sage, Palette.sageDark]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={[styles.gradient, { borderRadius: innerSize / 2 }]}
        >
          {/* Inner shine */}
          <View style={styles.shine} />
          {label ? (
            <Text style={styles.label}>{label}</Text>
          ) : null}
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems:     'center',
    justifyContent: 'center',
  },
  glow: {
    position:        'absolute',
    backgroundColor: 'rgba(124,152,133,0.25)',
  },
  orbOuter: {
    overflow: 'hidden',
  },
  gradient: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  shine: {
    position:        'absolute',
    top:             '15%',
    left:            '20%',
    width:           '30%',
    height:          '25%',
    backgroundColor: 'rgba(255,255,255,0.20)',
    borderRadius:    9999,
    transform:       [{ rotate: '-30deg' }],
  },
  label: {
    ...Typography.label,
    color:  Palette.cream,
    opacity: 0.9,
  },
});
