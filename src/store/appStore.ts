"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AppState, UserProfile, Goal, CalendarTask } from "@/types";
import { mockEmails } from "@/data/mockEmails";
import { mockCalendarTasks } from "@/data/mockCalendar";
import { rankOpportunities } from "@/lib/opportunityRanking";
import { detectConflicts } from "@/lib/conflictDetection";
import { deriveOpportunitiesFromEmails } from "@/lib/emailParser";
import { generateDailyStrategy } from "@/lib/strategyEngine";

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
  setActiveTab: (tab: AppState["activeTab"]) => void;
  completeOnboarding: (profile: UserProfile) => void;
  updateProfile: (profile: Partial<UserProfile>) => void;
  setOpportunityInterest: (id: string, interested: boolean | null) => void;
  addOpportunityToCalendar: (opportunityId: string) => void;
  confirmCalendarTask: (taskId: string) => void;
  resolveConflict: (conflictId: string, keepTaskId: string) => void;
  confirmGoal: (goalId: string, confirmed: boolean) => void;
  generateAIInsights: (profile: UserProfile) => Promise<void>;
  setGoals: (goals: Goal[]) => void;
  computeStrategy: () => void;
  resetStore: () => void;
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

      setActiveTab: (tab) => set({ activeTab: tab }),

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
        set({ profile, opportunities: rankedOpps, dailyStrategy: strategy });
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

        const type =
          opp.category === "internship_application"
            ? ("internship_application" as const)
            : opp.category === "networking"
              ? ("networking" as const)
              : opp.category === "professional_event"
                ? ("workshop" as const)
                : opp.category === "classes"
                  ? ("class" as const)
                  : ("other" as const);

        const color: Record<string, string> = {
          internship_application: "#10b981",
          networking: "#ec4899",
          workshop: "#6366f1",
          class: "#3b82f6",
          other: "#6b7280",
        };

        const newTask: CalendarTask = {
          id: `opp-task-${opportunityId}`,
          title: opp.title,
          type,
          startTime: get().profile.preferredStartTime || "09:00",
          endTime: "11:00",
          date: opp.deadline,
          opportunityId,
          color: color[type] || "#6b7280",
          confirmed: false,
        };

        const newTasks = [...get().calendarTasks, newTask];
        const conflicts = detectConflicts(newTasks);

        set((state) => ({
          calendarTasks: newTasks,
          conflicts,
          opportunities: state.opportunities.map((o) =>
            o.id === opportunityId ? { ...o, addedToCalendar: true } : o,
          ),
        }));
      },

      confirmCalendarTask: (taskId) => {
        set((state) => ({
          calendarTasks: state.calendarTasks.map((t) =>
            t.id === taskId ? { ...t, confirmed: true } : t,
          ),
        }));
      },

      resolveConflict: (conflictId, keepTaskId) => {
        const conflict = get().conflicts.find((c) => c.id === conflictId);
        if (!conflict) return;
        const removeTaskId =
          keepTaskId === conflict.taskAId ? conflict.taskBId : conflict.taskAId;
        const newTasks = get().calendarTasks.filter(
          (t) => t.id !== removeTaskId,
        );
        set({
          calendarTasks: newTasks,
          conflicts: detectConflicts(newTasks),
        });
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
          aiInsight: '',
          aiInsightLoading: false,
          dailyStrategy: null,
          activeTab: 'dashboard',
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
