import React, { useMemo } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors } from '../theme/colors';
import { RootStackParamList } from '../types';
import { PortfolioSummary } from '../components/dashboard/PortfolioSummary';
import { MarketOverview } from '../components/dashboard/MarketOverview';
import { SectorLeaders } from '../components/dashboard/SectorLeaders';
import { AIBrief } from '../components/dashboard/AIBrief';
import { StockRow } from '../components/common/StockRow';
import { Card } from '../components/common/Card';

import { usePortfolioStore } from '../store/portfolioStore';
import { useAlarmsStore } from '../store/alarmsStore';
import { calculatePortfolioStats } from '../utils/riskScoring';
import { getTopGainers, getTopLosers } from '../data/mockBIST30';
import { getTopSectors, getWeakSectors } from '../data/mockSectors';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export const DashboardScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const positions = usePortfolioStore((s) => s.positions);
  const alarms = useAlarmsStore((s) => s.alarms);

  const stats = useMemo(() => calculatePortfolioStats(positions), [positions]);
  const gainers = useMemo(() => getTopGainers(5), []);
  const losers = useMemo(() => getTopLosers(5), []);
  const topSectors = useMemo(() => getTopSectors(3), []);
  const weakSectors = useMemo(() => getWeakSectors(3), []);
  const criticalAlarms = alarms.filter((a) => a.priority === 'critical' && a.active);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>BIST AI Komuta</Text>
            <Text style={styles.headerDate}>{new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
          </View>
          <View style={styles.liveDot}>
            <View style={styles.dot} />
            <Text style={styles.liveText}>CANLI</Text>
          </View>
        </View>

        {/* Critical Alarms */}
        {criticalAlarms.length > 0 && (
          <View style={styles.criticalBanner}>
            <Text style={styles.criticalIcon}>🔴</Text>
            <Text style={styles.criticalText}>
              {criticalAlarms.length} kritik alarm aktif: {criticalAlarms.map((a) => a.stockCode).join(', ')}
            </Text>
          </View>
        )}

        {/* Portfolio Summary */}
        <PortfolioSummary stats={stats} />

        {/* Market Overview */}
        <MarketOverview />

        {/* AI Brief */}
        <AIBrief />

        {/* Gainers & Losers */}
        <View style={styles.twoCol}>
          <Card style={styles.halfCard}>
            <Text style={styles.sectionTitle}>EN GÜÇLÜ 5</Text>
            {gainers.map((s, i) => (
              <StockRow
                key={s.code}
                stock={s}
                rank={i + 1}
                onPress={() => navigation.navigate('StockDetail', { stockCode: s.code })}
              />
            ))}
          </Card>
          <Card style={styles.halfCard}>
            <Text style={styles.sectionTitle}>EN ZAYIF 5</Text>
            {losers.map((s, i) => (
              <StockRow
                key={s.code}
                stock={s}
                rank={i + 1}
                onPress={() => navigation.navigate('StockDetail', { stockCode: s.code })}
              />
            ))}
          </Card>
        </View>

        {/* Sector Rotation */}
        <View style={styles.twoCol}>
          <View style={{ flex: 1 }}>
            <SectorLeaders sectors={topSectors} title="GÜÇLÜ SEKTÖRLER" mode="strong" />
          </View>
          <View style={{ flex: 1 }}>
            <SectorLeaders sectors={weakSectors} title="ZAYIF SEKTÖRLER" mode="weak" />
          </View>
        </View>

        <Text style={styles.disclaimer}>
          Bu ekran karar destek amaçlıdır. Yatırım tavsiyesi değildir.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.primary },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  headerTitle: { color: colors.text.primary, fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  headerDate: { color: colors.text.muted, fontSize: 12, marginTop: 2 },
  liveDot: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.positive },
  liveText: { color: colors.positive, fontSize: 11, fontWeight: '700' },
  criticalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,71,87,0.12)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,71,87,0.3)',
    padding: 12,
  },
  criticalIcon: { fontSize: 16 },
  criticalText: { color: colors.negative, fontSize: 13, fontWeight: '600', flex: 1 },
  twoCol: { flexDirection: 'row', gap: 10 },
  halfCard: { flex: 1 },
  sectionTitle: { color: colors.text.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginBottom: 4 },
  disclaimer: { color: colors.text.muted, fontSize: 10, textAlign: 'center', fontStyle: 'italic', marginTop: 8 },
});
