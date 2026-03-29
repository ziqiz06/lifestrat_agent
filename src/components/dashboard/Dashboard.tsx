"use client";
import { useAppStore } from "@/store/appStore";
import { Plan } from "@/types";
import { generatePlans } from "@/lib/strategyEngine";
import PixelSprite from "@/components/character/PixelSprite";
import {
  getArchetypePalette,
  STAT_META,
  SIGNAL_META,
} from "@/lib/characterEngine";
import type { CharacterStats } from "@/types";

// ── Character mini-card ───────────────────────────────────────────────────────
function CharacterMiniCard() {
  const { character, setActiveTab } = useAppStore();

  if (!character) {
    return (
      <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white flex items-center gap-2">
            <span>⚔️</span> Dual Self
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            Create a character that evolves with your choices
          </p>
        </div>
        <button
          onClick={() => setActiveTab("character")}
          className="py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors shrink-0"
        >
          Create →
        </button>
      </div>
    );
  }

  const palette = getArchetypePalette(character.archetype);
  const topSignal = character.signals[0];
  const signalMeta = topSignal ? SIGNAL_META[topSignal] : null;
  const statKeys = Object.keys(character.stats) as (keyof CharacterStats)[];

  return (
    <div
      className="rounded-2xl p-5 border cursor-pointer transition-all hover:brightness-110"
      style={{
        borderColor: `${palette.glow}30`,
        background: `radial-gradient(ellipse at top left, ${palette.glow}14, transparent 55%), #1f2937`,
      }}
      onClick={() => setActiveTab("character")}
    >
      <div className="flex items-center gap-4">
        {/* Sprite */}
        <div className="shrink-0">
          <PixelSprite
            palette={palette}
            scale={3}
            animated
            signals={character.signals}
          />
        </div>

        {/* Identity + stats */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-sm font-bold text-white truncate">
              {character.name}
            </h3>
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
              style={{
                backgroundColor: `${palette.glow}22`,
                color: palette.glow,
                border: `1px solid ${palette.glow}44`,
              }}
            >
              Lv {character.level}
            </span>
          </div>
          <p className="text-xs mb-2" style={{ color: palette.glow }}>
            {character.archetype}
          </p>

          {/* Mini stat bars */}
          <div className="space-y-1">
            {statKeys.map((key) => {
              const meta = STAT_META[key];
              const val = character.stats[key];
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-[10px] w-16 text-gray-500 shrink-0">
                    {meta.label}
                  </span>
                  <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${val}%`, backgroundColor: meta.color }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-600 w-6 text-right tabular-nums">
                    {val}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Signal badge */}
        {signalMeta && (
          <div className="shrink-0 hidden sm:flex flex-col items-center gap-1">
            <span className="text-lg">{signalMeta.icon}</span>
            <span
              className="text-[10px] font-medium text-center leading-tight"
              style={{ color: signalMeta.color }}
            >
              {signalMeta.label}
            </span>
          </div>
        )}
      </div>

      <p className="text-[10px] text-gray-600 mt-3 text-right">
        View full character sheet →
      </p>
    </div>
  );
}

function AIInsightPanel() {
  const { aiInsight, aiInsightLoading, profile, generateAIInsights } =
    useAppStore();

  if (!aiInsight && !aiInsightLoading) {
    return (
      <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white">AI Strategy Insights</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Generate a personalized plan from K2 Think
          </p>
        </div>
        <button
          onClick={() => generateAIInsights(profile)}
          className="py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
        >
          Generate →
        </button>
      </div>
    );
  }

  return (
    <div className="bg-linear-to-br from-indigo-950/60 to-purple-950/60 rounded-2xl p-5 border border-indigo-700/40">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-white flex items-center gap-2">
          <span>🤖</span> AI Strategy (K2 Think)
        </h2>
        {aiInsightLoading && (
          <span className="text-xs text-indigo-400 animate-pulse">
            Thinking...
          </span>
        )}
        {!aiInsightLoading && (
          <button
            onClick={() => generateAIInsights(profile)}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Refresh ↻
          </button>
        )}
      </div>
      {/* Render markdown-like bold headings */}
      <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
        {aiInsight.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
          part.startsWith("**") && part.endsWith("**") ? (
            <span key={i} className="font-semibold text-white">
              {part.slice(2, -2)}
            </span>
          ) : (
            <span key={i}>{part}</span>
          ),
        )}
        {aiInsightLoading && <span className="animate-pulse">▌</span>}
      </div>
    </div>
  );
}

function PlansPanel({ plans }: { plans: Plan[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
      {plans.map((plan) => (
        <div
          key={plan.name}
          className="bg-gray-800/60 rounded-xl p-4 border border-gray-700"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-indigo-400 bg-indigo-900/40 px-2 py-0.5 rounded-full">
              {plan.name}
            </span>
            <span className="text-xs text-gray-400">{plan.focus}</span>
          </div>
          <p className="text-xs text-gray-500 mb-3 italic">
            {plan.explanation}
          </p>
          <ol className="space-y-2">
            {plan.items.map((item, idx) => (
              <li key={item.opportunityId} className="flex items-start gap-2">
                <span className="text-xs text-indigo-400 shrink-0 font-mono mt-0.5">
                  {idx + 1}.
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white font-medium truncate">
                    {item.action}
                  </p>
                  {item.reason && (
                    <p className="text-xs text-gray-500 truncate">
                      {item.reason}
                    </p>
                  )}
                </div>
                <span className="text-xs text-gray-600 shrink-0">
                  {item.estimatedHours}h
                </span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

function TodaysStrategyPanel() {
  const { dailyStrategy, computeStrategy, conflicts, opportunities, profile } =
    useAppStore();

  if (!dailyStrategy) {
    return (
      <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white">
            Today&apos;s Strategy
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            Get a prioritized action plan for your day
          </p>
        </div>
        <button
          onClick={computeStrategy}
          className="py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
        >
          Compute Strategy →
        </button>
      </div>
    );
  }

  const showPlans = conflicts.length >= 2;
  const plans = showPlans ? generatePlans(opportunities, profile) : [];

  return (
    <div className="bg-gray-800 rounded-2xl p-5 border border-indigo-700/30">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-white flex items-center gap-2">
            <span>📋</span> Today&apos;s Strategy
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">{dailyStrategy.date}</p>
        </div>
        <button
          onClick={computeStrategy}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Refresh ↻
        </button>
      </div>

      {/* Top actions */}
      {dailyStrategy.topActions.length === 0 ? (
        <p className="text-sm text-gray-500">
          No high-priority actions for today.
        </p>
      ) : (
        <ol className="space-y-3 mb-4">
          {dailyStrategy.topActions.map((item, idx) => (
            <li key={item.opportunityId} className="flex items-start gap-3">
              <span className="text-sm font-bold text-indigo-400 shrink-0 w-5 text-right">
                {idx + 1}.
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium">{item.action}</p>
                {item.reason && (
                  <p className="text-xs text-gray-500 mt-0.5">{item.reason}</p>
                )}
              </div>
              <span className="text-xs text-gray-600 shrink-0 mt-0.5">
                {item.estimatedHours}h
              </span>
            </li>
          ))}
        </ol>
      )}

      {/* Deferred items */}
      {dailyStrategy.deferredItems.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <p className="text-xs font-semibold text-gray-400 mb-2">
            Defer to tomorrow:
          </p>
          <ul className="space-y-1.5">
            {dailyStrategy.deferredItems.map((item) => (
              <li key={item.opportunityId} className="flex items-start gap-2">
                <span className="text-gray-600 text-xs mt-0.5">–</span>
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-gray-400">{item.action}</span>
                  {item.reason && (
                    <span className="text-xs text-gray-600">
                      {" "}
                      — {item.reason}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Overload warning */}
      {dailyStrategy.overloaded && (
        <div className="mt-3 pt-3 border-t border-yellow-700/40 flex items-start gap-2">
          <span className="text-yellow-400 text-sm">⚠️</span>
          <p className="text-xs text-yellow-400">
            This day is overloaded ({dailyStrategy.totalScheduledHours}h planned
            / {dailyStrategy.availableHours}h available). Consider dropping
            lower-priority items.
          </p>
        </div>
      )}

      {/* Plans A/B when conflicts exist */}
      {showPlans && plans.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <p className="text-xs font-semibold text-gray-400 mb-1">
            You have {conflicts.length} schedule conflicts — choose a plan:
          </p>
          <PlansPanel plans={plans} />
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const {
    profile,
    opportunities,
    conflicts,
    calendarTasks,
    goals,
    setActiveTab,
    confirmGoal,
    resolveConflict,
  } = useAppStore();

  const today = "2026-03-28";
  const todayTasks = calendarTasks.filter(
    (t) => t.date === today || t.date === "2026-03-29",
  );
  const topOpps = opportunities
    .filter((o) => o.interested === null && o.category !== "ignore")
    .slice(0, 3);
  const pendingGoals = goals.filter((g) => g.confirmed === null);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Character mini-card */}
      <CharacterMiniCard />

      {/* AI Insights */}
      <AIInsightPanel />

      {/* Today's Strategy */}
      <TodaysStrategyPanel />

      {/* Welcome */}
      <div className="bg-linear-to-r from-indigo-900/50 to-purple-900/50 rounded-2xl p-5 border border-indigo-800/50">
        <h1 className="text-xl font-bold text-white mb-1">
          Good morning{profile.name ? `, ${profile.name}` : ""}! 👋
        </h1>
        <p className="text-gray-300 text-sm">
          {profile.scheduleIntensity === "intense"
            ? "🔥 Intense mode — let's crush it today."
            : profile.scheduleIntensity === "light"
              ? "🌱 Light mode — steady and sustainable."
              : "⚡ Moderate mode — balanced and productive."}
        </p>
      </div>

      {/* Grid: conflicts + top priorities */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Conflicts */}
        {conflicts.length > 0 && (
          <div className="bg-gray-800 rounded-2xl p-5 border border-red-800/50">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <span className="text-red-400">⚠️</span> Schedule Conflicts
              </h2>
              <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
                {conflicts.length}
              </span>
            </div>
            {conflicts.slice(0, 2).map((c) => (
              <div key={c.id} className="mb-3 last:mb-0">
                <p className="text-sm text-gray-300 mb-1">{c.reason}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => resolveConflict(c.id, c.taskAId)}
                    className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded px-2 py-1 transition-colors"
                  >
                    Keep &quot;{c.taskATitle.slice(0, 20)}...&quot;
                  </button>
                  <button
                    onClick={() => resolveConflict(c.id, c.taskBId)}
                    className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded px-2 py-1 transition-colors"
                  >
                    Keep &quot;{c.taskBTitle.slice(0, 20)}...&quot;
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Goals */}
        {pendingGoals.length > 0 && (
          <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700">
            <h2 className="font-semibold text-white mb-3 flex items-center gap-2">
              <span>🎯</span> Your Weekly Goals
            </h2>
            <div className="space-y-3">
              {pendingGoals.slice(0, 3).map((g) => (
                <div key={g.id} className="flex items-start gap-3">
                  <p className="text-sm text-gray-300 flex-1">{g.text}</p>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => confirmGoal(g.id, true)}
                      className="text-xs bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-600/50 rounded px-2 py-0.5 transition-colors"
                    >
                      Add to plan
                    </button>
                    <button
                      onClick={() => confirmGoal(g.id, false)}
                      className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-400 rounded px-2 py-0.5 transition-colors"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Today's schedule */}
      <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <span>📅</span> Upcoming Schedule
          </h2>
          <button
            onClick={() => setActiveTab("calendar")}
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            View all →
          </button>
        </div>
        {todayTasks.length === 0 ? (
          <p className="text-gray-500 text-sm">
            No tasks scheduled. Add some from Opportunities!
          </p>
        ) : (
          <div className="space-y-2">
            {todayTasks.slice(0, 5).map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 py-2 border-b border-gray-700 last:border-0"
              >
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: task.color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{task.title}</p>
                  <p className="text-xs text-gray-500">
                    {task.date} • {task.startTime}–{task.endTime}
                  </p>
                </div>
                {task.conflict && (
                  <span className="text-xs text-red-400">⚠️ Conflict</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top opportunities */}
      <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <span>🚀</span> Top Opportunities
          </h2>
          <button
            onClick={() => setActiveTab("opportunities")}
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            See all →
          </button>
        </div>
        <div className="space-y-3">
          {topOpps.map((opp) => (
            <div key={opp.id} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-900/50 flex items-center justify-center text-sm shrink-0">
                {opp.priority >= 9 ? "🔴" : opp.priority >= 7 ? "🟡" : "🟢"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {opp.title}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {opp.priorityReason}
                </p>
              </div>
              <span className="text-xs text-indigo-400 shrink-0">
                P{opp.priority}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Review Opportunities",
            tab: "opportunities" as const,
            icon: "🎯",
          },
          { label: "View Calendar", tab: "calendar" as const, icon: "📅" },
          {
            label: "Edit Preferences",
            tab: "preferences" as const,
            icon: "⚙️",
          },
          { label: "Check Conflicts", tab: "dashboard" as const, icon: "⚠️" },
        ].map((action) => (
          <button
            key={action.label}
            onClick={() => setActiveTab(action.tab)}
            className="bg-gray-800 border border-gray-700 rounded-xl p-4 text-center transition-colors hover:border-indigo-600/50"
          >
            <div className="text-2xl mb-1">{action.icon}</div>
            <p className="text-xs text-gray-300 font-medium">{action.label}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
