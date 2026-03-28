// Core types for the app

export interface UserProfile {
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
  activeTab: "dashboard" | "calendar" | "opportunities" | "preferences";
  onboardingComplete: boolean;
  // AI-generated content
  aiInsight: string;
  aiInsightLoading: boolean;
}
