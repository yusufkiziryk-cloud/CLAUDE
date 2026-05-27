import React from 'react';
import { StyleSheet, Pressable, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { BorderRadius } from '../../constants/spacing';

interface Props {
  children:   React.ReactNode;
  style?:     ViewStyle;
  onPress?:   () => void;
  intensity?: number;   // blur intensity 0-100
  tint?:      'dark' | 'light' | 'default' | 'extraLight';
  pressable?: boolean;
  padding?:   number;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function GlassmorphicCard({
  children,
  style,
  onPress,
  intensity = 20,
  tint      = 'dark',
  pressable = true,
  padding   = 16,
}: Props) {
  const scale   = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity:   opacity.value,
  }));

  const handlePressIn  = () => { scale.value = withSpring(0.97, { damping: 15, stiffness: 300 }); opacity.value = withTiming(0.9); };
  const handlePressOut = () => { scale.value = withSpring(1.0,  { damping: 15, stiffness: 300 }); opacity.value = withTiming(1.0); };

  const content = (
    <BlurView intensity={intensity} tint={tint} style={[styles.blur, { padding }]}>
      <View style={styles.inner}>
        {children}
      </View>
    </BlurView>
  );

  if (!pressable || !onPress) {
    return (
      <View style={[styles.container, style]}>
        {content}
      </View>
    );
  }

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.container, style, animStyle]}
    >
      {content}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius:    BorderRadius.xl,
    overflow:        'hidden',
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.12)',
  },
  blur: {
    borderRadius:    BorderRadius.xl,
  },
  inner: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
});
