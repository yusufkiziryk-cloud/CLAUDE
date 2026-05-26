import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Card } from '../common/Card';
import { colors } from '../../theme/colors';
import { Sector } from '../../types';

interface Props {
  sectors: Sector[];
  title: string;
  mode: 'strong' | 'weak';
}

export const SectorLeaders: React.FC<Props> = ({ sectors, title, mode }) => (
  <Card style={styles.card}>
    <Text style={styles.title}>{title}</Text>
    <View style={styles.list}>
      {sectors.map((s) => {
        const isPositive = s.changePercent >= 0;
        const changeColor = isPositive ? colors.positive : colors.negative;
        const momentumColor = s.momentumScore > 60 ? colors.positive : s.momentumScore > 40 ? colors.warning : colors.negative;

        return (
          <View key={s.code} style={styles.item}>
            <View style={styles.left}>
              <Text style={styles.sectorName}>{s.name}</Text>
              <Text style={styles.leaders}>{s.leaders.slice(0, 2).join(' · ')}</Text>
            </View>
            <View style={styles.right}>
              <Text style={[styles.change, { color: changeColor }]}>
                {isPositive ? '+' : ''}{s.changePercent.toFixed(2)}%
              </Text>
              <View style={[styles.momentumBar, { width: `${s.momentumScore}%` as any, backgroundColor: momentumColor }]} />
            </View>
          </View>
        );
      })}
    </View>
  </Card>
);

const styles = StyleSheet.create({
  card: { gap: 10 },
  title: { color: colors.text.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  list: { gap: 10 },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  left: { flex: 1, gap: 2 },
  sectorName: { color: colors.text.primary, fontSize: 14, fontWeight: '600' },
  leaders: { color: colors.text.muted, fontSize: 11 },
  right: { alignItems: 'flex-end', gap: 4 },
  change: { fontSize: 13, fontWeight: '700' },
  momentumBar: { height: 3, borderRadius: 2, minWidth: 20 },
});
