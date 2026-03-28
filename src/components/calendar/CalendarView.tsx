"use client";
import { useState, useRef, useEffect } from "react";
import { useAppStore } from "@/store/appStore";
import { CalendarTask, Conflict } from "@/types";

// ── Grid constants ────────────────────────────────────────────────────────────
const HOUR_HEIGHT = 64; // px per hour
const START_HOUR = 7; // 7 am
const END_HOUR = 24; // midnight
const TOTAL_HOURS = END_HOUR - START_HOUR; // 17
const TOTAL_HEIGHT = TOTAL_HOURS * HOUR_HEIGHT; // 1088 px
const TIME_COL_W = 52; // px – left time-label column

// ── Week helpers ──────────────────────────────────────────────────────────────
// Base Monday: 2026-03-30 (the week containing most mock data)
const BASE_MS = new Date("2026-03-30T00:00:00").getTime();
const DAY_MS = 86_400_000;

function getWeekDates(offset: number): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    return new Date(BASE_MS + (offset * 7 + i) * DAY_MS)
      .toISOString()
      .slice(0, 10);
  });
}

function weekRangeLabel(dates: string[]): string {
  const fmt = (s: string) =>
    new Date(s + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  return `${fmt(dates[0])} – ${fmt(dates[6])}, ${dates[0].slice(0, 4)}`;
}

// ── Time helpers ──────────────────────────────────────────────────────────────
function toMins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function topPx(time: string): number {
  return ((toMins(time) - START_HOUR * 60) / 60) * HOUR_HEIGHT;
}

function heightPx(start: string, end: string): number {
  const s = Math.max(toMins(start), START_HOUR * 60);
  const e = Math.min(
    toMins(end) === toMins(start) ? toMins(end) + 30 : toMins(end),
    END_HOUR * 60,
  );
  return Math.max(((e - s) / 60) * HOUR_HEIGHT, 22);
}

// ── Lane layout ───────────────────────────────────────────────────────────────
interface LaidTask {
  task: CalendarTask;
  lane: number;
  laneCount: number;
}

function assignLanes(tasks: CalendarTask[]): LaidTask[] {
  const sorted = [...tasks].sort(
    (a, b) => toMins(a.startTime) - toMins(b.startTime),
  );
  const laneEnds: number[] = [];

  const assigned: LaidTask[] = sorted.map((task) => {
    const s = toMins(task.startTime);
    const e = toMins(task.endTime) <= s ? s + 30 : toMins(task.endTime);
    let lane = laneEnds.findIndex((end) => s >= end);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(e);
    } else {
      laneEnds[lane] = e;
    }
    return { task, lane, laneCount: 1 };
  });

  // Compute laneCount = total concurrent lanes for each task
  assigned.forEach((a) => {
    const s = toMins(a.task.startTime);
    const e = toMins(a.task.endTime) <= s ? s + 30 : toMins(a.task.endTime);
    const maxLane = assigned
      .filter((b) => {
        const bs = toMins(b.task.startTime);
        const be =
          toMins(b.task.endTime) <= bs ? bs + 30 : toMins(b.task.endTime);
        return bs < e && s < be;
      })
      .reduce((m, b) => Math.max(m, b.lane), 0);
    a.laneCount = maxLane + 1;
  });

  return assigned;
}

// ── Chat types ────────────────────────────────────────────────────────────────
interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

// ── TaskBlock ─────────────────────────────────────────────────────────────────
function TaskBlock({
  laid,
  isConflict,
  onConfirm,
}: {
  laid: LaidTask;
  isConflict: boolean;
  onConfirm: () => void;
}) {
  const { task, lane, laneCount } = laid;
  const top = topPx(task.startTime);
  const height = heightPx(task.startTime, task.endTime);
  const widthPct = 100 / laneCount;
  const leftPct = (lane / laneCount) * 100;
  const confirmed = task.confirmed !== false;
  const isTall = height >= 48;
  const isVeryTall = height >= 72;

  const borderColor = isConflict ? "#ef4444" : task.color;
  const bg = `${task.color}${confirmed ? "20" : "12"}`;

  return (
    <div
      style={{
        position: "absolute",
        top,
        height,
        left: `calc(${leftPct}% + 2px)`,
        width: `calc(${widthPct}% - 4px)`,
        backgroundColor: bg,
        borderLeft: `3px solid ${borderColor}`,
        border: confirmed
          ? `1px solid ${borderColor}40`
          : `1.5px dashed ${borderColor}90`,
        borderLeft: `3px solid ${borderColor}`,
        borderRadius: 6,
        overflow: "hidden",
        zIndex: isConflict ? 2 : 1,
        cursor: "default",
        transition: "box-shadow 0.15s",
      }}
      className="group hover:brightness-110"
    >
      <div className="px-1.5 py-1 h-full flex flex-col gap-0.5 overflow-hidden">
        {/* Header row */}
        <div className="flex items-center gap-1 min-w-0">
          {isConflict && (
            <span className="text-red-400 text-[10px] shrink-0">⚠</span>
          )}
          {!confirmed && (
            <span
              className="text-yellow-400 text-[10px] shrink-0"
              title="Unconfirmed — click Confirm to lock in"
            >
              ◌
            </span>
          )}
          {isTall && (
            <span
              className="text-[10px] font-semibold truncate"
              style={{ color: task.color }}
            >
              {task.startTime}–{task.endTime}
            </span>
          )}
        </div>

        {/* Title */}
        <p
          className="text-[11px] font-semibold text-white leading-tight"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: isTall ? 2 : 1,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {task.title}
        </p>

        {/* Confirm button for unconfirmed tasks */}
        {!confirmed && isVeryTall && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onConfirm();
            }}
            className="mt-auto text-[10px] border border-yellow-500/50 text-yellow-300 hover:bg-yellow-500/20 rounded px-1.5 py-0.5 w-fit transition-colors"
          >
            Confirm ✓
          </button>
        )}
      </div>
    </div>
  );
}

// ── AiChatPanel ───────────────────────────────────────────────────────────────
function AiChatPanel({
  conflict,
  allTasks,
  onClose,
  onResolve,
}: {
  conflict: Conflict;
  allTasks: CalendarTask[];
  onClose: () => void;
  onResolve: (keepId: string) => void;
}) {
  const taskA = allTasks.find((t) => t.id === conflict.taskAId);
  const taskB = allTasks.find((t) => t.id === conflict.taskBId);

  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  async function sendWithHistory(text: string, history: ChatMsg[]) {
    const userMsg: ChatMsg = { role: "user", content: text };
    const nextHistory = [...history, userMsg];
    setMsgs(nextHistory);
    setStreaming(true);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextHistory.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          stream: true,
        }),
      });

      if (!res.ok || !res.body) {
        setMsgs((prev) => [
          ...prev,
          { role: "assistant", content: "Sorry — could not reach AI service." },
        ]);
        return;
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let full = "";
      setMsgs((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of dec.decode(value, { stream: true }).split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;
          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content ?? "";
            full += delta;
            setMsgs((prev) => [
              ...prev.slice(0, -1),
              { role: "assistant", content: full },
            ]);
          } catch {
            /* skip malformed SSE chunk */
          }
        }
      }
    } catch {
      setMsgs((prev) => [
        ...prev,
        { role: "assistant", content: "Connection error." },
      ]);
    } finally {
      setStreaming(false);
    }
  }

  // Auto-send the initial context prompt once on mount
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const prompt =
      `I have a scheduling conflict on ${conflict.date}:\n` +
      `• "${conflict.taskATitle}" (${taskA?.startTime ?? "?"}–${taskA?.endTime ?? "?"})\n` +
      `• "${conflict.taskBTitle}" (${taskB?.startTime ?? "?"}–${taskB?.endTime ?? "?"})\n\n` +
      `These events overlap — I can only attend one. Which should I prioritize? ` +
      `Please give a brief, direct recommendation considering career impact and urgency.`;
    sendWithHistory(prompt, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll to bottom whenever messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-lg bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl flex flex-col"
        style={{ maxHeight: "82vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700 shrink-0">
          <div>
            <p className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="text-red-400">⚠️</span>
              Conflict · AI Recommendation
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{conflict.date}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl leading-none transition-colors w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-700"
          >
            ✕
          </button>
        </div>

        {/* Conflicting event cards */}
        <div className="px-5 pt-4 pb-3 grid grid-cols-2 gap-3 shrink-0">
          {[taskA, taskB].map(
            (t) =>
              t && (
                <div
                  key={t.id}
                  className="rounded-xl p-3 border flex flex-col gap-1"
                  style={{
                    borderColor: `${t.color}50`,
                    backgroundColor: `${t.color}18`,
                  }}
                >
                  <p
                    className="text-[10px] font-semibold"
                    style={{ color: t.color }}
                  >
                    {t.startTime}–{t.endTime}
                  </p>
                  <p className="text-sm text-white font-medium leading-snug">
                    {t.title}
                  </p>
                  <button
                    onClick={() => {
                      onResolve(t.id);
                      onClose();
                    }}
                    className="mt-1 self-start text-[10px] bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-md px-2 py-1 transition-colors"
                  >
                    Keep this →
                  </button>
                </div>
              ),
          )}
        </div>

        <div className="px-5 pb-2 shrink-0">
          <div className="border-t border-gray-700/60" />
          <p className="text-[11px] text-gray-500 mt-2">
            Only one of these events can be attended — the AI will help you
            decide which to keep.
          </p>
        </div>

        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3 min-h-0">
          {msgs.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-indigo-600 text-white rounded-br-sm"
                    : "bg-gray-800 text-gray-100 border border-gray-700 rounded-bl-sm"
                }`}
              >
                {m.content ||
                  (streaming && i === msgs.length - 1 ? (
                    <span className="text-gray-400 animate-pulse">
                      Thinking…
                    </span>
                  ) : (
                    ""
                  ))}
              </div>
            </div>
          ))}
          {streaming && msgs[msgs.length - 1]?.role === "user" && (
            <div className="flex justify-start">
              <div className="bg-gray-800 border border-gray-700 rounded-2xl rounded-bl-sm px-4 py-2.5">
                <span className="text-gray-400 text-sm animate-pulse">
                  Thinking…
                </span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-4 pb-4 pt-2 border-t border-gray-700/50 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (input.trim() && !streaming) {
                sendWithHistory(input.trim(), msgs);
                setInput("");
              }
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              className="flex-1 bg-gray-800 text-white rounded-xl px-3 py-2 text-sm border border-gray-600 focus:border-indigo-500 focus:outline-none placeholder-gray-500"
              placeholder="Ask a follow-up…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={streaming}
            />
            <button
              type="submit"
              disabled={!input.trim() || streaming}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl px-4 py-2 text-sm font-medium transition-colors"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── CalendarView (main export) ────────────────────────────────────────────────
export default function CalendarView() {
  const { calendarTasks, conflicts, resolveConflict, confirmCalendarTask } =
    useAppStore();
  const [weekOffset, setWeekOffset] = useState(0);
  const [chatConflict, setChatConflict] = useState<Conflict | null>(null);

  const weekDates = getWeekDates(weekOffset);
  const weekTasks = calendarTasks.filter((t) => weekDates.includes(t.date));
  const weekConflicts = conflicts.filter((c) => weekDates.includes(c.date));
  const conflictTaskIds = new Set(
    weekConflicts.flatMap((c) => [c.taskAId, c.taskBId]),
  );

  const totalTasks = weekTasks.length;
  const unconfirmedCount = weekTasks.filter(
    (t) => t.confirmed === false,
  ).length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col gap-4">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Weekly Plan</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {weekRangeLabel(weekDates)}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Status badges */}
          <div className="flex items-center gap-2">
            {weekConflicts.length > 0 && (
              <span className="text-xs bg-red-500/15 text-red-400 px-2.5 py-1 rounded-full border border-red-800/40">
                ⚠ {weekConflicts.length} conflict
                {weekConflicts.length !== 1 ? "s" : ""}
              </span>
            )}
            {unconfirmedCount > 0 && (
              <span className="text-xs bg-yellow-500/10 text-yellow-400 px-2.5 py-1 rounded-full border border-yellow-700/40">
                ◌ {unconfirmedCount} unconfirmed
              </span>
            )}
            <span className="text-xs bg-gray-700/60 text-gray-400 px-2.5 py-1 rounded-full border border-gray-600/40">
              {totalTasks} tasks
            </span>
          </div>

          {/* Week navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setWeekOffset((o) => o - 1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 transition-colors text-base"
              title="Previous week"
            >
              ‹
            </button>
            <button
              onClick={() => setWeekOffset(0)}
              className="px-3 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 border border-gray-700 transition-colors text-xs font-medium"
            >
              Today
            </button>
            <button
              onClick={() => setWeekOffset((o) => o + 1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 transition-colors text-base"
              title="Next week"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {/* ── Conflict alerts ─────────────────────────────────────────────────── */}
      {weekConflicts.length > 0 && (
        <div className="space-y-2">
          {weekConflicts.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between bg-red-950/30 border border-red-800/40 rounded-xl px-4 py-3 gap-4"
            >
              <div className="flex items-start gap-3 min-w-0">
                <span className="text-red-400 text-base shrink-0 mt-0.5">
                  ⚠️
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-red-300 font-medium truncate">
                    <span className="text-white">{c.taskATitle}</span>
                    <span className="text-red-500 mx-1.5">overlaps</span>
                    <span className="text-white">{c.taskBTitle}</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {c.date} · Only one can be attended — resolve now or get an
                    AI recommendation
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setChatConflict(c)}
                  className="text-xs bg-indigo-600/25 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-600/40 rounded-lg px-3 py-1.5 transition-colors font-medium"
                >
                  Ask AI ✦
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Calendar grid ───────────────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden">
        {/* Day header row */}
        <div
          className="flex border-b border-gray-700 bg-gray-800/60"
          style={{ paddingLeft: TIME_COL_W }}
        >
          {weekDates.map((date) => {
            const d = new Date(date + "T00:00:00");
            const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
            const dayNum = d.getDate();
            const isToday = date === new Date().toISOString().slice(0, 10);
            const hasConflict = weekConflicts.some((c) => c.date === date);
            const hasUnconfirmed = weekTasks.some(
              (t) => t.date === date && t.confirmed === false,
            );
            const hasTasks = weekTasks.some((t) => t.date === date);
            return (
              <div
                key={date}
                className="flex-1 text-center py-2.5 border-l border-gray-700/50"
              >
                <p className="text-[10px] text-gray-500 uppercase tracking-widest">
                  {dayName}
                </p>
                <div className="flex items-center justify-center gap-1 mt-0.5">
                  <p
                    className={`text-sm font-bold ${
                      isToday
                        ? "bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs mx-auto"
                        : hasConflict
                          ? "text-red-400"
                          : hasTasks
                            ? "text-white"
                            : "text-gray-600"
                    }`}
                  >
                    {dayNum}
                  </p>
                  {hasConflict && (
                    <span className="text-red-400 text-[10px]">⚠</span>
                  )}
                  {hasUnconfirmed && !hasConflict && (
                    <span className="text-yellow-500 text-[10px]">◌</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Scrollable time grid */}
        <div className="overflow-y-auto" style={{ maxHeight: "68vh" }}>
          <div className="flex relative" style={{ height: TOTAL_HEIGHT }}>
            {/* Time-label column */}
            <div
              className="shrink-0 relative z-10 bg-gray-900"
              style={{ width: TIME_COL_W }}
            >
              {Array.from({ length: TOTAL_HOURS }, (_, i) => {
                const h = START_HOUR + i;
                const label =
                  h === 0
                    ? "12am"
                    : h < 12
                      ? `${h}am`
                      : h === 12
                        ? "12pm"
                        : `${h - 12}pm`;
                return (
                  <div
                    key={h}
                    style={{
                      position: "absolute",
                      top: i * HOUR_HEIGHT - 8,
                      right: 8,
                      lineHeight: "16px",
                    }}
                  >
                    <span className="text-[10px] text-gray-500 select-none">
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Day columns */}
            {weekDates.map((date) => {
              const dayTasks = weekTasks.filter((t) => t.date === date);
              const laid = assignLanes(dayTasks);

              return (
                <div
                  key={date}
                  className="flex-1 relative border-l border-gray-700/40"
                  style={{ minWidth: 0 }}
                >
                  {/* Hour gridlines */}
                  {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                    <div
                      key={`hr-${i}`}
                      style={{
                        position: "absolute",
                        top: i * HOUR_HEIGHT,
                        left: 0,
                        right: 0,
                        height: 1,
                        backgroundColor:
                          i === 0 ? "transparent" : "rgba(75,85,99,0.35)",
                      }}
                    />
                  ))}
                  {/* Half-hour gridlines */}
                  {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                    <div
                      key={`hh-${i}`}
                      style={{
                        position: "absolute",
                        top: i * HOUR_HEIGHT + HOUR_HEIGHT / 2,
                        left: 0,
                        right: 0,
                        height: 1,
                        backgroundColor: "rgba(55,65,81,0.3)",
                      }}
                    />
                  ))}

                  {/* Task blocks */}
                  {laid.map((l) => (
                    <TaskBlock
                      key={l.task.id}
                      laid={l}
                      isConflict={conflictTaskIds.has(l.task.id)}
                      onConfirm={() => confirmCalendarTask(l.task.id)}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Legend ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-3.5 rounded border border-dashed border-gray-400 bg-gray-700/20" />
          <span className="text-xs text-gray-400">Unconfirmed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-3.5 rounded border border-gray-500 bg-gray-700/40" />
          <span className="text-xs text-gray-400">Confirmed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-red-400 text-xs">⚠</span>
          <span className="text-xs text-gray-400">Conflict</span>
        </div>
        {[
          { label: "Internship", color: "#10b981" },
          { label: "Academic", color: "#3b82f6" },
          { label: "Networking", color: "#ec4899" },
          { label: "Event / Workshop", color: "#6366f1" },
          { label: "Career Fair", color: "#f97316" },
          { label: "Deadline", color: "#ef4444" },
          { label: "Research", color: "#8b5cf6" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-xs text-gray-400">{item.label}</span>
          </div>
        ))}
      </div>

      {/* ── AI Chat Panel ────────────────────────────────────────────────────── */}
      {chatConflict && (
        <AiChatPanel
          conflict={chatConflict}
          allTasks={calendarTasks}
          onClose={() => setChatConflict(null)}
          onResolve={(keepId) => {
            resolveConflict(chatConflict.id, keepId);
            setChatConflict(null);
          }}
        />
      )}
    </div>
  );
}
