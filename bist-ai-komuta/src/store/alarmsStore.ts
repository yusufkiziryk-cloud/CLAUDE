import { create } from 'zustand';
import { Alarm, AlarmType } from '../types';

interface AlarmsState {
  alarms: Alarm[];
  addAlarm: (alarm: Omit<Alarm, 'id' | 'triggered' | 'createdAt'>) => void;
  removeAlarm: (id: string) => void;
  toggleAlarm: (id: string) => void;
}

export const useAlarmsStore = create<AlarmsState>((set) => ({
  alarms: [
    {
      id: 'a1',
      stockCode: 'GARAN',
      type: 'support_break',
      condition: 'below',
      value: 118.00,
      priority: 'high',
      triggered: false,
      createdAt: '2025-05-20',
      active: true,
      note: 'Kritik destek kırılımı takibi',
    },
    {
      id: 'a2',
      stockCode: 'KOZAL',
      type: 'rsi',
      condition: 'above',
      value: 75,
      priority: 'watch',
      triggered: false,
      createdAt: '2025-05-22',
      active: true,
      note: 'RSI aşırı alım uyarısı',
    },
    {
      id: 'a3',
      stockCode: 'THYAO',
      type: 'price',
      condition: 'above',
      value: 295.00,
      priority: 'low',
      triggered: false,
      createdAt: '2025-05-24',
      active: true,
      note: 'Direnç kırılımı takibi',
    },
    {
      id: 'a4',
      stockCode: 'FROTO',
      type: 'price',
      condition: 'below',
      value: 1248.00,
      priority: 'critical',
      triggered: false,
      createdAt: '2025-05-25',
      active: true,
      note: 'Stop-loss seviyesi kontrolü',
    },
  ],

  addAlarm: (alarm) =>
    set((state) => ({
      alarms: [
        ...state.alarms,
        {
          ...alarm,
          id: Date.now().toString(),
          triggered: false,
          createdAt: new Date().toISOString().split('T')[0],
        },
      ],
    })),

  removeAlarm: (id) =>
    set((state) => ({ alarms: state.alarms.filter((a) => a.id !== id) })),

  toggleAlarm: (id) =>
    set((state) => ({
      alarms: state.alarms.map((a) =>
        a.id === id ? { ...a, active: !a.active } : a
      ),
    })),
}));
