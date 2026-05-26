import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';
import { Alarm, AlarmType } from '../types';
import { useAlarmsStore } from '../store/alarmsStore';
import { AlarmCard } from '../components/alarms/AlarmCard';
import { BIST30_STOCKS } from '../data/mockBIST30';

const ALARM_TYPES: { key: AlarmType; label: string }[] = [
  { key: 'price', label: 'Fiyat Alarmı' },
  { key: 'support_break', label: 'Destek Altı' },
  { key: 'resistance_break', label: 'Direnç Üstü' },
  { key: 'rsi', label: 'RSI Alarmı' },
  { key: 'volume_surge', label: 'Hacim Patlaması' },
  { key: 'volatility', label: 'Volatilite Artışı' },
];

const PRIORITIES: { key: Alarm['priority']; label: string; color: string }[] = [
  { key: 'low', label: 'Düşük', color: colors.neutral },
  { key: 'watch', label: 'Takip Et', color: colors.accent.blue },
  { key: 'high', label: 'Yüksek Dikkat', color: colors.warning },
  { key: 'critical', label: 'Kritik', color: colors.negative },
];

export const AlarmsScreen: React.FC = () => {
  const alarms = useAlarmsStore((s) => s.alarms);
  const addAlarm = useAlarmsStore((s) => s.addAlarm);
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [stockCode, setStockCode] = useState('');
  const [alarmType, setAlarmType] = useState<AlarmType>('price');
  const [condition, setCondition] = useState<'above' | 'below'>('above');
  const [value, setValue] = useState('');
  const [priority, setPriority] = useState<Alarm['priority']>('watch');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const reset = () => {
    setStockCode(''); setValue(''); setNote(''); setError('');
    setAlarmType('price'); setCondition('above'); setPriority('watch');
  };

  const handleAdd = () => {
    const code = stockCode.toUpperCase().trim();
    if (!BIST30_STOCKS.find((s) => s.code === code)) {
      setError('Hisse kodu bulunamadı.'); return;
    }
    const v = parseFloat(value.replace(',', '.'));
    if (!v || v <= 0) { setError('Geçerli değer girin.'); return; }

    addAlarm({ stockCode: code, type: alarmType, condition, value: v, priority, active: true, note: note.trim() });
    reset();
    setShowModal(false);
  };

  const activeCount = alarms.filter((a) => a.active).length;
  const criticalCount = alarms.filter((a) => a.priority === 'critical' && a.active).length;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Alarm Merkezi</Text>
          <Text style={styles.subtitle}>{activeCount} aktif · {criticalCount} kritik</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
          <Text style={styles.addBtnText}>+ Alarm</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          ℹ Alarm tek başına işlem nedeni değildir. İnceleme çağrısıdır.
        </Text>
      </View>

      <FlatList
        data={[...alarms].sort((a, b) => {
          const order = { critical: 0, high: 1, watch: 2, low: 3 };
          return order[a.priority] - order[b.priority];
        })}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <AlarmCard alarm={item} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyTitle}>Alarm yok</Text>
            <Text style={styles.emptyDesc}>İlk alarmınızı ekleyerek takibe başlayın.</Text>
          </View>
        }
      />

      {/* Add Alarm Modal */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => { reset(); setShowModal(false); }}>
        <View style={styles.overlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Alarm Ekle</Text>
              <TouchableOpacity onPress={() => { reset(); setShowModal(false); }}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Hisse Kodu *</Text>
              <TextInput
                style={styles.input}
                value={stockCode}
                onChangeText={(t) => { setStockCode(t.toUpperCase()); setError(''); }}
                placeholder="AKBNK"
                placeholderTextColor={colors.text.muted}
                autoCapitalize="characters"
              />

              <Text style={styles.fieldLabel}>Alarm Türü</Text>
              <View style={styles.optionGrid}>
                {ALARM_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.key}
                    style={[styles.optionBtn, alarmType === t.key && styles.optionBtnActive]}
                    onPress={() => setAlarmType(t.key)}
                  >
                    <Text style={[styles.optionText, alarmType === t.key && styles.optionTextActive]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Koşul</Text>
              <View style={styles.conditionRow}>
                {(['above', 'below'] as const).map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.condBtn, condition === c && styles.condBtnActive]}
                    onPress={() => setCondition(c)}
                  >
                    <Text style={[styles.condText, condition === c && styles.condTextActive]}>
                      {c === 'above' ? '▲ Üstünde' : '▼ Altında'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Değer *</Text>
              <TextInput
                style={styles.input}
                value={value}
                onChangeText={setValue}
                placeholder="48.20"
                placeholderTextColor={colors.text.muted}
                keyboardType="decimal-pad"
              />

              <Text style={styles.fieldLabel}>Öncelik</Text>
              <View style={styles.optionGrid}>
                {PRIORITIES.map((p) => (
                  <TouchableOpacity
                    key={p.key}
                    style={[styles.optionBtn, priority === p.key && { backgroundColor: `${p.color}20`, borderColor: p.color }]}
                    onPress={() => setPriority(p.key)}
                  >
                    <Text style={[styles.optionText, priority === p.key && { color: p.color }]}>{p.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Not (isteğe bağlı)</Text>
              <TextInput
                style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
                value={note}
                onChangeText={setNote}
                placeholder="Alarm hakkında not..."
                placeholderTextColor={colors.text.muted}
                multiline
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <TouchableOpacity style={styles.submitBtn} onPress={handleAdd}>
                <Text style={styles.submitText}>Alarm Ekle</Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.primary },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title: { color: colors.text.primary, fontSize: 22, fontWeight: '800' },
  subtitle: { color: colors.text.muted, fontSize: 12, marginTop: 2 },
  addBtn: { backgroundColor: colors.accent.blue, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  infoBox: { marginHorizontal: 16, marginBottom: 8, backgroundColor: colors.accent.blueLight, borderRadius: 8, padding: 10 },
  infoText: { color: colors.accent.blue, fontSize: 12 },
  list: { paddingHorizontal: 16, gap: 10, paddingBottom: 32 },
  empty: { padding: 40, alignItems: 'center', gap: 10 },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { color: colors.text.primary, fontSize: 18, fontWeight: '700' },
  emptyDesc: { color: colors.text.muted, textAlign: 'center', fontSize: 13 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bg.secondary,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingBottom: 32, maxHeight: '90%',
  },
  handle: { width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle: { color: colors.text.primary, fontSize: 18, fontWeight: '700' },
  closeBtn: { color: colors.text.muted, fontSize: 18 },
  fieldLabel: { color: colors.text.secondary, fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: colors.bg.card, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    color: colors.text.primary, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
  },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionBtn: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border,
  },
  optionBtnActive: { backgroundColor: colors.accent.blueLight, borderColor: colors.accent.blue },
  optionText: { color: colors.text.muted, fontSize: 12, fontWeight: '600' },
  optionTextActive: { color: colors.accent.blue },
  conditionRow: { flexDirection: 'row', gap: 10 },
  condBtn: {
    flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10,
    backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border,
  },
  condBtnActive: { backgroundColor: colors.accent.blueLight, borderColor: colors.accent.blue },
  condText: { color: colors.text.muted, fontWeight: '600' },
  condTextActive: { color: colors.accent.blue },
  error: { color: colors.negative, fontSize: 13, marginTop: 8 },
  submitBtn: { backgroundColor: colors.accent.blue, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 16, marginBottom: 8 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
