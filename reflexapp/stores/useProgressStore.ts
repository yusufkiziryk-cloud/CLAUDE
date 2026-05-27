import { create } from 'zustand';
import { MMKV } from 'react-native-mmkv';
import { DailyLog, SessionLog, ProgressStoreState, WeeklyStats, MoodLevel, StressLevel, SleepQuality } from '../types';
import { format, subDays, startOfWeek } from 'date-fns';

const storage = new MMKV({ id: 'progress-store' });

function saveToStorage(key: string, data: unknown) {
  storage.set(key, JSON.stringify(data));
}

function loadFromStorage<T>(key: string, fallback: T): T {
  const raw = storage.getString(key);
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; }
  catch { return fallback; }
}

function computeWellnessScore(log: Partial<DailyLog>): number {
  const mood    = ((log.moodLevel  ?? 3) / 5) * 30;
  const stress  = ((6 - (log.stressLevel ?? 3)) / 5) * 35;  // inverted
  const sleep   = ((log.sleepQuality ?? 3) / 5) * 35;
  return Math.round(mood + stress + sleep);
}

function computeStreak(logs: DailyLog[]): number {
  if (!logs.length) return 0;
  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
  let streak = 0;
  let expectedDate = format(new Date(), 'yyyy-MM-dd');
  for (const log of sorted) {
    if (log.date === expectedDate) {
      streak++;
      expectedDate = format(subDays(new Date(log.date), 1), 'yyyy-MM-dd');
    } else {
      break;
    }
  }
  return streak;
}

function computeWeeklyStats(logs: DailyLog[], sessionLogs: SessionLog[]): WeeklyStats | null {
  if (!logs.length && !sessionLogs.length) return null;

  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekLogs = logs.filter((l) => l.date >= weekStart);
  const weekSessions = sessionLogs.filter((s) => s.completedAt >= weekStart);

  const avg = (arr: number[]) =>
    arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0;

  return {
    weekStart,
    totalSessions:    weekSessions.length,
    totalMinutes:     Math.round(weekSessions.reduce((a, s) => a + s.durationSeconds / 60, 0)),
    avgWellnessScore: avg(weekLogs.map((l) => l.wellnessScore)),
    avgStressLevel:   avg(weekLogs.map((l) => l.stressLevel)),
    avgMoodLevel:     avg(weekLogs.map((l) => l.moodLevel)),
    avgSleepQuality:  avg(weekLogs.map((l) => l.sleepQuality)),
    streakDays:       computeStreak(logs),
  };
}

export const useProgressStore = create<ProgressStoreState>((set, get) => ({
  dailyLogs:    loadFromStorage<DailyLog[]>('daily_logs', []),
  sessionLogs:  loadFromStorage<SessionLog[]>('session_logs', []),
  currentStreak: 0,
  todayLog:     null,
  weeklyStats:  null,

  computeWellnessScore,

  addDailyLog: (logData) => {
    set((state) => {
      const score   = computeWellnessScore(logData);
      const newLog: DailyLog = {
        ...logData,
        id:            `log_${Date.now()}`,
        wellnessScore: score,
      } as DailyLog;

      // Replace existing log for same date
      const filtered = state.dailyLogs.filter((l) => l.date !== newLog.date);
      const updated  = [newLog, ...filtered].sort((a, b) => b.date.localeCompare(a.date));

      saveToStorage('daily_logs', updated);

      const today = format(new Date(), 'yyyy-MM-dd');
      return {
        dailyLogs:    updated,
        todayLog:     newLog.date === today ? newLog : state.todayLog,
        currentStreak: computeStreak(updated),
        weeklyStats:  computeWeeklyStats(updated, state.sessionLogs),
      };
    });
  },

  addSessionLog: (logData) => {
    set((state) => {
      const newLog: SessionLog = {
        ...logData,
        id: `session_${Date.now()}`,
      };
      const updated = [newLog, ...state.sessionLogs];
      saveToStorage('session_logs', updated);
      return {
        sessionLogs: updated,
        weeklyStats: computeWeeklyStats(state.dailyLogs, updated),
      };
    });
  },

  loadHistory: () => {
    const dailyLogs   = loadFromStorage<DailyLog[]>('daily_logs', []);
    const sessionLogs = loadFromStorage<SessionLog[]>('session_logs', []);
    const today       = format(new Date(), 'yyyy-MM-dd');

    set({
      dailyLogs,
      sessionLogs,
      todayLog:     dailyLogs.find((l) => l.date === today) ?? null,
      currentStreak: computeStreak(dailyLogs),
      weeklyStats:  computeWeeklyStats(dailyLogs, sessionLogs),
    });
  },
}));
