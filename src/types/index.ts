// Core types for the app

export interface UserProfile {
  name: string;
  careerGoals: string;
  professionalInterests: string;
  experienceLevel: "student" | "entry" | "mid" | "senior";
  targetIndustries: string;
  activelyLooking: boolean;
  dailyHoursAvailable: number;
  preferredStartTime: string; // "HH:MM" 24h
  preferredEndTime: string; // "HH:MM" 24h
  typicalDaySnapshot: string;
  perDaySchedule: Record<string, string>; // optional per-day overrides, keyed by day name
  scheduleIntensity: "light" | "moderate" | "intense";
  doNotScheduleDays: string[]; // e.g. ["Saturday", "Sunday"]
  doNotScheduleWindows: string; // e.g. "After 9pm"
  timezone: string; // IANA timezone string, e.g. "America/New_York"
  completed: boolean;
}

export type EmailCategory =
  | "entertainment"
  | "internship_research"
  | "internship_application"
  | "professional_event"
  | "classes"
  | "networking"
  | "deadline"
  | "personal"
  | "ignore";

export interface MockEmail {
  id: string;
  from: string;
  subject: string;
  body: string;
  date: string;
  category: EmailCategory;
  opportunityId?: string; // links to Opportunity if applicable
}

export interface Opportunity {
  id: string;
  title: string;
  description: string;
  category: EmailCategory;
  deadline: string | null; // ISO date string
  estimatedHours: number;
  priority: number; // 1-10
  priorityReason: string;
  emailId: string;
  interested: boolean | null; // null = undecided, true = yes, false = no
  addedToCalendar: boolean;
}

export type TaskType =
  | "career_fair"
  | "internship_application"
  | "company_research"
  | "resume_update"
  | "workshop"
  | "class"
  | "entertainment"
  | "networking"
  | "free_time"
  | "deadline"
  | "other";

export interface CalendarTask {
  id: string;
  title: string;
  type: TaskType;
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  date: string; // "YYYY-MM-DD"
  opportunityId?: string;
  color: string;
  conflict?: boolean;
  confirmed?: boolean; // undefined/true = confirmed, false = pending user confirmation
}

export interface Conflict {
  id: string;
  taskAId: string;
  taskBId: string;
  taskATitle: string;
  taskBTitle: string;
  date: string;
  reason: string;
  suggestions: string[];
}

export interface Goal {
  id: string;
  text: string;
  confirmed: boolean | null; // null = unanswered
  addedToPlan: boolean;
}

export interface AppState {
  profile: UserProfile;
  emails: MockEmail[];
  opportunities: Opportunity[];
  calendarTasks: CalendarTask[];
  conflicts: Conflict[];
  goals: Goal[];
  activeTab:
    | "dashboard"
    | "calendar"
    | "opportunities"
    | "preferences"
    | "character";
  character: Character | null;
  onboardingComplete: boolean;
  // AI-generated content
  aiInsight: string;
  aiInsightLoading: boolean;
  dailyStrategy: DailyStrategy | null;
}

export interface StrategyAction {
  opportunityId: string;
  title: string;
  action: string; // e.g. "Submit: Amazon SDE application"
  reason: string; // e.g. "Deadline in 2 days — high career impact"
  estimatedHours: number;
}

export interface DailyStrategy {
  date: string;
  topActions: StrategyAction[];
  deferredItems: StrategyAction[];
  overloaded: boolean;
  totalScheduledHours: number;
  availableHours: number;
}

export interface Plan {
  name: string; // "Plan A" or "Plan B"
  focus: string; // "Career-Focused"
  items: StrategyAction[];
  explanation: string;
}

// ── Character system types ─────────────────────────────────────────────────────

export interface CharacterStats {
  focus: number;
  career: number;
  vitality: number;
  social: number;
  exploration: number;
}

export type StateSignal =
  | "finding_rhythm"
  | "surging"
  | "narrowing"
  | "drifting"
  | "stretched"
  | "isolated"
  | "restless"
  | "steady";

export interface StatSnapshot {
  date: string; // "YYYY-MM-DD"
  stats: CharacterStats;
}

export type HairStyle = "medium" | "short" | "long" | "spiky";
export type EyeStyle = "default" | "wide" | "narrow";
export type FaceShape = "round" | "angular" | "soft";

export interface CharacterAppearance {
  hairStyle: HairStyle;
  eyeStyle: EyeStyle;
  faceShape: FaceShape;
}

export interface Character {
  name: string;
  stats: CharacterStats;
  level: number;
  archetype: string;
  signals: StateSignal[];
  statHistory: StatSnapshot[];
  appearance?: CharacterAppearance; // optional for backward compat
}
