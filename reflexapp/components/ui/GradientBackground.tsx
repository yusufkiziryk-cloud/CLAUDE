import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Palette } from '../../constants/colors';

interface Props {
  children:  React.ReactNode;
  style?:    ViewStyle;
  variant?:  'default' | 'zen' | 'earth' | 'ocean' | 'dusk';
}

const GRADIENTS = {
  default: [Palette.navy, Palette.navyMid, '#0D0D1A'] as const,
  zen:     [Palette.navy, '#1A2A1F', '#0D1A10'] as const,
  earth:   ['#1A1208', '#2A1F14', '#0D0A06'] as const,
  ocean:   ['#0A1628', '#0D2040', '#060F1A'] as const,
  dusk:    ['#1A0A1E', '#2A1028', '#0D0614'] as const,
} as const;

export function GradientBackground({ children, style, variant = 'default' }: Props) {
  return (
    <LinearGradient
      colors={GRADIENTS[variant]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.3, y: 1 }}
      style={[styles.gradient, style]}
    >
      {/* Subtle texture overlay */}
      <View style={styles.texture} pointerEvents="none" />
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  texture: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(124,152,133,0.03)',
  },
});
