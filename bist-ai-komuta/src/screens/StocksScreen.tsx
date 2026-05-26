import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors } from '../theme/colors';
import { RootStackParamList, Stock } from '../types';
import { BIST30_STOCKS } from '../data/mockBIST30';
import { SECTORS } from '../data/mockSectors';
import { StockRow } from '../components/common/StockRow';
import { useWatchlistStore } from '../store/watchlistStore';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type SortKey = 'default' | 'gainers' | 'losers' | 'rsi_high' | 'rsi_low' | 'watchlist';

export const StocksScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { codes: watchlist } = useWatchlistStore();
  const [query, setQuery] = useState('');
  const [sector, setSector] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('default');

  const sectors = useMemo(() => [...new Set(BIST30_STOCKS.map((s) => s.sector))], []);

  const filtered = useMemo(() => {
    let list = [...BIST30_STOCKS];
    if (query.trim()) {
      const q = query.toUpperCase();
      list = list.filter((s) => s.code.includes(q) || s.name.toUpperCase().includes(q));
    }
    if (sector) list = list.filter((s) => s.sector === sector);
    if (sort === 'watchlist') list = list.filter((s) => watchlist.includes(s.code));
    if (sort === 'gainers') list.sort((a, b) => b.changePercent - a.changePercent);
    else if (sort === 'losers') list.sort((a, b) => a.changePercent - b.changePercent);
    else if (sort === 'rsi_high') list.sort((a, b) => b.rsi - a.rsi);
    else if (sort === 'rsi_low') list.sort((a, b) => a.rsi - b.rsi);
    return list;
  }, [query, sector, sort, watchlist]);

  const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: 'default', label: 'Varsayılan' },
    { key: 'gainers', label: '▲ Kazananlar' },
    { key: 'losers', label: '▼ Kaybedenler' },
    { key: 'rsi_high', label: 'RSI Yüksek' },
    { key: 'rsi_low', label: 'RSI Düşük' },
    { key: 'watchlist', label: '⭐ İzleme' },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Hisseler</Text>
        <Text style={styles.count}>{filtered.length} hisse</Text>
      </View>

      <TextInput
        style={styles.search}
        placeholder="Hisse kodu veya isim ara..."
        placeholderTextColor={colors.text.muted}
        value={query}
        onChangeText={setQuery}
        autoCapitalize="characters"
      />

      {/* Sort chips */}
      <View style={styles.chips}>
        {SORT_OPTIONS.map((o) => (
          <TouchableOpacity
            key={o.key}
            style={[styles.chip, sort === o.key && styles.chipActive]}
            onPress={() => setSort(o.key)}
          >
            <Text style={[styles.chipText, sort === o.key && styles.chipTextActive]}>{o.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Sector filter */}
      <View style={styles.chips}>
        <TouchableOpacity
          style={[styles.chip, !sector && styles.chipActive]}
          onPress={() => setSector(null)}
        >
          <Text style={[styles.chipText, !sector && styles.chipTextActive]}>Tümü</Text>
        </TouchableOpacity>
        {sectors.map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.chip, sector === s && styles.chipActive]}
            onPress={() => setSector(s === sector ? null : s)}
          >
            <Text style={[styles.chipText, sector === s && styles.chipTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.code}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <StockRow
            stock={item}
            showSector
            onPress={() => navigation.navigate('StockDetail', { stockCode: item.code })}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Sonuç bulunamadı</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.primary },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title: { color: colors.text.primary, fontSize: 22, fontWeight: '800' },
  count: { color: colors.text.muted, fontSize: 13 },
  search: {
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: colors.bg.card, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border,
    color: colors.text.primary, paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 14,
  },
  chips: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, marginBottom: 6, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: colors.bg.card, borderRadius: 20,
    borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.accent.blueLight, borderColor: colors.accent.blue },
  chipText: { color: colors.text.muted, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: colors.accent.blue },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  empty: { padding: 32, alignItems: 'center' },
  emptyText: { color: colors.text.muted },
});
