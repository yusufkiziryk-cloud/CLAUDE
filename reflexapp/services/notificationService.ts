import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { NotificationSchedule } from '../types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge:  false,
  }),
});

export const DEFAULT_SCHEDULES: NotificationSchedule[] = [
  {
    id:      'morning-session',
    type:    'session',
    hour:    8,
    minute:  0,
    enabled: true,
    label:   { tr: '🌅 Sabah seansı zamanı', en: '🌅 Morning session time' },
  },
  {
    id:      'water-reminder',
    type:    'water',
    hour:    10,
    minute:  30,
    enabled: true,
    label:   { tr: '💧 Su içmeyi unutma!', en: '💧 Don\'t forget to drink water!' },
  },
  {
    id:      'midday-breath',
    type:    'breath',
    hour:    13,
    minute:  0,
    enabled: false,
    label:   { tr: '🌿 Nefes molası vakti', en: '🌿 Time for a breath break' },
  },
  {
    id:      'evening-session',
    type:    'session',
    hour:    20,
    minute:  0,
    enabled: true,
    label:   { tr: '🌙 Akşam rahatlama seansı', en: '🌙 Evening relaxation session' },
  },
  {
    id:      'sleep-prep',
    type:    'sleep',
    hour:    22,
    minute:  30,
    enabled: true,
    label:   { tr: '😴 Uyku hazırlığı zamanı', en: '😴 Sleep preparation time' },
  },
];

export const NotificationService = {
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'web') return false;

    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  },

  async scheduleAll(schedules: NotificationSchedule[], lang: 'tr' | 'en'): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();

    for (const sched of schedules) {
      if (!sched.enabled) continue;
      await Notifications.scheduleNotificationAsync({
        identifier: sched.id,
        content: {
          title: 'Refleks 🦶',
          body:  sched.label[lang],
          sound: false,
        },
        trigger: {
          hour:    sched.hour,
          minute:  sched.minute,
          repeats: true,
        },
      });
    }
  },

  async cancelAll(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  },

  async sendImmediateNotification(title: string, body: string): Promise<void> {
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: null,
    });
  },
};
