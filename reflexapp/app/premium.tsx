import React from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Palette } from '../constants/colors';
import { Typography } from '../constants/typography';
import { Spacing, BorderRadius } from '../constants/spacing';
import { Button } from '../components/ui/Button';
import { useUserStore } from '../stores/useUserStore';

const FEATURES = [
  { emoji: '🎯', title: 'Tüm Seanslar',       desc: '20+ rehberli refleksoloji seansı' },
  { emoji: '🤖', title: 'Gelişmiş AI',         desc: 'Claude destekli kişisel rehber' },
  { emoji: '📊', title: 'Detaylı Analiz',      desc: 'Haftalık ve aylık wellness raporu' },
  { emoji: '🎵', title: 'Premium Müzikler',    desc: 'Zen meditasyon müzik koleksiyonu' },
  { emoji: '🔔', title: 'Akıllı Bildirimler',  desc: 'Kişiselleştirilmiş wellness hatırlatıcıları' },
  { emoji: '🌐', title: 'Çevrimdışı Kullanım', desc: 'İnternet olmadan tam erişim' },
  { emoji: '📱', title: 'Sınırsız Seans',      desc: 'Günlük limit yok' },
  { emoji: '💬', title: 'Öncelikli Destek',    desc: 'Premium müşteri hizmeti' },
];

const PLANS = [
  {
    id:     'monthly',
    label:  'Aylık',
    price:  '₺49',
    period: '/ ay',
    badge:  null,
  },
  {
    id:     'yearly',
    label:  'Yıllık',
    price:  '₺299',
    period: '/ yıl',
    badge:  '🔥 %49 İndirim',
  },
];

export default function PremiumScreen() {
  const [selectedPlan, setSelectedPlan] = React.useState('yearly');
  const updateProfile = useUserStore((s) => s.updateProfile);

  const handleSubscribe = () => {
    // In a real app, this would trigger in-app purchase
    // For demo purposes, we'll unlock premium directly
    updateProfile({ isPremium: true });
    router.back();
  };

  return (
    <LinearGradient
      colors={['#1A0E00', '#2A1A08', '#1A0E00']}
      style={styles.container}
    >
      {/* Close button */}
      <Pressable onPress={() => router.back()} style={styles.closeBtn}>
        <Text style={styles.closeBtnText}>✕</Text>
      </Pressable>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <Animated.View entering={FadeInDown.duration(500)} style={styles.hero}>
          <Text style={styles.heroEmoji}>✦</Text>
          <Text style={styles.heroTitle}>Refleks Premium</Text>
          <Text style={styles.heroSubtitle}>
            Tam wellness deneyimi için her şeyin kilidi açık
          </Text>
        </Animated.View>

        {/* Feature list */}
        <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.featureGrid}>
          {FEATURES.map((f) => (
            <View key={f.title} style={styles.featureCard}>
              <BlurView intensity={15} tint="dark" style={styles.featureBlur}>
                <Text style={styles.featureEmoji}>{f.emoji}</Text>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </BlurView>
            </View>
          ))}
        </Animated.View>

        {/* Plan selector */}
        <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.plans}>
          <Text style={styles.plansTitle}>Plan Seç</Text>
          {PLANS.map((plan) => (
            <Pressable
              key={plan.id}
              onPress={() => setSelectedPlan(plan.id)}
              style={[styles.planCard, selectedPlan === plan.id && styles.planCardActive]}
            >
              <View style={styles.planLeft}>
                <Text style={[styles.planLabel, selectedPlan === plan.id && { color: '#C49A6C' }]}>
                  {plan.label}
                </Text>
                {plan.badge && (
                  <View style={styles.planBadge}>
                    <Text style={styles.planBadgeText}>{plan.badge}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.planPrice, selectedPlan === plan.id && { color: '#C49A6C' }]}>
                {plan.price}
                <Text style={styles.planPeriod}>{plan.period}</Text>
              </Text>
            </Pressable>
          ))}
        </Animated.View>

        {/* CTA */}
        <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.cta}>
          <LinearGradient
            colors={['#C49A6C', '#A87848', '#C49A6C']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.ctaGradient}
          >
            <Pressable onPress={handleSubscribe} style={styles.ctaBtn}>
              <Text style={styles.ctaBtnText}>
                ✦ Premium'u Başlat
              </Text>
            </Pressable>
          </LinearGradient>
          <Text style={styles.ctaNote}>
            3 günlük ücretsiz deneme · İstediğinizde iptal edin
          </Text>
        </Animated.View>

        {/* Legal */}
        <Text style={styles.legal}>
          Ödeme Apple/Google aracılığıyla gerçekleşir. Abonelik, deneme süresi sonunda otomatik olarak yenilenir.
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  closeBtn:  { position: 'absolute', top: 56, right: Spacing['5'], zIndex: 10, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { color: Palette.cream, fontSize: 16 },

  scroll:   { paddingHorizontal: Spacing['5'], paddingTop: 80, paddingBottom: Spacing['8'] },

  hero:        { alignItems: 'center', marginBottom: Spacing['8'] },
  heroEmoji:   { fontSize: 48, color: '#C49A6C', marginBottom: Spacing['3'] },
  heroTitle:   { ...Typography.hero, color: Palette.cream, textAlign: 'center' },
  heroSubtitle: { ...Typography.body, color: '#C49A6C', textAlign: 'center', marginTop: Spacing['2'], lineHeight: 24 },

  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing['3'], marginBottom: Spacing['6'] },
  featureCard: { width: '47%', borderRadius: BorderRadius.xl, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(196,154,108,0.20)' },
  featureBlur: { padding: Spacing['4'], gap: Spacing['1'] },
  featureEmoji: { fontSize: 26, marginBottom: Spacing['1'] },
  featureTitle: { ...Typography.label, color: '#C49A6C' },
  featureDesc:  { ...Typography.caption, color: Palette.slateMid, lineHeight: 16 },

  plans:      { gap: Spacing['3'], marginBottom: Spacing['6'] },
  plansTitle: { ...Typography.h3, color: Palette.cream, marginBottom: Spacing['2'] },
  planCard:   { borderRadius: BorderRadius.xl, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.10)', padding: Spacing['4'], flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.04)' },
  planCardActive: { borderColor: '#C49A6C', backgroundColor: 'rgba(196,154,108,0.08)' },
  planLeft:   { gap: Spacing['1'] },
  planLabel:  { ...Typography.h4, color: Palette.cream },
  planBadge:  { backgroundColor: 'rgba(196,154,108,0.20)', borderRadius: BorderRadius.full, paddingHorizontal: Spacing['3'], paddingVertical: 2 },
  planBadgeText: { ...Typography.caption, color: '#C49A6C', fontWeight: '700' },
  planPrice:  { ...Typography.h2, color: Palette.cream, fontWeight: '300' },
  planPeriod: { ...Typography.body, color: Palette.slateMid, fontWeight: '400' },

  cta:          { gap: Spacing['3'] },
  ctaGradient:  { borderRadius: BorderRadius['2xl'], overflow: 'hidden' },
  ctaBtn:       { paddingVertical: Spacing['4'], alignItems: 'center' },
  ctaBtnText:   { ...Typography.button, color: '#1A0800', fontSize: 18, letterSpacing: 1 },
  ctaNote:      { ...Typography.bodySmall, color: Palette.slateMid, textAlign: 'center' },

  legal: { ...Typography.caption, color: Palette.slateMid, textAlign: 'center', marginTop: Spacing['6'], lineHeight: 18, fontStyle: 'italic' },
});
