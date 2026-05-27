import React, { useState, useRef } from 'react';
import { StyleSheet, Text, View, Dimensions, ScrollView, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Palette } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing, BorderRadius } from '../../constants/spacing';
import { Button } from '../../components/ui/Button';
import { BreathingOrb } from '../../components/ui/BreathingOrb';
import { useUserStore } from '../../stores/useUserStore';

const { width: W } = Dimensions.get('window');

interface OnboardingStep {
  id:       number;
  emoji:    string;
  title:    string;
  subtitle: string;
  content:  React.ReactNode;
}

export default function OnboardingScreen() {
  const [step, setStep]     = useState(0);
  const [name, setName]     = useState('');
  const { setProfile, completeOnboarding } = useUserStore();

  const steps: OnboardingStep[] = [
    {
      id:       0,
      emoji:    '🦶',
      title:    'Refleksoloji Nedir?',
      subtitle: 'Binlerce yıllık bilgelik',
      content:  (
        <View style={styles.stepContent}>
          <Text style={styles.bodyText}>
            Refleksoloji, ayak, el ve kulaktaki basınç noktalarını uyararak vücudun doğal iyileşme süreçlerini destekleyen tamamlayıcı bir terapidir.
          </Text>
          <View style={styles.factCards}>
            {[
              { emoji: '🌏', text: '5000+ yıllık geçmişi var' },
              { emoji: '🗺',  text: 'Tüm vücut ayak tabanına yansır' },
              { emoji: '💆', text: 'Stresi anında azaltır' },
              { emoji: '🔬', text: 'Bilimsel çalışmalarla desteklenir' },
            ].map((f) => (
              <View key={f.text} style={styles.factCard}>
                <Text style={styles.factEmoji}>{f.emoji}</Text>
                <Text style={styles.factText}>{f.text}</Text>
              </View>
            ))}
          </View>
        </View>
      ),
    },
    {
      id:       1,
      emoji:    '👣',
      title:    'Nasıl Çalışır?',
      subtitle: 'Bilim ve doğanın birleşimi',
      content:  (
        <View style={styles.stepContent}>
          <BreathingOrb size={120} inhale={3} hold={1} exhale={5} running />
          <Text style={[styles.bodyText, { marginTop: Spacing['5'] }]}>
            Vücudun tüm organları ayak tabanındaki bölgelere karşılık gelir. Bu noktalara uygulanan basınç:
          </Text>
          <View style={styles.steps}>
            {[
              'Kan dolaşımını artırır',
              'Sinir iletimini uyarır',
              'Lenfatik sistemi temizler',
              'Vücut dengesini (homeostaz) destekler',
            ].map((s, i) => (
              <View key={i} style={styles.stepItem}>
                <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
                <Text style={styles.stepItemText}>{s}</Text>
              </View>
            ))}
          </View>
        </View>
      ),
    },
    {
      id:       2,
      emoji:    '🌟',
      title:    'Sizi Tanıyalım',
      subtitle: 'Kişiselleştirilmiş deneyim',
      content:  (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.stepContent}>
          <Text style={styles.bodyText}>
            Adınızı girerek kişiselleştirilmiş bir refleksoloji deneyimi başlatın.
          </Text>
          <TextInput
            style={styles.nameInput}
            placeholder="Adınız"
            placeholderTextColor={Palette.slateMid}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoFocus={false}
          />
          <Text style={styles.privacy}>
            🔒 Verileriniz yalnızca cihazınızda saklanır.
          </Text>
        </KeyboardAvoidingView>
      ),
    },
    {
      id:       3,
      emoji:    '⚠️',
      title:    'Önemli Bilgi',
      subtitle: 'Güvenliğiniz için',
      content:  (
        <View style={styles.stepContent}>
          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>Bu uygulama hakkında</Text>
            <Text style={styles.warningText}>
              • Destekleyici rahatlama aracıdır{'\n'}
              • Tıbbi tanı koymaz{'\n'}
              • İlaç veya tedavinin yerini almaz{'\n'}
              • Ciddi rahatsızlıklarda doktora gidin{'\n'}
              • Hamilelikte dikkatli kullanın
            </Text>
          </View>
          <Text style={[styles.bodyText, { marginTop: Spacing['4'] }]}>
            Bu bilgileri anlıyor ve kabul ediyorum. Refleksoloji tamamlayıcı bir terapi olarak kullanacağım.
          </Text>
        </View>
      ),
    },
  ];

  const currentStep = steps[step];
  const isLast      = step === steps.length - 1;

  const handleNext = () => {
    if (isLast) {
      // Save profile and complete onboarding
      setProfile({
        id:                   `user_${Date.now()}`,
        name:                 name.trim() || 'Ziyaretçi',
        isPremium:            false,
        language:             'tr',
        theme:                'dark',
        notificationsEnabled: true,
        hapticEnabled:        true,
        soundEnabled:         true,
        onboardingCompleted:  true,
        joinedAt:             new Date().toISOString(),
      });
      router.replace('/(tabs)');
    } else {
      setStep((s) => s + 1);
    }
  };

  return (
    <LinearGradient
      colors={['#0A1209', '#0F1E12', '#1A2A1F']}
      style={styles.container}
    >
      {/* Progress dots */}
      <View style={styles.dots}>
        {steps.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === step && styles.dotActive, i < step && styles.dotDone]}
          />
        ))}
      </View>

      {/* Content */}
      <Animated.View key={step} entering={FadeIn.duration(350)} exiting={FadeOut.duration(200)} style={styles.content}>
        <Text style={styles.emoji}>{currentStep.emoji}</Text>
        <Text style={styles.title}>{currentStep.title}</Text>
        <Text style={styles.subtitle}>{currentStep.subtitle}</Text>
        {currentStep.content}
      </Animated.View>

      {/* Buttons */}
      <View style={styles.buttons}>
        {step > 0 && (
          <Button
            label="Geri"
            onPress={() => setStep((s) => s - 1)}
            variant="ghost"
            style={{ flex: 1, marginRight: Spacing['2'] }}
          />
        )}
        <Button
          label={isLast ? '✓ Başla' : 'Devam →'}
          onPress={handleNext}
          fullWidth={step === 0}
          style={{ flex: step > 0 ? 2 : undefined }}
          disabled={step === 2 && name.trim().length === 0}
        />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex:               1,
    paddingHorizontal:  Spacing['6'],
    paddingTop:         Spacing['16'],
    paddingBottom:      Spacing['8'],
  },
  dots: {
    flexDirection: 'row',
    gap:           Spacing['2'],
    marginBottom:  Spacing['10'],
    alignSelf:     'center',
  },
  dot: {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: 'rgba(255,255,255,0.20)',
  },
  dotActive: {
    width:           24,
    backgroundColor: Palette.sage,
  },
  dotDone: {
    backgroundColor: Palette.sageDark,
  },
  content: {
    flex: 1,
  },
  emoji: {
    fontSize:     48,
    marginBottom: Spacing['3'],
  },
  title: {
    ...Typography.h1,
    color:        Palette.cream,
    marginBottom: Spacing['1'],
  },
  subtitle: {
    ...Typography.body,
    color:        Palette.sageLight,
    marginBottom: Spacing['6'],
  },
  stepContent: {
    flex: 1,
  },
  bodyText: {
    ...Typography.body,
    color:      Palette.creamDark,
    lineHeight: 24,
  },
  factCards: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           Spacing['3'],
    marginTop:     Spacing['5'],
  },
  factCard: {
    width:           (W - Spacing['6'] * 2 - Spacing['3']) / 2,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius:    BorderRadius.lg,
    padding:         Spacing['4'],
    gap:             Spacing['2'],
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.08)',
  },
  factEmoji: { fontSize: 28 },
  factText: {
    ...Typography.bodySmall,
    color: Palette.creamDark,
  },
  steps: {
    marginTop: Spacing['4'],
    gap:       Spacing['3'],
  },
  stepItem: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing['3'],
  },
  stepNum: {
    width:           28,
    height:          28,
    borderRadius:    14,
    backgroundColor: 'rgba(124,152,133,0.25)',
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  stepNumText: {
    ...Typography.label,
    color:      Palette.sage,
    fontWeight: '700',
  },
  stepItemText: {
    ...Typography.body,
    color: Palette.creamDark,
    flex:  1,
  },
  nameInput: {
    backgroundColor:  'rgba(255,255,255,0.08)',
    borderRadius:     BorderRadius.xl,
    padding:          Spacing['4'],
    color:            Palette.cream,
    fontSize:         18,
    marginTop:        Spacing['6'],
    borderWidth:      1,
    borderColor:      'rgba(124,152,133,0.30)',
  },
  privacy: {
    ...Typography.caption,
    color:     Palette.slateMid,
    marginTop: Spacing['3'],
    textAlign: 'center',
  },
  warningBox: {
    backgroundColor: 'rgba(240,165,0,0.08)',
    borderRadius:    BorderRadius.xl,
    padding:         Spacing['5'],
    borderWidth:     1,
    borderColor:     'rgba(240,165,0,0.20)',
    marginBottom:    Spacing['3'],
  },
  warningTitle: {
    ...Typography.h4,
    color:        '#F5A623',
    marginBottom: Spacing['3'],
  },
  warningText: {
    ...Typography.body,
    color:      Palette.creamDark,
    lineHeight: 26,
  },
  buttons: {
    flexDirection: 'row',
    gap:           Spacing['2'],
    marginTop:     Spacing['4'],
  },
});
