export type Chain = "ethereum" | "solana";
export type Level = "beginner" | "intermediate" | "advanced";

export interface Avatar {
  name: string;
  personality: "patient" | "energetic" | "socratic" | "mentor";
  appearance: "nebula" | "flame" | "crystal" | "aurora";
}

export interface UserProfile {
  id: string;
  name: string;
  level: Level;
  chain: Chain | "both";
  hoursPerDay: number;
  goals: string[];
  avatar: Avatar;
  xp: number;
  streak: number;
  lastActiveDate: string;
  completedLessons: string[];
  currentPath: string | null;
  onboardingDone: boolean;
  createdAt: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface LessonProgress {
  lessonId: string;
  status: "not_started" | "in_progress" | "completed";
  score?: number;
  completedAt?: string;
}

export interface AppState {
  profile: UserProfile | null;
  messages: Message[];
  lessonProgress: Record<string, LessonProgress>;
  todaysXpEarned: number;
  weeklyXp: number[];
}

const STORAGE_KEY = "srp_learn_v1";

const DEFAULT_STATE: AppState = {
  profile: null,
  messages: [],
  lessonProgress: {},
  todaysXpEarned: 0,
  weeklyXp: [0, 0, 0, 0, 0, 0, 0],
};

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_STATE;
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage full — ignore
  }
}

export function addXP(state: AppState, amount: number): AppState {
  const profile = state.profile;
  if (!profile) return state;
  const newXP = profile.xp + amount;
  const today = new Date().toDateString();
  const isNewDay = profile.lastActiveDate !== today;
  const newStreak = isNewDay ? profile.streak + 1 : profile.streak;
  const newWeekly = [...state.weeklyXp];
  const dayIdx = new Date().getDay();
  newWeekly[dayIdx] = (newWeekly[dayIdx] || 0) + amount;
  return {
    ...state,
    profile: {
      ...profile,
      xp: newXP,
      streak: newStreak,
      lastActiveDate: today,
    },
    todaysXpEarned: state.todaysXpEarned + amount,
    weeklyXp: newWeekly,
  };
}

export function xpToLevel(xp: number): { level: number; levelName: string; progress: number; toNext: number } {
  const thresholds = [0, 500, 1500, 3000, 6000, 12000, 25000, 50000];
  const names = ["Genesis", "Explorer", "Builder", "Hacker", "Architect", "Auditor", "Legend", "Ascended"];
  let lvl = 0;
  for (let i = 0; i < thresholds.length; i++) {
    if (xp >= thresholds[i]) lvl = i;
  }
  const current = thresholds[lvl];
  const next = thresholds[lvl + 1] ?? thresholds[lvl] + 50000;
  const progress = Math.min(100, ((xp - current) / (next - current)) * 100);
  const toNext = Math.max(0, next - xp);
  return { level: lvl + 1, levelName: names[lvl], progress, toNext };
}
