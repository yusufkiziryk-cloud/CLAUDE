import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  TextInput, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { colors } from '../../theme/colors';
import { usePortfolioStore } from '../../store/portfolioStore';
import { BIST30_STOCKS } from '../../data/mockBIST30';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export const AddPositionModal: React.FC<Props> = ({ visible, onClose }) => {
  const addPosition = usePortfolioStore((s) => s.addPosition);
  const [stockCode, setStockCode] = useState('');
  const [lots, setLots] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [buyDate, setBuyDate] = useState('');
  const [horizon, setHorizon] = useState<'short' | 'medium' | 'long'>('medium');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const reset = () => {
    setStockCode(''); setLots(''); setBuyPrice('');
    setBuyDate(''); setNote(''); setError('');
    setHorizon('medium');
  };

  const handleAdd = () => {
    const code = stockCode.toUpperCase().trim();
    if (!BIST30_STOCKS.find((s) => s.code === code)) {
      setError('Hisse kodu bulunamadı. BIST30 listesini kontrol edin.');
      return;
    }
    const lotsNum = parseInt(lots, 10);
    const priceNum = parseFloat(buyPrice.replace(',', '.'));
    if (!lotsNum || lotsNum <= 0) { setError('Geçerli lot sayısı giriniz.'); return; }
    if (!priceNum || priceNum <= 0) { setError('Geçerli alış fiyatı giriniz.'); return; }

    addPosition({
      stockCode: code,
      lots: lotsNum,
      buyPrice: priceNum,
      buyDate: buyDate || new Date().toISOString().split('T')[0],
      targetHorizon: horizon,
      note: note.trim(),
    });
    reset();
    onClose();
  };

  const horizonOptions: { key: 'short' | 'medium' | 'long'; label: string }[] = [
    { key: 'short', label: 'Kısa' },
    { key: 'medium', label: 'Orta' },
    { key: 'long', label: 'Uzun' },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Pozisyon Ekle</Text>
            <TouchableOpacity onPress={() => { reset(); onClose(); }}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.form}>
            <Field label="Hisse Kodu *" value={stockCode} onChangeText={(t) => { setStockCode(t.toUpperCase()); setError(''); }} placeholder="AKBNK" autoCapitalize="characters" />
            <Field label="Lot Sayısı *" value={lots} onChangeText={setLots} placeholder="500" keyboardType="numeric" />
            <Field label="Alış Fiyatı (₺) *" value={buyPrice} onChangeText={setBuyPrice} placeholder="48.20" keyboardType="decimal-pad" />
            <Field label="Alış Tarihi" value={buyDate} onChangeText={setBuyDate} placeholder="2025-01-15" />

            <Text style={styles.label}>Hedef Vade</Text>
            <View style={styles.horizonRow}>
              {horizonOptions.map((h) => (
                <TouchableOpacity
                  key={h.key}
                  style={[styles.horizonBtn, horizon === h.key && styles.horizonBtnActive]}
                  onPress={() => setHorizon(h.key)}
                >
                  <Text style={[styles.horizonText, horizon === h.key && styles.horizonTextActive]}>
                    {h.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Field label="Not (isteğe bağlı)" value={note} onChangeText={setNote} placeholder="Pozisyon hakkında not..." multiline />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Text style={styles.ruleNote}>
              ℹ Tek hisse %15 üzeri veya aynı sektör %35 üzeri olduğunda yoğunlaşma uyarısı otomatik üretilir.
            </Text>
          </ScrollView>

          <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
            <Text style={styles.addBtnText}>Portföye Ekle</Text>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const Field: React.FC<{
  label: string; value: string; onChangeText: (t: string) => void;
  placeholder?: string; keyboardType?: any; autoCapitalize?: any; multiline?: boolean;
}> = ({ label, value, onChangeText, placeholder, keyboardType, autoCapitalize, multiline }) => (
  <View style={styles.fieldContainer}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      style={[styles.input, multiline && styles.inputMultiline]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.text.muted}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      multiline={multiline}
    />
  </View>
);

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bg.secondary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 32,
    maxHeight: '90%',
  },
  handle: { width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { color: colors.text.primary, fontSize: 18, fontWeight: '700' },
  closeBtn: { color: colors.text.muted, fontSize: 18 },
  form: { marginBottom: 16 },
  fieldContainer: { marginBottom: 14 },
  label: { color: colors.text.secondary, fontSize: 12, marginBottom: 6, fontWeight: '600' },
  input: {
    backgroundColor: colors.bg.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text.primary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  inputMultiline: { minHeight: 72, textAlignVertical: 'top' },
  horizonRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  horizonBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center',
  },
  horizonBtnActive: { backgroundColor: colors.accent.blueLight, borderColor: colors.accent.blue },
  horizonText: { color: colors.text.muted, fontWeight: '600', fontSize: 13 },
  horizonTextActive: { color: colors.accent.blue },
  error: { color: colors.negative, fontSize: 13, marginBottom: 10 },
  ruleNote: { color: colors.text.muted, fontSize: 11, lineHeight: 16, marginTop: 4, marginBottom: 16 },
  addBtn: {
    backgroundColor: colors.accent.blue,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
