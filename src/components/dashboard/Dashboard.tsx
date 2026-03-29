"use client";
import { useState, useEffect, useRef } from "react";
import { useAppStore } from "@/store/appStore";
import PixelSprite from "@/components/character/PixelSprite";
import { getArchetypePalette } from "@/lib/characterEngine";
import type { StateSignal, CharacterAppearance } from "@/types";

const DOT  = { fontFamily: "var(--font-dot)"  } as const;
const MONO = { fontFamily: "var(--font-mono)" } as const;

// ── Box shell — border color driven by avatar palette ────────────────────────
function Box({
  title,
  titleRight,
  children,
  className = "",
  style,
  accentColor,
}: {
  title: string;
  titleRight?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  accentColor: string; // palette.glow hex
}) {
  const border = `1px solid ${accentColor}55`;
  const headerBorder = `1px solid ${accentColor}44`;

  return (
    <div
      className={`bg-gray-900/70 flex flex-col ${className}`}
      style={{ border, ...style }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3 shrink-0"
        style={{ borderBottom: headerBorder }}
      >
        <span
          style={MONO}
          className="text-lg font-bold uppercase tracking-[0.18em] text-gray-100"
        >
          {title}
        </span>
        {titleRight && (
          <span style={MONO} className="text-sm text-gray-500">
            {titleRight}
          </span>
        )}
      </div>
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

// ── Upcoming Schedule ─────────────────────────────────────────────────────────
function UpcomingSchedule({ accent }: { accent: string }) {
  const { calendarTasks, conflicts, setActiveTab } = useAppStore();

  const upcoming = [...calendarTasks]
    .sort(
      (a, b) =>
        new Date(`${a.date}T${a.startTime}`).getTime() -
        new Date(`${b.date}T${b.startTime}`).getTime()
    )
    .slice(0, 6);

  const conflictIds = new Set(conflicts.flatMap((c) => [c.taskAId, c.taskBId]));

  return (
    <Box
      title="Upcoming Schedule"
      accentColor={accent}
      titleRight={
        <button
          onClick={() => setActiveTab("calendar")}
          className="hover:text-indigo-300 transition-colors cursor-pointer"
          style={MONO}
        >
          view all →
        </button>
      }
    >
      <div className="px-5 py-4 space-y-2.5" style={MONO}>
        {upcoming.length === 0 ? (
          <p className="text-base text-gray-600 italic">no tasks scheduled yet.</p>
        ) : (
          upcoming.map((task) => (
            <div
              key={task.id}
              className="flex items-start gap-3 pb-2.5 border-b last:border-0"
              style={{ borderColor: `${accent}22` }}
            >
              <div
                className="w-2 h-2 mt-1 shrink-0"
                style={{ backgroundColor: task.color }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-base text-gray-200 truncate leading-snug">
                  {task.title}
                </p>
                <p className="text-sm text-gray-500 mt-0.5">
                  {task.date} · {task.startTime}–{task.endTime}
                  {task.confirmed === false && (
                    <span className="ml-2 text-yellow-600">◌ unconfirmed</span>
                  )}
                </p>
              </div>
              {conflictIds.has(task.id) && (
                <span className="text-sm text-red-500 shrink-0 mt-0.5">⚠</span>
              )}
            </div>
          ))
        )}
      </div>
    </Box>
  );
}

// ── Weekly Goals ──────────────────────────────────────────────────────────────
function WeeklyGoals({ accent }: { accent: string }) {
  const { goals, confirmGoal, addGoal } = useAppStore();
  const [newGoalText, setNewGoalText] = useState("");
  const [inputOpen, setInputOpen] = useState(false);
  const pending = goals.filter((g) => g.confirmed === null).slice(0, 5);

  return (
    <Box title="Weekly Goals" accentColor={accent}>
      <div className="px-5 py-4 space-y-3" style={MONO}>
        {pending.length === 0 ? (
          <p className="text-base text-gray-600 italic">
            all goals reviewed — check back next week.
          </p>
        ) : (
          pending.map((g) => (
            <div key={g.id} className="flex items-start gap-3">
              <p className="text-base text-gray-300 flex-1 leading-snug">{g.text}</p>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => confirmGoal(g.id, true)}
                  className="text-sm px-2.5 py-1 transition-colors border"
                  style={{
                    backgroundColor: `${accent}18`,
                    borderColor: `${accent}55`,
                    color: accent,
                  }}
                >
                  add ✓
                </button>
                <button
                  onClick={() => confirmGoal(g.id, false)}
                  className="text-sm px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-500 border border-gray-700 transition-colors"
                >
                  skip
                </button>
              </div>
            </div>
          ))
        )}

        <div className="pt-2.5" style={{ borderTop: `1px solid ${accent}22` }}>
          {!inputOpen ? (
            <button
              onClick={() => setInputOpen(true)}
              className="text-sm text-gray-600 hover:text-gray-400 transition-colors"
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
                className="flex-1 bg-gray-800 text-gray-200 text-base px-3 py-1.5 border border-gray-600 focus:outline-none placeholder-gray-600"
                style={{ ...MONO, borderColor: `${accent}44` }}
                placeholder="new goal…"
                value={newGoalText}
                onChange={(e) => setNewGoalText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") { setInputOpen(false); setNewGoalText(""); }
                }}
              />
              <button
                type="submit"
                disabled={!newGoalText.trim()}
                className="text-sm px-3 py-1.5 disabled:opacity-40 text-white transition-colors"
                style={{ backgroundColor: accent }}
              >
                add
              </button>
              <button
                type="button"
                onClick={() => { setInputOpen(false); setNewGoalText(""); }}
                className="text-sm text-gray-600 hover:text-gray-400 px-1"
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
function AIChatbot({ accent }: { accent: string }) {
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
      accentColor={accent}
      titleRight={
        chatMessages.length > 0 ? (
          <button
            onClick={clearChat}
            className="hover:text-gray-300 transition-colors cursor-pointer"
            style={MONO}
          >
            clear ↺
          </button>
        ) : (
          <span className="text-gray-700 text-sm" style={MONO}>K2 Think</span>
        )
      }
    >
      <div className="flex flex-col" style={{ minHeight: 260 }}>
        {/* Messages */}
        <div
          className="flex-1 overflow-y-auto px-5 py-4 space-y-3"
          style={{ maxHeight: 280 }}
        >
          {chatMessages.length === 0 ? (
            <div className="space-y-3 pt-1" style={MONO}>
              <p className="text-base text-gray-600 italic">
                ask me anything about your career, schedule, or goals.
              </p>
              <div className="space-y-2">
                {SUGGESTED.map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="w-full text-left text-base text-gray-500 hover:text-gray-300 px-3 py-2 transition-colors border border-gray-800 hover:border-gray-700"
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
                style={MONO}
              >
                <div
                  className={`max-w-[88%] px-4 py-2.5 text-base leading-relaxed border ${
                    msg.role === "user"
                      ? "text-indigo-100"
                      : "bg-gray-800/80 text-gray-300 border-gray-700/50"
                  }`}
                  style={
                    msg.role === "user"
                      ? {
                          backgroundColor: `${accent}22`,
                          borderColor: `${accent}55`,
                          color: "#e0e7ff",
                        }
                      : undefined
                  }
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
        <div className="px-5 py-3" style={{ borderTop: `1px solid ${accent}33` }}>
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
              className="flex-1 bg-gray-800/60 text-gray-200 text-base px-4 py-2 border border-gray-700 focus:outline-none placeholder-gray-600 disabled:opacity-50"
              style={{ borderColor: `${accent}33` }}
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              className="px-5 py-2 disabled:opacity-40 text-white text-base font-bold transition-colors shrink-0"
              style={{ backgroundColor: `${accent}cc` }}
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
function TopOpportunities({ accent }: { accent: string }) {
  const { opportunities, setActiveTab } = useAppStore();
  const topOpps = opportunities
    .filter((o) => o.interested === null && o.category !== "ignore")
    .slice(0, 4);

  return (
    <Box
      title="Top Opportunities"
      accentColor={accent}
      titleRight={
        <button
          onClick={() => setActiveTab("opportunities")}
          className="hover:text-indigo-300 transition-colors cursor-pointer"
          style={MONO}
        >
          see all →
        </button>
      }
    >
      <div className="px-5 py-4 space-y-3" style={MONO}>
        {topOpps.length === 0 ? (
          <p className="text-base text-gray-600 italic">no pending opportunities.</p>
        ) : (
          topOpps.map((opp) => (
            <div
              key={opp.id}
              className="flex items-start gap-3 pb-2.5 border-b last:border-0"
              style={{ borderColor: `${accent}22` }}
            >
              <span className="text-base shrink-0 mt-0.5" style={{ color: accent }}>
                {opp.priority >= 9 ? "■" : opp.priority >= 7 ? "▲" : "●"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-base text-gray-200 truncate">{opp.title}</p>
                <p className="text-sm text-gray-500 truncate mt-0.5">
                  {opp.priorityReason}
                </p>
              </div>
              <span className="text-sm shrink-0 mt-0.5" style={{ color: `${accent}99` }}>
                P{opp.priority}
              </span>
            </div>
          ))
        )}
      </div>
    </Box>
  );
}

// ── Sprite with reaction overlay ──────────────────────────────────────────────
function SpriteColumn({
  pose,
  onNavigate,
  character,
  palette,
}: {
  pose: "think" | "ponder";
  onNavigate: () => void;
  character: {
    name: string;
    signals: StateSignal[];
    appearance?: CharacterAppearance;
    level: number;
  } | null;
  palette: { glow: string; hair: string; eye: string; shirt: string; accent: string };
}) {
  // Reaction bubble differs per pose
  const bubble =
    pose === "think"
      ? { text: "...", title: "thinking", offsetX: "right-2" }
      : { text: "!", title: "reacting", offsetX: "left-2" };

  return (
    <div
      className="shrink-0 flex flex-col items-center justify-center self-stretch cursor-pointer group gap-3"
      style={{ width: 220 }}
      onClick={onNavigate}
      title="View character sheet"
    >
      {/* Sprite + reaction badge */}
      <div className="relative">
        {/* Floating reaction badge */}
        <div
          className={`absolute -top-7 ${bubble.offsetX} pointer-events-none select-none`}
          style={{
            fontFamily: "var(--font-mono)",
            color: palette.glow,
            fontSize: pose === "think" ? 18 : 24,
            fontWeight: "bold",
            letterSpacing: pose === "think" ? "0.2em" : undefined,
            animation: "float-badge 2.8s ease-in-out infinite",
            textShadow: `0 0 12px ${palette.glow}88`,
            animationDelay: pose === "ponder" ? "0.6s" : "0s",
          }}
        >
          {bubble.text}
        </div>

        {/* Sprite */}
        <div
          className="opacity-90 group-hover:opacity-100 transition-opacity"
          style={{ filter: !character ? "grayscale(0.7) brightness(0.6)" : undefined }}
        >
          <PixelSprite
            palette={palette}
            scale={16}
            animated
            pose={pose}
            signals={character?.signals ?? []}
            appearance={character?.appearance}
            level={character?.level ?? 1}
          />
        </div>
      </div>

      {/* Name on hover */}
      {character ? (
        <p
          style={{ ...DOT, color: palette.glow }}
          className="text-lg opacity-0 group-hover:opacity-100 transition-opacity"
        >
          {character.name}
        </p>
      ) : (
        <p style={MONO} className="text-sm text-gray-600 uppercase tracking-widest">
          create character →
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
      h >= 5 && h < 12
        ? "Good morning"
        : h >= 12 && h < 17
          ? "Good afternoon"
          : h >= 17 && h < 21
            ? "Good evening"
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

  const accent = palette.glow;

  const NAV_TABS = [
    { label: "Opportunities", tab: "opportunities" as const },
    { label: "Calendar",      tab: "calendar"      as const },
    { label: "Character",     tab: "character"     as const },
    { label: "Preferences",   tab: "preferences"   as const },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-5">

      {/* ── Title ──────────────────────────────────────────────────────────── */}
      <div className="pb-2">
        <p style={DOT} className="text-3xl text-gray-400 mb-1">
          {greeting},
        </p>
        <h1 style={DOT} className="text-8xl text-white leading-none tracking-wide">
          {profile.name || "Adventurer"}.
        </h1>
      </div>

      {/* ── Row 1: thinking sprite left · schedule/goals right ─────────────── */}
      <div className="flex gap-5 items-stretch">
        <SpriteColumn
          pose="think"
          onNavigate={() => setActiveTab("character")}
          character={character}
          palette={palette}
        />

        <div className="flex-1 flex flex-col gap-4 min-w-0">
          <UpcomingSchedule accent={accent} />
          <WeeklyGoals accent={accent} />
        </div>
      </div>

      {/* ── Row 2: AI/opps left · ponder sprite right ──────────────────────── */}
      <div className="flex gap-5 items-stretch">
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          <AIChatbot accent={accent} />
          <TopOpportunities accent={accent} />
        </div>

        <SpriteColumn
          pose="ponder"
          onNavigate={() => setActiveTab("character")}
          character={character}
          palette={palette}
        />
      </div>

      {/* ── Nav ────────────────────────────────────────────────────────────── */}
      <div
        className="flex gap-10 justify-center pt-4"
        style={{ borderTop: `1px solid ${accent}33` }}
      >
        {NAV_TABS.map(({ label, tab }) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={DOT}
            className="text-2xl text-gray-500 hover:text-white transition-colors tracking-widest uppercase"
          >
            {label}
          </button>
        ))}
      </div>

    </div>
  );
}
