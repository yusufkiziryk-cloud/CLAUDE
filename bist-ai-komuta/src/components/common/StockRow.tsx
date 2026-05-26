import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../../theme/colors';
import { Stock } from '../../types';

interface StockRowProps {
  stock: Stock;
  onPress?: () => void;
  showSector?: boolean;
  rank?: number;
}

export const StockRow: React.FC<StockRowProps> = ({ stock, onPress, showSector, rank }) => {
  const isPositive = stock.changePercent >= 0;
  const changeColor = isPositive ? colors.positive : colors.negative;

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      {rank !== undefined && (
        <Text style={styles.rank}>{rank}</Text>
      )}
      <View style={styles.info}>
        <Text style={styles.code}>{stock.code}</Text>
        {showSector && <Text style={styles.sector}>{stock.sector}</Text>}
      </View>
      <View style={styles.right}>
        <Text style={styles.price}>{stock.price.toFixed(2)} ₺</Text>
        <View style={[styles.changeBadge, { backgroundColor: isPositive ? 'rgba(0,200,150,0.15)' : 'rgba(255,71,87,0.15)' }]}>
          <Text style={[styles.change, { color: changeColor }]}>
            {isPositive ? '+' : ''}{stock.changePercent.toFixed(2)}%
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  rank: {
    color: colors.text.muted,
    fontSize: 12,
    width: 18,
    textAlign: 'center',
  },
  info: { flex: 1, gap: 2 },
  code: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  sector: {
    color: colors.text.muted,
    fontSize: 11,
  },
  right: { alignItems: 'flex-end', gap: 4 },
  price: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  changeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  change: {
    fontSize: 12,
    fontWeight: '700',
  },
});
