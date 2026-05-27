import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Palette } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing, BorderRadius } from '../../constants/spacing';

interface MoodOption {
  value: number;
  emoji: string;
  label: string;
}

const MOODS: MoodOption[] = [
  { value: 1, emoji: '😞', label: 'Kötü'      },
  { value: 2, emoji: '😕', label: 'Yorgun'    },
  { value: 3, emoji: '😐', label: 'Normal'    },
  { value: 4, emoji: '🙂', label: 'İyi'       },
  { value: 5, emoji: '😄', label: 'Harika'    },
];

const STRESS_LEVELS = [
  { value: 1, emoji: '🌿', label: 'Yok',      color: Palette.sage      },
  { value: 2, emoji: '😌', label: 'Az',        color: Palette.sageLight },
  { value: 3, emoji: '😐', label: 'Orta',      color: '#C4A840'         },
  { value: 4, emoji: '😰', label: 'Yüksek',    color: '#C47840'         },
  { value: 5, emoji: '😩', label: 'Çok Yüksek', color: '#C44040'        },
];

const SLEEP_QUALITY = [
  { value: 1, emoji: '😵', label: 'Berbat'   },
  { value: 2, emoji: '😪', label: 'Kötü'     },
  { value: 3, emoji: '😐', label: 'Orta'     },
  { value: 4, emoji: '😴', label: 'İyi'      },
  { value: 5, emoji: '🌟', label: 'Harika'   },
];

interface PickerProps {
  title:       string;
  options:     MoodOption[];
  selected:    number | null;
  onSelect:    (value: number) => void;
  accentColor?: string;
}

function EmojiPicker({ title, options, selected, onSelect, accentColor = Palette.sage }: PickerProps) {
  return (
    <View style={styles.pickerContainer}>
      <Text style={styles.pickerTitle}>{title}</Text>
      <View style={styles.optionsRow}>
        {options.map((opt) => {
          const isSelected = selected === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onSelect(opt.value)}
              style={[
                styles.optionBtn,
                isSelected && [styles.optionBtnSelected, { borderColor: accentColor, backgroundColor: accentColor + '18' }],
              ]}
            >
              <Text style={styles.optionEmoji}>{opt.emoji}</Text>
              <Text style={[styles.optionLabel, isSelected && { color: accentColor }]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

interface Props {
  moodLevel?:   number | null;
  stressLevel?: number | null;
  sleepQuality?: number | null;
  onMoodChange?:   (v: number) => void;
  onStressChange?: (v: number) => void;
  onSleepChange?:  (v: number) => void;
}

export function MoodPicker({
  moodLevel, stressLevel, sleepQuality,
  onMoodChange, onStressChange, onSleepChange,
}: Props) {
  return (
    <View style={styles.container}>
      <EmojiPicker
        title="😊 Ruh Halin"
        options={MOODS}
        selected={moodLevel ?? null}
        onSelect={onMoodChange ?? (() => {})}
      />
      <EmojiPicker
        title="⚡ Stres Seviyesi"
        options={STRESS_LEVELS}
        selected={stressLevel ?? null}
        onSelect={onStressChange ?? (() => {})}
        accentColor="#C47840"
      />
      <EmojiPicker
        title="🌙 Uyku Kalitesi"
        options={SLEEP_QUALITY}
        selected={sleepQuality ?? null}
        onSelect={onSleepChange ?? (() => {})}
        accentColor={Palette.sky}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing['5'],
  },
  pickerContainer: {
    gap: Spacing['3'],
  },
  pickerTitle: {
    ...Typography.label,
    color: Palette.sageLight,
  },
  optionsRow: {
    flexDirection: 'row',
    gap:           Spacing['2'],
  },
  optionBtn: {
    flex:            1,
    alignItems:      'center',
    paddingVertical: Spacing['2'],
    borderRadius:    BorderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.08)',
    gap:             2,
  },
  optionBtnSelected: {
    borderWidth: 1.5,
  },
  optionEmoji: {
    fontSize: 22,
  },
  optionLabel: {
    ...Typography.caption,
    color: Palette.slateLight,
  },
});
