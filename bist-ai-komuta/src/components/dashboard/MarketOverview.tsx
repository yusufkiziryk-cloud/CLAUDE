import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from '../common/Card';
import { colors } from '../../theme/colors';
import { BIST_INDEX } from '../../data/mockBIST30';

export const MarketOverview: React.FC = () => {
  const isPositive = BIST_INDEX.changePercent >= 0;
  const changeColor = isPositive ? colors.positive : colors.negative;

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>BIST-100</Text>
        <View style={[styles.badge, { backgroundColor: isPositive ? 'rgba(0,200,150,0.15)' : 'rgba(255,71,87,0.15)' }]}>
          <Text style={[styles.badgeText, { color: changeColor }]}>
            {isPositive ? '▲' : '▼'} {Math.abs(BIST_INDEX.changePercent).toFixed(2)}%
          </Text>
        </View>
      </View>
      <Text style={styles.value}>{BIST_INDEX.value.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</Text>
      <View style={styles.row}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Değişim</Text>
          <Text style={[styles.statValue, { color: changeColor }]}>
            {isPositive ? '+' : ''}{BIST_INDEX.change.toFixed(2)}
          </Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Hacim</Text>
          <Text style={styles.statValue}>
            {(BIST_INDEX.volume / 1e9).toFixed(1)} Mrd ₺
          </Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Piyasa Değeri</Text>
          <Text style={styles.statValue}>
            {(BIST_INDEX.marketCap / 1e12).toFixed(2)} Trl ₺
          </Text>
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: { gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.text.muted, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 13, fontWeight: '700' },
  value: { color: colors.text.primary, fontSize: 26, fontWeight: '800' },
  row: { flexDirection: 'row', gap: 12, marginTop: 4 },
  stat: { flex: 1 },
  statLabel: { color: colors.text.muted, fontSize: 10, marginBottom: 2 },
  statValue: { color: colors.text.secondary, fontSize: 13, fontWeight: '600' },
});
