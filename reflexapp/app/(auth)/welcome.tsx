import React, { useEffect } from 'react';
import { StyleSheet, Text, View, Dimensions, Pressable } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay,
  withRepeat, withSequence, Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Palette } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing, BorderRadius } from '../../constants/spacing';
import { BreathingOrb } from '../../components/ui/BreathingOrb';
import { Button } from '../../components/ui/Button';

const { width: W, height: H } = Dimensions.get('window');

const PARTICLES = Array.from({ length: 12 }, (_, i) => ({
  id: i, x: Math.random(), y: Math.random(), size: 2 + Math.random() * 4,
}));

export default function WelcomeScreen() {
  const titleO   = useSharedValue(0);
  const titleY   = useSharedValue(30);
  const subtitleO = useSharedValue(0);
  const btnO     = useSharedValue(0);

  useEffect(() => {
    titleO.value   = withDelay(400, withTiming(1, { duration: 800 }));
    titleY.value   = withDelay(400, withTiming(0, { duration: 800, easing: Easing.out(Easing.cubic) }));
    subtitleO.value = withDelay(900, withTiming(1, { duration: 700 }));
    btnO.value     = withDelay(1400, withTiming(1, { duration: 600 }));
  }, []);

  const titleStyle   = useAnimatedStyle(() => ({ opacity: titleO.value, transform: [{ translateY: titleY.value }] }));
  const subtitleStyle = useAnimatedStyle(() => ({ opacity: subtitleO.value }));
  const btnStyle     = useAnimatedStyle(() => ({ opacity: btnO.value }));

  return (
    <LinearGradient
      colors={['#0A1209', '#0F1E12', '#1A2A1F', Palette.navy]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.4, y: 1 }}
      style={styles.container}
    >
      {/* Floating particles */}
      {PARTICLES.map((p) => (
        <FloatingParticle key={p.id} x={p.x} y={p.y} size={p.size} delay={p.id * 200} />
      ))}

      {/* Main orb */}
      <View style={styles.orbWrapper}>
        <BreathingOrb size={180} inhale={4} hold={2} exhale={6} running />
      </View>

      {/* Title */}
      <Animated.View style={[styles.titleBlock, titleStyle]}>
        <Text style={styles.appName}>Refleks</Text>
        <Text style={styles.tagline}>Refleksoloji Asistanınız</Text>
      </Animated.View>

      {/* Subtitle / promise */}
      <Animated.View style={[styles.subtitleBlock, subtitleStyle]}>
        <Text style={styles.subtitle}>
          Ellerinizin gücüyle{'\n'}vücudunuzu dinleyin.
        </Text>
        <View style={styles.features}>
          {['🦶 İnteraktif Ayak Haritası', '🤖 AI Rehberlik', '📊 İlerleme Takibi'].map((f) => (
            <Text key={f} style={styles.featureItem}>{f}</Text>
          ))}
        </View>
      </Animated.View>

      {/* CTA */}
      <Animated.View style={[styles.btnBlock, btnStyle]}>
        <Button
          label="Yolculuğa Başla"
          onPress={() => router.push('/(auth)/onboarding')}
          fullWidth
          size="lg"
        />
        <Pressable
          onPress={() => router.push('/(tabs)')}
          style={styles.skipBtn}
        >
          <Text style={styles.skipText}>Atla ve keşfet →</Text>
        </Pressable>
      </Animated.View>

      {/* Disclaimer */}
      <Text style={styles.disclaimer}>
        Bu uygulama destekleyici rahatlama amaçlıdır.{'\n'}Tıbbi tanı veya tedavi yerine geçmez.
      </Text>
    </LinearGradient>
  );
}

function FloatingParticle({ x, y, size, delay }: { x: number; y: number; size: number; delay: number }) {
  const translateY = useSharedValue(0);
  const opacity    = useSharedValue(0.2 + Math.random() * 0.4);

  useEffect(() => {
    translateY.value = withDelay(delay,
      withRepeat(
        withSequence(
          withTiming(-20 - Math.random() * 30, { duration: 3000 + Math.random() * 2000 }),
          withTiming(0, { duration: 3000 + Math.random() * 2000 }),
        ),
        -1,
        true
      )
    );
    opacity.value = withDelay(delay,
      withRepeat(
        withSequence(
          withTiming(0.6, { duration: 2000 }),
          withTiming(0.1, { duration: 2000 }),
        ),
        -1,
        true
      )
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity:   opacity.value,
  }));

  return (
    <Animated.View style={[{
      position:        'absolute',
      left:            x * W,
      top:             y * H,
      width:           size,
      height:          size,
      borderRadius:    size,
      backgroundColor: Palette.sage,
    }, style]} />
  );
}

const styles = StyleSheet.create({
  container: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing['8'],
  },
  orbWrapper: {
    marginBottom: Spacing['10'],
  },
  titleBlock: {
    alignItems:   'center',
    marginBottom: Spacing['6'],
  },
  appName: {
    fontSize:      60,
    fontWeight:    '200',
    color:         Palette.cream,
    letterSpacing: -2,
    lineHeight:    64,
  },
  tagline: {
    ...Typography.body,
    color:         Palette.sageLight,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop:     Spacing['1'],
  },
  subtitleBlock: {
    alignItems:   'center',
    marginBottom: Spacing['10'],
  },
  subtitle: {
    ...Typography.h3,
    color:       Palette.creamDark,
    textAlign:   'center',
    fontWeight:  '300',
    marginBottom: Spacing['5'],
  },
  features: {
    gap: Spacing['2'],
    alignItems: 'center',
  },
  featureItem: {
    ...Typography.body,
    color: Palette.slateLight,
  },
  btnBlock: {
    width:        '100%',
    alignItems:   'center',
    marginBottom: Spacing['5'],
  },
  skipBtn: {
    marginTop: Spacing['3'],
    padding:   Spacing['2'],
  },
  skipText: {
    ...Typography.bodySmall,
    color: Palette.slateMid,
  },
  disclaimer: {
    ...Typography.caption,
    color:     Palette.slateMid,
    textAlign: 'center',
    position:  'absolute',
    bottom:    Spacing['6'],
    fontStyle: 'italic',
  },
});
