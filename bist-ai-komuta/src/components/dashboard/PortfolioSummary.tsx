import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from '../common/Card';
import { RiskMeter } from '../common/RiskMeter';
import { colors } from '../../theme/colors';
import { PortfolioStats } from '../../types';

interface Props {
  stats: PortfolioStats;
}

export const PortfolioSummary: React.FC<Props> = ({ stats }) => {
  const dailyPos = stats.dailyPnl >= 0;
  const totalPos = stats.totalPnl >= 0;

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>PORTFÖY DURUMU</Text>
      <Text style={styles.totalValue}>
        {stats.totalValue.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 })}
      </Text>

      <View style={styles.row}>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Günlük K/Z</Text>
          <Text style={[styles.metricValue, { color: dailyPos ? colors.positive : colors.negative }]}>
            {dailyPos ? '+' : ''}{stats.dailyPnl.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
          </Text>
          <Text style={[styles.metricPct, { color: dailyPos ? colors.positive : colors.negative }]}>
            {dailyPos ? '+' : ''}{stats.dailyPnlPercent.toFixed(2)}%
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Toplam K/Z</Text>
          <Text style={[styles.metricValue, { color: totalPos ? colors.positive : colors.negative }]}>
            {totalPos ? '+' : ''}{stats.totalPnl.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
          </Text>
          <Text style={[styles.metricPct, { color: totalPos ? colors.positive : colors.negative }]}>
            {totalPos ? '+' : ''}{stats.totalPnlPercent.toFixed(2)}%
          </Text>
        </View>
      </View>

      <View style={styles.riskSection}>
        <Text style={styles.riskLabel}>Portföy Risk Skoru</Text>
        <RiskMeter score={stats.riskScore} compact />
      </View>

      {stats.concentrationWarnings.length > 0 && (
        <View style={styles.warnings}>
          {stats.concentrationWarnings.map((w, i) => (
            <View key={i} style={styles.warning}>
              <Text style={styles.warningText}>
                ⚠ {w.type === 'stock' ? w.name : w.name + ' sektörü'} yoğunlaşması ({w.weight.toFixed(1)}%)
              </Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: { gap: 12 },
  title: { color: colors.text.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  totalValue: { color: colors.text.primary, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  row: { flexDirection: 'row', gap: 16 },
  metric: { flex: 1, gap: 2 },
  metricLabel: { color: colors.text.muted, fontSize: 11 },
  metricValue: { fontSize: 16, fontWeight: '700' },
  metricPct: { fontSize: 12, fontWeight: '600' },
  divider: { width: 1, backgroundColor: colors.border },
  riskSection: { gap: 6 },
  riskLabel: { color: colors.text.muted, fontSize: 11 },
  warnings: { gap: 4 },
  warning: {
    backgroundColor: 'rgba(255,179,0,0.12)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  warningText: { color: colors.warning, fontSize: 12, fontWeight: '500' },
});
