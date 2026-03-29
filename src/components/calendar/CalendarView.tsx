"use client";
import { useState, useEffect } from "react";
import { useAppStore } from "@/store/appStore";
import { CalendarTask, Conflict, TaskType } from "@/types";
import { detectOverflow } from "@/lib/dayPlanner";

// ── Grid constants ─────────────────────────────────────────────────────────────
const HOUR_HEIGHT = 64;
const START_HOUR = 7;
const END_HOUR = 24;
const TOTAL_HOURS = END_HOUR - START_HOUR;
const TOTAL_HEIGHT = TOTAL_HOURS * HOUR_HEIGHT;
const TIME_COL_W = 52;

// ── Week helpers ───────────────────────────────────────────────────────────────
const BASE_MS = new Date("2026-03-30T00:00:00").getTime();
const DAY_MS = 86_400_000;

function getWeekDates(offset: number): string[] {
  return Array.from({ length: 7 }, (_, i) =>
    new Date(BASE_MS + (offset * 7 + i) * DAY_MS).toISOString().slice(0, 10),
  );
}

function weekRangeLabel(dates: string[]): string {
  const fmt = (s: string) =>
    new Date(s + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  return `${fmt(dates[0])} – ${fmt(dates[6])}, ${dates[0].slice(0, 4)}`;
}

// ── Time helpers ───────────────────────────────────────────────────────────────
function toMins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function topPx(time: string): number {
  return ((toMins(time) - START_HOUR * 60) / 60) * HOUR_HEIGHT;
}

function heightPx(start: string, end: string): number {
  const s = Math.max(toMins(start), START_HOUR * 60);
  const rawEnd = toMins(end);
  const e = Math.min(
    rawEnd <= toMins(start) ? toMins(start) + 30 : rawEnd,
    END_HOUR * 60,
  );
  return Math.max(((e - s) / 60) * HOUR_HEIGHT, 22);
}

// Snap a raw pixel Y offset within a day column to the nearest 15-min time string
function yToTimeStr(y: number): string {
  const totalMins = START_HOUR * 60 + (y / HOUR_HEIGHT) * 60;
  const snapped = Math.max(
    START_HOUR * 60,
    Math.min(Math.round(totalMins / 15) * 15, (END_HOUR - 1) * 60),
  );
  const h = Math.floor(snapped / 60);
  const m = snapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Add one hour to a time string, clamped to END_HOUR
function addOneHour(t: string): string {
  const m = Math.min(toMins(t) + 60, (END_HOUR - 1) * 60);
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

// ── Lane layout ────────────────────────────────────────────────────────────────
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
    const rawE = toMins(task.endTime);
    const e = rawE <= s ? s + 30 : rawE;
    let lane = laneEnds.findIndex((end) => s >= end);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(e);
    } else {
      laneEnds[lane] = e;
    }
    return { task, lane, laneCount: 1 };
  });

  assigned.forEach((a) => {
    const s = toMins(a.task.startTime);
    const rawE = toMins(a.task.endTime);
    const e = rawE <= s ? s + 30 : rawE;
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

// ── Event type options ─────────────────────────────────────────────────────────
const TYPE_OPTIONS: { value: TaskType; label: string; color: string }[] = [
  {
    value: "internship_application",
    label: "Internship Application",
    color: "#10b981",
  },
  { value: "company_research", label: "Company Research", color: "#8b5cf6" },
  { value: "networking", label: "Networking", color: "#ec4899" },
  { value: "career_fair", label: "Career Fair", color: "#f97316" },
  { value: "workshop", label: "Event / Workshop", color: "#6366f1" },
  { value: "class", label: "Class / Academic", color: "#3b82f6" },
  { value: "deadline", label: "Deadline", color: "#ef4444" },
  { value: "resume_update", label: "Resume Work", color: "#10b981" },
  { value: "free_time", label: "Free Time", color: "#6b7280" },
  { value: "other", label: "Other", color: "#6b7280" },
];

// ── Local types ────────────────────────────────────────────────────────────────
interface SelectedTask {
  task: CalendarTask;
  rect: DOMRect;
  conflict: Conflict | null;
  conflictPartner: CalendarTask | null;
}

interface AddModalState {
  date: string;
  startTime: string;
}

// ── TaskBlock ──────────────────────────────────────────────────────────────────
function TaskBlock({
  laid,
  isConflict,
  onClick,
  onExtend,
}: {
  laid: LaidTask;
  isConflict: boolean;
  onClick: (rect: DOMRect) => void;
  onExtend?: (extraMinutes: number) => void;
}) {
  const { task, lane, laneCount } = laid;
  const [hovered, setHovered] = useState(false);
  const top = topPx(task.startTime);
  const height = heightPx(task.startTime, task.endTime);
  const widthPct = 100 / laneCount;
  const leftPct = (lane / laneCount) * 100;
  const confirmed = task.confirmed !== false;
  const isTall = height >= 48;
  const isFlexible = task.flex === "flexible";

  const borderColor = isConflict ? "#ef4444" : task.color;
  const bg = `${task.color}${confirmed ? "20" : "12"}`;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        onClick((e.currentTarget as HTMLDivElement).getBoundingClientRect());
      }}
      style={{
        position: "absolute",
        top,
        height,
        left: `calc(${leftPct}% + 2px)`,
        width: `calc(${widthPct}% - 4px)`,
        backgroundColor: bg,
        border: confirmed
          ? `1px solid ${borderColor}50`
          : `1.5px dashed ${borderColor}90`,
        borderLeft: `3px solid ${borderColor}`,
        borderRadius: 6,
        overflow: "hidden",
        zIndex: isConflict ? 2 : 1,
        cursor: "pointer",
        transition: "filter 0.12s, box-shadow 0.12s",
      }}
      className={hovered ? "brightness-125 shadow-lg" : ""}
    >
      <div className="px-1.5 py-1 h-full flex flex-col gap-0.5 overflow-hidden">
        <div className="flex items-center gap-1 min-w-0">
          {isConflict && (
            <span className="text-red-400 text-[10px] shrink-0">⚠</span>
          )}
          {!confirmed && (
            <span
              className="text-yellow-400 text-[10px] shrink-0"
              title="Unconfirmed"
            >
              ◌
            </span>
          )}
          {isFlexible && (
            <span className="text-[9px] px-1 rounded bg-indigo-900/60 text-indigo-300 border border-indigo-700/50 shrink-0 leading-tight">
              flex
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
        {/* Extend buttons — only for flexible tasks, only when hovered and tall enough */}
        {isFlexible && onExtend && hovered && height >= 40 && (
          <div className="flex gap-1 mt-auto pt-0.5" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={(e) => { e.stopPropagation(); onExtend(30); }}
              className="text-[9px] px-1 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white/70 transition-colors leading-none"
              title="Extend by 30 minutes"
            >
              +30m
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onExtend(60); }}
              className="text-[9px] px-1 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white/70 transition-colors leading-none"
              title="Extend by 1 hour"
            >
              +1h
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── AddEventModal ──────────────────────────────────────────────────────────────
function AddEventModal({
  initial,
  onClose,
  onAdd,
}: {
  initial: AddModalState;
  onClose: () => void;
  onAdd: (task: Omit<CalendarTask, "id">) => void;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(initial.date);
  const [startTime, setStartTime] = useState(initial.startTime);
  const [endTime, setEndTime] = useState(() => addOneHour(initial.startTime));
  const [type, setType] = useState<TaskType>("other");
  const [error, setError] = useState("");

  const selectedType =
    TYPE_OPTIONS.find((o) => o.value === type) ??
    TYPE_OPTIONS[TYPE_OPTIONS.length - 1];

  // Update endTime default when startTime changes (only if end <= start)
  useEffect(() => {
    if (toMins(endTime) <= toMins(startTime)) {
      setEndTime(addOneHour(startTime));
    }
  }, [startTime]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please enter a title.");
      return;
    }
    if (toMins(endTime) <= toMins(startTime)) {
      setError("End time must be after start time.");
      return;
    }
    onAdd({
      title: title.trim(),
      date,
      startTime,
      endTime,
      type,
      color: selectedType.color,
      confirmed: true,
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl overflow-hidden">
        {/* Coloured accent bar — updates live with type */}
        <div
          className="h-1 w-full transition-colors duration-200"
          style={{ backgroundColor: selectedType.color }}
        />

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Add Event</h2>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-gray-700 transition-colors text-sm"
            >
              ✕
            </button>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Title</label>
            <input
              autoFocus
              type="text"
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-600 focus:border-indigo-500 focus:outline-none placeholder-gray-500"
              placeholder="e.g. Coffee chat with recruiter"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setError("");
              }}
            />
          </div>

          {/* Type picker */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Type</label>
            <div className="grid grid-cols-2 gap-1.5">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setType(opt.value)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-colors text-left ${
                    type === opt.value
                      ? "border-gray-500 bg-gray-700 text-white"
                      : "border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600 hover:text-gray-300"
                  }`}
                >
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: opt.color }}
                  />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Date</label>
            <input
              type="date"
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-600 focus:border-indigo-500 focus:outline-none"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* Start / End time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">
                Start time
              </label>
              <input
                type="time"
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-600 focus:border-indigo-500 focus:outline-none"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">
                End time
              </label>
              <input
                type="time"
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-600 focus:border-indigo-500 focus:outline-none"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          {/* Validation error */}
          {error && <p className="text-xs text-red-400">{error}</p>}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm border border-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 rounded-lg text-white text-sm font-medium transition-colors"
              style={{ backgroundColor: selectedType.color }}
            >
              Add to Calendar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── TaskPopover ────────────────────────────────────────────────────────────────
const POPOVER_W = 292;

function TaskPopover({
  selected,
  onClose,
  onConfirm,
  onResolve,
  onDelete,
}: {
  selected: SelectedTask;
  onClose: () => void;
  onConfirm: () => void;
  onResolve: (keepId: string) => void;
  onDelete: () => void;
}) {
  const { task, rect, conflict, conflictPartner } = selected;
  const confirmed = task.confirmed !== false;
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // ── Smart positioning ──────────────────────────────────────────────────────
  const GAP = 10;
  const POPOVER_MAX_H = 540;

  const rightSpace = window.innerWidth - rect.right;
  const leftSpace = rect.left;

  let left: number;
  if (rightSpace >= POPOVER_W + GAP) {
    left = rect.right + GAP;
  } else if (leftSpace >= POPOVER_W + GAP) {
    left = rect.left - POPOVER_W - GAP;
  } else {
    left = Math.max(
      GAP,
      Math.min(window.innerWidth - POPOVER_W - GAP, rect.left),
    );
  }

  const top = Math.max(
    GAP,
    Math.min(rect.top, window.innerHeight - POPOVER_MAX_H - GAP),
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const typeLabel = task.type.replace(/_/g, " ");

  return (
    <>
      {/* Invisible backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Popover card */}
      <div
        style={{ position: "fixed", left, top, width: POPOVER_W, zIndex: 50 }}
        className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Coloured accent bar */}
        <div className="h-1 w-full" style={{ backgroundColor: task.color }} />

        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: task.color }}
                />
                <span className="text-[10px] text-gray-500 uppercase tracking-wider truncate">
                  {typeLabel}
                </span>
                {!confirmed && (
                  <span className="text-[10px] text-yellow-400 border border-yellow-600/40 rounded px-1 leading-tight">
                    unconfirmed
                  </span>
                )}
              </div>
              <h3 className="text-sm font-semibold text-white leading-snug">
                {task.title}
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {task.date}&nbsp;·&nbsp;{task.startTime}–{task.endTime}
              </p>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 w-6 h-6 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-gray-700 transition-colors text-sm"
            >
              ✕
            </button>
          </div>

          {/* Unconfirmed notice */}
          {!confirmed && (
            <div className="mb-3 rounded-xl bg-yellow-500/10 border border-yellow-600/30 p-3">
              <p className="text-xs text-yellow-300 mb-2 leading-relaxed">
                This event hasn&apos;t been confirmed yet. Lock it in to include
                it in your plan.
              </p>
              <button
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className="w-full text-xs bg-yellow-500/20 hover:bg-yellow-500/35 text-yellow-200 border border-yellow-500/40 rounded-lg px-3 py-2 transition-colors font-medium"
              >
                Confirm Attendance ✓
              </button>
            </div>
          )}

          {/* Conflict section or no-conflict footer */}
          {conflict && conflictPartner ? (
            <div className="rounded-xl bg-red-950/40 border border-red-800/40 p-3 space-y-3">
              <div className="flex items-start gap-2">
                <span className="text-red-400 text-sm shrink-0 mt-0.5">⚠</span>
                <div>
                  <p className="text-xs text-red-300 font-semibold leading-tight">
                    Scheduling conflict
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                    Overlaps with{" "}
                    <span className="text-white font-medium">
                      &quot;{conflictPartner.title}&quot;
                    </span>{" "}
                    ({conflictPartner.startTime}–{conflictPartner.endTime}).
                    Only one can be attended.
                  </p>
                </div>
              </div>
              <div className="space-y-1.5">
                <button
                  onClick={() => {
                    onResolve(task.id);
                    onClose();
                  }}
                  className="w-full text-left text-xs bg-indigo-600/25 hover:bg-indigo-600/45 text-indigo-200 border border-indigo-600/40 rounded-lg px-3 py-2 transition-colors leading-snug"
                >
                  <span className="font-semibold">Keep this</span>
                  <span className="text-indigo-400">
                    {" "}
                    · remove &quot;{conflictPartner.title}&quot;
                  </span>
                </button>
                <button
                  onClick={() => {
                    onResolve(conflictPartner.id);
                    onClose();
                  }}
                  className="w-full text-left text-xs bg-gray-700/50 hover:bg-gray-700 text-gray-300 border border-gray-600/40 rounded-lg px-3 py-2 transition-colors leading-snug"
                >
                  <span className="font-semibold">
                    Keep &quot;{conflictPartner.title}&quot;
                  </span>
                  <span className="text-gray-500"> · remove this</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 pt-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500/70" />
              <span className="text-[10px] text-gray-500">
                No conflicts with other events
              </span>
            </div>
          )}

          {/* Delete section */}
          <div className="mt-3 pt-3 border-t border-gray-700/50">
            {!confirmingDelete ? (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="w-full text-xs text-red-400/70 hover:text-red-400 hover:bg-red-950/30 rounded-lg px-3 py-2 transition-colors text-left"
              >
                🗑 Remove event
              </button>
            ) : (
              <div>
                <p className="text-xs text-gray-400 mb-2">
                  Remove this event from your calendar?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      onDelete();
                      onClose();
                    }}
                    className="flex-1 py-1.5 rounded-lg bg-red-600/80 hover:bg-red-600 text-white text-xs font-medium transition-colors"
                  >
                    Yes, remove
                  </button>
                  <button
                    onClick={() => setConfirmingDelete(false)}
                    className="flex-1 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ── CalendarView ───────────────────────────────────────────────────────────────
export default function CalendarView() {
  const {
    calendarTasks,
    conflicts,
    profile,
    resolveConflict,
    confirmCalendarTask,
    deleteCalendarTask,
    addCustomCalendarTask,
    extendTask,
  } = useAppStore();

  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedTask, setSelectedTask] = useState<SelectedTask | null>(null);
  const [addModal, setAddModal] = useState<AddModalState | null>(null);

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

  function handleTaskClick(task: CalendarTask, rect: DOMRect) {
    const conflict =
      conflicts.find((c) => c.taskAId === task.id || c.taskBId === task.id) ??
      null;
    const partnerId = conflict
      ? conflict.taskAId === task.id
        ? conflict.taskBId
        : conflict.taskAId
      : null;
    const conflictPartner = partnerId
      ? (calendarTasks.find((t) => t.id === partnerId) ?? null)
      : null;
    setSelectedTask({ task, rect, conflict, conflictPartner });
  }

  // Clicking an empty slot pre-fills the Add Event modal with that date + time
  function handleSlotClick(date: string, e: React.MouseEvent<HTMLDivElement>) {
    const colRect = e.currentTarget.getBoundingClientRect();
    const relY = e.clientY - colRect.top;
    const startTime = yToTimeStr(relY);
    setAddModal({ date, startTime });
  }

  // Close popover when navigating weeks
  useEffect(() => {
    setSelectedTask(null);
  }, [weekOffset]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col gap-4">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
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
              <span
                className="text-xs bg-red-500/15 text-red-400 px-2.5 py-1 rounded-full border border-red-800/40 cursor-default"
                title="Click any ⚠ event on the calendar to resolve"
              >
                ⚠ {weekConflicts.length} conflict
                {weekConflicts.length !== 1 ? "s" : ""} · click to resolve
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

          {/* Add event button */}
          <button
            onClick={() =>
              setAddModal({ date: weekDates[0], startTime: "09:00" })
            }
            className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
          >
            <span className="text-base leading-none">+</span> Add Event
          </button>
        </div>
      </div>

      {/* ── Calendar grid ────────────────────────────────────────────────────── */}
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden"
        onClick={() => setSelectedTask(null)}
      >
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
                        ? "bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs"
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
                  className="flex-1 relative border-l border-gray-700/40 cursor-crosshair"
                  style={{ minWidth: 0 }}
                  onClick={(e) => handleSlotClick(date, e)}
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
                      onClick={(rect) => handleTaskClick(l.task, rect)}
                      onExtend={l.task.flex === "flexible" ? (mins) => extendTask(l.task.id, mins) : undefined}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Legend ───────────────────────────────────────────────────────────── */}
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
          <span className="text-xs text-gray-400">
            Conflict — click event to resolve
          </span>
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

      {/* ── Overflow / Deferred Tasks ────────────────────────────────────────── */}
      {(() => {
        const overflowTasks = weekDates.flatMap((date) => {
          const { overflow } = detectOverflow(calendarTasks, date, profile);
          return overflow.map((t) => ({ ...t, date }));
        });
        if (overflowTasks.length === 0) return null;
        return (
          <div className="bg-gray-800/60 border border-yellow-700/40 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-yellow-400 text-sm">⚠</span>
              <h2 className="text-sm font-semibold text-yellow-300">Deferred — Day Overloaded</h2>
              <span className="text-xs text-gray-500 ml-auto">{overflowTasks.length} task{overflowTasks.length !== 1 ? "s" : ""} didn&apos;t fit</span>
            </div>
            <div className="flex flex-col gap-2">
              {overflowTasks.map((t) => (
                <div key={t.id} className="flex items-center gap-3 bg-gray-900/60 rounded-xl px-3 py-2 border border-gray-700/50">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{t.title}</p>
                    <p className="text-[10px] text-gray-500">{t.date} · {t.startTime}–{t.endTime}</p>
                  </div>
                  <span className="text-[10px] text-yellow-600 border border-yellow-700/40 rounded px-1.5 py-0.5 shrink-0">overflow</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── Task Popover ──────────────────────────────────────────────────────── */}
      {selectedTask && (
        <TaskPopover
          selected={selectedTask}
          onClose={() => setSelectedTask(null)}
          onConfirm={() => confirmCalendarTask(selectedTask.task.id)}
          onResolve={(keepId) => {
            if (selectedTask.conflict) {
              resolveConflict(selectedTask.conflict.id, keepId);
            }
            setSelectedTask(null);
          }}
          onDelete={() => {
            deleteCalendarTask(selectedTask.task.id);
            setSelectedTask(null);
          }}
        />
      )}

      {/* ── Add Event Modal ───────────────────────────────────────────────────── */}
      {addModal && (
        <AddEventModal
          initial={addModal}
          onClose={() => setAddModal(null)}
          onAdd={(task) => addCustomCalendarTask(task)}
        />
      )}
    </div>
  );
}
