import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const isSupported = Platform.OS !== 'web';

export const HapticService = {
  /** Light tap — for navigation or small interactions */
  light: async () => {
    if (!isSupported) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },

  /** Medium tap — for zone press, button presses */
  medium: async () => {
    if (!isSupported) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  },

  /** Heavy tap — for important confirmations */
  heavy: async () => {
    if (!isSupported) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  },

  /** Success notification — session complete, log saved */
  success: async () => {
    if (!isSupported) return;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },

  /** Warning notification */
  warning: async () => {
    if (!isSupported) return;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  },

  /** Error notification */
  error: async () => {
    if (!isSupported) return;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  },

  /** Selection changed — for pickers, sliders */
  selection: async () => {
    if (!isSupported) return;
    await Haptics.selectionAsync();
  },

  /** Zone pulse — used when a reflexology zone is activated */
  zonePulse: async () => {
    if (!isSupported) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await new Promise((r) => setTimeout(r, 100));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },

  /** Breath rhythm — subtle during breathing exercises */
  breathIn: async () => {
    if (!isSupported) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },

  breathOut: async () => {
    if (!isSupported) return;
    await Haptics.selectionAsync();
  },

  /** Timer tick — gentle tick each second during session */
  tick: async () => {
    if (!isSupported) return;
    await Haptics.selectionAsync();
  },
};
