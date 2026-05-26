import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Card } from '../common/Card';
import { RiskMeter } from '../common/RiskMeter';
import { colors } from '../../theme/colors';
import { PortfolioPosition } from '../../types';
import { usePortfolioStore } from '../../store/portfolioStore';

interface Props {
  position: PortfolioPosition;
  onPressStock?: () => void;
}

export const PositionCard: React.FC<Props> = ({ position, onPressStock }) => {
  const removePosition = usePortfolioStore((s) => s.removePosition);
  const isPositive = position.pnl >= 0;
  const color = isPositive ? colors.positive : colors.negative;

  const horizonLabel = { short: 'Kısa Vade', medium: 'Orta Vade', long: 'Uzun Vade' }[position.targetHorizon];

  const handleDelete = () => {
    Alert.alert('Pozisyonu Kaldır', `${position.stockCode} pozisyonu silinsin mi?`, [
      { text: 'İptal', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: () => removePosition(position.id) },
    ]);
  };

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onPressStock} style={styles.stockInfo}>
          <Text style={styles.code}>{position.stockCode}</Text>
          <Text style={styles.name}>{position.stock.name}</Text>
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <View style={[styles.horizonBadge]}>
            <Text style={styles.horizonText}>{horizonLabel}</Text>
          </View>
          <TouchableOpacity onPress={handleDelete} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Text style={styles.deleteBtn}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Lot / Alış</Text>
          <Text style={styles.metricValue}>{position.lots} lot @ {position.buyPrice.toFixed(2)} ₺</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Güncel Fiyat</Text>
          <Text style={styles.metricValue}>{position.stock.price.toFixed(2)} ₺</Text>
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Maliyet</Text>
          <Text style={styles.metricValue}>{position.cost.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Güncel Değer</Text>
          <Text style={styles.metricValue}>{position.currentValue.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</Text>
        </View>
      </View>

      <View style={styles.pnlRow}>
        <Text style={styles.metricLabel}>Kâr / Zarar</Text>
        <View style={styles.pnlValues}>
          <Text style={[styles.pnlAmount, { color }]}>
            {isPositive ? '+' : ''}{position.pnl.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
          </Text>
          <View style={[styles.pctBadge, { backgroundColor: isPositive ? 'rgba(0,200,150,0.15)' : 'rgba(255,71,87,0.15)' }]}>
            <Text style={[styles.pctText, { color }]}>
              {isPositive ? '+' : ''}{position.pnlPercent.toFixed(2)}%
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.weightText}>Ağırlık: %{position.weight.toFixed(1)}</Text>
        <RiskMeter score={position.stock.riskScore} showLabel={false} compact />
      </View>

      {position.note ? (
        <Text style={styles.note}>{position.note}</Text>
      ) : null}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: { gap: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  stockInfo: { flex: 1 },
  code: { color: colors.text.primary, fontSize: 17, fontWeight: '800', letterSpacing: 0.5 },
  name: { color: colors.text.muted, fontSize: 12 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  horizonBadge: {
    backgroundColor: colors.accent.blueLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  horizonText: { color: colors.accent.blue, fontSize: 11, fontWeight: '600' },
  deleteBtn: { color: colors.text.muted, fontSize: 14 },
  row: { flexDirection: 'row', gap: 12 },
  metric: { flex: 1, gap: 2 },
  metricLabel: { color: colors.text.muted, fontSize: 11 },
  metricValue: { color: colors.text.secondary, fontSize: 13, fontWeight: '600' },
  pnlRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pnlValues: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pnlAmount: { fontSize: 16, fontWeight: '700' },
  pctBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  pctText: { fontSize: 13, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weightText: { color: colors.text.muted, fontSize: 11 },
  note: {
    color: colors.text.muted,
    fontSize: 11,
    fontStyle: 'italic',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
});
