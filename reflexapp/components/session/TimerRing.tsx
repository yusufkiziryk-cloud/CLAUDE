import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { useAnimatedProps, useDerivedValue } from 'react-native-reanimated';
import { Palette } from '../../constants/colors';
import { Typography } from '../../constants/typography';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  elapsed:   number;  // seconds elapsed
  duration:  number;  // total seconds
  size?:     number;
  color?:    string;
  label?:    string;
}

export function TimerRing({ elapsed, duration, size = 140, color = Palette.sage, label }: Props) {
  const strokeWidth = 8;
  const radius      = (size - strokeWidth * 2) / 2;
  const circumf     = 2 * Math.PI * radius;
  const progress    = Math.min(elapsed / Math.max(duration, 1), 1);
  const dashOffset  = circumf * (1 - progress);

  const remaining   = Math.max(duration - elapsed, 0);
  const mins        = Math.floor(remaining / 60);
  const secs        = remaining % 60;
  const timeStr     = mins > 0
    ? `${mins}:${secs.toString().padStart(2, '0')}`
    : `${secs}s`;

  const cx = size / 2;
  const cy = size / 2;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {/* Background track */}
        <Circle
          cx={cx} cy={cy} r={radius}
          strokeWidth={strokeWidth}
          stroke="rgba(255,255,255,0.08)"
          fill="none"
        />
        {/* Progress arc */}
        <Circle
          cx={cx} cy={cy} r={radius}
          strokeWidth={strokeWidth}
          stroke={color}
          strokeDasharray={`${circumf} ${circumf}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          fill="none"
          transform={`rotate(-90, ${cx}, ${cy})`}
        />
      </Svg>

      {/* Center content */}
      <View style={styles.center}>
        <Text style={[styles.time, { color }]}>{timeStr}</Text>
        {label && <Text style={styles.label} numberOfLines={2}>{label}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems:     'center',
    justifyContent: 'center',
  },
  center: {
    alignItems:  'center',
    paddingHorizontal: 12,
  },
  time: {
    ...Typography.h2,
    fontWeight: '300',
    letterSpacing: -1,
  },
  label: {
    ...Typography.caption,
    color:     Palette.sageLight,
    textAlign: 'center',
    marginTop: 4,
  },
});
