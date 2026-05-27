import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Switch, Pressable, Alert, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Palette } from '../constants/colors';
import { Typography } from '../constants/typography';
import { Spacing, BorderRadius } from '../constants/spacing';
import { GlassmorphicCard } from '../components/ui/GlassmorphicCard';
import { Button } from '../components/ui/Button';
import { useUserStore } from '../stores/useUserStore';

function SettingRow({
  emoji, title, subtitle, children,
}: {
  emoji: string; title: string; subtitle?: string; children?: React.ReactNode;
}) {
  return (
    <View style={styles.settingRow}>
      <Text style={styles.settingEmoji}>{emoji}</Text>
      <View style={styles.settingInfo}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {children}
    </View>
  );
}

export default function SettingsScreen() {
  const profile       = useUserStore((s) => s.profile);
  const updateProfile = useUserStore((s) => s.updateProfile);
  const reset         = useUserStore((s) => s.reset);

  const [apiKey, setApiKey] = useState(profile?.apiKey ?? '');
  const [showKey, setShowKey] = useState(false);

  const handleSaveApiKey = () => {
    updateProfile({ apiKey: apiKey.trim() });
    Alert.alert('Kaydedildi', 'API anahtarınız kaydedildi.');
  };

  const handleReset = () => {
    Alert.alert(
      'Verileri Sıfırla',
      'Tüm verileriniz silinecek. Emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        { text: 'Sıfırla', style: 'destructive', onPress: () => { reset(); router.replace('/(auth)/welcome'); } },
      ]
    );
  };

  if (!profile) return null;

  return (
    <LinearGradient colors={['#0A1209', '#0F1E12', Palette.navy]} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Geri</Text>
        </Pressable>
        <Text style={styles.title}>⚙️ Ayarlar</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Profile */}
        <Text style={styles.sectionTitle}>Profil</Text>
        <GlassmorphicCard style={styles.card} pressable={false} padding={Spacing['5']}>
          <SettingRow emoji="👤" title="İsim" subtitle={profile.name}>
            <View style={styles.namePill}>
              <Text style={styles.namePillText}>{profile.name}</Text>
            </View>
          </SettingRow>
          <View style={styles.divider} />
          <SettingRow emoji="🌐" title="Dil" subtitle="Uygulama dili">
            <View style={styles.segmented}>
              {(['tr', 'en'] as const).map((lang) => (
                <Pressable
                  key={lang}
                  onPress={() => updateProfile({ language: lang })}
                  style={[styles.segBtn, profile.language === lang && styles.segBtnActive]}
                >
                  <Text style={[styles.segBtnText, profile.language === lang && styles.segBtnTextActive]}>
                    {lang === 'tr' ? '🇹🇷 TR' : '🇬🇧 EN'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </SettingRow>
        </GlassmorphicCard>

        {/* Preferences */}
        <Text style={styles.sectionTitle}>Tercihler</Text>
        <GlassmorphicCard style={styles.card} pressable={false} padding={Spacing['5']}>
          <SettingRow emoji="📳" title="Titreşim" subtitle="Haptic feedback">
            <Switch
              value={profile.hapticEnabled}
              onValueChange={(v) => updateProfile({ hapticEnabled: v })}
              trackColor={{ true: Palette.sage, false: 'rgba(255,255,255,0.15)' }}
              thumbColor={Palette.cream}
            />
          </SettingRow>
          <View style={styles.divider} />
          <SettingRow emoji="🔔" title="Bildirimler" subtitle="Wellness hatırlatıcıları">
            <Switch
              value={profile.notificationsEnabled}
              onValueChange={(v) => updateProfile({ notificationsEnabled: v })}
              trackColor={{ true: Palette.sage, false: 'rgba(255,255,255,0.15)' }}
              thumbColor={Palette.cream}
            />
          </SettingRow>
          <View style={styles.divider} />
          <SettingRow emoji="🔊" title="Ses" subtitle="Sesli rehber">
            <Switch
              value={profile.soundEnabled}
              onValueChange={(v) => updateProfile({ soundEnabled: v })}
              trackColor={{ true: Palette.sage, false: 'rgba(255,255,255,0.15)' }}
              thumbColor={Palette.cream}
            />
          </SettingRow>
        </GlassmorphicCard>

        {/* AI Settings */}
        <Text style={styles.sectionTitle}>AI Asistan</Text>
        <GlassmorphicCard style={styles.card} pressable={false} padding={Spacing['5']}>
          <Text style={styles.apiKeyLabel}>Anthropic API Anahtarı (İsteğe Bağlı)</Text>
          <Text style={styles.apiKeyDesc}>
            Claude AI ile güçlendirilmiş yanıtlar için kendi API anahtarınızı girin. Anahtar olmadan yerel AI kullanılır.
          </Text>
          <View style={styles.apiKeyRow}>
            <TextInput
              style={styles.apiKeyInput}
              value={showKey ? apiKey : (apiKey ? '•'.repeat(Math.min(apiKey.length, 20)) : '')}
              onChangeText={setApiKey}
              onFocus={() => setShowKey(true)}
              onBlur={() => setShowKey(false)}
              placeholder="sk-ant-..."
              placeholderTextColor={Palette.slateMid}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <Button
            label="API Anahtarı Kaydet"
            onPress={handleSaveApiKey}
            variant="secondary"
            size="sm"
            fullWidth
            style={{ marginTop: Spacing['3'] }}
          />
          <Text style={styles.apiKeyNote}>
            🔒 Anahtar yalnızca cihazınızda saklanır. Anthropic Console'dan alabilirsiniz: console.anthropic.com
          </Text>
        </GlassmorphicCard>

        {/* Premium */}
        <Text style={styles.sectionTitle}>Premium</Text>
        <GlassmorphicCard style={styles.card} pressable={false} padding={Spacing['5']}>
          <SettingRow emoji="✦" title="Premium Üyelik" subtitle={profile.isPremium ? '✓ Aktif' : 'Aktif değil'}>
            {!profile.isPremium && (
              <Pressable onPress={() => router.push('/premium')} style={styles.upgBtn}>
                <Text style={styles.upgText}>Yükselt</Text>
              </Pressable>
            )}
          </SettingRow>
        </GlassmorphicCard>

        {/* About */}
        <Text style={styles.sectionTitle}>Hakkında</Text>
        <GlassmorphicCard style={styles.card} pressable={false} padding={Spacing['5']}>
          <Text style={styles.aboutTitle}>Refleks v1.0.0</Text>
          <Text style={styles.aboutDesc}>
            Refleks, refleksoloji bilgisini erişilebilir kılmak için tasarlanmış bir wellness uygulamasıdır.
          </Text>
          <Text style={[styles.aboutDesc, { marginTop: Spacing['3'], fontStyle: 'italic' }]}>
            ⚠️ Bu uygulama destekleyici rahatlama amaçlıdır. Tıbbi tanı veya tedavi yerine geçmez.
          </Text>
        </GlassmorphicCard>

        {/* Danger zone */}
        <Button
          label="Verileri Sıfırla"
          onPress={handleReset}
          variant="danger"
          fullWidth
          style={{ marginTop: Spacing['4'] }}
        />

        <View style={{ height: 80 }} />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing['5'], paddingTop: 60, paddingBottom: Spacing['4'], gap: Spacing['4'] },
  backBtn:   { padding: Spacing['2'] },
  backText:  { ...Typography.body, color: Palette.sageLight },
  title:     { ...Typography.h2, color: Palette.cream },

  scroll:    { paddingHorizontal: Spacing['5'], paddingTop: Spacing['4'] },

  sectionTitle: { ...Typography.overline, color: Palette.sageLight, marginBottom: Spacing['3'], marginTop: Spacing['2'] },
  card:      { marginBottom: Spacing['4'] },
  divider:   { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: Spacing['3'] },

  settingRow:     { flexDirection: 'row', alignItems: 'center', gap: Spacing['3'] },
  settingEmoji:   { fontSize: 22, width: 28 },
  settingInfo:    { flex: 1 },
  settingTitle:   { ...Typography.body, color: Palette.cream },
  settingSubtitle: { ...Typography.caption, color: Palette.slateMid, marginTop: 2 },

  namePill:     { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: BorderRadius.full, paddingHorizontal: Spacing['3'], paddingVertical: Spacing['1'] },
  namePillText: { ...Typography.caption, color: Palette.sageLight },

  segmented: { flexDirection: 'row', gap: 4, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: BorderRadius.lg, padding: 3 },
  segBtn:     { paddingHorizontal: Spacing['3'], paddingVertical: Spacing['1'], borderRadius: BorderRadius.md },
  segBtnActive: { backgroundColor: Palette.sage },
  segBtnText:   { ...Typography.label, color: Palette.slateMid },
  segBtnTextActive: { color: Palette.navy },

  apiKeyLabel:  { ...Typography.label, color: Palette.sageLight, marginBottom: Spacing['2'] },
  apiKeyDesc:   { ...Typography.caption, color: Palette.slateMid, lineHeight: 18, marginBottom: Spacing['3'] },
  apiKeyRow:    { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  apiKeyInput:  { padding: Spacing['3'], color: Palette.cream, ...Typography.body },
  apiKeyNote:   { ...Typography.caption, color: Palette.slateMid, marginTop: Spacing['3'], lineHeight: 16 },

  upgBtn: { backgroundColor: 'rgba(196,154,108,0.20)', borderRadius: BorderRadius.full, paddingHorizontal: Spacing['3'], paddingVertical: Spacing['1'], borderWidth: 1, borderColor: 'rgba(196,154,108,0.35)' },
  upgText: { ...Typography.caption, color: '#C49A6C' },

  aboutTitle: { ...Typography.h4, color: Palette.cream, marginBottom: Spacing['2'] },
  aboutDesc:  { ...Typography.body, color: Palette.slateMid, lineHeight: 22 },
});
