"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useAppStore } from "@/store/appStore";
import { CalendarTask, Conflict, RecurrenceRule, TaskType } from "@/types";
import { scheduleBlockAppliesToDate } from "@/lib/dayPlanner";
import { detectOverflow } from "@/lib/dayPlanner";

// ── Recurrence helpers ─────────────────────────────────────────────────────────

/** Returns true if a recurring task should appear on the given date. */
function occursOn(task: CalendarTask, date: string): boolean {
  const rule = task.recurrence;
  if (!rule || rule.frequency === 'none') return task.date === date;
  if (date < task.date) return false;
  if (rule.endDate && date > rule.endDate) return false;

  const d    = new Date(date        + 'T00:00:00');
  const orig = new Date(task.date   + 'T00:00:00');
  const interval = rule.interval ?? 1;

  switch (rule.frequency) {
    case 'daily': {
      const diffDays = Math.round((d.getTime() - orig.getTime()) / 86_400_000);
      return diffDays >= 0 && diffDays % interval === 0;
    }
    case 'weekly': {
      if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
        return d >= orig && rule.daysOfWeek.includes(d.getDay());
      }
      const diffWeeks = Math.round((d.getTime() - orig.getTime()) / (7 * 86_400_000));
      return d.getDay() === orig.getDay() && diffWeeks >= 0 && diffWeeks % interval === 0;
    }
    case 'monthly': {
      if (d.getDate() !== orig.getDate()) return false;
      const monthDiff =
        (d.getFullYear() - orig.getFullYear()) * 12 + (d.getMonth() - orig.getMonth());
      return monthDiff >= 0 && monthDiff % interval === 0;
    }
  }
  return false;
}

/**
 * Expands recurring tasks into virtual instances for the visible week dates.
 * Non-recurring tasks are included only if their date is in weekDates.
 * Virtual instances keep the original task.id (so store actions work).
 */
function expandRecurringTasks(tasks: CalendarTask[], weekDates: string[]): CalendarTask[] {
  const result: CalendarTask[] = [];
  for (const task of tasks) {
    if (!task.recurrence || task.recurrence.frequency === 'none') {
      if (weekDates.includes(task.date)) result.push(task);
    } else {
      for (const date of weekDates) {
        if (occursOn(task, date)) {
          result.push({ ...task, date });
        }
      }
    }
  }
  return result;
}

const DOT  = { fontFamily: "var(--font-dot)"  } as const;
const MONO = { fontFamily: "var(--font-mono)" } as const;

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

// ── Drag helpers ───────────────────────────────────────────────────────────────
function minutesToTime(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(Math.min(h, 23)).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

interface DragState {
  task:          CalendarTask;
  offsetMinutes: number; // how many minutes from task start the user grabbed
  ghostDate:     string;
  ghostStart:    string;
  ghostEnd:      string;
}

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

// ── Recurrence form state (used inside AddEventModal) ──────────────────────────
interface RecurrenceFormState {
  frequency: RecurrenceRule['frequency'];
  daysOfWeek: number[];
  endDate: string;
}

// ── TaskBlock ──────────────────────────────────────────────────────────────────
function TaskBlock({
  laid,
  isConflict,
  onClick,
  onExtend,
  onDragStart,
  isDragging,
  onMarkCompleted,
  onMarkMissed,
}: {
  laid: LaidTask;
  isConflict: boolean;
  onClick: (rect: DOMRect) => void;
  onExtend?: (extraMinutes: number) => void;
  onDragStart?: (task: CalendarTask, e: React.MouseEvent) => void;
  isDragging?: boolean;
  onMarkCompleted?: () => void;
  onMarkMissed?: () => void;
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

  const cs = task.completionStatus;
  const isCompleted = cs === 'completed';
  const isMissed    = cs === 'missed';
  const isAwaiting  = cs === 'awaiting_confirmation';

  const isOverrideAccepted = task.status === 'confirmed_with_override';
  const borderColor = isConflict && !isOverrideAccepted ? "#ef4444" : task.color;
  const bg = isMissed
    ? 'rgba(75,85,99,0.15)'
    : isCompleted
      ? `${task.color}${confirmed ? "28" : "0d"}`
      : `${task.color}${confirmed ? "20" : "0d"}`;
  const leftBorderColor = isMissed
    ? '#6b7280'
    : isCompleted
      ? '#22c55e'
      : isAwaiting
        ? '#f59e0b'
        : isOverrideAccepted
          ? "#d97706"
          : !confirmed
            ? "#eab308"
            : borderColor;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseDown={(e) => {
        if (isFlexible && onDragStart) onDragStart(task, e);
      }}
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
          : `1.5px dashed ${borderColor}70`,
        borderLeft: `3px solid ${leftBorderColor}`,
        borderRadius: 6,
        overflow: "hidden",
        zIndex: isConflict ? 2 : 1,
        cursor: isFlexible ? (isDragging ? "grabbing" : "grab") : "pointer",
        transition: isDragging ? "none" : "filter 0.12s, box-shadow 0.12s",
        opacity: isDragging ? 0.35 : 1,
      }}
      className={hovered && !isDragging ? "brightness-125 shadow-lg" : ""}
    >
      <div className="px-1.5 py-1 h-full flex flex-col gap-0.5 overflow-hidden">
        <div className="flex items-center gap-1 min-w-0">
          {/* Completion status icons */}
          {isCompleted && (
            <span className="text-green-400 text-[10px] shrink-0" title="Completed">✓</span>
          )}
          {isMissed && (
            <span className="text-gray-500 text-[10px] shrink-0" title="Missed">✕</span>
          )}
          {isAwaiting && (
            <span className="text-amber-400 text-[10px] shrink-0 animate-pulse" title="Did you complete this?">?</span>
          )}
          {!isCompleted && !isMissed && !isAwaiting && isConflict && !isOverrideAccepted && (
            <span className="text-red-400 text-[10px] shrink-0" title="Scheduling Conflict">⚠</span>
          )}
          {!isCompleted && !isMissed && !isAwaiting && isOverrideAccepted && (
            <span className="text-amber-500 text-[10px] shrink-0" title="Conflict accepted">~</span>
          )}
          {!isCompleted && !isMissed && !isAwaiting && !confirmed && task.status !== 'needs_confirmation' && !isOverrideAccepted && (
            <span className="text-yellow-400 text-[10px] shrink-0" title="Unconfirmed">◌</span>
          )}
          {task.status === 'needs_confirmation' && (
            <span className="text-[9px] px-1 rounded bg-yellow-900/60 text-yellow-300 border border-yellow-700/50 shrink-0 leading-tight" title="Needs Confirmation">!</span>
          )}
          {task.status === 'deferred' && (
            <span className="text-[9px] px-1 rounded bg-gray-700/80 text-gray-400 border border-gray-600/50 shrink-0 leading-tight">defer</span>
          )}
          {task.status === 'awaiting_permission' && (
            <span className="text-[9px] px-1 rounded bg-orange-900/60 text-orange-300 border border-orange-700/50 shrink-0 leading-tight">?</span>
          )}
          {isFlexible && (
            <span className="text-[9px] px-1 rounded bg-indigo-900/60 text-indigo-300 border border-indigo-700/50 shrink-0 leading-tight">flex</span>
          )}
          {isTall && (
            <span
              className="text-[10px] font-semibold truncate"
              style={{ color: isMissed ? '#6b7280' : isCompleted ? '#22c55e' : task.color, ...MONO }}
            >
              {task.startTime}–{task.endTime}
            </span>
          )}
        </div>
        <p
          className="text-[15px] font-semibold text-white leading-tight"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: isTall ? 2 : 1,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            letterSpacing: "0.06em",
            ...DOT,
          }}
        >
          {task.title}
        </p>
        {/* Awaiting-confirmation quick actions — shown on hover */}
        {isAwaiting && hovered && height >= 36 && (
          <div className="flex gap-1 mt-auto pt-0.5" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={(e) => { e.stopPropagation(); onMarkCompleted?.(); }}
              className="flex-1 text-[9px] py-0.5 bg-green-900/60 hover:bg-green-800/80 text-green-300 transition-colors leading-none"
              style={MONO}
              title="Mark as completed"
            >
              ✓ Done
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onMarkMissed?.(); }}
              className="flex-1 text-[9px] py-0.5 bg-gray-700/60 hover:bg-gray-600/80 text-gray-400 transition-colors leading-none"
              style={MONO}
              title="Mark as missed"
            >
              ✕ Missed
            </button>
          </div>
        )}
        {/* Extend buttons — only for flexible tasks, only when hovered and tall enough */}
        {isFlexible && !isAwaiting && onExtend && hovered && height >= 40 && (
          <div className="flex gap-1 mt-auto pt-0.5" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={(e) => { e.stopPropagation(); onExtend(30); }}
              className="text-[9px] px-1 py-0.5 bg-white/10 hover:bg-white/20 text-white/70 transition-colors leading-none"
              style={MONO}
              title="Extend by 30 minutes"
            >
              +30m
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onExtend(60); }}
              className="text-[9px] px-1 py-0.5 bg-white/10 hover:bg-white/20 text-white/70 transition-colors leading-none"
              style={MONO}
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
const DOW_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

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
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(initial.date);
  const [startTime, setStartTime] = useState(initial.startTime);
  const [endTime, setEndTime] = useState(() => addOneHour(initial.startTime));
  const [type, setType] = useState<TaskType>("other");
  const [error, setError] = useState("");
  const [recurrence, setRecurrence] = useState<RecurrenceFormState>({
    frequency: 'none',
    daysOfWeek: [],
    endDate: '',
  });

  function toggleDow(dow: number) {
    setRecurrence((r) => ({
      ...r,
      daysOfWeek: r.daysOfWeek.includes(dow)
        ? r.daysOfWeek.filter((d) => d !== dow)
        : [...r.daysOfWeek, dow],
    }));
  }

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

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please enter a title.");
      return;
    }
    if (toMins(endTime) <= toMins(startTime)) {
      setError("End time must be after start time.");
      return;
    }
    const recurrenceRule: RecurrenceRule | undefined =
      recurrence.frequency === 'none'
        ? undefined
        : {
            frequency: recurrence.frequency,
            interval: 1,
            daysOfWeek:
              recurrence.frequency === 'weekly' && recurrence.daysOfWeek.length > 0
                ? recurrence.daysOfWeek
                : undefined,
            endDate: recurrence.endDate || undefined,
          };
    onAdd({
      title: title.trim(),
      description: description.trim() || undefined,
      date,
      startTime,
      endTime,
      type,
      color: selectedType.color,
      confirmed: true,
      recurrence: recurrenceRule,
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
      <div className="w-full max-w-md bg-gray-900 border border-gray-700 shadow-2xl overflow-hidden">
        {/* Coloured accent bar — updates live with type */}
        <div
          className="h-1 w-full transition-colors duration-200"
          style={{ backgroundColor: selectedType.color }}
        />

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white uppercase tracking-wider" style={MONO}>Add Event</h2>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-white hover:bg-gray-700 transition-colors text-sm"
              style={MONO}
            >
              ✕
            </button>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm text-gray-400 mb-1.5" style={MONO}>Title</label>
            <input
              autoFocus
              type="text"
              className="w-full bg-gray-800 text-white px-3 py-2 text-base border border-gray-600 focus:border-indigo-500 focus:outline-none placeholder-gray-500"
              style={MONO}
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
            <label className="block text-sm text-gray-400 mb-1.5" style={MONO}>Type</label>
            <div className="grid grid-cols-2 gap-1.5">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setType(opt.value)}
                  className={`flex items-center gap-2 px-3 py-2 border text-sm transition-colors text-left ${
                    type === opt.value
                      ? "border-gray-500 bg-gray-700 text-white"
                      : "border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600 hover:text-gray-300"
                  }`}
                  style={MONO}
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
            <label className="block text-sm text-gray-400 mb-1.5" style={MONO}>Date</label>
            <input
              type="date"
              className="w-full bg-gray-800 text-white px-3 py-2 text-base border border-gray-600 focus:border-indigo-500 focus:outline-none"
              style={MONO}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* Start / End time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5" style={MONO}>
                Start time
              </label>
              <input
                type="time"
                className="w-full bg-gray-800 text-white px-3 py-2 text-base border border-gray-600 focus:border-indigo-500 focus:outline-none"
                style={MONO}
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5" style={MONO}>
                End time
              </label>
              <input
                type="time"
                className="w-full bg-gray-800 text-white px-3 py-2 text-base border border-gray-600 focus:border-indigo-500 focus:outline-none"
                style={MONO}
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm text-gray-400 mb-1.5" style={MONO}>Description (optional)</label>
            <textarea
              className="w-full bg-gray-800 text-white px-3 py-2 text-sm border border-gray-600 focus:border-indigo-500 focus:outline-none placeholder-gray-500 resize-none"
              style={MONO}
              rows={2}
              placeholder="Notes, location, links…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Recurrence */}
          <div>
            <label className="block text-sm text-gray-400 mb-1.5" style={MONO}>Recurrence</label>
            <select
              className="w-full bg-gray-800 text-white px-3 py-2 text-sm border border-gray-600 focus:border-indigo-500 focus:outline-none"
              style={MONO}
              value={recurrence.frequency}
              onChange={(e) =>
                setRecurrence((r) => ({
                  ...r,
                  frequency: e.target.value as RecurrenceRule['frequency'],
                  daysOfWeek: [],
                }))
              }
            >
              <option value="none">Does not repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly (same day)</option>
            </select>

            {/* Day-of-week selector (weekly only) */}
            {recurrence.frequency === 'weekly' && (
              <div className="flex gap-1.5 mt-2">
                {DOW_LABELS.map((label, dow) => (
                  <button
                    key={dow}
                    type="button"
                    onClick={() => toggleDow(dow)}
                    className={`w-8 h-8 text-xs font-bold transition-colors border ${
                      recurrence.daysOfWeek.includes(dow)
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : 'bg-gray-800 text-gray-400 border-gray-600 hover:border-gray-500'
                    }`}
                    style={MONO}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* End date (daily / weekly / monthly) */}
            {recurrence.frequency !== 'none' && (
              <div className="mt-2">
                <label className="block text-xs text-gray-500 mb-1" style={MONO}>Ends on (optional)</label>
                <input
                  type="date"
                  className="w-full bg-gray-800 text-white px-3 py-1.5 text-sm border border-gray-600 focus:border-indigo-500 focus:outline-none"
                  style={MONO}
                  value={recurrence.endDate}
                  onChange={(e) => setRecurrence((r) => ({ ...r, endDate: e.target.value }))}
                />
              </div>
            )}
          </div>

          {/* Validation error */}
          {error && <p className="text-sm text-red-400" style={MONO}>{error}</p>}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-base border border-gray-600 transition-colors"
              style={MONO}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 text-white text-base font-medium transition-colors"
              style={{ backgroundColor: selectedType.color, ...MONO }}
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
  onUpdate,
  onAcceptConflict,
  onUndoOverride,
  onMarkCompleted,
  onMarkMissed,
}: {
  selected: SelectedTask;
  onClose: () => void;
  onConfirm: () => void;
  onResolve: (keepId: string) => void;
  onDelete: () => void;
  onUpdate: (updates: Partial<Pick<CalendarTask, 'title' | 'startTime' | 'endTime' | 'description'>>) => void;
  onAcceptConflict: () => void;
  onUndoOverride: () => void;
  onMarkCompleted: () => void;
  onMarkMissed: () => void;
}) {
  const { task, rect, conflict, conflictPartner } = selected;
  const confirmed = task.confirmed !== false;
  const cs = task.completionStatus;
  const isCompleted = cs === 'completed';
  const isMissed    = cs === 'missed';
  const isAwaiting  = cs === 'awaiting_confirmation';
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editStart, setEditStart] = useState(task.startTime);
  const [editEnd, setEditEnd] = useState(task.endTime);

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
        className="bg-gray-900 border border-gray-700 shadow-2xl overflow-hidden"
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
                <span className="text-xs text-gray-500 uppercase tracking-wider truncate" style={MONO}>
                  {typeLabel}
                </span>
                {!confirmed && (
                  <span className="text-xs text-yellow-400 border border-yellow-600/40 px-1 leading-tight" style={MONO}>
                    unconfirmed
                  </span>
                )}
              </div>
              <h3 className="text-base font-semibold text-white leading-snug" style={MONO}>
                {task.title}
              </h3>
              <p className="text-sm text-gray-400 mt-0.5" style={MONO}>
                {task.date}&nbsp;·&nbsp;{task.startTime}–{task.endTime}
                {task.totalScheduledMinutes != null && (
                  <span className="ml-2 text-gray-500">
                    · {task.totalScheduledMinutes >= 60
                      ? `${Math.round(task.totalScheduledMinutes / 6) / 10}h`
                      : `${task.totalScheduledMinutes}min`} total
                    {task.splitGroup ? ' across blocks' : ''}
                  </span>
                )}
              </p>
              {/* Flex / scheduling metadata */}
              <div className="flex flex-wrap gap-1 mt-1">
                {task.flex === 'flexible' && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-indigo-900/50 text-indigo-300 border border-indigo-800/50" style={MONO}>
                    Flexible task · can be moved
                  </span>
                )}
                {task.recurrence && task.recurrence.frequency !== 'none' && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-gray-700/60 text-gray-400 border border-gray-600/40" style={MONO}>
                    ↻ Recurring ({task.recurrence.frequency})
                  </span>
                )}
                {task.status && task.status !== 'confirmed' && task.status !== 'confirmed_with_override' && (
                  <span className={`text-[10px] px-1.5 py-0.5 font-medium ${
                    task.status === 'needs_confirmation' ? 'bg-yellow-900/50 text-yellow-300' :
                    task.status === 'scheduling_conflict' ? 'bg-red-900/50 text-red-300' :
                    task.status === 'deferred' ? 'bg-gray-700 text-gray-400' :
                    task.status === 'awaiting_permission' ? 'bg-orange-900/50 text-orange-300' :
                    task.status === 'unscheduled' ? 'bg-gray-700 text-gray-500' :
                    'bg-gray-700 text-gray-400'
                  }`} style={MONO}>
                    {task.status.replace(/_/g, ' ')}
                  </span>
                )}
                {task.status === 'confirmed_with_override' && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-amber-900/40 text-amber-400 border border-amber-700/40" style={MONO}>
                    Conflict accepted
                  </span>
                )}
              </div>
              {/* Description */}
              {task.description && (
                <p className="text-xs text-gray-500 mt-1.5 leading-relaxed" style={MONO}>
                  {task.description}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="shrink-0 w-6 h-6 flex items-center justify-center text-gray-500 hover:text-white hover:bg-gray-700 transition-colors text-base"
              style={MONO}
            >
              ✕
            </button>
          </div>

          {/* Unconfirmed notice */}
          {!confirmed && (
            <div className="mb-3 bg-yellow-500/10 border border-yellow-600/30 p-3">
              <p className="text-xs text-yellow-300 mb-2 leading-relaxed" style={MONO}>
                This event hasn&apos;t been confirmed yet. Lock it in to include
                it in your plan.
              </p>
              <button
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className="w-full text-sm bg-yellow-500/20 hover:bg-yellow-500/35 text-yellow-200 border border-yellow-500/40 px-3 py-2 transition-colors font-medium"
                style={MONO}
              >
                Confirm Attendance ✓
              </button>
            </div>
          )}

          {/* ── Completion section ──────────────────────────────────────── */}
          {isAwaiting && (
            <div className="mb-3 bg-amber-950/30 border border-amber-700/40 p-3">
              <p className="text-xs text-amber-300 font-semibold mb-1" style={MONO}>Did you complete this?</p>
              <p className="text-xs text-gray-500 mb-2 leading-relaxed" style={MONO}>
                Mark the outcome to earn XP and update your character stats.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => { onMarkCompleted(); onClose(); }}
                  className="flex-1 py-1.5 bg-green-900/50 hover:bg-green-800/70 text-green-300 text-sm font-medium border border-green-700/50 transition-colors"
                  style={MONO}
                >
                  ✓ Completed
                </button>
                <button
                  onClick={() => { onMarkMissed(); onClose(); }}
                  className="flex-1 py-1.5 bg-gray-700/50 hover:bg-gray-700 text-gray-400 text-sm border border-gray-600/40 transition-colors"
                  style={MONO}
                >
                  ✕ Missed
                </button>
              </div>
            </div>
          )}
          {isCompleted && (
            <div className="mb-3 flex items-center gap-2 bg-green-950/30 border border-green-700/30 px-3 py-2">
              <span className="text-green-400 text-sm">✓</span>
              <p className="text-xs text-green-400 font-medium" style={MONO}>Completed — XP awarded</p>
            </div>
          )}
          {isMissed && (
            <div className="mb-3 flex items-center gap-2 bg-gray-800/50 border border-gray-600/30 px-3 py-2">
              <span className="text-gray-500 text-sm">✕</span>
              <p className="text-xs text-gray-500" style={MONO}>Marked as missed</p>
            </div>
          )}

          {/* Conflict section or no-conflict footer */}
          {task.conflictOverride ? (
            // Override accepted — soft indicator with undo
            <div className="bg-amber-950/30 border border-amber-800/30 p-3">
              <div className="flex items-start gap-2">
                <span className="text-amber-500 text-sm shrink-0 mt-0.5">~</span>
                <div className="flex-1">
                  <p className="text-sm text-amber-400 font-semibold leading-tight" style={MONO}>
                    Conflict accepted
                  </p>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed" style={MONO}>
                    You chose to keep this event despite a blocked-time overlap.
                  </p>
                  <button
                    onClick={() => { onUndoOverride(); onClose(); }}
                    className="mt-2 text-xs text-gray-500 hover:text-gray-300 transition-colors underline"
                    style={MONO}
                  >
                    Undo override — re-check conflicts
                  </button>
                </div>
              </div>
            </div>
          ) : conflict && conflict.isBlockedTime ? (
            // Blocked-time conflict — soft: show warning + "Keep anyway" option
            <div className="bg-orange-950/40 border border-orange-800/40 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-orange-400 text-sm shrink-0 mt-0.5">⚠</span>
                <div>
                  <p className="text-sm text-orange-300 font-semibold leading-tight" style={MONO}>
                    Overlaps blocked time
                  </p>
                  <p className="text-sm text-gray-400 mt-1 leading-relaxed" style={MONO}>
                    {conflict.reason}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { onAcceptConflict(); onClose(); }}
                  className="flex-1 text-sm bg-amber-900/40 hover:bg-amber-900/70 text-amber-300 border border-amber-700/50 px-3 py-1.5 transition-colors"
                  style={MONO}
                >
                  Keep anyway
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 text-sm bg-gray-700/50 hover:bg-gray-700 text-gray-400 border border-gray-600/40 px-3 py-1.5 transition-colors"
                  style={MONO}
                >
                  Move event
                </button>
              </div>
            </div>
          ) : conflict && conflictPartner ? (
            // Task-to-task conflict — user chooses which to keep
            <div className="bg-red-950/40 border border-red-800/40 p-3 space-y-3">
              <div className="flex items-start gap-2">
                <span className="text-red-400 text-sm shrink-0 mt-0.5">⚠</span>
                <div>
                  <p className="text-sm text-red-300 font-semibold leading-tight" style={MONO}>
                    Scheduling conflict
                  </p>
                  <p className="text-sm text-gray-400 mt-0.5 leading-relaxed" style={MONO}>
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
                  onClick={() => { onResolve(task.id); onClose(); }}
                  className="w-full text-left text-sm bg-indigo-600/25 hover:bg-indigo-600/45 text-indigo-200 border border-indigo-600/40 px-3 py-2 transition-colors leading-snug"
                  style={MONO}
                >
                  <span className="font-semibold">Keep this</span>
                  <span className="text-indigo-400"> · remove &quot;{conflictPartner.title}&quot;</span>
                </button>
                <button
                  onClick={() => { onResolve(conflictPartner.id); onClose(); }}
                  className="w-full text-left text-sm bg-gray-700/50 hover:bg-gray-700 text-gray-300 border border-gray-600/40 px-3 py-2 transition-colors leading-snug"
                  style={MONO}
                >
                  <span className="font-semibold">Keep &quot;{conflictPartner.title}&quot;</span>
                  <span className="text-gray-500"> · remove this</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 pt-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500/70" />
              <span className="text-xs text-gray-500" style={MONO}>No conflicts with other events</span>
            </div>
          )}

          {/* Edit section */}
          <div className="mt-3 pt-3 border-t border-gray-700/50">
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="w-full text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 px-3 py-2 transition-colors text-left"
                style={MONO}
              >
                ✏ Edit name / time
              </button>
            ) : (
              <div className="space-y-2">
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-gray-800 text-white text-sm px-3 py-2 border border-gray-600 focus:border-indigo-500 focus:outline-none"
                  style={MONO}
                  placeholder="Event name"
                />
                <textarea
                  value={task.description ?? ""}
                  onChange={(e) => onUpdate({ description: e.target.value || undefined })}
                  className="w-full bg-gray-800 text-white text-xs px-3 py-2 border border-gray-600 focus:border-indigo-500 focus:outline-none resize-none"
                  style={MONO}
                  rows={2}
                  placeholder="Description (optional)"
                />
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-0.5" style={MONO}>Start</label>
                    <input type="time" value={editStart} onChange={(e) => setEditStart(e.target.value)}
                      className="w-full bg-gray-800 text-white text-sm px-2 py-1.5 border border-gray-600 focus:border-indigo-500 focus:outline-none"
                      style={MONO} />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-0.5" style={MONO}>End</label>
                    <input type="time" value={editEnd} onChange={(e) => setEditEnd(e.target.value)}
                      className="w-full bg-gray-800 text-white text-sm px-2 py-1.5 border border-gray-600 focus:border-indigo-500 focus:outline-none"
                      style={MONO} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      onUpdate({ title: editTitle, startTime: editStart, endTime: editEnd });
                      setEditing(false);
                      onClose();
                    }}
                    className="flex-1 py-1.5 bg-indigo-600/80 hover:bg-indigo-600 text-white text-sm font-medium transition-colors"
                    style={MONO}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="flex-1 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm transition-colors"
                    style={MONO}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Delete section */}
          <div className="mt-2 pt-2 border-t border-gray-700/30">
            {!confirmingDelete ? (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="w-full text-sm text-red-400/70 hover:text-red-400 hover:bg-red-950/30 px-3 py-2 transition-colors text-left"
                style={MONO}
              >
                🗑 Remove event
              </button>
            ) : (
              <div>
                <p className="text-sm text-gray-400 mb-2" style={MONO}>
                  Remove this event from your calendar?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      onDelete();
                      onClose();
                    }}
                    className="flex-1 py-1.5 bg-red-600/80 hover:bg-red-600 text-white text-sm font-medium transition-colors"
                    style={MONO}
                  >
                    Yes, remove
                  </button>
                  <button
                    onClick={() => setConfirmingDelete(false)}
                    className="flex-1 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm transition-colors"
                    style={MONO}
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

// ── UnavailableBlock ───────────────────────────────────────────────────────────
function UnavailableBlock({ startTime, endTime, label }: { startTime: string; endTime: string; label: string }) {
  const top = topPx(startTime);
  const h = heightPx(startTime, endTime);
  if (h <= 0) return null;
  return (
    <div
      style={{
        position: "absolute", top, height: h, left: 0, right: 0, zIndex: 0,
        background: "repeating-linear-gradient(135deg, rgba(55,65,81,0.35) 0px, rgba(55,65,81,0.35) 2px, transparent 2px, transparent 8px)",
        backgroundColor: "rgba(17,24,39,0.45)",
        borderTop: "1px solid rgba(75,85,99,0.5)",
        borderBottom: "1px solid rgba(75,85,99,0.5)",
        pointerEvents: "none",
      }}
    >
      <span style={{ fontSize: 9, color: "rgba(156,163,175,0.8)", padding: "2px 6px", display: "block", lineHeight: "14px", userSelect: "none" }}>{label}</span>
    </div>
  );
}

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.min(Math.floor(total / 60), 23)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
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
    updateCalendarTask,
    acceptConflict,
    undoConflictOverride,
    markTaskCompleted,
    markTaskMissed,
    checkPastTasks,
    aiPlanCalendar,
    aiPlanLoading,
    aiPlanSummary,
  } = useAppStore();

  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedTask, setSelectedTask] = useState<SelectedTask | null>(null);

  // ── Drag state ────────────────────────────────────────────────────────────
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragRef    = useRef<DragState | null>(null);
  const scrollRef  = useRef<HTMLDivElement>(null);
  const gridRef    = useRef<HTMLDivElement>(null);
  const droppedRef = useRef(false); // suppress click after drop
  const [addModal, setAddModal] = useState<AddModalState | null>(null);

  const weekDates = getWeekDates(weekOffset);
  // Expand recurring tasks into virtual instances for the current week
  const weekTasks = expandRecurringTasks(calendarTasks, weekDates);
  const weekConflicts = conflicts.filter((c) => weekDates.includes(c.date));
  const conflictTaskIds = new Set(
    weekConflicts.flatMap((c) => [c.taskAId, c.taskBId]),
  );

  const totalTasks = weekTasks.length;
  const unconfirmedCount = weekTasks.filter(
    (t) => t.confirmed === false,
  ).length;

  // ── Drag handlers ──────────────────────────────────────────────────────────
  const handleDragStart = useCallback((task: CalendarTask, e: React.MouseEvent) => {
    if (task.flex !== "flexible") return;
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const offsetMinutes = Math.max(0, Math.floor(((e.clientY - rect.top) / HOUR_HEIGHT) * 60));
    const state: DragState = {
      task, offsetMinutes,
      ghostDate: task.date, ghostStart: task.startTime, ghostEnd: task.endTime,
    };
    dragRef.current = state;
    setDragState(state);
    droppedRef.current = false;
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
  }, []);

  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!dragRef.current || !scrollRef.current || !gridRef.current) return;
    const { task, offsetMinutes } = dragRef.current;
    const duration = toMins(task.endTime) - toMins(task.startTime);

    const scrollRect = scrollRef.current.getBoundingClientRect();
    const gridRect   = gridRef.current.getBoundingClientRect();
    const scrollTop  = scrollRef.current.scrollTop;

    // Time from Y
    const relY         = e.clientY - scrollRect.top + scrollTop;
    const rawMinutes   = (relY / HOUR_HEIGHT) * 60 + START_HOUR * 60 - offsetMinutes;
    const snapped      = Math.round(rawMinutes / 15) * 15;
    const clampedStart = Math.max(START_HOUR * 60, Math.min(END_HOUR * 60 - duration, snapped));
    const ghostStart   = minutesToTime(clampedStart);
    const ghostEnd     = minutesToTime(clampedStart + duration);

    // Date from X
    const relX     = e.clientX - gridRect.left - TIME_COL_W;
    const colW     = (gridRect.width - TIME_COL_W) / weekDates.length;
    const dayIdx   = Math.max(0, Math.min(weekDates.length - 1, Math.floor(relX / colW)));
    const ghostDate = weekDates[dayIdx];

    const next = { ...dragRef.current, ghostDate, ghostStart, ghostEnd };
    dragRef.current = next;
    setDragState(next);
    droppedRef.current = true;
  }, [weekDates]);

  const handleDragEnd = useCallback(() => {
    if (!dragRef.current) return;
    const { task, ghostDate, ghostStart, ghostEnd } = dragRef.current;
    if (droppedRef.current &&
        (ghostDate !== task.date || ghostStart !== task.startTime || ghostEnd !== task.endTime)) {
      updateCalendarTask(task.id, { date: ghostDate, startTime: ghostStart, endTime: ghostEnd });
    }
    dragRef.current = null;
    setDragState(null);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    // Brief flag so the click that fires on mouseup doesn't open the popover
    setTimeout(() => { droppedRef.current = false; }, 50);
  }, [updateCalendarTask]);

  useEffect(() => {
    if (!dragState) return;
    window.addEventListener("mousemove", handleDragMove);
    window.addEventListener("mouseup",   handleDragEnd);
    return () => {
      window.removeEventListener("mousemove", handleDragMove);
      window.removeEventListener("mouseup",   handleDragEnd);
    };
  }, [dragState, handleDragMove, handleDragEnd]);

  function handleTaskClick(task: CalendarTask, rect: DOMRect) {
    if (droppedRef.current) return; // suppress click that fires right after drop
    const conflict =
      conflicts.find((c) => c.taskAId === task.id || c.taskBId === task.id) ??
      null;
    const partnerId = conflict && !conflict.isBlockedTime
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

  // Scan past tasks on mount and whenever calendar tasks change
  useEffect(() => {
    checkPastTasks();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Close popover when navigating weeks
  useEffect(() => {
    setSelectedTask(null);
  }, [weekOffset]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col gap-4">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white" style={DOT}>Weekly Plan</h1>
          <p className="text-base text-gray-400 mt-0.5" style={MONO}>
            {weekRangeLabel(weekDates)}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Status badges */}
          <div className="flex items-center gap-2">
            {weekConflicts.length > 0 && (
              <span
                className="text-xs bg-red-500/15 text-red-400 px-2.5 py-1 border border-red-800/40 cursor-default"
                style={MONO}
                title="Click any ⚠ event on the calendar to resolve"
              >
                ⚠ {weekConflicts.length} conflict
                {weekConflicts.length !== 1 ? "s" : ""} · click to resolve
              </span>
            )}
            {unconfirmedCount > 0 && (
              <span className="text-xs bg-yellow-500/10 text-yellow-400 px-2.5 py-1 border border-yellow-700/40" style={MONO}>
                ◌ {unconfirmedCount} unconfirmed
              </span>
            )}
            <span className="text-xs bg-gray-700/60 text-gray-400 px-2.5 py-1 border border-gray-600/40" style={MONO}>
              {totalTasks} tasks
            </span>
          </div>

          {/* Week navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setWeekOffset((o) => o - 1)}
              className="w-8 h-8 flex items-center justify-center bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 transition-colors text-base"
              style={DOT}
              title="Previous week"
            >
              ‹
            </button>
            <button
              onClick={() => setWeekOffset(0)}
              className="px-3 h-8 bg-gray-800 hover:bg-gray-700 text-gray-400 border border-gray-700 transition-colors text-sm font-medium"
              style={DOT}
            >
              Today
            </button>
            <button
              onClick={() => setWeekOffset((o) => o + 1)}
              className="w-8 h-8 flex items-center justify-center bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 transition-colors text-base"
              style={DOT}
              title="Next week"
            >
              ›
            </button>
          </div>

          {/* AI Plan button */}
          <button
            onClick={() => aiPlanCalendar()}
            disabled={aiPlanLoading}
            className="flex items-center gap-1.5 px-3 h-8 bg-violet-700 hover:bg-violet-600 disabled:opacity-50 disabled:cursor-wait text-white text-sm font-medium transition-colors"
            style={MONO}
            title="Let K2 intelligently reschedule your flexible tasks"
          >
            {aiPlanLoading ? "Planning…" : "AI Plan"}
          </button>

          {/* Add event button */}
          <button
            onClick={() =>
              setAddModal({ date: weekDates[0], startTime: "09:00" })
            }
            className="flex items-center gap-1.5 px-3 h-8 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
            style={MONO}
          >
            <span className="text-base leading-none">+</span> Add Event
          </button>
        </div>
      </div>

      {/* ── AI Plan summary banner ──────────────────────────────────────────── */}
      {aiPlanSummary && !aiPlanLoading && (
        <div className="flex items-start gap-3 px-4 py-3 bg-violet-950/60 border border-violet-700/40 text-sm text-violet-300" style={MONO}>
          <span className="shrink-0 text-violet-400">AI</span>
          <span>{aiPlanSummary}</span>
        </div>
      )}
      {aiPlanLoading && (
        <div className="flex items-center gap-3 px-4 py-3 bg-violet-950/40 border border-violet-800/30 text-sm text-violet-400" style={MONO}>
          <span className="animate-pulse">Thinking through your schedule…</span>
        </div>
      )}

      {/* ── Calendar grid ────────────────────────────────────────────────────── */}
      <div
        className="bg-gray-900 border border-gray-700 overflow-hidden"
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
                <p className="text-xs text-gray-500 uppercase tracking-widest" style={MONO}>
                  {dayName}
                </p>
                <div className="flex items-center justify-center gap-1 mt-0.5">
                  <p
                    className={`text-base font-bold ${
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
        <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight: "68vh" }}>
          <div ref={gridRef} className="flex relative" style={{ height: TOTAL_HEIGHT }}>
            {/* Time-label column */}
            <div
              className="shrink-0 relative z-10 bg-gray-900"
              style={{ width: TIME_COL_W }}
            >
              {Array.from({ length: TOTAL_HOURS }, (_, i) => {
                const h = START_HOUR + i;
                const label = `${String(h).padStart(2, "0")}:00`;
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
                    <span className="text-[10px] text-gray-500 select-none" style={MONO}>
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

                  {/* Unavailable blocks — sleep, meals */}
                  {profile.wakeTime && (
                    <UnavailableBlock startTime={`${String(START_HOUR).padStart(2,"0")}:00`} endTime={profile.wakeTime} label="Sleeping" />
                  )}
                  {profile.sleepTime && (
                    <UnavailableBlock startTime={profile.sleepTime} endTime={`${String(END_HOUR).padStart(2,"0")}:00`} label="Sleeping" />
                  )}
                  {profile.breakfastTime && (profile.breakfastDurationMinutes ?? 0) > 0 && (
                    <UnavailableBlock startTime={profile.breakfastTime} endTime={addMinutes(profile.breakfastTime, profile.breakfastDurationMinutes)} label="Breakfast" />
                  )}
                  {profile.lunchStart && (profile.lunchDurationMinutes ?? 0) > 0 && (
                    <UnavailableBlock startTime={profile.lunchStart} endTime={addMinutes(profile.lunchStart, profile.lunchDurationMinutes)} label="Lunch" />
                  )}
                  {profile.dinnerTime && (profile.dinnerDurationMinutes ?? 0) > 0 && (
                    <UnavailableBlock startTime={profile.dinnerTime} endTime={addMinutes(profile.dinnerTime, profile.dinnerDurationMinutes)} label="Dinner" />
                  )}
                  {(profile.scheduleBlocks ?? []).filter((b) => scheduleBlockAppliesToDate(b, date)).map((b) => (
                    <UnavailableBlock key={b.id} startTime={b.startTime} endTime={b.endTime} label={b.name} />
                  ))}

                  {/* Ghost block shown while dragging */}
                  {dragState && dragState.ghostDate === date && (
                    <div
                      style={{
                        position: "absolute",
                        top: topPx(dragState.ghostStart),
                        height: heightPx(dragState.ghostStart, dragState.ghostEnd),
                        left: 2, right: 2,
                        backgroundColor: `${dragState.task.color}30`,
                        border: `2px dashed ${dragState.task.color}bb`,
                        borderRadius: 6,
                        zIndex: 20,
                        pointerEvents: "none",
                      }}
                    >
                      <span className="text-[10px] px-1.5 py-0.5 font-semibold"
                        style={{ color: dragState.task.color, fontFamily: "var(--font-mono)" }}>
                        {dragState.ghostStart} – {dragState.ghostEnd}
                      </span>
                    </div>
                  )}

                  {/* Task blocks */}
                  {laid.map((l) => (
                    <TaskBlock
                      key={`${l.task.id}-${l.task.date}`}
                      laid={l}
                      isConflict={conflictTaskIds.has(l.task.id)}
                      onClick={(rect) => handleTaskClick(l.task, rect)}
                      onExtend={l.task.flex === "flexible" ? (mins) => extendTask(l.task.id, mins) : undefined}
                      onDragStart={handleDragStart}
                      isDragging={dragState?.task.id === l.task.id}
                      onMarkCompleted={() => markTaskCompleted(l.task.id)}
                      onMarkMissed={() => markTaskMissed(l.task.id)}
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
          <span className="text-sm text-gray-400" style={MONO}>Unconfirmed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-3.5 rounded border border-gray-500 bg-gray-700/40" />
          <span className="text-sm text-gray-400" style={MONO}>Confirmed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-red-400 text-xs">⚠</span>
          <span className="text-sm text-gray-400" style={MONO}>Conflict — click to resolve</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-amber-500 text-xs">~</span>
          <span className="text-sm text-gray-400" style={MONO}>Conflict accepted</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] px-1 bg-indigo-900/60 text-indigo-300 border border-indigo-700/50" style={MONO}>flex</span>
          <span className="text-sm text-gray-400" style={MONO}>Flexible · draggable</span>
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
            <span className="text-sm text-gray-400" style={MONO}>{item.label}</span>
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
          <div className="bg-gray-800/60 border border-yellow-700/40 p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-yellow-400 text-sm">⚠</span>
              <h2 className="text-base font-semibold text-yellow-300 uppercase tracking-wider" style={MONO}>Deferred — Day Overloaded</h2>
              <span className="text-sm text-gray-500 ml-auto" style={MONO}>{overflowTasks.length} task{overflowTasks.length !== 1 ? "s" : ""} didn&apos;t fit</span>
            </div>
            <div className="flex flex-col gap-2">
              {overflowTasks.map((t) => (
                <div key={t.id} className="flex items-center gap-3 bg-gray-900/60 px-3 py-2 border border-gray-700/50">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate" style={MONO}>{t.title}</p>
                    <p className="text-[10px] text-gray-500" style={MONO}>{t.date} · {t.startTime}–{t.endTime}</p>
                  </div>
                  <span className="text-[10px] text-yellow-600 border border-yellow-700/40 px-1.5 py-0.5 shrink-0" style={MONO}>overflow</span>
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
          onUpdate={(updates) => {
            updateCalendarTask(selectedTask.task.id, updates);
          }}
          onAcceptConflict={() => acceptConflict(selectedTask.task.id)}
          onUndoOverride={() => undoConflictOverride(selectedTask.task.id)}
          onMarkCompleted={() => markTaskCompleted(selectedTask.task.id)}
          onMarkMissed={() => markTaskMissed(selectedTask.task.id)}
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
