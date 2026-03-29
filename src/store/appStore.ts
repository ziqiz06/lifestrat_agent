"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  AppState,
  UserProfile,
  Goal,
  CalendarTask,
  Character,
  CharacterAppearance,
} from "@/types";
import {
  computeStats,
  getLevel,
  getArchetype,
  detectSignals,
  seedHistory,
  DEFAULT_APPEARANCE,
} from "@/lib/characterEngine";
import { mockEmails } from "@/data/mockEmails";
import { mockCalendarTasks } from "@/data/mockCalendar";
import { rankOpportunities } from "@/lib/opportunityRanking";
import { detectConflicts } from "@/lib/conflictDetection";
import { deriveOpportunitiesFromEmails } from "@/lib/emailParser";
import { generateDailyStrategy } from "@/lib/strategyEngine";
import { getFixedEventsForDay, getAvailableTimeBlocks, extendTaskAndReflowDay, reflowCalendar } from "@/lib/dayPlanner";

const DEFAULT_PROFILE: UserProfile = {
  name: "",
  careerGoals: "",
  professionalInterests: "",
  experienceLevel: "student",
  targetIndustries: "",
  activelyLooking: true,
  dailyHoursAvailable: 4,
  preferredStartTime: "09:00",
  preferredEndTime: "22:00",
  typicalDaySnapshot: "",
  perDaySchedule: {},
  scheduleIntensity: "moderate",
  doNotScheduleDays: [],
  doNotScheduleWindows: "",
  timezone: "",
  completed: false,
};

const DEFAULT_GOALS: Goal[] = [
  {
    id: "g1",
    text: "Apply to 2 internships this week",
    confirmed: null,
    addedToPlan: false,
  },
  {
    id: "g2",
    text: "Attend 1 networking event",
    confirmed: null,
    addedToPlan: false,
  },
  {
    id: "g3",
    text: "Spend 4 hours on career development",
    confirmed: null,
    addedToPlan: false,
  },
  {
    id: "g4",
    text: "Preserve 1 hour of entertainment time nightly",
    confirmed: null,
    addedToPlan: false,
  },
  {
    id: "g5",
    text: "Prep for CS 401 midterm by April 4",
    confirmed: null,
    addedToPlan: false,
  },
];

interface AppStore extends AppState {
  character: Character | null;
  setActiveTab: (tab: AppState["activeTab"]) => void;
  completeOnboarding: (profile: UserProfile) => void;
  updateProfile: (profile: Partial<UserProfile>) => void;
  setOpportunityInterest: (id: string, interested: boolean | null) => void;
  addOpportunityToCalendar: (opportunityId: string) => void;
  extendTask: (taskId: string, extraMinutes: number) => void;
  confirmCalendarTask: (taskId: string) => void;
  deleteCalendarTask: (taskId: string) => void;
  addCustomCalendarTask: (task: Omit<CalendarTask, "id">) => void;
  resolveConflict: (conflictId: string, keepTaskId: string) => void;
  confirmGoal: (goalId: string, confirmed: boolean) => void;
  generateAIInsights: (profile: UserProfile) => Promise<void>;
  setGoals: (goals: Goal[]) => void;
  computeStrategy: () => void;
  resetStore: () => void;
  createCharacter: (name: string, appearance?: CharacterAppearance) => void;
  refreshCharacterStats: () => void;
  addGoal: (text: string) => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      profile: DEFAULT_PROFILE,
      emails: mockEmails,
      opportunities: rankOpportunities(
        deriveOpportunitiesFromEmails(mockEmails),
        DEFAULT_PROFILE,
      ),
      calendarTasks: mockCalendarTasks,
      conflicts: detectConflicts(mockCalendarTasks),
      goals: DEFAULT_GOALS,
      activeTab: "dashboard",
      onboardingComplete: false,
      aiInsight: "",
      aiInsightLoading: false,
      dailyStrategy: null,
      character: null,

      setActiveTab: (tab) => set({ activeTab: tab }),

      createCharacter: (name, appearance = DEFAULT_APPEARANCE) => {
        const tasks = get().calendarTasks;
        const stats = computeStats(tasks);
        const level = getLevel(stats);
        const archetype = getArchetype(stats);
        const signals = detectSignals(stats);
        const statHistory = seedHistory(stats);
        set({
          character: {
            name,
            stats,
            level,
            archetype,
            signals,
            statHistory,
            appearance,
          },
        });
      },

      addGoal: (text) => {
        const newGoal: Goal = {
          id: `custom-${Date.now()}`,
          text,
          confirmed: null,
          addedToPlan: false,
        };
        set((state) => ({ goals: [...state.goals, newGoal] }));
      },

      refreshCharacterStats: () => {
        const char = get().character;
        if (!char) return;
        const tasks = get().calendarTasks;
        const stats = computeStats(tasks);
        const level = getLevel(stats);
        const archetype = getArchetype(stats);
        const signals = detectSignals(stats);
        const today = new Date().toISOString().slice(0, 10);
        const lastSnap = char.statHistory[char.statHistory.length - 1];
        const statHistory =
          lastSnap?.date === today
            ? [...char.statHistory.slice(0, -1), { date: today, stats }]
            : [...char.statHistory.slice(-29), { date: today, stats }];
        set({
          character: { ...char, stats, level, archetype, signals, statHistory },
        });
      },

      computeStrategy: () => {
        const { opportunities, profile } = get();
        const strategy = generateDailyStrategy(opportunities, profile);
        set({ dailyStrategy: strategy });
      },

      completeOnboarding: (profile) => {
        const rankedOpps = rankOpportunities(get().opportunities, profile);
        const conflicts = detectConflicts(get().calendarTasks);
        const strategy = generateDailyStrategy(rankedOpps, profile);
        set({
          profile,
          opportunities: rankedOpps,
          conflicts,
          onboardingComplete: true,
          dailyStrategy: strategy,
        });
      },

      setGoals: (goals) => set({ goals }),

      generateAIInsights: async (profile) => {
        set({ aiInsightLoading: true, aiInsight: "" });

        const topOpps = get()
          .opportunities.slice(0, 5)
          .map(
            (o) =>
              `• ${o.title} (deadline: ${o.deadline ?? "none"}, priority: ${o.priority}/10)`,
          )
          .join("\n");

        const prompt = `You are a personal life strategy assistant. Based on this user profile, write a concise (3–4 sentence) strategic plan summary and then list exactly 5 personalized weekly goals as a numbered list.

User Profile:
- Career goals: ${profile.careerGoals || "not specified"}
- Interests: ${profile.professionalInterests || "not specified"}
- Experience: ${profile.experienceLevel}
- Target industries: ${profile.targetIndustries || "not specified"}
- Actively looking for internships: ${profile.activelyLooking ? "yes" : "no"}
- Daily hours available: ${profile.dailyHoursAvailable}h
- Schedule intensity: ${profile.scheduleIntensity}
- Do not schedule on: ${profile.doNotScheduleDays.join(", ") || "none specified"}

Top detected opportunities:
${topOpps}

Format your response as:
**Strategy Summary**
[3-4 sentences]

**Your 5 Goals This Week**
1. [goal]
2. [goal]
3. [goal]
4. [goal]
5. [goal]`;

        try {
          const res = await fetch("/api/ai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: [{ role: "user", content: prompt }],
              stream: true,
            }),
          });

          if (!res.ok || !res.body) {
            set({
              aiInsightLoading: false,
              aiInsight: "Failed to load AI insights.",
            });
            return;
          }

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let fullText = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Parse SSE chunks: "data: {...}\n\n"
            const chunk = decoder.decode(value, { stream: true });
            for (const line of chunk.split("\n")) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();
              if (data === "[DONE]") break;
              try {
                const json = JSON.parse(data);
                const delta = json.choices?.[0]?.delta?.content ?? "";
                fullText += delta;
                set({ aiInsight: fullText });
              } catch {
                // skip malformed chunks
              }
            }
          }

          // Parse AI-generated goals from numbered list in response
          const goalLines = fullText
            .split("\n")
            .filter((l) => /^\d+\.\s/.test(l.trim()))
            .slice(0, 5);

          if (goalLines.length > 0) {
            const aiGoals: Goal[] = goalLines.map((line, i) => ({
              id: `ai-g${i + 1}`,
              text: line.replace(/^\d+\.\s*/, "").trim(),
              confirmed: null,
              addedToPlan: false,
            }));
            set({ goals: aiGoals });
          }
        } catch {
          set({ aiInsight: "Could not connect to AI service." });
        } finally {
          set({ aiInsightLoading: false });
        }
      },

      updateProfile: (partial) => {
        const profile = { ...get().profile, ...partial };
        const rankedOpps = rankOpportunities(get().opportunities, profile);
        const strategy = generateDailyStrategy(rankedOpps, profile);
        const reflowed = reflowCalendar(get().calendarTasks, profile);
        set({ profile, opportunities: rankedOpps, dailyStrategy: strategy, calendarTasks: reflowed, conflicts: detectConflicts(reflowed) });
      },

      setOpportunityInterest: (id, interested) => {
        set((state) => ({
          opportunities: state.opportunities.map((o) =>
            o.id === id ? { ...o, interested } : o,
          ),
        }));
      },

      addOpportunityToCalendar: (opportunityId) => {
        const opp = get().opportunities.find((o) => o.id === opportunityId);
        if (!opp || !opp.deadline) return;
        const profile = get().profile;

        // Categories whose events happen at a fixed real-world time
        const FIXED_TIME_CATEGORIES = new Set([
          'networking', 'professional_event', 'classes', 'entertainment',
        ]);

        const typeMap: Record<string, CalendarTask['type']> = {
          internship_application: 'internship_application',
          internship_research: 'company_research',
          networking: 'networking',
          professional_event: 'workshop',
          classes: 'class',
          deadline: 'deadline',
          entertainment: 'entertainment',
        };
        const type = typeMap[opp.category] ?? 'other';

        const colorMap: Record<string, string> = {
          internship_application: '#10b981',
          company_research: '#8b5cf6',
          networking: '#ec4899',
          workshop: '#6366f1',
          class: '#3b82f6',
          deadline: '#ef4444',
          entertainment: '#f59e0b',
          other: '#6b7280',
        };

        const durationMin = Math.round(opp.estimatedHours * 60);

        const calcEnd = (start: string, mins: number): string => {
          const [sh, sm] = start.split(':').map(Number);
          const total = sh * 60 + sm + mins;
          return `${String(Math.min(Math.floor(total / 60), 23)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
        };

        let startTime: string;
        let endTime: string;
        let taskFlex: CalendarTask['flex'];

        if (opp.eventTime) {
          // ── Fixed-time event: email contains a real clock time ──────────────
          // Place it at that exact time — do NOT look for a flexible slot.
          startTime = opp.eventTime;
          endTime = opp.eventEndTime ?? calcEnd(startTime, durationMin);
          taskFlex = 'fixed';
        } else if (!FIXED_TIME_CATEGORIES.has(opp.category)) {
          // ── Flexible task: find the first open slot on the deadline day ─────
          const fixedEvents = getFixedEventsForDay(get().calendarTasks, opp.deadline);
          const blocks = getAvailableTimeBlocks(fixedEvents, profile, opp.deadline);
          const slot = blocks.find((b) => b.durationMinutes >= durationMin);
          if (slot) {
            startTime = slot.startTime;
            endTime = calcEnd(startTime, durationMin);
          } else {
            // Day is full — fall back to preferred start and let conflict detection flag it
            startTime = profile.preferredStartTime || '09:00';
            endTime = calcEnd(startTime, durationMin);
          }
          taskFlex = 'flexible';
        } else {
          // ── Fixed-time category but no parseable clock time in the email ────
          // Best we can do: use preferred start time (user can drag it later)
          startTime = profile.preferredStartTime || '09:00';
          endTime = calcEnd(startTime, durationMin);
          taskFlex = 'fixed';
        }

        const newTask: CalendarTask = {
          id: `opp-task-${opportunityId}`,
          title: opp.title,
          type,
          flex: taskFlex,
          startTime,
          endTime,
          date: opp.deadline,
          opportunityId,
          color: colorMap[type] || '#6b7280',
          confirmed: false,
        };

        const newTasks = [...get().calendarTasks, newTask];
        const conflicts = detectConflicts(newTasks);

        set((state) => ({
          calendarTasks: newTasks,
          conflicts,
          opportunities: state.opportunities.map((o) =>
            o.id === opportunityId ? { ...o, addedToCalendar: true } : o
          ),
        }));
      },

      extendTask: (taskId, extraMinutes) => {
        const newTasks = extendTaskAndReflowDay(get().calendarTasks, taskId, extraMinutes, get().profile);
        set({ calendarTasks: newTasks, conflicts: detectConflicts(newTasks) });
      },

      confirmCalendarTask: (taskId) => {
        set((state) => ({
          calendarTasks: state.calendarTasks.map((t) =>
            t.id === taskId ? { ...t, confirmed: true } : t,
          ),
        }));
      },

      deleteCalendarTask: (taskId) => {
        const removed = get().calendarTasks.find((t) => t.id === taskId);
        const newTasks = get().calendarTasks.filter((t) => t.id !== taskId);
        const newConflicts = detectConflicts(newTasks);
        set((state) => ({
          calendarTasks: newTasks,
          conflicts: newConflicts,
          // If the task was linked to an opportunity, un-mark it as added
          opportunities: removed?.opportunityId
            ? state.opportunities.map((o) =>
                o.id === removed.opportunityId
                  ? { ...o, addedToCalendar: false }
                  : o,
              )
            : state.opportunities,
        }));
      },

      addCustomCalendarTask: (taskData) => {
        const newTask: CalendarTask = {
          ...taskData,
          id: `custom-${Date.now()}`,
          confirmed: true,
        };
        const newTasks = [...get().calendarTasks, newTask];
        set({
          calendarTasks: newTasks,
          conflicts: detectConflicts(newTasks),
        });
      },

      resolveConflict: (conflictId, keepTaskId) => {
        const conflict = get().conflicts.find((c) => c.id === conflictId);
        if (!conflict) return;
        const removeTaskId =
          keepTaskId === conflict.taskAId ? conflict.taskBId : conflict.taskAId;
        const removedTask = get().calendarTasks.find((t) => t.id === removeTaskId);
        const newTasks = get().calendarTasks.filter((t) => t.id !== removeTaskId);
        set((state) => ({
          calendarTasks: newTasks,
          conflicts: detectConflicts(newTasks),
          // If removed task was linked to an opportunity, clear its addedToCalendar flag
          opportunities: removedTask?.opportunityId
            ? state.opportunities.map((o) =>
                o.id === removedTask.opportunityId
                  ? { ...o, addedToCalendar: false }
                  : o
              )
            : state.opportunities,
        }));
      },

      confirmGoal: (goalId, confirmed) => {
        set((state) => ({
          goals: state.goals.map((g) =>
            g.id === goalId ? { ...g, confirmed, addedToPlan: confirmed } : g,
          ),
        }));
      },

      resetStore: () => {
        set({
          profile: DEFAULT_PROFILE,
          goals: DEFAULT_GOALS,
          calendarTasks: mockCalendarTasks,
          conflicts: detectConflicts(mockCalendarTasks),
          opportunities: rankOpportunities(
            deriveOpportunitiesFromEmails(mockEmails),
            DEFAULT_PROFILE,
          ),
          onboardingComplete: false,
          aiInsight: "",
          aiInsightLoading: false,
          dailyStrategy: null,
          activeTab: "dashboard",
        });
      },
    }),
    {
      name: "lifestrat-app-state",
      // Never persist emails/opportunities — always load fresh from source files
      partialize: (state) => {
        const {
          emails,
          opportunities,
          aiInsight,
          aiInsightLoading,
          dailyStrategy,
          ...persisted
        } = state;
        void emails;
        void opportunities;
        void aiInsight;
        void aiInsightLoading;
        void dailyStrategy;
        return persisted;
      },
    },
  ),
);
