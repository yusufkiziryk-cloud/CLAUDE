import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import Animated, { FadeInDown, FadeInUp, Layout } from 'react-native-reanimated';
import { ChatMessage } from '../../types';
import { Palette } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing, BorderRadius } from '../../constants/spacing';
import { format } from 'date-fns';

interface Props {
  message:        ChatMessage;
  onZonePress?:   (zoneId: string) => void;
}

export function ChatBubble({ message, onZonePress }: Props) {
  const isUser      = message.role === 'user';
  const timeString  = format(message.timestamp, 'HH:mm');

  return (
    <Animated.View
      entering={isUser ? FadeInUp.duration(250) : FadeInDown.duration(300)}
      layout={Layout.springify()}
      style={[styles.container, isUser ? styles.containerUser : styles.containerAssistant]}
    >
      {/* Avatar */}
      {!isUser && (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>🦶</Text>
        </View>
      )}

      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        {/* Message text — parse markdown-lite */}
        <Text style={[styles.text, isUser ? styles.textUser : styles.textAssistant]}>
          {message.content}
        </Text>

        {/* Suggested zones chips */}
        {message.suggestedZones && message.suggestedZones.length > 0 && (
          <View style={styles.zoneChips}>
            <Text style={styles.zoneChipsLabel}>Önerilen Bölgeler:</Text>
            <View style={styles.chipsRow}>
              {message.suggestedZones.map((zoneId) => (
                <Pressable
                  key={zoneId}
                  style={styles.zoneChip}
                  onPress={() => onZonePress?.(zoneId)}
                >
                  <Text style={styles.zoneChipText}>🗺 {zoneId.replace(/_/g, ' ')}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <Text style={[styles.time, isUser ? styles.timeUser : styles.timeAssistant]}>
          {timeString}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection:  'row',
    marginVertical: Spacing['2'],
    paddingHorizontal: Spacing['4'],
    maxWidth:       '100%',
  },
  containerUser: {
    justifyContent: 'flex-end',
  },
  containerAssistant: {
    justifyContent: 'flex-start',
    alignItems:     'flex-end',
  },
  avatar: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: 'rgba(124,152,133,0.20)',
    alignItems:      'center',
    justifyContent:  'center',
    marginRight:     Spacing['2'],
    flexShrink:      0,
  },
  avatarText: {
    fontSize: 18,
  },
  bubble: {
    maxWidth:     '82%',
    borderRadius: BorderRadius.xl,
    padding:      Spacing['3'],
    paddingHorizontal: Spacing['4'],
  },
  bubbleUser: {
    backgroundColor: 'rgba(124,152,133,0.25)',
    borderWidth:     1,
    borderColor:     'rgba(124,152,133,0.35)',
    borderBottomRightRadius: BorderRadius.sm,
  },
  bubbleAssistant: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.10)',
    borderBottomLeftRadius: BorderRadius.sm,
  },
  text: {
    ...Typography.body,
    lineHeight: 22,
  },
  textUser: {
    color: Palette.cream,
  },
  textAssistant: {
    color: Palette.cream,
  },
  zoneChips: {
    marginTop: Spacing['3'],
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: Spacing['2'],
  },
  zoneChipsLabel: {
    ...Typography.caption,
    color:        Palette.sageLight,
    marginBottom: Spacing['2'],
  },
  chipsRow: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    gap:            Spacing['2'],
  },
  zoneChip: {
    backgroundColor: 'rgba(124,152,133,0.15)',
    borderWidth:     1,
    borderColor:     'rgba(124,152,133,0.30)',
    borderRadius:    BorderRadius.full,
    paddingHorizontal: Spacing['3'],
    paddingVertical:   Spacing['1'],
  },
  zoneChipText: {
    ...Typography.caption,
    color:     Palette.sageLight,
    textTransform: 'capitalize',
  },
  time: {
    ...Typography.caption,
    marginTop: Spacing['1'],
  },
  timeUser: {
    color:     Palette.slateLight,
    textAlign: 'right',
  },
  timeAssistant: {
    color:     Palette.slateMid,
    textAlign: 'left',
  },
});
