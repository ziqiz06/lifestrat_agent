"use client";
import { useState, useEffect, useRef } from "react";
import { useAppStore } from "@/store/appStore";
import PixelSprite from "@/components/character/PixelSprite";
import { getArchetypePalette } from "@/lib/characterEngine";

const DOT  = { fontFamily: "var(--font-dot)" } as const;
const MONO = { fontFamily: "var(--font-mono)" } as const;

// ── Box shell with sharp corners ──────────────────────────────────────────────
function Box({
  title,
  titleRight,
  children,
  className = "",
  style,
}: {
  title: string;
  titleRight?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`border border-gray-700 bg-gray-900/70 flex flex-col ${className}`}
      style={style}
    >
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 shrink-0">
        <span
          style={MONO}
          className="text-[11px] font-bold uppercase tracking-[0.15em] text-gray-200"
        >
          {title}
        </span>
        {titleRight && (
          <span style={MONO} className="text-[10px] text-gray-500">
            {titleRight}
          </span>
        )}
      </div>
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

// ── Upcoming Schedule ─────────────────────────────────────────────────────────
function UpcomingSchedule() {
  const { calendarTasks, conflicts, setActiveTab } = useAppStore();

  const upcoming = [...calendarTasks]
    .sort((a, b) =>
      new Date(`${a.date}T${a.startTime}`).getTime() -
      new Date(`${b.date}T${b.startTime}`).getTime()
    )
    .slice(0, 6);

  const conflictIds = new Set(conflicts.flatMap((c) => [c.taskAId, c.taskBId]));

  return (
    <Box
      title="Upcoming Schedule"
      titleRight={
        <button
          onClick={() => setActiveTab("calendar")}
          className="hover:text-indigo-400 transition-colors cursor-pointer"
        >
          view all →
        </button>
      }
    >
      <div className="px-4 py-3 space-y-2" style={MONO}>
        {upcoming.length === 0 ? (
          <p className="text-xs text-gray-600 italic">no tasks scheduled.</p>
        ) : (
          upcoming.map((task) => (
            <div
              key={task.id}
              className="flex items-start gap-3 py-1 border-b border-gray-800/60 last:border-0"
            >
              <div
                className="w-1.5 h-1.5 rounded-none mt-1.5 shrink-0"
                style={{ backgroundColor: task.color }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-200 truncate leading-snug">
                  {task.title}
                </p>
                <p className="text-[10px] text-gray-600">
                  {task.date} · {task.startTime}–{task.endTime}
                  {task.confirmed === false && (
                    <span className="ml-1.5 text-yellow-600">◌ unconfirmed</span>
                  )}
                </p>
              </div>
              {conflictIds.has(task.id) && (
                <span className="text-[10px] text-red-500 shrink-0 mt-0.5">
                  ⚠
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </Box>
  );
}

// ── Weekly Goals ──────────────────────────────────────────────────────────────
function WeeklyGoals() {
  const { goals, confirmGoal, addGoal } = useAppStore();
  const [newGoalText, setNewGoalText] = useState("");
  const [inputOpen, setInputOpen] = useState(false);
  const pending = goals.filter((g) => g.confirmed === null).slice(0, 5);

  return (
    <Box title="Weekly Goals">
      <div className="px-4 py-3 space-y-2.5" style={MONO}>
        {pending.length === 0 ? (
          <p className="text-xs text-gray-600 italic">
            all goals reviewed — check back next week.
          </p>
        ) : (
          pending.map((g) => (
            <div key={g.id} className="flex items-start gap-3">
              <p className="text-xs text-gray-300 flex-1 leading-snug">{g.text}</p>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => confirmGoal(g.id, true)}
                  className="text-[10px] bg-indigo-900/40 hover:bg-indigo-900/70 text-indigo-400 border border-indigo-800/60 px-2 py-0.5 transition-colors"
                >
                  add ✓
                </button>
                <button
                  onClick={() => confirmGoal(g.id, false)}
                  className="text-[10px] bg-gray-800 hover:bg-gray-700 text-gray-500 border border-gray-700 px-2 py-0.5 transition-colors"
                >
                  skip
                </button>
              </div>
            </div>
          ))
        )}

        <div className="pt-2 border-t border-gray-800/60">
          {!inputOpen ? (
            <button
              onClick={() => setInputOpen(true)}
              className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
            >
              + add a goal…
            </button>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newGoalText.trim()) {
                  addGoal(newGoalText.trim());
                  setNewGoalText("");
                  setInputOpen(false);
                }
              }}
              className="flex gap-2"
            >
              <input
                autoFocus
                maxLength={120}
                className="flex-1 bg-gray-800 text-gray-200 text-[11px] px-2 py-1 border border-gray-600 focus:border-indigo-600 focus:outline-none placeholder-gray-600"
                placeholder="new goal…"
                value={newGoalText}
                onChange={(e) => setNewGoalText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") { setInputOpen(false); setNewGoalText(""); }
                }}
                style={MONO}
              />
              <button
                type="submit"
                disabled={!newGoalText.trim()}
                className="text-[10px] bg-indigo-700 hover:bg-indigo-600 disabled:opacity-40 text-white px-2 py-1 transition-colors"
              >
                add
              </button>
              <button
                type="button"
                onClick={() => { setInputOpen(false); setNewGoalText(""); }}
                className="text-[10px] text-gray-600 hover:text-gray-400 px-1"
              >
                ✕
              </button>
            </form>
          )}
        </div>
      </div>
    </Box>
  );
}

// ── AI Strategy Chatbot ───────────────────────────────────────────────────────
function AIChatbot() {
  const { chatMessages, sendChatMessage, clearChat } = useAppStore();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
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
    <Box
      title="AI Strategy Assistant"
      titleRight={
        chatMessages.length > 0 ? (
          <button
            onClick={clearChat}
            className="hover:text-gray-300 transition-colors cursor-pointer"
          >
            clear ↺
          </button>
        ) : (
          <span className="text-gray-700">K2 Think</span>
        )
      }
    >
      <div className="flex flex-col" style={{ minHeight: 260 }}>
        {/* Messages */}
        <div
          className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
          style={{ maxHeight: 260, ...MONO }}
        >
          {chatMessages.length === 0 ? (
            <div className="space-y-3 pt-1">
              <p className="text-xs text-gray-600 italic">
                ask me anything about your career, schedule, or goals.
              </p>
              <div className="space-y-1.5">
                {SUGGESTED.map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="w-full text-left text-[10px] text-gray-500 hover:text-gray-300 hover:bg-gray-800/60 px-3 py-2 border border-gray-800 transition-colors"
                  >
                    &gt; {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            chatMessages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[88%] px-3 py-2 text-xs leading-relaxed ${
                    msg.role === "user"
                      ? "bg-indigo-900/60 text-indigo-100 border border-indigo-800/50"
                      : "bg-gray-800/80 text-gray-300 border border-gray-700/50"
                  }`}
                >
                  {msg.content ? (
                    msg.content.split(/(\*\*[^*]+\*\*)/).map((part, j) =>
                      part.startsWith("**") && part.endsWith("**") ? (
                        <span key={j} className="font-bold text-white">
                          {part.slice(2, -2)}
                        </span>
                      ) : (
                        <span key={j}>{part}</span>
                      )
                    )
                  ) : (
                    <span className="animate-pulse text-gray-600">▌</span>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={endRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-2.5 border-t border-gray-700/60">
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex gap-2"
            style={MONO}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="> ask about your career strategy..."
              disabled={sending}
              className="flex-1 bg-gray-800/60 text-gray-200 text-[11px] px-3 py-2 border border-gray-700 focus:border-indigo-600 focus:outline-none placeholder-gray-600 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              className="px-4 py-2 bg-indigo-800 hover:bg-indigo-700 disabled:opacity-40 text-indigo-100 text-[11px] font-bold transition-colors shrink-0"
            >
              {sending ? "…" : "→"}
            </button>
          </form>
        </div>
      </div>
    </Box>
  );
}

// ── Top Opportunities ─────────────────────────────────────────────────────────
function TopOpportunities() {
  const { opportunities, setActiveTab } = useAppStore();
  const topOpps = opportunities
    .filter((o) => o.interested === null && o.category !== "ignore")
    .slice(0, 4);

  return (
    <Box
      title="Top Opportunities"
      titleRight={
        <button
          onClick={() => setActiveTab("opportunities")}
          className="hover:text-indigo-400 transition-colors cursor-pointer"
        >
          see all →
        </button>
      }
    >
      <div className="px-4 py-3 space-y-2" style={MONO}>
        {topOpps.length === 0 ? (
          <p className="text-xs text-gray-600 italic">no pending opportunities.</p>
        ) : (
          topOpps.map((opp) => (
            <div key={opp.id} className="flex items-start gap-2.5 py-1 border-b border-gray-800/60 last:border-0">
              <span className="text-xs shrink-0 mt-0.5">
                {opp.priority >= 9 ? "■" : opp.priority >= 7 ? "▲" : "●"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-200 truncate">{opp.title}</p>
                <p className="text-[10px] text-gray-600 truncate">{opp.priorityReason}</p>
              </div>
              <span className="text-[10px] text-indigo-500 shrink-0">P{opp.priority}</span>
            </div>
          ))
        )}
      </div>
    </Box>
  );
}

// ── Character sprite column ───────────────────────────────────────────────────
function SpriteColumn({
  pose,
  onNavigate,
  character,
  palette,
}: {
  pose: "think" | "ponder";
  onNavigate: () => void;
  character: { name: string; signals: import("@/types").StateSignal[]; appearance?: import("@/types").CharacterAppearance; level: number } | null;
  palette: { glow: string; hair: string; eye: string; shirt: string; accent: string };
}) {
  return (
    <div
      className="shrink-0 flex flex-col items-center justify-center self-stretch cursor-pointer group"
      style={{ width: 180 }}
      onClick={onNavigate}
      title="View character sheet"
    >
      <div
        className="opacity-90 group-hover:opacity-100 transition-opacity"
        style={{ filter: !character ? "grayscale(0.6) opacity(0.5)" : undefined }}
      >
        <PixelSprite
          palette={palette}
          scale={14}
          animated
          pose={pose}
          signals={character?.signals ?? []}
          appearance={character?.appearance}
          level={character?.level ?? 1}
        />
      </div>
      {!character && (
        <p style={MONO} className="text-[9px] text-gray-600 mt-2 uppercase tracking-widest">
          create character →
        </p>
      )}
      {character && (
        <p
          style={{ ...DOT, color: palette.glow }}
          className="text-[10px] mt-2 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          {character.name}
        </p>
      )}
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { profile, character, setActiveTab, updateProfile } = useAppStore();
  const [greeting, setGreeting] = useState("Good morning");
  const savedOnce = useRef(false);

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(
      h >= 5 && h < 12 ? "Good morning"
      : h >= 12 && h < 17 ? "Good afternoon"
      : h >= 17 && h < 21 ? "Good evening"
      : "Good night"
    );
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!profile.timezone && !savedOnce.current) {
      savedOnce.current = true;
      updateProfile({ timezone: detected });
    }
  }, [profile.timezone, updateProfile]);

  const palette = character
    ? getArchetypePalette(character.archetype)
    : getArchetypePalette("The Sage");

  const NAV_TABS = [
    { label: "Opportunities", tab: "opportunities" as const },
    { label: "Calendar",      tab: "calendar"      as const },
    { label: "Character",     tab: "character"     as const },
    { label: "Preferences",   tab: "preferences"   as const },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-7 space-y-4">

      {/* ── Title ──────────────────────────────────────────────────────────── */}
      <div className="pb-1">
        <p style={DOT} className="text-gray-500 text-sm tracking-widest mb-0.5">
          {greeting},
        </p>
        <h1 style={DOT} className="text-4xl text-white leading-none">
          {profile.name || "Adventurer"}.
        </h1>
      </div>

      {/* ── Row 1: thinking sprite left · schedule/goals right ─────────────── */}
      <div className="flex gap-4 items-stretch">
        <SpriteColumn
          pose="think"
          onNavigate={() => setActiveTab("character")}
          character={character}
          palette={palette}
        />

        <div className="flex-1 flex flex-col gap-4 min-w-0">
          <UpcomingSchedule />
          <WeeklyGoals />
        </div>
      </div>

      {/* ── Row 2: AI/opps left · ponder sprite right ──────────────────────── */}
      <div className="flex gap-4 items-stretch">
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          <AIChatbot />
          <TopOpportunities />
        </div>

        <SpriteColumn
          pose="ponder"
          onNavigate={() => setActiveTab("character")}
          character={character}
          palette={palette}
        />
      </div>

      {/* ── Nav ────────────────────────────────────────────────────────────── */}
      <div className="flex gap-8 justify-center pt-3 border-t border-gray-800/60">
        {NAV_TABS.map(({ label, tab }) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={DOT}
            className="text-sm text-gray-500 hover:text-white transition-colors tracking-wide uppercase"
          >
            {label}
          </button>
        ))}
      </div>

    </div>
  );
}
