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
  scheduleIntensity: "light" | "moderate" | "heavy" | "insane";
  doNotScheduleDays: string[]; // e.g. ["Saturday", "Sunday"]
  doNotScheduleWindows: string; // e.g. "After 9pm"
  timezone: string; // IANA timezone string, e.g. "America/New_York"
  // Lifestyle blocks — used to grey out unavailable time on the calendar
  wakeTime: string;              // "HH:MM" e.g. "07:30"
  sleepTime: string;             // "HH:MM" e.g. "23:00"
  breakfastTime: string;         // "HH:MM" e.g. "07:30" (empty = skip)
  breakfastDurationMinutes: number; // e.g. 30
  lunchStart: string;            // "HH:MM" e.g. "12:00" (empty = no lunch block)
  lunchDurationMinutes: number;  // e.g. 60
  dinnerTime: string;            // "HH:MM" e.g. "18:30" (empty = skip)
  dinnerDurationMinutes: number; // e.g. 60
  scheduleBlocks: ScheduleBlock[]; // manually added time blocks to show as unavailable on calendar
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
  /** Parsed real event start time (HH:MM). Present for fixed-time events like networking nights, career fairs, workshops. */
  eventTime?: string;
  /** Parsed real event end time (HH:MM). Present when the email specifies a range like "10am–3pm". */
  eventEndTime?: string;
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

export type TaskFlex = 'fixed' | 'flexible';

export type TaskStatus =
  | 'confirmed'
  | 'needs_confirmation'
  | 'scheduling_conflict'
  | 'deferred'
  | 'unscheduled'
  | 'awaiting_permission';

export type ScheduleBlockRecurrence = 'none' | 'daily' | 'weekly' | 'weekdays' | 'weekends';

export interface ScheduleBlock {
  id: string;
  name: string;
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  date?: string;     // "YYYY-MM-DD" — required for 'none', used for day-of-week for 'weekly'
  recurrence: ScheduleBlockRecurrence;
}

export interface TimeBlock {
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  durationMinutes: number;
}

export interface ScheduleResult {
  scheduled: CalendarTask[];
  deferred: CalendarTask[];
  overflow: boolean;
}

export interface CalendarTask {
  id: string;
  title: string;
  type: TaskType;
  flex?: TaskFlex;
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  date: string; // "YYYY-MM-DD"
  opportunityId?: string;
  color: string;
  conflict?: boolean;
  confirmed?: boolean; // undefined/true = confirmed, false = pending user confirmation
  status?: TaskStatus; // scheduling status label
  splitGroup?: string; // shared ID across "(continued)" blocks of the same task
  totalScheduledMinutes?: number; // sum across all split blocks
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
  isBlockedTime?: boolean; // true when taskB is a blocked interval, not another task
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
  chatMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
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
