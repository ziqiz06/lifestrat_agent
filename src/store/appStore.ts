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
  addOpportunityToCalendar: (opportunityId: string, opts?: { endTime?: string; durationMinutes?: number; title?: string }) => void;
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
  updateCalendarTask: (taskId: string, updates: Partial<Pick<import('@/types').CalendarTask, 'title' | 'startTime' | 'endTime'>>) => void;
  sendChatMessage: (content: string) => Promise<void>;
  clearChat: () => void;
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
      conflicts: detectConflicts(mockCalendarTasks, DEFAULT_PROFILE),
      goals: DEFAULT_GOALS,
      activeTab: "dashboard",
      onboardingComplete: false,
      aiInsight: "",
      aiInsightLoading: false,
      dailyStrategy: null,
      character: null,
      chatMessages: [],

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
        const rankedOpps = rankOpportunities(get().opportunities, profile);
        const strategy = generateDailyStrategy(rankedOpps, profile);
        const reflowed = reflowCalendar(get().calendarTasks, profile);
        set({ profile, opportunities: rankedOpps, dailyStrategy: strategy, calendarTasks: reflowed, conflicts: detectConflicts(reflowed, profile) });
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
        if (!opp || !opp.deadline) return;
        const profile = get().profile;
        const taskTitle = opts?.title ?? opp.title;

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

        // opts can override duration or end time (from the schedule modal)
        const durationMin = opts?.durationMinutes ?? Math.round(opp.estimatedHours * 60);

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
          startTime = opp.eventTime;
          endTime = opts?.endTime ?? opp.eventEndTime ?? calcEnd(startTime, durationMin);
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
            startTime = profile.preferredStartTime || '09:00';
            endTime = calcEnd(startTime, durationMin);
          }
          taskFlex = 'flexible';
        } else {
          // ── Fixed-time category but no parseable clock time ──────────────────
          startTime = profile.preferredStartTime || '09:00';
          endTime = opts?.endTime ?? calcEnd(startTime, durationMin);
          taskFlex = 'fixed';
        }

        const newTask: CalendarTask = {
          id: `opp-task-${opportunityId}`,
          title: taskTitle,
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
        const conflicts = detectConflicts(newTasks, get().profile);

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
        const newTasks = get().calendarTasks.filter((t) => t.id !== removeTaskId);
        set((state) => ({
          calendarTasks: newTasks,
          conflicts: detectConflicts(newTasks, get().profile),
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

      resetStore: () => {
        set({
          profile: DEFAULT_PROFILE,
          goals: DEFAULT_GOALS,
          calendarTasks: mockCalendarTasks,
          conflicts: detectConflicts(mockCalendarTasks, DEFAULT_PROFILE),
          opportunities: rankOpportunities(
            deriveOpportunitiesFromEmails(mockEmails),
            DEFAULT_PROFILE,
          ),
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
          ...persisted
        } = state;
        void emails;
        void opportunities;
        void aiInsight;
        void aiInsightLoading;
        void dailyStrategy;
        void chatMessages;
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
    },
  ),
);
