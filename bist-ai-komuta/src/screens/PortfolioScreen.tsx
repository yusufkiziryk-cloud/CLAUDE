import React, { useMemo, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors } from '../theme/colors';
import { RootStackParamList } from '../types';
import { usePortfolioStore } from '../store/portfolioStore';
import { buildPortfolioPositions, calculatePortfolioStats, getRiskColor, getRiskLabel } from '../utils/riskScoring';
import { PositionCard } from '../components/portfolio/PositionCard';
import { AddPositionModal } from '../components/portfolio/AddPositionModal';
import { Card } from '../components/common/Card';
import { RiskMeter } from '../components/common/RiskMeter';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export const PortfolioScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const positions = usePortfolioStore((s) => s.positions);
  const [showModal, setShowModal] = useState(false);

  const builtPositions = useMemo(() => buildPortfolioPositions(positions), [positions]);
  const stats = useMemo(() => calculatePortfolioStats(positions), [positions]);

  // Sector distribution
  const sectorWeights = useMemo(() => {
    const map: Record<string, number> = {};
    builtPositions.forEach((p) => {
      map[p.stock.sector] = (map[p.stock.sector] || 0) + p.weight;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [builtPositions]);

  const riskColor = getRiskColor(stats.riskScore);

  if (positions.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={styles.emptyTitle}>Portföy boş</Text>
          <Text style={styles.emptyDesc}>İlk pozisyonunuzu ekleyerek portföy takibine başlayın.</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
            <Text style={styles.addBtnText}>+ Pozisyon Ekle</Text>
          </TouchableOpacity>
        </View>
        <AddPositionModal visible={showModal} onClose={() => setShowModal(false)} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Portföy</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
            <Text style={styles.addBtnText}>+ Ekle</Text>
          </TouchableOpacity>
        </View>

        {/* Summary Row */}
        <Card elevated>
          <View style={styles.summaryRow}>
            <View style={styles.summaryMetric}>
              <Text style={styles.summaryLabel}>Toplam Değer</Text>
              <Text style={styles.summaryValue}>{stats.totalValue.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</Text>
            </View>
            <View style={styles.summaryMetric}>
              <Text style={styles.summaryLabel}>Toplam K/Z</Text>
              <Text style={[styles.summaryValue, { color: stats.totalPnl >= 0 ? colors.positive : colors.negative }]}>
                {stats.totalPnl >= 0 ? '+' : ''}{stats.totalPnlPercent.toFixed(2)}%
              </Text>
            </View>
            <View style={styles.summaryMetric}>
              <Text style={styles.summaryLabel}>Risk Skoru</Text>
              <Text style={[styles.summaryValue, { color: riskColor }]}>{stats.riskScore}</Text>
            </View>
          </View>
          <View style={{ marginTop: 10 }}>
            <RiskMeter score={stats.riskScore} showLabel={false} />
          </View>
        </Card>

        {/* Warnings */}
        {stats.concentrationWarnings.length > 0 && (
          <View style={styles.warnings}>
            {stats.concentrationWarnings.map((w, i) => (
              <View key={i} style={styles.warning}>
                <Text style={styles.warningText}>
                  ⚠ {w.type === 'stock' ? `${w.name} hissesi` : `${w.name} sektörü`} ağırlığı %{w.weight.toFixed(1)} — eşik: %{w.threshold}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Sector Distribution */}
        <Card>
          <Text style={styles.sectionTitle}>SEKTÖR DAĞILIMI</Text>
          <View style={styles.sectorList}>
            {sectorWeights.map(([sector, weight]) => (
              <View key={sector} style={styles.sectorRow}>
                <Text style={styles.sectorName}>{sector}</Text>
                <View style={styles.sectorBarContainer}>
                  <View style={[styles.sectorBar, {
                    width: `${weight}%` as any,
                    backgroundColor: weight > 35 ? colors.warning : colors.accent.blue,
                  }]} />
                </View>
                <Text style={styles.sectorPct}>%{weight.toFixed(1)}</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Positions */}
        <Text style={styles.sectionTitle}>POZİSYONLAR ({builtPositions.length})</Text>
        {builtPositions
          .sort((a, b) => b.currentValue - a.currentValue)
          .map((pos) => (
            <PositionCard
              key={pos.id}
              position={pos}
              onPressStock={() => navigation.navigate('StockDetail', { stockCode: pos.stockCode })}
            />
          ))}

        <Text style={styles.disclaimer}>
          Bu ekran karar destek amaçlıdır. Yatırım tavsiyesi değildir.
        </Text>
      </ScrollView>

      <AddPositionModal visible={showModal} onClose={() => setShowModal(false)} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.primary },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: colors.text.primary, fontSize: 22, fontWeight: '800' },
  addBtn: { backgroundColor: colors.accent.blue, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  summaryRow: { flexDirection: 'row', gap: 8 },
  summaryMetric: { flex: 1, alignItems: 'center', gap: 4 },
  summaryLabel: { color: colors.text.muted, fontSize: 11 },
  summaryValue: { color: colors.text.primary, fontSize: 16, fontWeight: '700' },
  warnings: { gap: 6 },
  warning: { backgroundColor: 'rgba(255,179,0,0.1)', borderRadius: 8, padding: 10, borderLeftWidth: 3, borderLeftColor: colors.warning },
  warningText: { color: colors.warning, fontSize: 12 },
  sectionTitle: { color: colors.text.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  sectorList: { gap: 10, marginTop: 8 },
  sectorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectorName: { color: colors.text.secondary, fontSize: 12, width: 90 },
  sectorBarContainer: { flex: 1, height: 6, backgroundColor: colors.bg.secondary, borderRadius: 3, overflow: 'hidden' },
  sectorBar: { height: '100%', borderRadius: 3 },
  sectorPct: { color: colors.text.muted, fontSize: 12, width: 36, textAlign: 'right' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { color: colors.text.primary, fontSize: 20, fontWeight: '700' },
  emptyDesc: { color: colors.text.muted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  disclaimer: { color: colors.text.muted, fontSize: 10, textAlign: 'center', fontStyle: 'italic', marginTop: 8 },
});
