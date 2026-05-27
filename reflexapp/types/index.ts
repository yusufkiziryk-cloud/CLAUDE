// ─── Core Domain Types ────────────────────────────────────────────────────────

export type BodyArea = 'foot' | 'hand' | 'ear';
export type FootSide = 'left' | 'right';
export type Language = 'tr' | 'en';
export type Theme = 'dark' | 'light' | 'system';
export type MoodLevel = 1 | 2 | 3 | 4 | 5;
export type StressLevel = 1 | 2 | 3 | 4 | 5;
export type SleepQuality = 1 | 2 | 3 | 4 | 5;

// ─── Reflexology Zone ─────────────────────────────────────────────────────────

export interface ZoneLocalizedContent {
  name: string;
  location: string;
  benefits: string[];
  technique: string;
  caution: string;
  description: string;
}

export interface ReflexZone {
  id: string;
  area: BodyArea;
  organ: string;
  emoji: string;
  color: string;
  glowColor: string;
  pressureDuration: number; // seconds
  tr: ZoneLocalizedContent;
  en: ZoneLocalizedContent;
  svgPath?: string;       // SVG path for foot map
  x?: number;             // normalized x position [0-1]
  y?: number;             // normalized y position [0-1]
  r?: number;             // circle radius for marker
  relatedZones?: string[]; // IDs of related zones
  symptoms?: string[];     // symptom keywords (both TR & EN)
}

// ─── Guided Session ───────────────────────────────────────────────────────────

export interface SessionStep {
  id: string;
  zoneId: string;
  durationSeconds: number;
  instruction: { tr: string; en: string };
  breathingPattern?: BreathingPattern;
}

export interface GuidedSession {
  id: string;
  title: { tr: string; en: string };
  description: { tr: string; en: string };
  durationMinutes: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  category: 'stress' | 'sleep' | 'energy' | 'digestion' | 'pain' | 'immunity' | 'full';
  emoji: string;
  isPremium: boolean;
  steps: SessionStep[];
  benefits: { tr: string[]; en: string[] };
}

export interface BreathingPattern {
  inhale: number;  // seconds
  hold: number;
  exhale: number;
  cycles: number;
}

// ─── User & Progress ──────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  isPremium: boolean;
  language: Language;
  theme: Theme;
  notificationsEnabled: boolean;
  hapticEnabled: boolean;
  soundEnabled: boolean;
  onboardingCompleted: boolean;
  joinedAt: string; // ISO date string
  apiKey?: string;  // optional Anthropic API key
}

export interface DailyLog {
  id: string;
  date: string; // YYYY-MM-DD
  moodLevel: MoodLevel;
  stressLevel: StressLevel;
  sleepQuality: SleepQuality;
  painAreas: string[];
  notes?: string;
  wellnessScore: number; // 0-100 computed
}

export interface SessionLog {
  id: string;
  sessionId: string;
  sessionTitle: string;
  completedAt: string; // ISO string
  durationSeconds: number;
  completionPercent: number;
  zonesVisited: string[];
  moodBefore?: MoodLevel;
  moodAfter?: MoodLevel;
}

export interface WeeklyStats {
  weekStart: string;
  totalSessions: number;
  totalMinutes: number;
  avgWellnessScore: number;
  avgStressLevel: number;
  avgMoodLevel: number;
  avgSleepQuality: number;
  streakDays: number;
}

// ─── AI Assistant ─────────────────────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  suggestedZones?: string[];
  isLoading?: boolean;
}

export interface AIContext {
  userProfile?: UserProfile;
  recentLogs?: DailyLog[];
  recentSessions?: SessionLog[];
}

// ─── Navigation ───────────────────────────────────────────────────────────────

export type RootStackParamList = {
  '(auth)/welcome': undefined;
  '(auth)/onboarding': undefined;
  '(tabs)': undefined;
  'zone/[id]': { id: string };
  'session/[sessionId]': { sessionId: string };
  settings: undefined;
  premium: undefined;
};

// ─── Store State ──────────────────────────────────────────────────────────────

export interface UserStoreState {
  profile: UserProfile | null;
  isLoading: boolean;
  setProfile: (profile: UserProfile) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  completeOnboarding: () => void;
  reset: () => void;
}

export interface SessionStoreState {
  currentSession: GuidedSession | null;
  currentStepIndex: number;
  isPlaying: boolean;
  elapsedSeconds: number;
  startSession: (session: GuidedSession) => void;
  nextStep: () => void;
  prevStep: () => void;
  pause: () => void;
  resume: () => void;
  endSession: () => void;
}

export interface ProgressStoreState {
  dailyLogs: DailyLog[];
  sessionLogs: SessionLog[];
  currentStreak: number;
  todayLog: DailyLog | null;
  weeklyStats: WeeklyStats | null;
  addDailyLog: (log: Omit<DailyLog, 'id' | 'wellnessScore'>) => void;
  addSessionLog: (log: Omit<SessionLog, 'id'>) => void;
  loadHistory: () => void;
  computeWellnessScore: (log: Partial<DailyLog>) => number;
}

export interface AIStoreState {
  messages: ChatMessage[];
  isTyping: boolean;
  addUserMessage: (content: string) => void;
  addAssistantMessage: (content: string, suggestedZones?: string[]) => void;
  setTyping: (v: boolean) => void;
  clearChat: () => void;
}

// ─── Notification ─────────────────────────────────────────────────────────────

export interface NotificationSchedule {
  id: string;
  type: 'session' | 'water' | 'breath' | 'sleep';
  hour: number;
  minute: number;
  enabled: boolean;
  label: { tr: string; en: string };
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────

export interface TabIconProps {
  focused: boolean;
  color: string;
  size: number;
}

export interface CardProps {
  style?: object;
  children: React.ReactNode;
  onPress?: () => void;
  intensity?: number;
}
