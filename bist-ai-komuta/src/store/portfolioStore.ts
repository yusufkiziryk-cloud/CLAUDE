import { create } from 'zustand';
import { Position } from '../types';

interface PortfolioState {
  positions: Position[];
  addPosition: (position: Omit<Position, 'id'>) => void;
  removePosition: (id: string) => void;
  updatePosition: (id: string, updates: Partial<Position>) => void;
}

export const usePortfolioStore = create<PortfolioState>((set) => ({
  positions: [
    {
      id: '1',
      stockCode: 'AKBNK',
      lots: 500,
      buyPrice: 48.20,
      buyDate: '2024-10-15',
      targetHorizon: 'medium',
      note: 'Bankacılık sektörü pozisyonu',
    },
    {
      id: '2',
      stockCode: 'THYAO',
      lots: 200,
      buyPrice: 265.80,
      buyDate: '2024-11-03',
      targetHorizon: 'long',
      note: 'Uzun vadeli turizm ve havacılık teması',
    },
    {
      id: '3',
      stockCode: 'ASELS',
      lots: 300,
      buyPrice: 76.40,
      buyDate: '2025-01-20',
      targetHorizon: 'long',
      note: 'Savunma sanayi büyüme teması',
    },
    {
      id: '4',
      stockCode: 'BIMAS',
      lots: 100,
      buyPrice: 532.00,
      buyDate: '2025-02-14',
      targetHorizon: 'medium',
      note: 'Defansif perakende pozisyonu',
    },
  ],

  addPosition: (position) =>
    set((state) => ({
      positions: [
        ...state.positions,
        { ...position, id: Date.now().toString() },
      ],
    })),

  removePosition: (id) =>
    set((state) => ({
      positions: state.positions.filter((p) => p.id !== id),
    })),

  updatePosition: (id, updates) =>
    set((state) => ({
      positions: state.positions.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    })),
}));
