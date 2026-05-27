import React from 'react';
import { StyleSheet, Text, ViewStyle, TextStyle, Pressable, ActivityIndicator } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Palette } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { BorderRadius, Spacing } from '../../constants/spacing';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size    = 'sm' | 'md' | 'lg';

interface Props {
  label:      string;
  onPress:    () => void;
  variant?:   Variant;
  size?:      Size;
  loading?:   boolean;
  disabled?:  boolean;
  fullWidth?: boolean;
  icon?:      React.ReactNode;
  style?:     ViewStyle;
  textStyle?: TextStyle;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SIZE_MAP = {
  sm: { paddingV: Spacing['2'], paddingH: Spacing['4'], fontSize: 13, height: 36 },
  md: { paddingV: Spacing['3'], paddingH: Spacing['6'], fontSize: 15, height: 48 },
  lg: { paddingV: Spacing['4'], paddingH: Spacing['8'], fontSize: 17, height: 56 },
} as const;

export function Button({
  label,
  onPress,
  variant    = 'primary',
  size       = 'md',
  loading    = false,
  disabled   = false,
  fullWidth  = false,
  icon,
  style,
  textStyle,
}: Props) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn  = () => { scale.value = withSpring(0.96, { damping: 15 }); };
  const handlePressOut = () => { scale.value = withSpring(1.00, { damping: 15 }); };

  const sz = SIZE_MAP[size];
  const isDisabled = disabled || loading;

  const renderContent = () => (
    <>
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'primary' ? Palette.navy : Palette.sage} />
      ) : (
        <>
          {icon}
          <Text style={[
            styles.label,
            { fontSize: sz.fontSize, marginLeft: icon ? Spacing['2'] : 0 },
            variant === 'secondary' && styles.labelSecondary,
            variant === 'ghost'     && styles.labelGhost,
            variant === 'danger'    && styles.labelDanger,
            isDisabled              && styles.labelDisabled,
            textStyle,
          ]}>
            {label}
          </Text>
        </>
      )}
    </>
  );

  const containerStyle: ViewStyle[] = [
    styles.base,
    { height: sz.height, paddingHorizontal: sz.paddingH },
    fullWidth && styles.fullWidth,
    isDisabled && styles.disabled,
    style as ViewStyle,
  ];

  if (variant === 'primary') {
    return (
      <AnimatedPressable
        onPress={isDisabled ? undefined : onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[animStyle, containerStyle]}
        accessible
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <LinearGradient
          colors={isDisabled ? ['#3A4A3E', '#2A3A2E'] : [Palette.sage, Palette.sageDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {renderContent()}
        </LinearGradient>
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable
      onPress={isDisabled ? undefined : onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        animStyle,
        containerStyle,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost'     && styles.ghost,
        variant === 'danger'    && styles.danger,
      ]}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {renderContent()}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius:    BorderRadius['2xl'],
    alignItems:      'center',
    justifyContent:  'center',
    flexDirection:   'row',
    overflow:        'hidden',
  },
  fullWidth: {
    width: '100%',
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
    alignItems:     'center',
    justifyContent: 'center',
    flexDirection:  'row',
    paddingHorizontal: Spacing['5'],
  },
  secondary: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.15)',
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: 'rgba(224,82,82,0.15)',
    borderWidth:     1,
    borderColor:     'rgba(224,82,82,0.30)',
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    ...Typography.button,
    color:      Palette.cream,
    textAlign:  'center',
  },
  labelSecondary: {
    color: Palette.sageLight,
  },
  labelGhost: {
    color: Palette.slateLight,
  },
  labelDanger: {
    color: '#E05252',
  },
  labelDisabled: {
    color: Palette.slateMid,
  },
});
