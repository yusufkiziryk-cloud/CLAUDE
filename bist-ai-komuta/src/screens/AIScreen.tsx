import React, { useState, useMemo } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors } from '../theme/colors';
import { RootStackParamList } from '../types';
import { BIST30_STOCKS } from '../data/mockBIST30';
import { SECTORS } from '../data/mockSectors';
import { generateMorningBrief } from '../utils/aiPrompts';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { RiskMeter } from '../components/common/RiskMeter';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Tab = 'brief' | 'sector' | 'screener';

export const AIScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const [tab, setTab] = useState<Tab>('brief');
  const [query, setQuery] = useState('');

  const today = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  const brief = useMemo(() => generateMorningBrief(today), [today]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'brief', label: 'Sabah Bülteni' },
    { key: 'sector', label: 'Sektör Rotasyonu' },
    { key: 'screener', label: 'Hisse Tarayıcı' },
  ];

  // Screener: filter by AI criteria
  const screenerResults = useMemo(() => {
    return BIST30_STOCKS.filter((s) => {
      if (query === 'güçlü') return s.technicalScore > 65 && s.fundamentalScore > 65;
      if (query === 'rsi_dip') return s.rsi < 35;
      if (query === 'düşük_risk') return s.riskScore < 35;
      if (query === 'momentum') return s.changePercent > 1.5;
      return true;
    }).slice(0, 10);
  }, [query]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.aiBadge}>
          <Text style={styles.aiLabel}>AI</Text>
        </View>
        <Text style={styles.title}>Analiz Motoru</Text>
      </View>

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

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* SABAH BÜLTENİ */}
        {tab === 'brief' && (
          <Card style={styles.briefCard}>
            <Text style={styles.briefDate}>{today}</Text>
            {brief.split('\n').map((line, i) => {
              if (line.startsWith('# ')) return <Text key={i} style={styles.briefH1}>{line.slice(2)}</Text>;
              if (line.startsWith('## ')) return <Text key={i} style={styles.briefH2}>{line.slice(3)}</Text>;
              if (line.startsWith('• ') || line.startsWith('- ')) return <Text key={i} style={styles.briefBullet}>{line}</Text>;
              if (line.startsWith('*')) return <Text key={i} style={styles.briefDisclaimer}>{line.replace(/\*/g, '')}</Text>;
              if (line.startsWith('---')) return <View key={i} style={styles.divider} />;
              if (line.trim() === '') return <View key={i} style={{ height: 6 }} />;
              return <Text key={i} style={styles.briefBody}>{line}</Text>;
            })}
          </Card>
        )}

        {/* SEKTÖR ROTASYONU */}
        {tab === 'sector' && (
          <View style={styles.sectorGrid}>
            {[...SECTORS]
              .sort((a, b) => b.momentumScore - a.momentumScore)
              .map((sector) => {
                const momentumColor = sector.momentumScore > 65 ? colors.positive : sector.momentumScore > 45 ? colors.warning : colors.negative;
                const riskColor = sector.riskScore < 35 ? colors.positive : sector.riskScore < 55 ? colors.warning : colors.negative;
                const macroColors = { high: colors.negative, medium: colors.warning, low: colors.positive };
                const macroColor = macroColors[sector.macroSensitivity];

                return (
                  <Card key={sector.code} style={styles.sectorCard}>
                    <View style={styles.sectorHeader}>
                      <Text style={styles.sectorName}>{sector.name}</Text>
                      <Text style={[styles.sectorChange, { color: sector.changePercent >= 0 ? colors.positive : colors.negative }]}>
                        {sector.changePercent >= 0 ? '+' : ''}{sector.changePercent.toFixed(2)}%
                      </Text>
                    </View>

                    <View style={styles.sectorScores}>
                      <View style={styles.scoreItem}>
                        <Text style={styles.scoreItemLabel}>Momentum</Text>
                        <Text style={[styles.scoreItemValue, { color: momentumColor }]}>{sector.momentumScore}</Text>
                      </View>
                      <View style={styles.scoreItem}>
                        <Text style={styles.scoreItemLabel}>Risk</Text>
                        <Text style={[styles.scoreItemValue, { color: riskColor }]}>{sector.riskScore}</Text>
                      </View>
                      <View style={styles.scoreItem}>
                        <Text style={styles.scoreItemLabel}>Makro</Text>
                        <Text style={[styles.scoreItemValue, { color: macroColor }]}>
                          {{ high: 'Yüksek', medium: 'Orta', low: 'Düşük' }[sector.macroSensitivity]}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.momentumBarContainer}>
                      <View style={[styles.momentumBarFill, {
                        width: `${sector.momentumScore}%` as any,
                        backgroundColor: momentumColor,
                      }]} />
                    </View>

                    <View style={styles.leaderRow}>
                      <Text style={styles.leaderLabel}>Liderler:</Text>
                      {sector.leaders.map((l) => (
                        <TouchableOpacity key={l} onPress={() => navigation.navigate('StockDetail', { stockCode: l })}>
                          <Badge label={l} color={colors.accent.blue} bgColor={colors.accent.blueLight} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </Card>
                );
              })}
          </View>
        )}

        {/* HİSSE TARAYICI */}
        {tab === 'screener' && (
          <View style={styles.screenerContainer}>
            <Card style={styles.screenerInfo}>
              <Text style={styles.screenerInfoTitle}>AI Hisse Tarayıcı</Text>
              <Text style={styles.screenerInfoDesc}>
                Hızlı filtreler ile BIST30 içinde kriterlere uyan hisseleri tarayın.
              </Text>
            </Card>

            <View style={styles.screenerChips}>
              {[
                { key: '', label: 'Tümü' },
                { key: 'güçlü', label: 'Güçlü Hisseler' },
                { key: 'rsi_dip', label: 'RSI Dip' },
                { key: 'düşük_risk', label: 'Düşük Risk' },
                { key: 'momentum', label: 'Momentum' },
              ].map((f) => (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.chip, query === f.key && styles.chipActive]}
                  onPress={() => setQuery(f.key)}
                >
                  <Text style={[styles.chipText, query === f.key && styles.chipTextActive]}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.screenerCount}>{screenerResults.length} hisse bulundu</Text>

            {screenerResults.map((stock) => (
              <Card key={stock.code} style={styles.screenerRow}>
                <TouchableOpacity
                  style={styles.screenerRowInner}
                  onPress={() => navigation.navigate('StockDetail', { stockCode: stock.code })}
                >
                  <View style={styles.screenerLeft}>
                    <Text style={styles.screenerCode}>{stock.code}</Text>
                    <Text style={styles.screenerSector}>{stock.sector}</Text>
                  </View>
                  <View style={styles.screenerScores}>
                    <Badge label={`T:${stock.technicalScore}`} color={colors.positive} bgColor="rgba(0,200,150,0.1)" />
                    <Badge label={`F:${stock.fundamentalScore}`} color={colors.accent.blue} bgColor={colors.accent.blueLight} />
                    <Badge label={`R:${stock.riskScore}`} color={stock.riskScore < 40 ? colors.positive : colors.warning} bgColor={colors.bg.secondary} />
                  </View>
                  <Text style={[styles.screenerPrice, { color: stock.changePercent >= 0 ? colors.positive : colors.negative }]}>
                    {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                  </Text>
                </TouchableOpacity>
                <View style={{ marginTop: 8 }}>
                  <RiskMeter score={stock.riskScore} showLabel={false} compact />
                </View>
              </Card>
            ))}

            <View style={styles.disclaimerBox}>
              <Text style={styles.disclaimerText}>
                Bu tarayıcı karar destek amaçlıdır. Yatırım tavsiyesi değildir. Yatırım kararları kişisel risk profili ve güncel veriyle birlikte değerlendirilmelidir.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  aiBadge: { backgroundColor: colors.accent.purpleLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  aiLabel: { color: colors.accent.purple, fontSize: 14, fontWeight: '800' },
  title: { color: colors.text.primary, fontSize: 22, fontWeight: '800' },
  tabs: { flexDirection: 'row', marginHorizontal: 16, backgroundColor: colors.bg.card, borderRadius: 12, padding: 4, gap: 4, marginBottom: 4 },
  tab: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: colors.bg.elevated },
  tabText: { color: colors.text.muted, fontWeight: '600', fontSize: 12 },
  tabTextActive: { color: colors.text.primary },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  // Brief
  briefCard: { gap: 4 },
  briefDate: { color: colors.text.muted, fontSize: 11, marginBottom: 8 },
  briefH1: { color: colors.text.primary, fontSize: 18, fontWeight: '800', marginTop: 12, marginBottom: 4 },
  briefH2: { color: colors.accent.blue, fontSize: 14, fontWeight: '700', marginTop: 10, marginBottom: 2 },
  briefBody: { color: colors.text.secondary, fontSize: 13, lineHeight: 20 },
  briefBullet: { color: colors.text.secondary, fontSize: 13, lineHeight: 20, paddingLeft: 4 },
  briefDisclaimer: { color: colors.text.muted, fontSize: 11, fontStyle: 'italic', marginTop: 8 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 8 },
  // Sector
  sectorGrid: { gap: 10 },
  sectorCard: { gap: 8 },
  sectorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectorName: { color: colors.text.primary, fontSize: 16, fontWeight: '700' },
  sectorChange: { fontSize: 14, fontWeight: '700' },
  sectorScores: { flexDirection: 'row', gap: 16 },
  scoreItem: { flex: 1 },
  scoreItemLabel: { color: colors.text.muted, fontSize: 10, marginBottom: 2 },
  scoreItemValue: { fontSize: 14, fontWeight: '700' },
  momentumBarContainer: { height: 4, backgroundColor: colors.bg.secondary, borderRadius: 2, overflow: 'hidden' },
  momentumBarFill: { height: '100%', borderRadius: 2 },
  leaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  leaderLabel: { color: colors.text.muted, fontSize: 11 },
  // Screener
  screenerContainer: { gap: 10 },
  screenerInfo: { gap: 4 },
  screenerInfoTitle: { color: colors.text.primary, fontSize: 16, fontWeight: '700' },
  screenerInfoDesc: { color: colors.text.muted, fontSize: 12, lineHeight: 18 },
  screenerChips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 12, paddingVertical: 7, backgroundColor: colors.bg.card, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.accent.blueLight, borderColor: colors.accent.blue },
  chipText: { color: colors.text.muted, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: colors.accent.blue },
  screenerCount: { color: colors.text.muted, fontSize: 12 },
  screenerRow: { gap: 2 },
  screenerRowInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  screenerLeft: { flex: 1 },
  screenerCode: { color: colors.text.primary, fontSize: 15, fontWeight: '700' },
  screenerSector: { color: colors.text.muted, fontSize: 11 },
  screenerScores: { flexDirection: 'row', gap: 4 },
  screenerPrice: { fontSize: 14, fontWeight: '700', minWidth: 55, textAlign: 'right' },
  disclaimerBox: { backgroundColor: colors.bg.card, borderRadius: 10, padding: 12 },
  disclaimerText: { color: colors.text.muted, fontSize: 11, lineHeight: 16, fontStyle: 'italic' },
});
