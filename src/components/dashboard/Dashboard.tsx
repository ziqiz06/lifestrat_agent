"use client";
import { useState, useEffect, useRef } from "react";
import { useAppStore } from "@/store/appStore";
import type { CharacterStats } from "@/types";
import PixelSprite from "@/components/character/PixelSprite";
import {
  getArchetypePalette,
  STAT_META,
  SIGNAL_META,
} from "@/lib/characterEngine";

// ── Greeting Banner ───────────────────────────────────────────────────────────
function GreetingBanner() {
  const { profile, character, setActiveTab, updateProfile } = useAppStore();
  const [greeting, setGreeting] = useState("Hello");
  const [tz, setTz] = useState("");
  const savedOnce = useRef(false);

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(
      h >= 5 && h < 12
        ? "Good morning"
        : h >= 12 && h < 17
          ? "Good afternoon"
          : h >= 17 && h < 21
            ? "Good evening"
            : "Good night",
    );

    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTz(profile.timezone || detected);

    // Auto-save detected timezone once if not set
    if (!profile.timezone && !savedOnce.current) {
      savedOnce.current = true;
      updateProfile({ timezone: detected });
    }
  }, [profile.timezone, updateProfile]);

  const name = profile.name;
  const moodLabel =
    profile.scheduleIntensity === "insane"
      ? "💀 Insane mode — maximum output."
      : profile.scheduleIntensity === "heavy"
        ? "🔥 Heavy mode — let's push today."
        : profile.scheduleIntensity === "light"
          ? "🌱 Light mode — steady and sustainable."
          : "⚡ Moderate mode — balanced and productive.";

  return (
    <div className="bg-gradient-to-r from-indigo-900/50 to-purple-900/50 rounded-2xl p-5 border border-indigo-800/50">
      <h1 className="text-xl font-bold text-white mb-1">
        {greeting}
        {name ? `, ${name}` : ""}! 👋
      </h1>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-gray-300 text-sm">{moodLabel}</p>
        {tz && (
          <button
            onClick={() => setActiveTab("preferences")}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors group"
          >
            <span>🌍</span>
            <span>{tz}</span>
            <span className="text-gray-700 group-hover:text-gray-500 transition-colors">
              · change
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

// ── Character Mini-Card ───────────────────────────────────────────────────────
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
      className="rounded-2xl p-5 border cursor-pointer transition-all hover:brightness-110 active:scale-[0.99]"
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
            appearance={character.appearance}
            level={character.level}
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
          <p className="text-xs mb-2.5" style={{ color: palette.glow }}>
            {character.archetype}
          </p>
          <div className="space-y-1.5">
            {statKeys.map((key) => {
              const meta = STAT_META[key];
              const val = character.stats[key];
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-[10px] w-16 text-gray-500 shrink-0">
                    {meta.label}
                  </span>
                  <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${val}%`, backgroundColor: meta.color }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-500 w-7 text-right tabular-nums">
                    {val}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Signal badge */}
        {signalMeta && (
          <div className="shrink-0 hidden sm:flex flex-col items-center gap-1 min-w-[48px]">
            <span className="text-2xl">{signalMeta.icon}</span>
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

// ── Schedule + Goals (side by side) ──────────────────────────────────────────
function ScheduleAndGoals() {
  const {
    calendarTasks,
    goals,
    setActiveTab,
    confirmGoal,
    conflicts,
    addGoal,
  } = useAppStore();
  const [newGoalText, setNewGoalText] = useState("");
  const [goalInputOpen, setGoalInputOpen] = useState(false);

  // Sort all tasks chronologically and take the soonest 5
  const upcoming = [...calendarTasks]
    .sort((a, b) => {
      const dA = new Date(`${a.date}T${a.startTime}`).getTime();
      const dB = new Date(`${b.date}T${b.startTime}`).getTime();
      return dA - dB;
    })
    .slice(0, 5);

  const conflictIds = new Set(conflicts.flatMap((c) => [c.taskAId, c.taskBId]));
  const pendingGoals = goals.filter((g) => g.confirmed === null);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Upcoming schedule */}
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
        {upcoming.length === 0 ? (
          <p className="text-gray-500 text-sm">No tasks scheduled yet.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((task) => {
              const hasConflict = conflictIds.has(task.id);
              return (
                <div
                  key={task.id}
                  className={`flex items-center gap-3 py-2 border-b border-gray-700/60 last:border-0 ${
                    task.confirmed === false ? "opacity-70" : ""
                  }`}
                >
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: task.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{task.title}</p>
                    <p className="text-xs text-gray-500">
                      {task.date} · {task.startTime}–{task.endTime}
                      {task.confirmed === false && (
                        <span className="ml-1 text-yellow-500">
                          ◌ unconfirmed
                        </span>
                      )}
                    </p>
                  </div>
                  {hasConflict && (
                    <span className="text-xs text-red-400 shrink-0">⚠</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Weekly goals */}
      <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700">
        <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
          <span>🎯</span> Weekly Goals
        </h2>
        {pendingGoals.length === 0 ? (
          <p className="text-gray-500 text-sm">
            All goals reviewed — check back next week.
          </p>
        ) : (
          <div className="space-y-3">
            {pendingGoals.slice(0, 4).map((g) => (
              <div key={g.id} className="flex items-start gap-3">
                <p className="text-sm text-gray-300 flex-1 leading-snug">
                  {g.text}
                </p>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => confirmGoal(g.id, true)}
                    className="text-xs bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-600/40 rounded px-2 py-0.5 transition-colors"
                  >
                    Add ✓
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
        )}

        {/* Add goal */}
        <div className="mt-3 pt-3 border-t border-gray-700/60">
          {!goalInputOpen ? (
            <button
              onClick={() => setGoalInputOpen(true)}
              className="w-full text-xs text-gray-500 hover:text-gray-300 hover:bg-gray-700/50 rounded-lg px-3 py-2 transition-colors text-left flex items-center gap-2"
            >
              <span className="text-gray-600">+</span> Add a goal…
            </button>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newGoalText.trim()) {
                  addGoal(newGoalText.trim());
                  setNewGoalText("");
                  setGoalInputOpen(false);
                }
              }}
              className="flex gap-2"
            >
              <input
                autoFocus
                type="text"
                maxLength={120}
                className="flex-1 bg-gray-700 text-white text-xs rounded-lg px-3 py-2 border border-gray-600 focus:border-indigo-500 focus:outline-none placeholder-gray-500"
                placeholder="e.g. Reach out to 2 new contacts this week"
                value={newGoalText}
                onChange={(e) => setNewGoalText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setGoalInputOpen(false);
                    setNewGoalText("");
                  }
                }}
              />
              <button
                type="submit"
                disabled={!newGoalText.trim()}
                className="shrink-0 text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg px-3 py-2 transition-colors font-medium"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setGoalInputOpen(false);
                  setNewGoalText("");
                }}
                className="shrink-0 text-xs text-gray-500 hover:text-gray-300 rounded-lg px-2 py-2 transition-colors"
              >
                ✕
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ── AI Strategy Chatbot ───────────────────────────────────────────────────────
function AIChatbot() {
  const { chatMessages, sendChatMessage, clearChat, aiInsightLoading } = useAppStore();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // aiInsightLoading kept in destructure for potential future use
  void aiInsightLoading;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setSending(true);
    await sendChatMessage(text);
    setSending(false);
  };

  const SUGGESTED = [
    "What should I focus on this week?",
    "Am I on track with my career goals?",
    "Which opportunities should I prioritize?",
  ];

  return (
    <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden flex flex-col" style={{ minHeight: 460 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-700">
        <h2 className="font-semibold text-white flex items-center gap-2 text-sm">
          <span>🤖</span> AI Strategy Assistant
          <span className="text-xs text-gray-500 font-normal">(K2 Think)</span>
        </h2>
        {chatMessages.length > 0 && (
          <button onClick={clearChat} className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
            Clear ↺
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4" style={{ maxHeight: 340 }}>
        {chatMessages.length === 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-400 text-center pt-4">Ask me anything about your career, schedule, or goals.</p>
            <div className="space-y-2">
              {SUGGESTED.map((s) => (
                <button key={s} onClick={() => { setInput(s); }}
                  className="w-full text-left text-xs bg-gray-700/50 hover:bg-gray-700 text-gray-300 rounded-xl px-4 py-2.5 border border-gray-600/50 transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          chatMessages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-sm'
                  : 'bg-gray-700 text-gray-200 rounded-bl-sm'
              }`}>
                {msg.content
                  ? msg.content.split(/(\*\*[^*]+\*\*)/).map((part, j) =>
                      part.startsWith('**') && part.endsWith('**')
                        ? <span key={j} className="font-semibold text-white">{part.slice(2, -2)}</span>
                        : <span key={j}>{part}</span>
                    )
                  : <span className="animate-pulse text-gray-500">▌</span>
                }
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-700">
        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your career strategy..."
            disabled={sending}
            className="flex-1 bg-gray-700 text-white text-sm rounded-xl px-4 py-2.5 border border-gray-600 focus:border-indigo-500 focus:outline-none placeholder-gray-500 disabled:opacity-50"
          />
          <button type="submit" disabled={!input.trim() || sending}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium transition-colors shrink-0">
            {sending ? '…' : '→'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Top Opportunities ─────────────────────────────────────────────────────────
function TopOpportunities() {
  const { opportunities, setActiveTab } = useAppStore();
  const topOpps = opportunities
    .filter((o) => o.interested === null && o.category !== "ignore")
    .slice(0, 3);

  if (topOpps.length === 0) return null;

  return (
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
            <span className="text-xs text-indigo-400 shrink-0 mt-0.5">
              P{opp.priority}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Quick Actions ─────────────────────────────────────────────────────────────
function QuickActions() {
  const { setActiveTab } = useAppStore();

  const actions = [
    { label: "Opportunities", tab: "opportunities" as const, icon: "🎯" },
    { label: "Calendar", tab: "calendar" as const, icon: "📅" },
    { label: "Character", tab: "character" as const, icon: "⚔️" },
    { label: "Preferences", tab: "preferences" as const, icon: "⚙️" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {actions.map((action) => (
        <button
          key={action.label}
          onClick={() => setActiveTab(action.tab)}
          className="bg-gray-800 border border-gray-700 rounded-xl p-4 text-center transition-colors hover:border-indigo-600/50 hover:bg-gray-750 active:scale-[0.97]"
        >
          <div className="text-2xl mb-1">{action.icon}</div>
          <p className="text-xs text-gray-300 font-medium">{action.label}</p>
        </button>
      ))}
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      {/* 1 · Greeting */}
      <GreetingBanner />

      {/* 2 · Character */}
      <CharacterMiniCard />

      {/* 3 · Upcoming schedule + Weekly goals */}
      <ScheduleAndGoals />

      {/* 4 · AI Strategy Chatbot */}
      <AIChatbot />

      {/* 5 · Top opportunities */}
      <TopOpportunities />

      {/* 6 · Quick actions */}
      <QuickActions />
    </div>
  );
}
