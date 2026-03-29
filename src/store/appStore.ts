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
// realEmails removed — every user imports their own Gmail inbox
// mockCalendarTasks intentionally removed — calendar starts empty
import { rankOpportunities } from "@/lib/opportunityRanking";
import { detectConflicts } from "@/lib/conflictDetection";
import { deriveOpportunitiesFromEmails } from "@/lib/emailParser";
import { generateDailyStrategy } from "@/lib/strategyEngine";
import { getFixedEventsForDay, getAvailableTimeBlocks, getBlockedIntervalsForDay, extendTaskAndReflowDay, reflowCalendar, isFixed, timeToMinutes, minutesToTime } from "@/lib/dayPlanner";
import { isOpportunityExpired } from "@/lib/timeParser";
import { computeTaskXP } from "@/lib/xpEngine";

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
  wakeTime: "07:30",
  sleepTime: "23:00",
  breakfastTime: "07:30",
  breakfastDurationMinutes: 30,
  lunchStart: "12:00",
  lunchDurationMinutes: 60,
  dinnerTime: "18:30",
  dinnerDurationMinutes: 60,
  scheduleBlocks: [],
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
  addOpportunityToCalendar: (opportunityId: string, opts?: {
    startTime?: string;        // override computed start (from ProposalModal)
    endTime?: string;
    durationMinutes?: number;
    title?: string;
    confirmed?: boolean;       // true = user already confirmed in ProposalModal
    date?: string;             // override date (for deadline-less manual scheduling)
  }) => void;
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
  updateCharacterAppearance: (appearance: CharacterAppearance) => void;
  addGoal: (text: string) => void;
  updateCalendarTask: (taskId: string, updates: Partial<Pick<import('@/types').CalendarTask, 'title' | 'startTime' | 'endTime' | 'date' | 'description'>>) => void;
  /** Mark a soft conflict as accepted — task gets confirmed_with_override status. */
  acceptConflict: (taskId: string) => void;
  /** Undo a previously accepted conflict override — re-evaluates conflicts. */
  undoConflictOverride: (taskId: string) => void;
  /** Undo the last add-opportunity or resolve-conflict action. */
  undoLastCalendarAction: () => void;
  /** Dismiss the undo toast without undoing. */
  clearCalendarUndo: () => void;
  /** Mark a past confirmed task as completed — awards XP. */
  markTaskCompleted: (taskId: string) => void;
  /** Mark a past confirmed task as missed — no XP. */
  markTaskMissed: (taskId: string) => void;
  /** Scan confirmed tasks whose end time has passed and set awaiting_confirmation. */
  checkPastTasks: () => void;
  sendChatMessage: (content: string) => Promise<void>;
  clearChat: () => void;
  aiPlanLoading: boolean;
  aiPlanSummary: string;
  aiPlanCalendar: () => Promise<void>;
  rerankLoading: boolean;
  rerankWithK2: () => Promise<void>;
  reloadOpportunities: () => void;
  /** Re-rank opportunities using current profile (alias for reloadOpportunities). */
  rerankOpportunities: () => void;
  /** Replace the email corpus with Gmail-imported emails and re-derive opportunities. */
  setEmails: (emails: import('@/types').MockEmail[]) => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      profile: DEFAULT_PROFILE,
      emails: [],
      opportunities: [],
      calendarTasks: [],
      conflicts: [],
      goals: DEFAULT_GOALS,
      activeTab: "dashboard",
      onboardingComplete: false,
      aiInsight: "",
      aiInsightLoading: false,
      dailyStrategy: null,
      character: null,
      chatMessages: [],
      aiPlanLoading: false,
      aiPlanSummary: "",
      rerankLoading: false,
      lastCalendarUndo: null,
      gmailConnected: false,

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

      updateCharacterAppearance: (appearance) => {
        const char = get().character;
        if (!char) return;
        set({ character: { ...char, appearance } });
      },

      refreshCharacterStats: () => {
        const char = get().character;
        if (!char) return;
        const tasks = get().calendarTasks;
        const stats = computeStats(tasks);
        const level = getLevel(stats, char.xp);
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
        const conflicts = detectConflicts(get().calendarTasks, get().profile);
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
        // Re-derive opportunities from source emails so scores always reflect the
        // latest profile rather than potentially stale AI-modified scores.
        const { emails, opportunities: existing } = get();
        const fresh = rankOpportunities(deriveOpportunitiesFromEmails(emails), profile);
        const existingMap = new Map(existing.map((o) => [o.id, o]));
        const rankedOpps = fresh.map((opp) => {
          const prev = existingMap.get(opp.id);
          if (!prev) return opp;
          return { ...opp, interested: prev.interested, addedToCalendar: prev.addedToCalendar };
        });
        const strategy = generateDailyStrategy(rankedOpps, profile);
        const reflowed = reflowCalendar(get().calendarTasks, profile);
        set({ profile, opportunities: rankedOpps, dailyStrategy: strategy, calendarTasks: reflowed, conflicts: detectConflicts(reflowed, profile) });
        // Fire AI rerank in the background so semantic understanding catches what
        // the heuristic misses (e.g. "English teacher" has no hardcoded keyword group).
        const hasProfile = !!(profile.careerGoals || profile.professionalInterests || profile.targetIndustries);
        if (hasProfile) get().rerankWithK2();
      },

      setOpportunityInterest: (id, interested) => {
        set((state) => ({
          opportunities: state.opportunities.map((o) =>
            o.id === id ? { ...o, interested } : o,
          ),
        }));
      },

      addOpportunityToCalendar: (opportunityId, opts) => {
        const opp = get().opportunities.find((o) => o.id === opportunityId);
        if (!opp) return;
        const taskDate = opts?.date ?? opp.deadline;
        if (!taskDate) return;
        if (opp.deadline && isOpportunityExpired(opp)) return; // refuse to schedule past-deadline items
        const profile = get().profile;
        const taskTitle = opts?.title ?? opp.title;

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

        // opts can override duration or end time (from the schedule modal)
        const durationMin = opts?.durationMinutes ?? Math.round(opp.estimatedHours * 60);

        // calcEnd: safely compute end time, capping at 23:59 to avoid midnight overflow.
        const calcEnd = (start: string, mins: number): string => {
          const total = Math.min(timeToMinutes(start) + mins, 23 * 60 + 59);
          return minutesToTime(total);
        };

        let startTime: string;
        let endTime: string;
        let taskFlex: CalendarTask['flex'];

        if (opp.flexibility !== 'fixed') {
          // ── Flexible: use caller-supplied times (from ProposalModal) or compute ─
          if (opts?.startTime) {
            startTime = opts.startTime;
            endTime   = opts.endTime ?? calcEnd(startTime, durationMin);
          } else {
            const fixedEvents = getFixedEventsForDay(get().calendarTasks, taskDate);
            const allBlocks   = getAvailableTimeBlocks(fixedEvents, profile, taskDate);
            const cutoffMins  = (opp.itemType === 'deadline' && opp.dueAt)
              ? timeToMinutes(opp.dueAt)
              : timeToMinutes(profile.preferredEndTime || '22:00');
            const trimmedBlocks = allBlocks
              .map((b) => {
                const bEnd = Math.min(timeToMinutes(b.endTime), cutoffMins);
                const dur  = bEnd - timeToMinutes(b.startTime);
                return { ...b, endTime: minutesToTime(bEnd), durationMinutes: dur };
              })
              .filter((b) => b.durationMinutes >= 30);
            const slot = trimmedBlocks.find((b) => b.durationMinutes >= durationMin)
              ?? trimmedBlocks.at(-1);
            if (slot) {
              startTime = slot.startTime;
              endTime   = calcEnd(startTime, Math.min(durationMin, slot.durationMinutes));
            } else {
              startTime = profile.preferredStartTime || '09:00';
              endTime   = calcEnd(startTime, durationMin);
            }
          }
          taskFlex = 'flexible';
        } else {
          // ── Fixed: anchor at the event's explicit time or preferred start ─────
          if (opp.eventTime) {
            startTime = opp.eventTime;
            endTime   = opts?.endTime ?? opp.eventEndTime ?? calcEnd(startTime, durationMin);
          } else {
            startTime = opts?.startTime ?? profile.preferredStartTime ?? '09:00';
            endTime   = opts?.endTime   ?? calcEnd(startTime, durationMin);
          }
          taskFlex = 'fixed';
        }

        // Safety: reject any interval where end ≤ start (can't happen with correct calcEnd,
        // but defensive in case opts provides a bad endTime from the modal)
        if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
          endTime = calcEnd(startTime, Math.max(durationMin, 30));
        }

        const newTask: CalendarTask = {
          id: `opp-task-${opportunityId}`,
          title: taskTitle,
          type,
          flex: taskFlex,
          startTime,
          endTime,
          date: taskDate,
          opportunityId,
          color: colorMap[type] || '#6b7280',
          confirmed: opts?.confirmed ?? false,
          status: opts?.confirmed ? 'confirmed' : 'proposed',
        };

        const newTasks = [...get().calendarTasks, newTask];
        const conflicts = detectConflicts(newTasks, get().profile);

        set((state) => ({
          calendarTasks: newTasks,
          conflicts,
          lastCalendarUndo: {
            type: 'add_opportunity',
            label: `Added "${newTask.title}" to calendar`,
            addedTaskId: newTask.id,
            opportunityId,
          },
          opportunities: state.opportunities.map((o) =>
            o.id === opportunityId ? { ...o, addedToCalendar: true } : o
          ),
        }));
      },

      extendTask: (taskId, extraMinutes) => {
        const newTasks = extendTaskAndReflowDay(get().calendarTasks, taskId, extraMinutes, get().profile);
        set({ calendarTasks: newTasks, conflicts: detectConflicts(newTasks, get().profile) });
      },

      confirmCalendarTask: (taskId) => {
        set((state) => ({
          calendarTasks: state.calendarTasks.map((t) =>
            t.id === taskId ? { ...t, confirmed: true } : t,
          ),
        }));
        get().refreshCharacterStats();
      },

      deleteCalendarTask: (taskId) => {
        const removed = get().calendarTasks.find((t) => t.id === taskId);
        const newTasks = get().calendarTasks.filter((t) => t.id !== taskId);
        const newConflicts = detectConflicts(newTasks, get().profile);
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
          conflicts: detectConflicts(newTasks, get().profile),
        });
        get().refreshCharacterStats();
      },

      resolveConflict: (conflictId, keepTaskId) => {
        const conflict = get().conflicts.find((c) => c.id === conflictId);
        if (!conflict) return;
        const removeTaskId =
          keepTaskId === conflict.taskAId ? conflict.taskBId : conflict.taskAId;
        const removedTask = get().calendarTasks.find((t) => t.id === removeTaskId);
        const keptTask = get().calendarTasks.find((t) => t.id === keepTaskId);
        const newTasks = get().calendarTasks.filter((t) => t.id !== removeTaskId);
        set((state) => ({
          calendarTasks: newTasks,
          conflicts: detectConflicts(newTasks, get().profile),
          lastCalendarUndo: removedTask ? {
            type: 'resolve_conflict',
            label: `Kept "${keptTask?.title ?? 'event'}" over "${removedTask.title}"`,
            removedTask,
            opportunityId: removedTask.opportunityId,
            removedConflict: conflict,
          } : null,
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

      acceptConflict: (taskId) => {
        // Mark the task as override-accepted; remove its conflict entries
        const newTasks = get().calendarTasks.map((t) =>
          t.id === taskId
            ? { ...t, conflictOverride: true, status: 'confirmed_with_override' as import('@/types').TaskStatus, confirmed: true }
            : t,
        );
        const newConflicts = get().conflicts.filter(
          (c) => c.taskAId !== taskId && c.taskBId !== taskId,
        );
        set({ calendarTasks: newTasks, conflicts: newConflicts });
      },

      undoConflictOverride: (taskId) => {
        const newTasks = get().calendarTasks.map((t) =>
          t.id === taskId
            ? { ...t, conflictOverride: false, status: 'confirmed' as import('@/types').TaskStatus }
            : t,
        );
        set({
          calendarTasks: newTasks,
          conflicts: detectConflicts(newTasks, get().profile),
        });
      },

      undoLastCalendarAction: () => {
        const entry = get().lastCalendarUndo;
        if (!entry) return;

        if (entry.type === 'add_opportunity') {
          // Remove the task that was added and reset the opportunity
          const newTasks = get().calendarTasks.filter((t) => t.id !== entry.addedTaskId);
          set((state) => ({
            calendarTasks: newTasks,
            conflicts: detectConflicts(newTasks, state.profile),
            lastCalendarUndo: null,
            opportunities: entry.opportunityId
              ? state.opportunities.map((o) =>
                  o.id === entry.opportunityId
                    ? { ...o, addedToCalendar: false, interested: null }
                    : o,
                )
              : state.opportunities,
          }));
        } else if (entry.type === 'resolve_conflict') {
          // Restore the removed task and its conflict record
          if (!entry.removedTask) { set({ lastCalendarUndo: null }); return; }
          const newTasks = [...get().calendarTasks, entry.removedTask];
          const newConflicts = entry.removedConflict
            ? [...detectConflicts(newTasks, get().profile)]
            : detectConflicts(newTasks, get().profile);
          set((state) => ({
            calendarTasks: newTasks,
            conflicts: newConflicts,
            lastCalendarUndo: null,
            opportunities: entry.opportunityId
              ? state.opportunities.map((o) =>
                  o.id === entry.opportunityId
                    ? { ...o, addedToCalendar: true }
                    : o,
                )
              : state.opportunities,
          }));
        }
      },

      clearCalendarUndo: () => set({ lastCalendarUndo: null }),

      markTaskCompleted: (taskId) => {
        const task = get().calendarTasks.find((t) => t.id === taskId);
        if (!task || task.xpAwarded) return;
        const xpGain = computeTaskXP(task);
        const newTasks = get().calendarTasks.map((t) =>
          t.id === taskId
            ? { ...t, completionStatus: 'completed' as import('@/types').CompletionStatus, xpAwarded: true, confirmed: true }
            : t,
        );
        set({ calendarTasks: newTasks });

        const char = get().character;
        if (char) {
          const newXp = (char.xp ?? 0) + xpGain;
          const stats = computeStats(newTasks);
          const level = getLevel(stats, newXp);
          const archetype = getArchetype(stats);
          const signals = detectSignals(stats);
          const today = new Date().toISOString().slice(0, 10);
          const lastSnap = char.statHistory[char.statHistory.length - 1];
          const statHistory =
            lastSnap?.date === today
              ? [...char.statHistory.slice(0, -1), { date: today, stats }]
              : [...char.statHistory.slice(-29), { date: today, stats }];
          const newEntry: import('@/types').XPLogEntry = {
            taskTitle: task.title,
            taskType: task.type,
            xp: xpGain,
            date: today,
          };
          const xpLog = [newEntry, ...(char.xpLog ?? [])].slice(0, 10);
          set({ character: { ...char, xp: newXp, xpLog, stats, level, archetype, signals, statHistory } });
        }
      },

      markTaskMissed: (taskId) => {
        const newTasks = get().calendarTasks.map((t) =>
          t.id === taskId
            ? { ...t, completionStatus: 'missed' as import('@/types').CompletionStatus }
            : t,
        );
        set({ calendarTasks: newTasks });
        get().refreshCharacterStats();
      },

      checkPastTasks: () => {
        const now = new Date();
        const nowDateStr = now.toISOString().slice(0, 10);
        const nowMins = now.getHours() * 60 + now.getMinutes();
        const toM = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

        let changed = false;
        const newTasks = get().calendarTasks.map((t) => {
          // Only scan confirmed tasks without a final completionStatus
          if (!t.confirmed) return t;
          if (t.completionStatus === 'completed' || t.completionStatus === 'missed') return t;
          if (t.completionStatus === 'awaiting_confirmation') return t;
          // Is the event fully in the past?
          const isPast =
            t.date < nowDateStr ||
            (t.date === nowDateStr && toM(t.endTime) < nowMins);
          if (!isPast) return t;
          changed = true;
          return { ...t, completionStatus: 'awaiting_confirmation' as import('@/types').CompletionStatus };
        });
        if (changed) set({ calendarTasks: newTasks });
      },

      confirmGoal: (goalId, confirmed) => {
        set((state) => ({
          goals: state.goals.map((g) =>
            g.id === goalId ? { ...g, confirmed, addedToPlan: confirmed } : g,
          ),
        }));
      },

      updateCalendarTask: (taskId, updates) => {
        const newTasks = get().calendarTasks.map((t) =>
          t.id === taskId ? { ...t, ...updates } : t,
        );
        set({ calendarTasks: newTasks, conflicts: detectConflicts(newTasks, get().profile) });
      },

      clearChat: () => set({ chatMessages: [] }),

      sendChatMessage: async (content) => {
        const { profile, calendarTasks, opportunities, goals, chatMessages } = get();

        const userMsg = { role: 'user' as const, content };
        const updatedMessages = [...chatMessages, userMsg];
        set({ chatMessages: updatedMessages });

        const upcomingTasks = [...calendarTasks]
          .sort((a, b) => new Date(`${a.date}T${a.startTime}`).getTime() - new Date(`${b.date}T${b.startTime}`).getTime())
          .slice(0, 10)
          .map(t => `• ${t.title} — ${t.date} ${t.startTime}–${t.endTime}`)
          .join('\n');

        const topOpps = opportunities
          .filter(o => o.category !== 'ignore')
          .slice(0, 8)
          .map(o => `• ${o.title} (priority: ${o.priority}/10, deadline: ${o.deadline ?? 'none'})`)
          .join('\n');

        const confirmedGoals = goals.filter(g => g.confirmed === true).map(g => `• ${g.text}`).join('\n');
        const pendingGoals = goals.filter(g => g.confirmed === null).map(g => `• ${g.text}`).join('\n');

        const mealsText = [
          profile.breakfastTime ? `Breakfast: ${profile.breakfastTime} (${profile.breakfastDurationMinutes}min)` : null,
          profile.lunchStart ? `Lunch: ${profile.lunchStart} (${profile.lunchDurationMinutes}min)` : null,
          profile.dinnerTime ? `Dinner: ${profile.dinnerTime} (${profile.dinnerDurationMinutes}min)` : null,
        ].filter(Boolean).join(', ');

        const systemPrompt = `You are a personal career and life strategy assistant for ${profile.name || 'the user'}.

User Profile:
- Career goals: ${profile.careerGoals || 'not specified'}
- Professional interests: ${profile.professionalInterests || 'not specified'}
- Experience level: ${profile.experienceLevel}
- Target industries: ${profile.targetIndustries || 'not specified'}
- Actively looking for internships: ${profile.activelyLooking ? 'yes' : 'no'}
- Schedule intensity: ${profile.scheduleIntensity}
- Daily schedule: Wake ${profile.wakeTime}, Sleep ${profile.sleepTime}
- Meals: ${mealsText || 'not specified'}
- Blocked times: ${(profile.scheduleBlocks ?? []).map(b => `${b.name} ${b.startTime}–${b.endTime} (${b.recurrence})`).join('; ') || 'none'}

Upcoming calendar events:
${upcomingTasks || 'none'}

Top opportunities:
${topOpps || 'none'}

Active goals:
${confirmedGoals || 'none'}

Pending goals to review:
${pendingGoals || 'none'}

You help the user analyze their career strategy, schedule, and opportunities. Keep responses concise and actionable. If the user mentions new career interests or goals that differ from their profile, note the shift and ask if they'd like to update their profile. Use their name if you know it.

WHY / PURPOSE / WORTH-IT MODE — triggered by: "why does this matter", "what is the purpose", "should I do this", "is this worth it", "why should I", or any question asking for justification or value.

Rules for this mode:
- DO NOT repeat or summarize the task back to the user
- DO NOT use generic phrases like "builds skills", "expands network", "good for growth" without specifics
- Always tie the answer to: deadlines, probability of success, or leverage (what moves the needle most)
- Max 5–6 lines total

Structure to follow exactly:
1. IMPACT — what outcome does this action directly influence? Be specific.
2. CONSEQUENCE — what happens if they skip it? (lost opportunity, missed deadline, weakened position)
3. PRIORITY COMPARISON — how does it rank against their other tasks? (higher/lower value and why)
4. SIMPLIFIED TAKEAWAY — one clear recommendation

Example output format:
"The purpose is to maximize [specific outcome].
- [Task A] → high impact because [specific reason tied to deadline/probability/leverage]
- [Task B] → moderate impact because [specific reason]
If you skip [task], the consequence is [specific loss].
Recommendation: [one clear action]"

EMAIL REASONING RULES — apply these whenever discussing, summarizing, or acting on emails:

1. Prefer future-facing emails over past ones. Prioritize upcoming meetings, deadlines, follow-ups, events, pending approvals, and incomplete tasks. Deprioritize resolved conversations unless needed for context.
2. Treat time carefully. Use the email's actual timestamp compared to today's date. Distinguish clearly between past, today, upcoming, overdue, and unscheduled. Never assume relative words like "tomorrow" or "next Friday" without grounding them in the sent date.
3. Prefer actionable threads. Surface emails requiring a reply, decision, attendance, payment, confirmation, or document submission. Ignore newsletters, promotions, and FYI emails unless explicitly requested.
4. Be conservative. Never send, archive, delete, label, or draft a reply unless explicitly asked. Default to summarizing and recommending actions first.
5. Use the latest message in a thread. Do not base conclusions on an older message if a newer one changes the plan.
6. Identify open vs. closed threads. Open = pending task, unresolved question, future event, or expected follow-up. Closed = clearly resolved.
7. Extract deadlines and commitments. For each important email identify: what is happening, when it is happening, whether action is needed, and the recommended next step.
8. When summarizing, organize by urgency: (1) urgent and upcoming, (2) upcoming but not urgent, (3) waiting / no action needed yet, (4) past / resolved.
9. Be explicit about uncertainty. If a date, owner, or next action is unclear, say so — do not guess.
10. Never invent recipients, dates, agreements, or attachments. Never assume an email is unimportant just because it is short.

SCHEDULING RULES (hard constraints — follow exactly):

DEFINITIONS:
- Blocked time = sleep, meals, classes, existing commitments, manually blocked personal time. NEVER schedule inside it without explicit user approval.
- Fixed-time event = anything with a real stated time (meeting, class, workshop, networking event, career fair). Keep at its real time. Never move or split.
- Flexible task = internship apps, studying, research, resume work. Can be moved and split.
- Free space = all time after removing blocked time, fixed events, meals, sleep.

HARD RULES:
1. NEVER place tasks inside blocked time. If the only option is blocked time, mark it "Awaiting Permission" and ask the user first.
2. Fixed events stay at their real start time. Do not move them.
3. Never split fixed events. Only flexible tasks may be split.
4. When splitting a flexible task, label all blocks after the first as "(continued)".
5. Place tasks in priority order: fixed events first, then flexible tasks by urgency (deadline proximity) then importance.
6. Stack flexible tasks sequentially. Prefer contiguous blocks. Split only when necessary.
7. Respect workload budget: Light=4h, Moderate=6h, Heavy=8h, Insane=16h. Do not schedule more than the budget unless required by a same-day deadline.
8. If budget is exceeded: move lower-priority tasks to the next day. Mark same-day deadline tasks that exceed budget as "Needs Confirmation" and ask the user.
9. If free space is exhausted: do not silently cram more in. Mark remaining tasks as Deferred or Unscheduled and tell the user.
10. If two fixed events overlap: show a Scheduling Conflict. Do not auto-resolve. The user must choose.
11. Leave small buffers (5–15 min) around fixed events and between long focus blocks.
12. Do not fill every empty minute. Open time after the workload budget is met should stay free.

STATUS LABELS — use these exactly:
- Confirmed: scheduled within budget, no conflicts
- Needs Confirmation: scheduled but exceeds workload budget or uses protected time
- Scheduling Conflict: two fixed events overlap, user must resolve
- Deferred: moved to next day due to workload limit
- Unscheduled: partially placed (show how much time remains)
- Awaiting Permission: would require overriding blocked time

OUTPUT FORMAT for any schedule you propose:
For each item: title | type | status | date/time | total scheduled hours
For split tasks: show all blocks, mark continuations, show total across blocks
For overflow: list what was deferred and why
For conflicts: list both items and tell the user to choose

==================================================
RESPONSE MODES — follow exactly, never mix
==================================================

MODE 1 — PRIORITIZATION MODE
Trigger: user asks "what should I prioritize", "what matters most", "what should I focus on", or any similar question about importance/priority.
Rules:
- DO NOT generate a schedule or time blocks
- DO NOT produce tables
- List at most 3–5 items
- Max 6 lines total in the response body
- Structure: top 3 priorities → 1–2 sentence explanation → one suggested next action → optional follow-up question
- If your response exceeds 8 lines, shorten it before sending

MODE 2 — PLANNING MODE
Trigger: user asks "make a schedule", "plan my day", "plan my week", or similar explicit scheduling requests.
Rules:
- Apply all scheduling rules above
- Show full schedule with status labels and hours
- Respect blocked time, workload budget, fixed events

MODE 3 — CONFLICT MODE
Trigger: the user describes or asks about a conflict between two events or tasks.
Rules:
- Clearly surface the conflict
- DO NOT resolve it automatically
- Ask the user to choose or reschedule

DEFAULT RULE: If the trigger is ambiguous, use PRIORITIZATION MODE — not planning mode.
HARD RULE: Never mix modes in a single response. Pick one and follow it completely.`;

        // Append placeholder for streaming
        set({ chatMessages: [...updatedMessages, { role: 'assistant' as const, content: '' }] });

        try {
          const res = await fetch('/api/ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [
                { role: 'system', content: systemPrompt },
                ...updatedMessages,
              ],
              stream: true,
            }),
          });

          if (!res.ok || !res.body) {
            set({ chatMessages: [...updatedMessages, { role: 'assistant' as const, content: 'Sorry, I could not connect to the AI service.' }] });
            return;
          }

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let fullText = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            for (const line of chunk.split('\n')) {
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6).trim();
              if (data === '[DONE]') break;
              try {
                const json = JSON.parse(data);
                const delta = json.choices?.[0]?.delta?.content ?? '';
                fullText += delta;
                // Hide thinking content (everything before </think>) while streaming
                const thinkClose = fullText.indexOf('</think>');
                const displayText = thinkClose !== -1
                  ? fullText.slice(thinkClose + '</think>'.length).trim()
                  : '';
                set({ chatMessages: [...updatedMessages, { role: 'assistant' as const, content: displayText || '…' }] });
              } catch { /* skip malformed */ }
            }
          }

          // After streaming done, store the clean final text for history (so future turns have real context)
          const thinkClose = fullText.indexOf('</think>');
          const finalContent = thinkClose !== -1
            ? fullText.slice(thinkClose + '</think>'.length).trim()
            : fullText.trim();
          set({ chatMessages: [...updatedMessages, { role: 'assistant' as const, content: finalContent || '(no response)' }] });
        } catch {
          set({ chatMessages: [...updatedMessages, { role: 'assistant' as const, content: 'Could not connect to AI service.' }] });
        }
      },

      aiPlanCalendar: async () => {
        const { profile, calendarTasks, opportunities } = get();
        set({ aiPlanLoading: true, aiPlanSummary: "" });

        try {
          const today = new Date().toISOString().slice(0, 10);
          // Plan over the next 14 days
          const horizon = Array.from({ length: 14 }, (_, i) => {
            const d = new Date(today + 'T00:00:00');
            d.setDate(d.getDate() + i);
            return d.toISOString().slice(0, 10);
          });

          const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

          const mealsText = [
            profile.wakeTime ? `Wake: ${profile.wakeTime}` : null,
            profile.sleepTime ? `Sleep: ${profile.sleepTime}` : null,
            profile.breakfastTime && profile.breakfastDurationMinutes > 0
              ? `Breakfast: ${profile.breakfastTime} (${profile.breakfastDurationMinutes}min)` : null,
            profile.lunchStart && profile.lunchDurationMinutes > 0
              ? `Lunch: ${profile.lunchStart} (${profile.lunchDurationMinutes}min)` : null,
            profile.dinnerTime && profile.dinnerDurationMinutes > 0
              ? `Dinner: ${profile.dinnerTime} (${profile.dinnerDurationMinutes}min)` : null,
          ].filter(Boolean).join(' | ');

          const blocksText = (profile.scheduleBlocks ?? []).length > 0
            ? (profile.scheduleBlocks ?? []).map(b => `  - ${b.name}: ${b.startTime}–${b.endTime} (${b.recurrence})`).join('\n')
            : '  none';

          const doNotText = profile.doNotScheduleDays?.length
            ? profile.doNotScheduleDays.join(', ') : 'none';

          const budgetMap: Record<string, string> = {
            light: '4 hours/day', moderate: '6 hours/day',
            heavy: '8 hours/day', insane: '16 hours/day',
          };

          // Fixed events in the planning window
          const fixedTasks = calendarTasks.filter(
            t => isFixed(t) && horizon.includes(t.date)
          ).sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

          const fixedText = fixedTasks.length > 0
            ? fixedTasks.map(t => {
                const dow = DAYS[new Date(t.date + 'T00:00:00').getDay()];
                return `  - ${t.date} ${dow}: ${t.title} | ${t.startTime}–${t.endTime} | type=${t.type}`;
              }).join('\n')
            : '  none';

          // Flexible tasks to schedule (only tasks in horizon or unscheduled)
          const flexTasks = calendarTasks.filter(t => !isFixed(t));

          // Include pending opportunities that haven't been added yet (interested but not on calendar)
          const pendingOpps = opportunities.filter(
            o => o.interested === true && !o.addedToCalendar && o.deadline
          );

          // ── Pre-compute constraint violations for each flexible task ──────────
          function computeViolations(
            t: CalendarTask,
            deadline: string | null,
            dueAt: string | undefined,
          ): string[] {
            const violations: string[] = [];
            const taskStartM = timeToMinutes(t.startTime);
            const taskEndM   = timeToMinutes(t.endTime);

            // 1. After-deadline check
            if (deadline) {
              if (t.date > deadline) {
                violations.push(`after_deadline (placed ${t.date} but deadline is ${deadline})`);
              } else if (t.date === deadline && dueAt && taskEndM > timeToMinutes(dueAt)) {
                violations.push(`after_deadline (ends ${t.endTime} but dueAt is ${dueAt})`);
              }
            }

            // 2. Overlap with fixed events on the same day
            const fixedOnDay = getFixedEventsForDay(calendarTasks, t.date);
            for (const f of fixedOnDay) {
              const fStart = timeToMinutes(f.startTime);
              const fEnd   = timeToMinutes(f.endTime);
              if (fStart < taskEndM && fEnd > taskStartM) {
                violations.push(`overlaps_fixed_event "${f.title}" (${f.startTime}–${f.endTime})`);
              }
            }

            // 3. Overlap with blocked intervals (sleep, meals, schedule blocks)
            // Skip if the user already explicitly accepted this conflict.
            const userAccepted = t.conflictOverride === true || t.status === 'confirmed_with_override';
            if (!userAccepted) {
              const blocked = getBlockedIntervalsForDay(profile, t.date);
              for (const b of blocked) {
                if (b.start < taskEndM && b.end > taskStartM) {
                  violations.push(`in_blocked_time "${b.label}" (${minutesToTime(b.start)}–${minutesToTime(b.end)})`);
                  break; // one blocked-time violation per task is enough
                }
              }
            }

            return violations;
          }

          const flexText = flexTasks.length > 0
            ? flexTasks.map(t => {
                const opp      = opportunities.find(o => o.id === t.opportunityId);
                const deadline = opp?.deadline ?? null;
                const dueAt    = opp?.dueAt;
                const durationMin = Math.round(
                  (new Date(`1970-01-01T${t.endTime}`).getTime() -
                   new Date(`1970-01-01T${t.startTime}`).getTime()) / 60000,
                );
                const violations = computeViolations(t, deadline, dueAt);
                const violationStr = violations.length > 0
                  ? ` | ⚠ VIOLATIONS: ${violations.join('; ')}`
                  : ' | placement: OK';
                const deadlineStr = deadline
                  ? `${deadline}${dueAt ? ` ${dueAt}` : ''}`
                  : 'none';
                return (
                  `  - id=${t.id} | ${t.title} | ${durationMin}min` +
                  ` | deadline=${deadlineStr}` +
                  ` | currentPlacement: ${t.date} ${t.startTime}–${t.endTime}` +
                  `${violationStr}` +
                  ` | type=${t.type} | color=${t.color}` +
                  (t.opportunityId ? ` | opportunityId=${t.opportunityId}` : '')
                );
              }).join('\n')
            : '  none';

          const pendingText = pendingOpps.length > 0
            ? pendingOpps.map(o =>
                `  - PENDING | ${o.title} | ${Math.round(o.estimatedHours * 60)}min | deadline=${o.deadline} | priority=${o.priority}/10`
              ).join('\n')
            : '  none';

          const userMessage = `Today is ${today} (${DAYS[new Date(today + 'T00:00:00').getDay()]}).
Planning horizon: ${today} through ${horizon[horizon.length - 1]}.

## User Profile
- ${mealsText}
- Schedule intensity: ${profile.scheduleIntensity} (workload budget: ${budgetMap[profile.scheduleIntensity] ?? '6 hours/day'})
- Preferred work window: ${profile.preferredStartTime ?? '09:00'} – ${profile.preferredEndTime ?? '22:00'}
- Do not schedule on: ${doNotText}

## Additional Blocked Time (Schedule Blocks)
${blocksText}

## Fixed Events (DO NOT MOVE OR SPLIT)
${fixedText}

## Flexible Tasks — current placement shown, repair if VIOLATIONS are present
${flexText}

## Pending Opportunities (interested but not yet on calendar — you may optionally pre-schedule these as prospect tasks)
${pendingText}

## Instructions
Apply all planning rules from your system prompt. Produce the optimal schedule for the flexible tasks above.
Return ONLY the JSON object — no markdown, no explanation.`;

          const res = await fetch('/api/ai/plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userMessage }),
          });

          if (!res.ok) {
            const err = await res.json();
            console.error('AI plan error:', err);
            set({ aiPlanLoading: false, aiPlanSummary: 'Planning failed. Try again.' });
            return;
          }

          const plan = await res.json();

          console.log('[aiPlan] raw AI response:', JSON.stringify({
            scheduledCount: plan.scheduledTasks?.length ?? 0,
            unscheduledCount: plan.unscheduled?.length ?? 0,
            warnings: plan.warnings,
            summary: plan.summary,
            tasks: plan.scheduledTasks?.map((t: { id: string; title: string; date: string; startTime: string; endTime: string; status: string }) => `${t.id} → ${t.date} ${t.startTime}–${t.endTime} [${t.status}]`),
          }, null, 2));

          if (plan.scheduledTasks && Array.isArray(plan.scheduledTasks)) {
            const fixed = calendarTasks.filter(t => isFixed(t));

            // Build a map of original flexible tasks so we can merge properties back.
            // The AI schema omits confirmed, opportunityId, completionStatus, etc. —
            // stripping them breaks violation detection on subsequent runs (no opportunityId
            // → deadline lookup fails → after_deadline never flagged again).
            const originalFlexMap = new Map(
              calendarTasks.filter(t => !isFixed(t)).map(t => [t.id, t]),
            );

            const plannedIds = new Set<string>();
            const mergedFlexTasks: CalendarTask[] = (plan.scheduledTasks as Partial<CalendarTask>[]).map((aiTask) => {
              const id = aiTask.id!;
              plannedIds.add(id);
              const original = originalFlexMap.get(id);
              return {
                // Base: all original properties (confirmed, opportunityId, completionStatus, etc.)
                ...(original ?? {}),
                // Override: AI's new date/startTime/endTime/type/color/status
                ...aiTask,
                // Explicitly re-stamp critical fields the AI schema doesn't carry
                confirmed:        original?.confirmed        ?? false,
                opportunityId:    original?.opportunityId    ?? (aiTask as CalendarTask).opportunityId,
                completionStatus: original?.completionStatus,
                xpAwarded:        original?.xpAwarded,
              } as CalendarTask;
            });

            // Safety net: retain flexible tasks the AI silently omitted rather than
            // dropping them. They keep their current placement and will be flagged
            // again on the next violation scan.
            const retainedFlexTasks = calendarTasks.filter(
              t => !isFixed(t) && !plannedIds.has(t.id),
            );
            if (retainedFlexTasks.length > 0) {
              console.warn('[aiPlan] AI omitted these flexible tasks — retained in place:',
                retainedFlexTasks.map(t => t.title));
            }

            const newTasks = [...fixed, ...mergedFlexTasks, ...retainedFlexTasks];
            set({
              calendarTasks: newTasks,
              conflicts: detectConflicts(newTasks, profile),
              aiPlanSummary: plan.summary ?? '',
            });
          }
        } catch (e) {
          console.error('aiPlanCalendar error:', e);
          set({ aiPlanSummary: 'Could not connect to AI planner.' });
        } finally {
          set({ aiPlanLoading: false });
        }
      },

      rerankOpportunities: () => get().reloadOpportunities(),

      setEmails: (emails) => {
        const profile = get().profile;
        const existing = get().opportunities;
        const fresh = rankOpportunities(deriveOpportunitiesFromEmails(emails), profile);
        // Preserve user decisions on any opportunity that survived
        const existingMap = new Map(existing.map((o) => [o.id, o]));
        const merged = fresh.map((opp) => {
          const prev = existingMap.get(opp.id);
          return prev ? { ...opp, interested: prev.interested, addedToCalendar: prev.addedToCalendar } : opp;
        });
        set({ emails, opportunities: merged, gmailConnected: true });
      },

      reloadOpportunities: () => {
        const { emails, profile, opportunities: existing } = get();
        const fresh = rankOpportunities(deriveOpportunitiesFromEmails(emails), profile);
        // Preserve user decisions (interested, addedToCalendar) for opportunities
        // that survived deduplication with the same canonical id.
        const existingMap = new Map(existing.map((o) => [o.id, o]));
        const merged = fresh.map((opp) => {
          const prev = existingMap.get(opp.id);
          if (!prev) return opp;
          return {
            ...opp,
            interested:      prev.interested,
            addedToCalendar: prev.addedToCalendar,
          };
        });
        set({ opportunities: merged });
      },

      rerankWithK2: async () => {
        const { opportunities, profile } = get();
        set({ rerankLoading: true });
        const topN = 15;
        try {
          const res = await fetch('/api/ai/rerank', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              opportunities: opportunities.slice(0, topN).map(o => ({
                id: o.id,
                title: o.title,
                description: o.description,
                category: o.category,
                deadline: o.deadline,
                priority: o.priority,
                priorityReason: o.priorityReason,
              })),
              profile: {
                careerGoals: profile.careerGoals,
                professionalInterests: profile.professionalInterests,
                targetIndustries: profile.targetIndustries,
                experienceLevel: profile.experienceLevel,
                activelyLooking: profile.activelyLooking,
              },
              topN,
            }),
          });
          if (!res.ok) return;
          const parsed = await res.json() as {
            results?: Array<{ opportunityId: string; aiPriority: number; aiReason: string }>;
            reranked?: Array<{ id: string; aiPriority: number; aiReason: string }>;
          };
          // Support new shape (results/opportunityId) and old shape (reranked/id)
          const entries = parsed.results
            ? parsed.results.map(r => ({ id: r.opportunityId, aiPriority: r.aiPriority, aiReason: r.aiReason }))
            : (parsed.reranked ?? []);
          const aiMap = new Map(entries.map(r => [r.id, r]));
          // Store aiRelevanceScore per-opp, then re-run rankOpportunities so the
          // 4-layer weights (with AI) are applied and finalScore is recomputed cleanly.
          const withAIScores = opportunities.map(o => {
            const ai = aiMap.get(o.id);
            if (!ai) return o;
            return { ...o, aiRelevanceScore: ai.aiPriority, aiExplanation: ai.aiReason };
          });
          set({ opportunities: rankOpportunities(withAIScores, profile) });
        } catch (e) {
          console.error('rerankWithK2 error:', e);
        } finally {
          set({ rerankLoading: false });
        }
      },

      resetStore: () => {
        set({
          profile: DEFAULT_PROFILE,
          goals: DEFAULT_GOALS,
          calendarTasks: [],
          conflicts: [],
          emails: [],
          opportunities: [],
          gmailConnected: false,
          lastCalendarUndo: null,
          onboardingComplete: false,
          aiInsight: "",
          aiInsightLoading: false,
          dailyStrategy: null,
          activeTab: "dashboard",
          chatMessages: [],
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
          chatMessages,
          lastCalendarUndo,
          ...persisted
        } = state;
        void emails;
        void opportunities;
        void aiInsight;
        void aiInsightLoading;
        void dailyStrategy;
        void chatMessages;
        void lastCalendarUndo;
        return persisted;
      },
      // Merge stored profile with DEFAULT_PROFILE so new fields always have values
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<AppState>),
        profile: {
          ...DEFAULT_PROFILE,
          ...((persisted as Partial<AppState>).profile ?? {}),
        },
      }),
      // After hydration the stored profile is available — re-rank with it so
      // opportunities are never scored against DEFAULT_PROFILE on page load.
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.reloadOpportunities();
        }
      },
    },
  ),
);
