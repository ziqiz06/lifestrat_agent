"use client";
import { useState, useEffect } from "react";
import { useAppStore } from "@/store/appStore";
import { UserProfile, ScheduleBlock, ScheduleBlockRecurrence } from "@/types";
import { saveProfile, clearCalendarAndDecisions } from "@/lib/supabaseSync";

const DOT  = { fontFamily: "var(--font-dot)"  } as const;
const MONO = { fontFamily: "var(--font-mono)" } as const;

const RECURRENCE_LABELS: Record<ScheduleBlockRecurrence, string> = {
  none: "One-time",
  daily: "Daily",
  weekly: "Weekly",
  weekdays: "Weekdays",
  weekends: "Weekends",
};

interface PreferencesProps {
  userId?: string | null;
}

export default function PreferencesView({ userId }: PreferencesProps) {
  const { profile, updateProfile, resetStore } = useAppStore();
  const [form, setForm] = useState<UserProfile>({ ...profile });
  const [saved, setSaved] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Schedule block form state
  const [blockName, setBlockName] = useState("");
  const [blockStart, setBlockStart] = useState("09:00");
  const [blockEnd, setBlockEnd] = useState("10:00");
  const [blockDate, setBlockDate] = useState("");
  const [blockRecurrence, setBlockRecurrence] = useState<ScheduleBlockRecurrence>("weekly");

  // Sync form when profile loads from Supabase after mount
  useEffect(() => {
    setForm({ ...profile });
  }, [profile]);

  const update = (key: keyof UserProfile, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

const handleSave = () => {
    updateProfile(form);
    if (userId) {
      saveProfile(userId, form);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = async () => {
    setResetting(true);
    resetStore();
    localStorage.removeItem('lifestrat-app-state');
    if (userId) {
      await clearCalendarAndDecisions(userId);
    }
    setResetting(false);
  };

  const addScheduleBlock = () => {
    if (!blockName.trim() || !blockStart || !blockEnd) return;
    if ((blockRecurrence === 'none' || blockRecurrence === 'weekly') && !blockDate) return;
    const newBlock: ScheduleBlock = {
      id: crypto.randomUUID(),
      name: blockName.trim(),
      startTime: blockStart,
      endTime: blockEnd,
      date: blockDate || undefined,
      recurrence: blockRecurrence,
    };
    const next = [...(profile.scheduleBlocks ?? []), newBlock];
    updateProfile({ ...profile, scheduleBlocks: next });
    setForm((prev) => ({ ...prev, scheduleBlocks: next }));
    setBlockName("");
    setBlockStart("09:00");
    setBlockEnd("10:00");
    setBlockDate("");
    setBlockRecurrence("weekly");
  };

  const removeScheduleBlock = (id: string) => {
    const next = (profile.scheduleBlocks ?? []).filter((b) => b.id !== id);
    updateProfile({ ...profile, scheduleBlocks: next });
    setForm((prev) => ({ ...prev, scheduleBlocks: next }));
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-5xl font-bold text-white" style={DOT}>Preferences</h1>
          <p className="text-base text-gray-400 mt-0.5" style={MONO}>
            Edit your planning constraints
          </p>
        </div>
        <button
          onClick={handleSave}
          className={`px-5 py-2 text-base font-medium transition-colors ${
            saved
              ? "bg-green-600 text-white"
              : "bg-indigo-600 hover:bg-indigo-500 text-white"
          }`}
          style={MONO}
        >
          {saved ? "✓ Saved!" : "Save Changes"}
        </button>
      </div>

      {/* Profile */}
      <section className="bg-gray-800 p-5 border border-gray-700 space-y-4">
        <h2 className="text-lg font-bold text-white uppercase tracking-wider" style={MONO}>Profile</h2>
        <div>
          <label className="block text-base text-gray-400 mb-1.5" style={MONO}>Your name</label>
          <input
            type="text"
            className="w-full bg-gray-700 text-white p-3 border border-gray-600 focus:border-indigo-500 focus:outline-none text-base"
            style={MONO}
            placeholder="e.g. Alex"
            value={form.name ?? ''}
            onChange={(e) => update('name', e.target.value)}
          />
        </div>
      </section>

      {/* Career */}
      <section className="bg-gray-800 p-5 border border-gray-700 space-y-4">
        <h2 className="text-lg font-bold text-white uppercase tracking-wider" style={MONO}>Career &amp; Interests</h2>
        <div>
          <label className="block text-base text-gray-400 mb-1.5" style={MONO}>
            Career goals
          </label>
          <textarea
            className="w-full bg-gray-700 text-white p-3 border border-gray-600 focus:border-indigo-500 focus:outline-none resize-none text-base"
            style={MONO}
            rows={2}
            value={form.careerGoals}
            onChange={(e) => update("careerGoals", e.target.value)}
          />
        </div>
        <div>
          <label className="block text-base text-gray-400 mb-1.5" style={MONO}>
            Professional interests
          </label>
          <textarea
            className="w-full bg-gray-700 text-white p-3 border border-gray-600 focus:border-indigo-500 focus:outline-none resize-none text-base"
            style={MONO}
            rows={2}
            value={form.professionalInterests}
            onChange={(e) => update("professionalInterests", e.target.value)}
          />
        </div>
        <div>
          <label className="block text-base text-gray-400 mb-1.5" style={MONO}>
            Target industries / roles
          </label>
          <input
            type="text"
            className="w-full bg-gray-700 text-white p-3 border border-gray-600 focus:border-indigo-500 focus:outline-none text-base"
            style={MONO}
            value={form.targetIndustries}
            onChange={(e) => update("targetIndustries", e.target.value)}
          />
        </div>
        <div>
          <label className="block text-base text-gray-400 mb-2" style={MONO}>
            Experience level
          </label>
          <div className="grid grid-cols-4 gap-2">
            {(["student", "entry", "mid", "senior"] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => update("experienceLevel", lvl)}
                className={`py-2 border text-xs capitalize transition-colors ${
                  form.experienceLevel === lvl
                    ? "bg-indigo-600 border-indigo-500 text-white"
                    : "bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500"
                }`}
                style={MONO}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <label className="text-base text-gray-400" style={MONO}>
            Actively seeking internships
          </label>
          <button
            onClick={() => update("activelyLooking", !form.activelyLooking)}
            className={`w-10 h-5 rounded-full transition-colors ${form.activelyLooking ? "bg-indigo-600" : "bg-gray-600"}`}
          >
            <div
              className={`w-4 h-4 bg-white rounded-full shadow transition-transform m-0.5 ${form.activelyLooking ? "translate-x-5" : "translate-x-0"}`}
            />
          </button>
        </div>
      </section>

      {/* Daily Routine */}
      <section className="bg-gray-800 p-5 border border-gray-700 space-y-4">
        <h2 className="text-lg font-bold text-white uppercase tracking-wider" style={MONO}>Daily Routine</h2>

        {/* Wake / Sleep */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-base text-gray-400 mb-1.5" style={MONO}>Wake up</label>
            <input type="time" className="w-full bg-gray-700 text-white p-2.5 border border-gray-600 focus:border-indigo-500 focus:outline-none text-base"
              style={MONO}
              value={form.wakeTime ?? "07:30"} onChange={(e) => update("wakeTime", e.target.value)} />
          </div>
          <div>
            <label className="block text-base text-gray-400 mb-1.5" style={MONO}>Sleep time</label>
            <input type="time" className="w-full bg-gray-700 text-white p-2.5 border border-gray-600 focus:border-indigo-500 focus:outline-none text-base"
              style={MONO}
              value={form.sleepTime ?? "23:00"} onChange={(e) => update("sleepTime", e.target.value)} />
          </div>
        </div>

        {/* Breakfast */}
        <div className="border border-gray-600/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-300" style={MONO}>Breakfast</label>
            <button
              onClick={() => update("breakfastTime", form.breakfastTime ? "" : "07:30")}
              className={`text-xs px-2.5 py-1 border font-semibold transition-colors ${
                form.breakfastTime
                  ? "bg-indigo-600 border-indigo-500 text-white"
                  : "bg-gray-700 border-gray-600 text-gray-400"
              }`}
              style={MONO}
            >
              {form.breakfastTime ? "On" : "N/A"}
            </button>
          </div>
          {form.breakfastTime ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500 mb-1" style={MONO}>Time</p>
                <input type="time" value={form.breakfastTime}
                  onChange={(e) => update("breakfastTime", e.target.value)}
                  className="w-full bg-gray-700 text-white p-2 border border-gray-600 focus:border-indigo-500 focus:outline-none text-sm"
                  style={MONO} />
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1" style={MONO}>Duration: <span className="text-indigo-400 font-bold">{form.breakfastDurationMinutes ?? 30} min</span></p>
                <input type="range" min={20} max={90} step={5}
                  value={form.breakfastDurationMinutes ?? 30}
                  onChange={(e) => update("breakfastDurationMinutes", Number(e.target.value))}
                  className="w-full accent-indigo-500 mt-2" />
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-600" style={MONO}>Not scheduled — toggle On to add a breakfast block.</p>
          )}
        </div>

        {/* Lunch */}
        <div className="border border-gray-600/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-300" style={MONO}>Lunch</label>
            <button
              onClick={() => update("lunchStart", form.lunchStart ? "" : "12:00")}
              className={`text-xs px-2.5 py-1 border font-semibold transition-colors ${
                form.lunchStart
                  ? "bg-indigo-600 border-indigo-500 text-white"
                  : "bg-gray-700 border-gray-600 text-gray-400"
              }`}
              style={MONO}
            >
              {form.lunchStart ? "On" : "N/A"}
            </button>
          </div>
          {form.lunchStart ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500 mb-1" style={MONO}>Time</p>
                <input type="time" value={form.lunchStart}
                  onChange={(e) => update("lunchStart", e.target.value)}
                  className="w-full bg-gray-700 text-white p-2 border border-gray-600 focus:border-indigo-500 focus:outline-none text-sm"
                  style={MONO} />
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1" style={MONO}>Duration: <span className="text-indigo-400 font-bold">{form.lunchDurationMinutes ?? 60} min</span></p>
                <input type="range" min={20} max={120} step={10}
                  value={form.lunchDurationMinutes ?? 60}
                  onChange={(e) => update("lunchDurationMinutes", Number(e.target.value))}
                  className="w-full accent-indigo-500 mt-2" />
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-600" style={MONO}>Not scheduled — toggle On to add a lunch block.</p>
          )}
        </div>

        {/* Dinner */}
        <div className="border border-gray-600/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-300" style={MONO}>Dinner</label>
            <button
              onClick={() => update("dinnerTime", form.dinnerTime ? "" : "18:30")}
              className={`text-xs px-2.5 py-1 border font-semibold transition-colors ${
                form.dinnerTime
                  ? "bg-indigo-600 border-indigo-500 text-white"
                  : "bg-gray-700 border-gray-600 text-gray-400"
              }`}
              style={MONO}
            >
              {form.dinnerTime ? "On" : "N/A"}
            </button>
          </div>
          {form.dinnerTime ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500 mb-1" style={MONO}>Time</p>
                <input type="time" value={form.dinnerTime}
                  onChange={(e) => update("dinnerTime", e.target.value)}
                  className="w-full bg-gray-700 text-white p-2 border border-gray-600 focus:border-indigo-500 focus:outline-none text-sm"
                  style={MONO} />
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1" style={MONO}>Duration: <span className="text-indigo-400 font-bold">{form.dinnerDurationMinutes ?? 60} min</span></p>
                <input type="range" min={30} max={120} step={10}
                  value={form.dinnerDurationMinutes ?? 60}
                  onChange={(e) => update("dinnerDurationMinutes", Number(e.target.value))}
                  className="w-full accent-indigo-500 mt-2" />
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-600" style={MONO}>Not scheduled — toggle On to add a dinner block.</p>
          )}
        </div>
      </section>

      {/* Work Hours & Schedule */}
      <section className="bg-gray-800 p-5 border border-gray-700 space-y-4">
        <h2 className="text-lg font-bold text-white uppercase tracking-wider" style={MONO}>Work Hours &amp; Schedule</h2>

        {/* Workload picker */}
        <div>
          <label className="block text-base text-gray-400 mb-2" style={MONO}>Schedule intensity</label>
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: "light", label: "🌱 Light", sub: "0–4h/day" },
              { value: "moderate", label: "⚡ Moderate", sub: "4–7h/day" },
              { value: "heavy", label: "🔥 Heavy", sub: "7–9h/day" },
              { value: "insane", label: "💀 Insane", sub: "9–16h/day" },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                onClick={() => update("scheduleIntensity", opt.value)}
                className={`py-3 px-4 border text-left transition-colors ${
                  form.scheduleIntensity === opt.value
                    ? "bg-indigo-600 border-indigo-500 text-white"
                    : "bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500"
                }`}
                style={MONO}
              >
                <div className="text-sm font-medium">{opt.label}</div>
                <div className="text-sm opacity-70 mt-0.5">{opt.sub}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-base text-gray-400 mb-1.5" style={MONO}>Start time</label>
            <input
              type="time"
              className="w-full bg-gray-700 text-white p-2.5 border border-gray-600 focus:border-indigo-500 focus:outline-none text-base"
              style={MONO}
              value={form.preferredStartTime}
              onChange={(e) => update("preferredStartTime", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-base text-gray-400 mb-1.5" style={MONO}>End time</label>
            <input
              type="time"
              className="w-full bg-gray-700 text-white p-2.5 border border-gray-600 focus:border-indigo-500 focus:outline-none text-base"
              style={MONO}
              value={form.preferredEndTime}
              onChange={(e) => update("preferredEndTime", e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Reset */}
      <section className="bg-gray-800 p-5 border border-red-900/40 space-y-3">
        <h2 className="text-lg font-bold text-white uppercase tracking-wider" style={MONO}>Reset Data</h2>
        <p className="text-base text-gray-400" style={MONO}>
          Clears your calendar and opportunity decisions back to defaults. Your profile settings are kept.
        </p>
        <button
          onClick={handleReset}
          disabled={resetting}
          className="px-4 py-2 text-base font-medium bg-red-900/40 hover:bg-red-800/60 text-red-300 border border-red-800/50 transition-colors disabled:opacity-50"
          style={MONO}
        >
          {resetting ? "Resetting…" : "Reset Calendar & Decisions"}
        </button>
      </section>

      {/* Scheduling Constraints */}
      <section className="bg-gray-800 p-5 border border-gray-700 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-white uppercase tracking-wider" style={MONO}>Blocked Time</h2>
          <p className="text-xs text-gray-500 mt-0.5" style={MONO}>These show as unavailable on your calendar and are skipped by the scheduler.</p>
        </div>

        {/* Existing blocks */}
        {(form.scheduleBlocks ?? []).length === 0 ? (
          <p className="text-sm text-gray-600" style={MONO}>No blocked times added yet.</p>
        ) : (
          <div className="space-y-2">
            {(form.scheduleBlocks ?? []).map((b) => (
              <div key={b.id} className="flex items-center justify-between bg-gray-700/60 px-3 py-2.5 border border-gray-600/50">
                <div className="min-w-0">
                  <p className="text-base text-white font-medium" style={MONO}>{b.name}</p>
                  <p className="text-sm text-gray-400" style={MONO}>
                    {b.startTime}–{b.endTime} · {RECURRENCE_LABELS[b.recurrence]}
                    {b.date ? ` · ${b.date}` : ""}
                  </p>
                </div>
                <button onClick={() => removeScheduleBlock(b.id)} className="text-gray-500 hover:text-red-400 transition-colors ml-3 shrink-0" style={MONO}>✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Add new block form */}
        <div className="border border-gray-600/60 p-4 space-y-3">
          <p className="text-base font-medium text-gray-300" style={MONO}>Add blocked time</p>

          <input
            value={blockName}
            onChange={(e) => setBlockName(e.target.value)}
            placeholder="Event name (e.g. Gym, No work)"
            className="w-full bg-gray-700 text-white text-base px-3 py-2 border border-gray-600 focus:border-indigo-500 focus:outline-none placeholder-gray-500"
            style={MONO}
          />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm text-gray-500 mb-1" style={MONO}>Start time</label>
              <input type="time" value={blockStart} onChange={(e) => setBlockStart(e.target.value)}
                className="w-full bg-gray-700 text-white text-base px-3 py-2 border border-gray-600 focus:border-indigo-500 focus:outline-none"
                style={MONO} />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1" style={MONO}>End time</label>
              <input type="time" value={blockEnd} onChange={(e) => setBlockEnd(e.target.value)}
                className="w-full bg-gray-700 text-white text-base px-3 py-2 border border-gray-600 focus:border-indigo-500 focus:outline-none"
                style={MONO} />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-500 mb-1" style={MONO}>Repeats</label>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(RECURRENCE_LABELS) as ScheduleBlockRecurrence[]).map((r) => (
                <button key={r} onClick={() => setBlockRecurrence(r)}
                  className={`px-3 py-1 text-sm border transition-colors ${blockRecurrence === r ? "bg-indigo-600 border-indigo-500 text-white" : "bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500"}`}
                  style={MONO}>
                  {RECURRENCE_LABELS[r]}
                </button>
              ))}
            </div>
          </div>

          {(blockRecurrence === 'none' || blockRecurrence === 'weekly') && (
            <div>
              <label className="block text-sm text-gray-500 mb-1" style={MONO}>
                {blockRecurrence === 'none' ? 'Date' : 'Starting date (sets day of week)'}
              </label>
              <input type="date" value={blockDate} onChange={(e) => setBlockDate(e.target.value)}
                className="w-full bg-gray-700 text-white text-base px-3 py-2 border border-gray-600 focus:border-indigo-500 focus:outline-none"
                style={MONO} />
            </div>
          )}

          <button
            onClick={addScheduleBlock}
            disabled={!blockName.trim() || !blockStart || !blockEnd || ((blockRecurrence === 'none' || blockRecurrence === 'weekly') && !blockDate)}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-base font-medium transition-colors"
            style={MONO}
          >
            Add Block
          </button>
        </div>
      </section>
    </div>
  );
}
