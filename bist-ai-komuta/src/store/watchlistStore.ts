import { create } from 'zustand';

interface WatchlistState {
  codes: string[];
  addToWatchlist: (code: string) => void;
  removeFromWatchlist: (code: string) => void;
  isWatching: (code: string) => boolean;
}

export const useWatchlistStore = create<WatchlistState>((set, get) => ({
  codes: ['ASELS', 'BIMAS', 'KOZAL', 'TUPRS'],

  addToWatchlist: (code) =>
    set((state) => ({ codes: [...new Set([...state.codes, code])] })),

  removeFromWatchlist: (code) =>
    set((state) => ({ codes: state.codes.filter((c) => c !== code) })),

  isWatching: (code) => get().codes.includes(code),
}));
