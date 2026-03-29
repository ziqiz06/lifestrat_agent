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

export interface RankingDebug {
  // ── Layer 1: deterministic actionability (email-derived facts) ─────────────
  baseActionabilityScore: number;   // 0-10: urgency×0.6 + effort×0.2 + confidence×0.2
  urgency:                number;   // 0-10: days until deadline
  effort:                 number;   // 0-10: inverse effort (low effort = high score)
  confidence:             number;   // 0-10: how much info the email provided

  // ── Layer 2: profile-driven preference fit (field-agnostic) ───────────────
  preferenceFitScore:  number;      // 0-10: dynamic term match against user profile text
  profileCoverage:     number;      // 0-1: fraction of profile terms found in opp text
  matchedTerms:        string[];    // profile terms that matched opp text
  matchedSignals:      string[];    // human-readable match labels

  // ── Layer 3: career value (category impact) ────────────────────────────────
  careerValueScore: number;         // 0-10: based on email category

  // ── Layer 4: AI semantic overlay (null until AI runs) ─────────────────────
  aiRelevanceScore: number | null;  // 0-10: LLM semantic judgment
  aiExplanation:    string;         // why the AI ranked it where it did

  // ── Composite ──────────────────────────────────────────────────────────────
  penalty:      number;             // subtracted from composite
  finalScore:   number;             // the value stored in opp.priority
  explanation:  string;             // human-readable summary of the ranking rationale
  today:        string;

  // ── Backward-compat aliases ────────────────────────────────────────────────
  preferenceFit:   number;          // = preferenceFitScore
  careerImpact:    number;          // = careerValueScore
  composite:       number;          // weighted composite before penalty
  matchedKeywords: string[];        // = matchedTerms
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
  /** Whether this is a timed event, a deadline, or a flexible task. */
  itemType?: 'event' | 'deadline' | 'task';
  /**
   * Whether this item is time-anchored ("fixed") or can be worked on any time
   * before a cutoff ("flexible").
   *
   * fixed   — meetings, classes, interviews, events with an explicit start time.
   *           Must be placed at their exact time; treated as hard constraints.
   * flexible — deadlines, applications, RSVP deadlines, prep work.
   *           Requires a work block BEFORE dueAt, not AT dueAt.
   */
  flexibility?: 'fixed' | 'flexible';
  /** Parsed real event start time (HH:MM). Present for fixed-time events like networking nights, career fairs, workshops. */
  eventTime?: string;
  /** Parsed real event end time (HH:MM). Present when the email specifies a range like "10am–3pm". */
  eventEndTime?: string;
  /** Due time (HH:MM) for deadline items — e.g. 23:59 for "by 11:59pm". NOT an event start time. */
  dueAt?: string;
  rankingDebug?: RankingDebug;
  /** AI-assigned relevance score (0-10), stored independently so it survives heuristic re-ranks. */
  aiRelevanceScore?: number;
  /** Human-readable explanation from the AI rerank pass. */
  aiExplanation?: string;
  /** Number of source emails merged into this opportunity (≥ 1). */
  sourceCount?: number;
  /** ISO date of the most recent source email. */
  latestEmailDate?: string;
  /** IDs of all source emails contributing to this opportunity. */
  sourceEmailIds?: string[];
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
  | 'proposed'                 // suggested slot shown to user, not yet confirmed
  | 'needs_confirmation'
  | 'scheduling_conflict'
  | 'deferred'
  | 'unscheduled'
  | 'awaiting_permission'
  | 'confirmed_with_override'; // user accepted a soft conflict (e.g. dinner overlap)

/**
 * A recurrence rule stored on a CalendarTask.
 * Events are NOT duplicated in the store — recurrence is expanded at render time.
 */
export interface RecurrenceRule {
  frequency: 'none' | 'daily' | 'weekly' | 'monthly';
  /** Repeat every N units (default 1). */
  interval?: number;
  /** For weekly frequency: days of week to recur on (0 = Sun … 6 = Sat). */
  daysOfWeek?: number[];
  /** Stop expanding after this date (YYYY-MM-DD). */
  endDate?: string;
}

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

export type CompletionStatus =
  | 'scheduled'             // confirmed, in the future
  | 'awaiting_confirmation' // end time passed — waiting for user to mark outcome
  | 'completed'             // user marked as done — XP awarded
  | 'missed';               // user marked as missed — no XP

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
  /** Optional description shown in the event detail popover. */
  description?: string;
  /** Recurrence rule — if present, this event repeats. NOT expanded in store. */
  recurrence?: RecurrenceRule;
  /** True when the user explicitly accepted a conflict for this task. */
  conflictOverride?: boolean;
  /** Lifecycle status for XP tracking. */
  completionStatus?: CompletionStatus;
  /** True once XP has been awarded for this task (prevents double-XP). */
  xpAwarded?: boolean;
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
  /** soft = routine block overlap (user can override); hard = two real tasks clash. */
  severity?: 'soft' | 'hard';
}

export interface Goal {
  id: string;
  text: string;
  confirmed: boolean | null; // null = unanswered
  addedToPlan: boolean;
}

export interface CalendarUndoEntry {
  type: 'add_opportunity' | 'resolve_conflict';
  label: string;            // human-readable description for the toast
  addedTaskId?: string;     // add_opportunity: the task id to remove on undo
  removedTask?: CalendarTask;  // resolve_conflict: the task to restore on undo
  opportunityId?: string;   // reset addedToCalendar / interested on undo
  removedConflict?: Conflict;  // resolve_conflict: conflict to restore
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
  // Undo for calendar actions (not persisted — session only)
  lastCalendarUndo: CalendarUndoEntry | null;
  // Gmail integration
  gmailConnected: boolean;
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

export interface XPLogEntry {
  taskTitle: string;
  taskType: string;
  xp: number;
  date: string; // "YYYY-MM-DD"
}

export interface Character {
  name: string;
  stats: CharacterStats;
  level: number;
  archetype: string;
  signals: StateSignal[];
  statHistory: StatSnapshot[];
  appearance?: CharacterAppearance; // optional for backward compat
  xp?: number;                      // total accumulated XP from completed events
  xpLog?: XPLogEntry[];             // last 10 XP gains (newest first)
}
