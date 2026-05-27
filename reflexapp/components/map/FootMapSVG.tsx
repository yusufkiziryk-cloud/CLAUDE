import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import Svg, {
  Path, Circle, G, Defs, RadialGradient, Stop, Filter, FeGaussianBlur,
  Ellipse, Rect,
} from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, withRepeat,
  withSequence, Easing,
} from 'react-native-reanimated';
import { ReflexZone } from '../../types';
import { FOOT_ZONES } from '../../constants/zones';
import { Palette } from '../../constants/colors';
import { HapticService } from '../../services/hapticService';

interface Props {
  side:         'left' | 'right';
  onZonePress:  (zone: ReflexZone) => void;
  activeZoneId?: string;
}

const { width: SCREEN_W } = Dimensions.get('window');
const SVG_W   = Math.min(SCREEN_W - 32, 340);
const SVG_H   = SVG_W * 2.1;

// Foot outline path — artistic representation
// Coordinates normalized for a 200×420 viewBox
const FOOT_OUTLINE_LEFT = `
  M 100,8
  C 85,5 68,10 58,22
  C 48,34 45,48 48,62
  C 50,72 52,80 54,85
  C 40,88 30,85 22,80
  C 12,74 8,65 10,55
  C 12,45 18,38 26,36
  C 16,28 12,18 16,10
  C 20,2 30,0 38,4
  C 42,6 45,10 46,14
  C 48,8 54,2 62,2
  C 70,2 76,6 78,12
  C 80,6 86,2 92,2
  C 98,2 104,6 106,12
  C 112,4 122,2 128,6
  C 136,10 138,20 134,28
  C 130,34 124,38 118,40
  C 126,48 130,58 128,68
  C 126,78 118,86 110,90
  C 102,94 92,95 82,95
  C 70,95 60,92 52,88
  C 56,100 60,115 60,130
  C 60,148 54,162 48,175
  C 42,188 35,198 30,210
  C 24,224 20,238 18,252
  C 15,268 15,285 18,300
  C 21,315 27,328 35,338
  C 43,348 53,355 65,360
  C 75,364 87,366 100,366
  C 113,366 125,364 135,360
  C 147,355 157,348 163,338
  C 171,328 175,315 176,300
  C 177,285 176,268 173,252
  C 170,236 165,222 158,210
  C 152,198 145,188 139,175
  C 133,162 128,148 128,130
  C 128,115 132,100 136,88
  C 126,94 116,96 106,96
  L 106,95
  C 110,92 114,88 118,84
  C 122,80 124,74 124,68
  C 124,62 122,56 118,52
  L 118,50
  C 124,46 128,40 130,34
  C 132,26 130,18 124,12
  C 120,8 114,6 108,8
  C 104,4 100,8 100,8
  Z
`;

// Zone marker positions (x, y in 200×420 coordinate space)
const ZONE_POSITIONS: Record<string, { x: number; y: number; r: number }> = {
  brain:        { x: 100, y: 28,  r: 16 },
  pituitary:    { x: 100, y: 44,  r:  8 },
  sinus:        { x: 74,  y: 38,  r: 10 },
  neck:         { x: 100, y: 72,  r: 12 },
  lung:         { x: 84,  y: 115, r: 15 },
  heart:        { x: 64,  y: 118, r: 12 },
  stomach:      { x: 94,  y: 168, r: 14 },
  liver:        { x: 120, y: 172, r: 14 },
  kidney:       { x: 98,  y: 210, r: 12 },
  intestine:    { x: 100, y: 255, r: 18 },
  spine:        { x: 30,  y: 200, r: 10 },
  sciatic:      { x: 100, y: 340, r: 14 },
  uterus_ovary: { x: 42,  y: 345, r: 12 },
};

function ZoneMarker({
  zone,
  x, y, r,
  isActive,
  onPress,
}: {
  zone:     ReflexZone;
  x:        number;
  y:        number;
  r:        number;
  isActive: boolean;
  onPress:  () => void;
}) {
  const scale = useSharedValue(1);

  React.useEffect(() => {
    if (isActive) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.25, { duration: 700, easing: Easing.inOut(Easing.sine) }),
          withTiming(1.00, { duration: 700, easing: Easing.inOut(Easing.sine) }),
        ),
        -1,
        false
      );
    } else {
      scale.value = withSpring(1);
    }
  }, [isActive]);

  return (
    <G onPress={onPress}>
      {/* Glow ring */}
      <Circle
        cx={x} cy={y}
        r={r * 1.8}
        fill={zone.glowColor}
        opacity={isActive ? 0.7 : 0.3}
      />
      {/* Main dot */}
      <Circle
        cx={x} cy={y}
        r={r}
        fill={zone.color}
        opacity={isActive ? 1 : 0.85}
        strokeWidth={isActive ? 2 : 1}
        stroke={isActive ? Palette.cream : 'rgba(255,255,255,0.3)'}
      />
      {/* Inner highlight */}
      <Circle
        cx={x - r * 0.25}
        cy={y - r * 0.25}
        r={r * 0.35}
        fill="rgba(255,255,255,0.35)"
      />
    </G>
  );
}

export function FootMapSVG({ side, onZonePress, activeZoneId }: Props) {
  const [pressedZoneId, setPressedZoneId] = useState<string | null>(null);

  const handleZonePress = useCallback(async (zone: ReflexZone) => {
    setPressedZoneId(zone.id);
    await HapticService.zonePulse();
    onZonePress(zone);
    setTimeout(() => setPressedZoneId(null), 1000);
  }, [onZonePress]);

  // Mirror x for right foot
  const mirrorX = (x: number) => side === 'right' ? 200 - x : x;

  return (
    <View style={[styles.container, { width: SVG_W, height: SVG_H }]}>
      <Svg
        width={SVG_W}
        height={SVG_H}
        viewBox="0 0 200 420"
      >
        <Defs>
          {/* Foot fill gradient */}
          <RadialGradient id="footGrad" cx="50%" cy="30%" r="65%">
            <Stop offset="0%"   stopColor="#3A4A3E" stopOpacity="1" />
            <Stop offset="60%"  stopColor="#2A3A2E" stopOpacity="1" />
            <Stop offset="100%" stopColor="#1A2A1E" stopOpacity="1" />
          </RadialGradient>

          {/* Zone glow gradients */}
          {FOOT_ZONES.map((zone) => (
            <RadialGradient key={`grad-${zone.id}`} id={`glow-${zone.id}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0%"   stopColor={zone.color}     stopOpacity="0.8" />
              <Stop offset="100%" stopColor={zone.glowColor} stopOpacity="0"   />
            </RadialGradient>
          ))}
        </Defs>

        {/* Mirror group for right foot */}
        <G transform={side === 'right' ? 'scale(-1,1) translate(-200,0)' : undefined}>
          {/* Foot shadow */}
          <Ellipse cx="100" cy="400" rx="55" ry="8" fill="rgba(0,0,0,0.25)" />

          {/* Foot body */}
          <Path
            d={FOOT_OUTLINE_LEFT}
            fill="url(#footGrad)"
            stroke="rgba(124,152,133,0.30)"
            strokeWidth="1.5"
          />

          {/* Toe lines */}
          <Path d="M 58,60 C 56,78 54,90 52,100" stroke="rgba(255,255,255,0.08)" strokeWidth="1" fill="none" />
          <Path d="M 76,50 C 74,68 72,82 70,94"  stroke="rgba(255,255,255,0.08)" strokeWidth="1" fill="none" />
          <Path d="M 92,46 C 90,64 88,80 86,92"  stroke="rgba(255,255,255,0.08)" strokeWidth="1" fill="none" />
          <Path d="M 108,46 C 106,64 104,80 102,92" stroke="rgba(255,255,255,0.08)" strokeWidth="1" fill="none" />

          {/* Arch line */}
          <Path d="M 30,90 C 25,150 22,220 25,290" stroke="rgba(255,255,255,0.06)" strokeWidth="1" fill="none" />

          {/* Zone markers */}
          {FOOT_ZONES.map((zone) => {
            const pos = ZONE_POSITIONS[zone.id];
            if (!pos) return null;

            // Skip heart on right foot (heart is only on left)
            if (zone.id === 'heart'  && side === 'right') return null;
            if (zone.id === 'liver'  && side === 'left')  return null;

            const isActive = activeZoneId === zone.id || pressedZoneId === zone.id;

            return (
              <ZoneMarker
                key={zone.id}
                zone={zone}
                x={pos.x}
                y={pos.y}
                r={pos.r}
                isActive={isActive}
                onPress={() => handleZonePress(zone)}
              />
            );
          })}
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
  },
});
