import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedProps, withTiming, Easing,
} from 'react-native-reanimated';
import { Palette } from '../../constants/colors';
import { Typography } from '../../constants/typography';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  score:    number; // 0-100
  size?:    number;
  label?:   string;
}

function getScoreColor(score: number): string {
  if (score >= 75) return Palette.sage;
  if (score >= 50) return '#C4A840';
  if (score >= 25) return '#C47840';
  return '#C44040';
}

function getScoreLabel(score: number, lang = 'tr'): string {
  if (score >= 80) return lang === 'tr' ? 'Mükemmel' : 'Excellent';
  if (score >= 65) return lang === 'tr' ? 'İyi'      : 'Good';
  if (score >= 45) return lang === 'tr' ? 'Orta'     : 'Fair';
  return                  lang === 'tr' ? 'Düşük'    : 'Low';
}

export function WellnessScoreRing({ score, size = 120, label }: Props) {
  const strokeWidth = 10;
  const radius      = (size - strokeWidth * 2) / 2;
  const circumf     = 2 * Math.PI * radius;
  const color       = getScoreColor(score);
  const cx          = size / 2;
  const cy          = size / 2;

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(score / 100, { duration: 1200, easing: Easing.out(Easing.cubic) });
  }, [score]);

  const animProps = useAnimatedProps(() => ({
    strokeDashoffset: circumf * (1 - progress.value),
  }));

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={color}         stopOpacity="1" />
            <Stop offset="100%" stopColor={color + '88'} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        {/* Track */}
        <Circle
          cx={cx} cy={cy} r={radius}
          strokeWidth={strokeWidth}
          stroke="rgba(255,255,255,0.07)"
          fill="none"
        />
        {/* Progress */}
        <AnimatedCircle
          cx={cx} cy={cy} r={radius}
          strokeWidth={strokeWidth}
          stroke="url(#scoreGrad)"
          strokeDasharray={`${circumf} ${circumf}`}
          strokeLinecap="round"
          fill="none"
          transform={`rotate(-90, ${cx}, ${cy})`}
          animatedProps={animProps}
        />
      </Svg>

      <View style={styles.center}>
        <Text style={[styles.score, { color }]}>{score}</Text>
        <Text style={styles.scoreLabel}>{getScoreLabel(score)}</Text>
        {label ? <Text style={styles.subLabel}>{label}</Text> : null}
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
    alignItems: 'center',
  },
  score: {
    ...Typography.h1,
    fontWeight: '300',
    letterSpacing: -2,
    lineHeight:    34,
  },
  scoreLabel: {
    ...Typography.caption,
    color:  Palette.sageLight,
    marginTop: 2,
  },
  subLabel: {
    ...Typography.caption,
    color:  Palette.slateMid,
    marginTop: 1,
  },
});
