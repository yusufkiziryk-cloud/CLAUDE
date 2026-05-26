import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { getRiskColor, getRiskLabel } from '../../utils/riskScoring';

interface RiskMeterProps {
  score: number;
  showLabel?: boolean;
  compact?: boolean;
}

export const RiskMeter: React.FC<RiskMeterProps> = ({ score, showLabel = true, compact }) => {
  const riskColor = getRiskColor(score);
  const label = getRiskLabel(score);
  const fillWidth = `${Math.min(100, score)}%` as const;

  return (
    <View style={compact ? styles.compactContainer : styles.container}>
      {showLabel && (
        <View style={styles.header}>
          <Text style={styles.label}>{label}</Text>
          <Text style={[styles.score, { color: riskColor }]}>{score}</Text>
        </View>
      )}
      <View style={styles.track}>
        <View style={[styles.fill, { width: fillWidth, backgroundColor: riskColor }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 6 },
  compactContainer: { gap: 4 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    color: colors.text.secondary,
    fontSize: 12,
  },
  score: {
    fontSize: 14,
    fontWeight: '700',
  },
  track: {
    height: 6,
    backgroundColor: colors.bg.secondary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
});
