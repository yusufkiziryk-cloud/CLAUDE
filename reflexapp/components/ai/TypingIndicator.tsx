import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, withDelay,
} from 'react-native-reanimated';
import { Palette } from '../../constants/colors';
import { Spacing, BorderRadius } from '../../constants/spacing';

function Dot({ delay }: { delay: number }) {
  const translateY = useSharedValue(0);
  const opacity    = useSharedValue(0.4);

  useEffect(() => {
    translateY.value = withDelay(delay,
      withRepeat(
        withSequence(
          withTiming(-6, { duration: 300 }),
          withTiming( 0, { duration: 300 }),
        ),
        -1,
        false
      )
    );
    opacity.value = withDelay(delay,
      withRepeat(
        withSequence(
          withTiming(1.0, { duration: 300 }),
          withTiming(0.4, { duration: 300 }),
        ),
        -1,
        false
      )
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity:   opacity.value,
  }));

  return <Animated.View style={[styles.dot, style]} />;
}

export function TypingIndicator() {
  return (
    <View style={styles.container}>
      <View style={styles.bubble}>
        <View style={styles.dotsRow}>
          <Dot delay={0}   />
          <Dot delay={150} />
          <Dot delay={300} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection:  'row',
    paddingHorizontal: Spacing['4'],
    marginVertical:    Spacing['2'],
    alignItems:     'flex-end',
  },
  bubble: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth:      1,
    borderColor:     'rgba(255,255,255,0.10)',
    borderRadius:    BorderRadius.xl,
    borderBottomLeftRadius: BorderRadius.sm,
    padding:         Spacing['3'],
    paddingHorizontal: Spacing['4'],
  },
  dotsRow: {
    flexDirection: 'row',
    gap:           6,
    alignItems:    'center',
    height:        16,
  },
  dot: {
    width:           7,
    height:          7,
    borderRadius:    4,
    backgroundColor: Palette.sage,
  },
});
