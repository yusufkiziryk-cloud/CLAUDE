import { create } from 'zustand';
import { MMKV } from 'react-native-mmkv';
import { UserProfile, UserStoreState } from '../types';

const storage = new MMKV({ id: 'user-store' });

const STORAGE_KEY = 'user_profile';

function persist(profile: UserProfile | null) {
  if (profile) {
    storage.set(STORAGE_KEY, JSON.stringify(profile));
  } else {
    storage.delete(STORAGE_KEY);
  }
}

function load(): UserProfile | null {
  const raw = storage.getString(STORAGE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as UserProfile; }
  catch { return null; }
}

const defaultProfile: UserProfile = {
  id: `user_${Date.now()}`,
  name: '',
  isPremium: false,
  language: 'tr',
  theme: 'dark',
  notificationsEnabled: true,
  hapticEnabled: true,
  soundEnabled: true,
  onboardingCompleted: false,
  joinedAt: new Date().toISOString(),
};

export const useUserStore = create<UserStoreState>((set) => ({
  profile: load(),
  isLoading: false,

  setProfile: (profile) => {
    persist(profile);
    set({ profile });
  },

  updateProfile: (updates) => {
    set((state) => {
      const updated = state.profile
        ? { ...state.profile, ...updates }
        : { ...defaultProfile, ...updates };
      persist(updated);
      return { profile: updated };
    });
  },

  completeOnboarding: () => {
    set((state) => {
      const updated = state.profile
        ? { ...state.profile, onboardingCompleted: true }
        : { ...defaultProfile, onboardingCompleted: true };
      persist(updated);
      return { profile: updated };
    });
  },

  reset: () => {
    persist(null);
    set({ profile: null });
  },
}));
