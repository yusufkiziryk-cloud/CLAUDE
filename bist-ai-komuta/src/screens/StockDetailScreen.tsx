import React, { useMemo, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors } from '../theme/colors';
import { RootStackParamList } from '../types';
import { getBIST30ByCode } from '../data/mockBIST30';
import { generateStockAnalysis } from '../utils/aiPrompts';
import { getRiskColor, getRiskLabel } from '../utils/riskScoring';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { RiskMeter } from '../components/common/RiskMeter';
import { useWatchlistStore } from '../store/watchlistStore';

type Route = RouteProp<RootStackParamList, 'StockDetail'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

type Tab = 'teknik' | 'temel' | 'ai';

const DECISION_COLORS: Record<string, string> = {
  'Güçlü izlenmeli': colors.positive,
  'İzleme listesine alınabilir': colors.accent.blue,
  'Teknik teyit beklenmeli': colors.warning,
  'Temkinli yaklaşılmalı': colors.warning,
  'Fiyatlama dikkat gerektiriyor': colors.warning,
  'Hikaye güçlü ama riskler yüksek': colors.warning,
  'Kısa vadede oynaklık, orta vadede potansiyel': colors.accent.gold,
  'Risk/getiri dengesi zayıf': colors.negative,
};

export const StockDetailScreen: React.FC = () => {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { stockCode } = route.params;
  const [tab, setTab] = useState<Tab>('teknik');

  const stock = useMemo(() => getBIST30ByCode(stockCode), [stockCode]);
  const analysis = useMemo(() => stock ? generateStockAnalysis(stock) : null, [stock]);
  const { isWatching, addToWatchlist, removeFromWatchlist } = useWatchlistStore();
  const watching = isWatching(stockCode);

  if (!stock || !analysis) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={{ color: colors.text.primary, padding: 16 }}>Hisse bulunamadı.</Text>
      </SafeAreaView>
    );
  }

  const isPositive = stock.changePercent >= 0;
  const changeColor = isPositive ? colors.positive : colors.negative;
  const riskColor = getRiskColor(stock.riskScore);
  const decisionColor = DECISION_COLORS[analysis.decisionNote] ?? colors.neutral;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'teknik', label: 'Teknik' },
    { key: 'temel', label: 'Temel' },
    { key: 'ai', label: 'AI Analiz' },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>← Geri</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.watchBtn, watching && styles.watchBtnActive]}
            onPress={() => watching ? removeFromWatchlist(stockCode) : addToWatchlist(stockCode)}
          >
            <Text style={[styles.watchBtnText, watching && styles.watchBtnTextActive]}>
              {watching ? '⭐ İzliyorum' : '☆ İzle'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Price Header */}
        <View style={styles.priceHeader}>
          <View>
            <Text style={styles.code}>{stock.code}</Text>
            <Text style={styles.name}>{stock.name}</Text>
            <Badge label={stock.sector} color={colors.text.secondary} bgColor={colors.bg.elevated} style={{ marginTop: 4 }} />
          </View>
          <View style={styles.priceRight}>
            <Text style={styles.price}>{stock.price.toFixed(2)} ₺</Text>
            <View style={[styles.changeBadge, { backgroundColor: isPositive ? 'rgba(0,200,150,0.15)' : 'rgba(255,71,87,0.15)' }]}>
              <Text style={[styles.changeText, { color: changeColor }]}>
                {isPositive ? '+' : ''}{stock.changePercent.toFixed(2)}%
              </Text>
            </View>
          </View>
        </View>

        {/* 52w Range */}
        <Card style={styles.rangeCard}>
          <View style={styles.rangeRow}>
            <View style={styles.rangeStat}>
              <Text style={styles.rangeLabel}>52H Düşük</Text>
              <Text style={[styles.rangeValue, { color: colors.negative }]}>{stock.low52w.toFixed(2)} ₺</Text>
            </View>
            <View style={styles.rangeStat}>
              <Text style={styles.rangeLabel}>52H Yüksek</Text>
              <Text style={[styles.rangeValue, { color: colors.positive }]}>{stock.high52w.toFixed(2)} ₺</Text>
            </View>
            <View style={styles.rangeStat}>
              <Text style={styles.rangeLabel}>Hacim</Text>
              <Text style={styles.rangeValue}>{(stock.volume / 1e6).toFixed(1)}M</Text>
            </View>
          </View>
        </Card>

        {/* Risk Score */}
        <Card>
          <View style={styles.riskHeader}>
            <Text style={styles.sectionLabel}>RİSK SKORU</Text>
            <Text style={[styles.riskScore, { color: riskColor }]}>{stock.riskScore} — {getRiskLabel(stock.riskScore)}</Text>
          </View>
          <RiskMeter score={stock.riskScore} showLabel={false} />
        </Card>

        {/* Tabs */}
        <View style={styles.tabs}>
          {tabs.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, tab === t.key && styles.tabActive]}
              onPress={() => setTab(t.key)}
            >
              <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        {tab === 'teknik' && (
          <Card style={styles.tabCard}>
            <Text style={styles.sectionLabel}>TEKNİK GÖSTERGELER</Text>
            <View style={styles.indicatorGrid}>
              <Indicator label="RSI (14)" value={stock.rsi.toString()} alert={stock.rsi > 70 || stock.rsi < 30} />
              <Indicator label="MACD" value={stock.macd.toFixed(2)} positive={stock.macd > stock.macdSignal} />
              <Indicator label="EMA 20" value={stock.ema20.toFixed(2)} positive={stock.price > stock.ema20} />
              <Indicator label="EMA 50" value={stock.ema50.toFixed(2)} positive={stock.price > stock.ema50} />
              <Indicator label="EMA 200" value={stock.ema200.toFixed(2)} positive={stock.price > stock.ema200} />
              <Indicator label="Destek" value={`${stock.support.toFixed(2)} ₺`} />
              <Indicator label="Direnç" value={`${stock.resistance.toFixed(2)} ₺`} />
            </View>

            <Text style={styles.sectionLabel}>TEKNİK ÖZET</Text>
            <Text style={styles.analysisText}>{analysis.technical}</Text>

            <View style={styles.scoreRow}>
              <Text style={styles.scoreLabel}>Teknik Skor</Text>
              <View style={styles.scoreBar}>
                <View style={[styles.scoreFill, { width: `${stock.technicalScore}%` as any, backgroundColor: stock.technicalScore > 60 ? colors.positive : colors.warning }]} />
              </View>
              <Text style={styles.scoreValue}>{stock.technicalScore}/100</Text>
            </View>
          </Card>
        )}

        {tab === 'temel' && (
          <Card style={styles.tabCard}>
            <Text style={styles.sectionLabel}>TEMEL GÖSTERGELER</Text>
            <View style={styles.indicatorGrid}>
              {stock.pe !== null && <Indicator label="F/K" value={stock.pe.toFixed(1)} />}
              {stock.pbv !== null && <Indicator label="PD/DD" value={stock.pbv.toFixed(1)} />}
              {stock.evEbitda !== null && <Indicator label="FD/FAVÖK" value={stock.evEbitda.toFixed(1)} />}
              {stock.roe !== null && <Indicator label="ROE (%)" value={stock.roe.toFixed(1)} positive={stock.roe > 15} />}
              {stock.debtEquity !== null && <Indicator label="Borç/Özkaynak" value={stock.debtEquity.toFixed(1)} alert={stock.debtEquity > 2} />}
              {stock.revenueGrowth !== null && <Indicator label="Ciro Büyüme (%)" value={stock.revenueGrowth.toFixed(1)} positive={stock.revenueGrowth > 0} />}
              {stock.netIncomeGrowth !== null && <Indicator label="Net Kâr Büyüme (%)" value={stock.netIncomeGrowth.toFixed(1)} positive={stock.netIncomeGrowth > 0} />}
            </View>

            <Text style={styles.sectionLabel}>TEMEL ÖZET</Text>
            <Text style={styles.analysisText}>{analysis.fundamental}</Text>

            <View style={styles.scoreRow}>
              <Text style={styles.scoreLabel}>Temel Skor</Text>
              <View style={styles.scoreBar}>
                <View style={[styles.scoreFill, { width: `${stock.fundamentalScore}%` as any, backgroundColor: stock.fundamentalScore > 60 ? colors.positive : colors.warning }]} />
              </View>
              <Text style={styles.scoreValue}>{stock.fundamentalScore}/100</Text>
            </View>
          </Card>
        )}

        {tab === 'ai' && (
          <Card style={styles.tabCard}>
            <View style={styles.aiHeader}>
              <View style={styles.aiBadge}>
                <Text style={styles.aiLabel}>AI ANALİZ</Text>
              </View>
              <View style={[styles.decisionBadge, { backgroundColor: `${decisionColor}20` }]}>
                <Text style={[styles.decisionText, { color: decisionColor }]}>{analysis.decisionNote}</Text>
              </View>
            </View>

            <Text style={styles.sectionLabel}>KISA ÖZET</Text>
            <Text style={styles.analysisText}>{analysis.summary}</Text>

            <Text style={styles.sectionLabel}>SEKTÖR & MAKRO</Text>
            <Text style={styles.analysisText}>{analysis.sectorMacro}</Text>

            <Text style={styles.sectionLabel}>RİSKLER</Text>
            {analysis.risks.map((r, i) => (
              <View key={i} style={styles.riskItem}>
                <Text style={styles.riskBullet}>•</Text>
                <Text style={styles.riskText}>{r}</Text>
              </View>
            ))}

            <Text style={styles.sectionLabel}>SENARYOLAR</Text>
            <View style={styles.scenarioCard}>
              <Text style={styles.scenarioTitle}>🟢 Olumlu Senaryo</Text>
              <Text style={styles.scenarioText}>{analysis.scenarios.bull}</Text>
            </View>
            <View style={styles.scenarioCard}>
              <Text style={styles.scenarioTitle}>🔵 Baz Senaryo</Text>
              <Text style={styles.scenarioText}>{analysis.scenarios.base}</Text>
            </View>
            <View style={styles.scenarioCard}>
              <Text style={styles.scenarioTitle}>🔴 Olumsuz Senaryo</Text>
              <Text style={styles.scenarioText}>{analysis.scenarios.bear}</Text>
            </View>

            <View style={styles.disclaimerBox}>
              <Text style={styles.disclaimerText}>{analysis.disclaimer}</Text>
            </View>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const Indicator: React.FC<{ label: string; value: string; positive?: boolean; alert?: boolean }> = ({ label, value, positive, alert }) => {
  const color = alert ? colors.negative : positive === true ? colors.positive : positive === false ? colors.negative : colors.text.secondary;
  return (
    <View style={indStyles.item}>
      <Text style={indStyles.label}>{label}</Text>
      <Text style={[indStyles.value, { color }]}>{value}</Text>
    </View>
  );
};

const indStyles = StyleSheet.create({
  item: { width: '47%', backgroundColor: colors.bg.secondary, borderRadius: 8, padding: 10, marginBottom: 8 },
  label: { color: colors.text.muted, fontSize: 10, marginBottom: 4 },
  value: { fontSize: 16, fontWeight: '700' },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.primary },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backBtn: { padding: 4 },
  backText: { color: colors.accent.blue, fontSize: 15, fontWeight: '600' },
  watchBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  watchBtnActive: { backgroundColor: colors.accent.goldLight, borderColor: colors.accent.gold },
  watchBtnText: { color: colors.text.muted, fontSize: 13, fontWeight: '600' },
  watchBtnTextActive: { color: colors.accent.gold },
  priceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  code: { color: colors.text.primary, fontSize: 26, fontWeight: '800', letterSpacing: 0.5 },
  name: { color: colors.text.secondary, fontSize: 14 },
  priceRight: { alignItems: 'flex-end', gap: 6 },
  price: { color: colors.text.primary, fontSize: 26, fontWeight: '800' },
  changeBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  changeText: { fontSize: 15, fontWeight: '700' },
  rangeCard: { flexDirection: 'row' },
  rangeRow: { flexDirection: 'row', flex: 1 },
  rangeStat: { flex: 1, alignItems: 'center', gap: 4 },
  rangeLabel: { color: colors.text.muted, fontSize: 11 },
  rangeValue: { color: colors.text.primary, fontSize: 14, fontWeight: '700' },
  riskHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionLabel: { color: colors.text.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginBottom: 8, marginTop: 12 },
  riskScore: { fontSize: 13, fontWeight: '700' },
  tabs: { flexDirection: 'row', backgroundColor: colors.bg.card, borderRadius: 12, padding: 4, gap: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: colors.bg.elevated },
  tabText: { color: colors.text.muted, fontWeight: '600', fontSize: 14 },
  tabTextActive: { color: colors.text.primary },
  tabCard: { gap: 2 },
  indicatorGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  analysisText: { color: colors.text.secondary, fontSize: 13, lineHeight: 20 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  scoreLabel: { color: colors.text.muted, fontSize: 11, width: 70 },
  scoreBar: { flex: 1, height: 6, backgroundColor: colors.bg.secondary, borderRadius: 3, overflow: 'hidden' },
  scoreFill: { height: '100%', borderRadius: 3 },
  scoreValue: { color: colors.text.secondary, fontSize: 12, fontWeight: '600', width: 50, textAlign: 'right' },
  aiHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  aiBadge: { backgroundColor: colors.accent.purpleLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  aiLabel: { color: colors.accent.purple, fontSize: 12, fontWeight: '800' },
  decisionBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, maxWidth: '65%' },
  decisionText: { fontSize: 12, fontWeight: '700', textAlign: 'right' },
  riskItem: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  riskBullet: { color: colors.negative, fontSize: 14, lineHeight: 20 },
  riskText: { color: colors.text.secondary, fontSize: 13, lineHeight: 20, flex: 1 },
  scenarioCard: { backgroundColor: colors.bg.secondary, borderRadius: 10, padding: 12, marginBottom: 8 },
  scenarioTitle: { color: colors.text.primary, fontSize: 13, fontWeight: '700', marginBottom: 6 },
  scenarioText: { color: colors.text.secondary, fontSize: 12, lineHeight: 18 },
  disclaimerBox: { backgroundColor: colors.bg.secondary, borderRadius: 8, padding: 12, marginTop: 8 },
  disclaimerText: { color: colors.text.muted, fontSize: 11, lineHeight: 16, fontStyle: 'italic' },
});
