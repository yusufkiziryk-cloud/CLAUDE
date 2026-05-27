import { create } from 'zustand';
import { GuidedSession, SessionStoreState } from '../types';

export const useSessionStore = create<SessionStoreState>((set, get) => ({
  currentSession:   null,
  currentStepIndex: 0,
  isPlaying:        false,
  elapsedSeconds:   0,

  startSession: (session: GuidedSession) => {
    set({ currentSession: session, currentStepIndex: 0, isPlaying: true, elapsedSeconds: 0 });
  },

  nextStep: () => {
    set((state) => {
      if (!state.currentSession) return state;
      const next = state.currentStepIndex + 1;
      if (next >= state.currentSession.steps.length) {
        // Session complete
        return { ...state, isPlaying: false };
      }
      return { ...state, currentStepIndex: next, elapsedSeconds: 0 };
    });
  },

  prevStep: () => {
    set((state) => ({
      currentStepIndex: Math.max(0, state.currentStepIndex - 1),
      elapsedSeconds:   0,
    }));
  },

  pause: () => set({ isPlaying: false }),
  resume: () => set({ isPlaying: true }),

  endSession: () => {
    set({ currentSession: null, currentStepIndex: 0, isPlaying: false, elapsedSeconds: 0 });
  },
}));
