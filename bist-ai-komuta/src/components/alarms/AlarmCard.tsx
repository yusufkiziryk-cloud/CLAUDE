import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { Card } from '../common/Card';
import { colors } from '../../theme/colors';
import { Alarm } from '../../types';
import { useAlarmsStore } from '../../store/alarmsStore';

const ALARM_LABELS: Record<string, string> = {
  price: 'Fiyat Alarmı',
  support_break: 'Destek Altı',
  resistance_break: 'Direnç Üstü',
  rsi: 'RSI Alarmı',
  volume_surge: 'Hacim Patlaması',
  volatility: 'Volatilite Artışı',
  portfolio_concentration: 'Yoğunlaşma',
  sector_rotation: 'Sektör Rotasyonu',
  balance_sheet: 'Bilanço',
  news: 'Haber Alarmı',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: colors.neutral,
  watch: colors.accent.blue,
  high: colors.warning,
  critical: colors.negative,
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Düşük',
  watch: 'Takip Et',
  high: 'Yüksek Dikkat',
  critical: 'Kritik',
};

interface Props {
  alarm: Alarm;
}

export const AlarmCard: React.FC<Props> = ({ alarm }) => {
  const { removeAlarm, toggleAlarm } = useAlarmsStore();
  const priorityColor = PRIORITY_COLORS[alarm.priority];

  return (
    <Card style={[styles.card, !alarm.active && styles.inactive]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.priorityDot, { backgroundColor: priorityColor }]} />
          <Text style={styles.code}>{alarm.stockCode}</Text>
          <View style={[styles.priorityBadge, { backgroundColor: `${priorityColor}20` }]}>
            <Text style={[styles.priorityText, { color: priorityColor }]}>
              {PRIORITY_LABELS[alarm.priority]}
            </Text>
          </View>
        </View>
        <Switch
          value={alarm.active}
          onValueChange={() => toggleAlarm(alarm.id)}
          trackColor={{ false: colors.border, true: colors.accent.blueLight }}
          thumbColor={alarm.active ? colors.accent.blue : colors.text.muted}
          style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
        />
      </View>

      <View style={styles.body}>
        <Text style={styles.typeLabel}>{ALARM_LABELS[alarm.type]}</Text>
        <Text style={styles.condition}>
          {alarm.condition === 'above' ? '▲ Üstünde' : '▼ Altında'}{' '}
          <Text style={styles.conditionValue}>{alarm.value}</Text>
          {alarm.type === 'rsi' ? ' (RSI)' : ' ₺'}
        </Text>
      </View>

      {alarm.note ? <Text style={styles.note}>{alarm.note}</Text> : null}

      <View style={styles.footer}>
        <Text style={styles.date}>{alarm.createdAt}</Text>
        <TouchableOpacity onPress={() => removeAlarm(alarm.id)}>
          <Text style={styles.deleteText}>Kaldır</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: { gap: 10 },
  inactive: { opacity: 0.5 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  code: { color: colors.text.primary, fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  priorityText: { fontSize: 11, fontWeight: '700' },
  body: { gap: 4 },
  typeLabel: { color: colors.text.muted, fontSize: 12 },
  condition: { color: colors.text.secondary, fontSize: 14, fontWeight: '600' },
  conditionValue: { color: colors.text.primary, fontWeight: '700' },
  note: { color: colors.text.muted, fontSize: 11, fontStyle: 'italic' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  date: { color: colors.text.muted, fontSize: 11 },
  deleteText: { color: colors.negative, fontSize: 12, fontWeight: '600' },
});
