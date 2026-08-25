"use client";
import { useState } from "react";
import { useAppStore } from "@/store/appStore";
import { CalendarTask, TaskType } from "@/types";

const DOT  = { fontFamily: "var(--font-dot)"  } as const;
const MONO = { fontFamily: "var(--font-mono)" } as const;

const DOW_LABELS = ["S", "M", "T", "W", "T", "F", "S"] as const;

const ROUTINE_TYPE_OPTIONS: { value: TaskType; label: string; color: string }[] = [
  { value: "class", label: "Class", color: "#3b82f6" },
  { value: "workshop", label: "Work Block", color: "#6366f1" },
  { value: "networking", label: "Recurring Meeting", color: "#ec4899" },
  { value: "entertainment", label: "Gym / Personal", color: "#f59e0b" },
  { value: "free_time", label: "Free Time", color: "#6b7280" },
  { value: "other", label: "Other", color: "#6b7280" },
];

function toMins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function summarizeDays(daysOfWeek: number[] | undefined): string {
  if (!daysOfWeek || daysOfWeek.length === 0) return "";
  return daysOfWeek
    .slice()
    .sort((a, b) => a - b)
    .map((d) => DOW_LABELS[d])
    .join("");
}

export default function RoutinesView() {
  const { calendarTasks, addCustomCalendarTask, deleteCalendarTask } = useAppStore();

  const routines = calendarTasks.filter(
    (t) => t.recurrence && t.recurrence.frequency !== "none",
  );

  const [title, setTitle] = useState("");
  const [type, setType] = useState<TaskType>("class");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("11:00");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState("");

  const selectedType =
    ROUTINE_TYPE_OPTIONS.find((o) => o.value === type) ?? ROUTINE_TYPE_OPTIONS[0];

  function toggleDow(dow: number) {
    setDaysOfWeek((d) => (d.includes(dow) ? d.filter((x) => x !== dow) : [...d, dow]));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please enter a name.");
      return;
    }
    if (daysOfWeek.length === 0) {
      setError("Pick at least one day.");
      return;
    }
    if (toMins(endTime) <= toMins(startTime)) {
      setError("End time must be after start time.");
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const task: Omit<CalendarTask, "id"> = {
      title: title.trim(),
      type,
      flex: "fixed",
      startTime,
      endTime,
      date: today, // anchor date — recurrence expands forward from here
      color: selectedType.color,
      confirmed: true,
      recurrence: {
        frequency: "weekly",
        daysOfWeek,
        endDate: endDate || undefined,
      },
    };
    addCustomCalendarTask(task);
    setTitle("");
    setDaysOfWeek([]);
    setEndDate("");
    setError("");
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-5xl font-bold text-white" style={DOT}>Routines</h1>
        <p className="text-base text-gray-400 mt-0.5" style={MONO}>
          Set up things that repeat every week — classes, gym, standing meetings — so your calendar
          doesn&apos;t have to be rebuilt each time. The AI plan treats these as fixed and schedules
          flexible work around them.
        </p>
      </div>

      {/* Add routine form */}
      <section className="bg-gray-800 p-5 border border-gray-700 space-y-4">
        <h2 className="text-lg font-bold text-white uppercase tracking-wider" style={MONO}>
          Add a Routine
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5" style={MONO}>Name</label>
            <input
              type="text"
              className="w-full bg-gray-700 text-white px-3 py-2 text-base border border-gray-600 focus:border-indigo-500 focus:outline-none placeholder-gray-500"
              style={MONO}
              placeholder="e.g. CS 101 Lecture"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setError(""); }}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1.5" style={MONO}>Type</label>
            <div className="grid grid-cols-3 gap-1.5">
              {ROUTINE_TYPE_OPTIONS.map((opt) => (
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
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: opt.color }} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1.5" style={MONO}>Repeats on</label>
            <div className="flex gap-1.5">
              {DOW_LABELS.map((label, dow) => (
                <button
                  key={dow}
                  type="button"
                  onClick={() => toggleDow(dow)}
                  className={`w-9 h-9 text-xs font-bold transition-colors border ${
                    daysOfWeek.includes(dow)
                      ? "bg-indigo-600 text-white border-indigo-500"
                      : "bg-gray-700 text-gray-400 border-gray-600 hover:border-gray-500"
                  }`}
                  style={MONO}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5" style={MONO}>Start time</label>
              <input
                type="time"
                className="w-full bg-gray-700 text-white px-3 py-2 text-base border border-gray-600 focus:border-indigo-500 focus:outline-none"
                style={MONO}
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5" style={MONO}>End time</label>
              <input
                type="time"
                className="w-full bg-gray-700 text-white px-3 py-2 text-base border border-gray-600 focus:border-indigo-500 focus:outline-none"
                style={MONO}
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1.5" style={MONO}>Ends on (optional)</label>
            <input
              type="date"
              className="w-full bg-gray-700 text-white px-3 py-2 text-base border border-gray-600 focus:border-indigo-500 focus:outline-none"
              style={MONO}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-400" style={MONO}>{error}</p>}

          <button
            type="submit"
            className="w-full py-2 text-white text-base font-medium transition-colors"
            style={{ backgroundColor: selectedType.color, ...MONO }}
          >
            Add Routine
          </button>
        </form>
      </section>

      {/* Existing routines */}
      <section className="bg-gray-800 p-5 border border-gray-700 space-y-3">
        <h2 className="text-lg font-bold text-white uppercase tracking-wider" style={MONO}>
          Your Routines
        </h2>
        {routines.length === 0 ? (
          <p className="text-sm text-gray-600" style={MONO}>No routines yet — add one above.</p>
        ) : (
          <div className="space-y-2">
            {routines.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between bg-gray-700/60 px-3 py-2.5 border border-gray-600/50"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                  <div className="min-w-0">
                    <p className="text-base text-white font-medium truncate" style={MONO}>{r.title}</p>
                    <p className="text-sm text-gray-400" style={MONO}>
                      {summarizeDays(r.recurrence?.daysOfWeek)} · {r.startTime}–{r.endTime}
                      {r.recurrence?.endDate ? ` · until ${r.recurrence.endDate}` : ""}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => deleteCalendarTask(r.id)}
                  className="text-gray-500 hover:text-red-400 transition-colors ml-3 shrink-0"
                  style={MONO}
                  title="Remove routine"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="text-xs text-gray-600" style={MONO}>
        Removing a routine here removes every future occurrence. One-off events still belong on the
        Calendar tab.
      </p>
    </div>
  );
}
