import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';

interface BadgeProps {
  label: string;
  color?: string;
  bgColor?: string;
  style?: ViewStyle;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  label, color = colors.text.primary, bgColor = colors.bg.elevated,
  style, size = 'sm',
}) => (
  <View style={[styles.badge, { backgroundColor: bgColor }, size === 'md' && styles.badgeMd, style]}>
    <Text style={[styles.label, { color }, size === 'md' && styles.labelMd]}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeMd: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  labelMd: {
    fontSize: 13,
  },
});
