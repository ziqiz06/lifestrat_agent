"use client";
import { useState } from "react";
import { UserProfile, ScheduleBlock, ScheduleBlockRecurrence } from "@/types";

interface Props {
  onComplete: (profile: UserProfile) => void;
}

const RECURRENCE_LABELS: Record<ScheduleBlockRecurrence, string> = {
  none: "One-time",
  daily: "Daily",
  weekly: "Weekly",
  weekdays: "Weekdays",
  weekends: "Weekends",
};

export default function OnboardingSurvey({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [breakfastEnabled, setBreakfastEnabled] = useState(true);
  const [lunchEnabled, setLunchEnabled] = useState(true);
  const [dinnerEnabled, setDinnerEnabled] = useState(true);

  // Schedule block form state (for Step 4)
  const [blockName, setBlockName] = useState("");
  const [blockStart, setBlockStart] = useState("09:00");
  const [blockEnd, setBlockEnd] = useState("10:00");
  const [blockDate, setBlockDate] = useState("");
  const [blockRecurrence, setBlockRecurrence] = useState<ScheduleBlockRecurrence>("weekly");

  const [form, setForm] = useState<Partial<UserProfile>>({
    activelyLooking: true,
    scheduleIntensity: "moderate",
    experienceLevel: "student",
    doNotScheduleDays: [],
    wakeTime: "07:30",
    sleepTime: "23:00",
    breakfastTime: "07:30",
    breakfastDurationMinutes: 30,
    lunchStart: "12:00",
    lunchDurationMinutes: 60,
    dinnerTime: "18:30",
    dinnerDurationMinutes: 60,
    perDaySchedule: {},
    doNotScheduleWindows: "",
    timezone: "",
    scheduleBlocks: [],
  });

  const update = (key: keyof UserProfile, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }));
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
    update("scheduleBlocks", [...(form.scheduleBlocks ?? []), newBlock]);
    setBlockName("");
    setBlockStart("09:00");
    setBlockEnd("10:00");
    setBlockDate("");
    setBlockRecurrence("weekly");
  };

  const removeScheduleBlock = (id: string) => {
    update("scheduleBlocks", (form.scheduleBlocks ?? []).filter((b) => b.id !== id));
  };

  const steps = [
    // ── Step 1: Career Goals ──────────────────────────────────────────────────
    {
      title: "Career Goals",
      content: (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              What&apos;s your name?
            </label>
            <input
              type="text"
              className="w-full bg-gray-700 text-white rounded-lg p-3 border border-gray-600 focus:border-indigo-500 focus:outline-none"
              placeholder="e.g. Alex"
              value={form.name ?? ""}
              onChange={(e) => update("name", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              What are your main career goals?
            </label>
            <textarea
              className="w-full bg-gray-700 text-white rounded-lg p-3 border border-gray-600 focus:border-indigo-500 focus:outline-none resize-none"
              rows={3}
              placeholder="e.g. Land a software engineering internship, break into data science…"
              value={form.careerGoals ?? ""}
              onChange={(e) => update("careerGoals", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              What are your professional interests?
            </label>
            <textarea
              className="w-full bg-gray-700 text-white rounded-lg p-3 border border-gray-600 focus:border-indigo-500 focus:outline-none resize-none"
              rows={2}
              placeholder="e.g. AI, web development, product management, finance…"
              value={form.professionalInterests ?? ""}
              onChange={(e) => update("professionalInterests", e.target.value)}
            />
          </div>
        </div>
      ),
    },

    // ── Step 2: Experience & Targets ─────────────────────────────────────────
    {
      title: "Experience & Targets",
      content: (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Experience level
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(["student", "entry", "mid", "senior"] as const).map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => update("experienceLevel", lvl)}
                  className={`py-2 px-4 rounded-lg border text-sm capitalize transition-colors ${
                    form.experienceLevel === lvl
                      ? "bg-indigo-600 border-indigo-500 text-white"
                      : "bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500"
                  }`}
                >
                  {lvl === "student"
                    ? "Student"
                    : lvl === "entry"
                      ? "Entry Level"
                      : lvl === "mid"
                        ? "Mid Level"
                        : "Senior"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Target industries / roles
            </label>
            <textarea
              className="w-full bg-gray-700 text-white rounded-lg p-3 border border-gray-600 focus:border-indigo-500 focus:outline-none resize-none"
              rows={2}
              placeholder="e.g. Tech, Finance, Startups — SWE, Data Science, PM roles…"
              value={form.targetIndustries ?? ""}
              onChange={(e) => update("targetIndustries", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Are you actively looking for internships / opportunities?
            </label>
            <div className="flex gap-3">
              {[true, false].map((val) => (
                <button
                  key={String(val)}
                  onClick={() => update("activelyLooking", val)}
                  className={`py-2 px-6 rounded-lg border text-sm transition-colors ${
                    form.activelyLooking === val
                      ? "bg-indigo-600 border-indigo-500 text-white"
                      : "bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500"
                  }`}
                >
                  {val ? "Yes" : "No"}
                </button>
              ))}
            </div>
          </div>
        </div>
      ),
    },

    // ── Step 3: Daily Routine ─────────────────────────────────────────────────
    {
      title: "Daily Routine",
      content: (
        <div className="space-y-4">
          {/* Wake / Sleep */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Wake up</p>
              <input type="time" value={form.wakeTime ?? "07:30"}
                onChange={(e) => update("wakeTime", e.target.value)}
                className="w-full bg-gray-700 text-white rounded-lg p-2.5 border border-gray-600 focus:border-indigo-500 focus:outline-none text-sm" />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Sleep time</p>
              <input type="time" value={form.sleepTime ?? "23:00"}
                onChange={(e) => update("sleepTime", e.target.value)}
                className="w-full bg-gray-700 text-white rounded-lg p-2.5 border border-gray-600 focus:border-indigo-500 focus:outline-none text-sm" />
            </div>
          </div>

          {/* Breakfast */}
          <div className="border border-gray-600 rounded-xl overflow-hidden">
            <button onClick={() => setBreakfastEnabled((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-700/60 hover:bg-gray-700 transition-colors text-left">
              <div>
                <span className="text-sm font-medium text-gray-200">Breakfast</span>
                <p className="text-xs text-gray-500 mt-0.5">Block off morning meal time</p>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${breakfastEnabled ? "bg-indigo-600 border-indigo-500 text-white" : "bg-gray-700 border-gray-600 text-gray-400"}`}>
                {breakfastEnabled ? "On" : "Off"}
              </span>
            </button>
            {breakfastEnabled && (
              <div className="px-4 py-3 bg-gray-800/50 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Starts at</p>
                  <input type="time" value={form.breakfastTime ?? "07:30"}
                    onChange={(e) => update("breakfastTime", e.target.value)}
                    className="w-full bg-gray-700 text-white rounded-lg p-2 border border-gray-600 focus:border-indigo-500 focus:outline-none text-sm" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Duration: <span className="text-indigo-400 font-bold">{form.breakfastDurationMinutes ?? 30} min</span></p>
                  <input type="range" min={20} max={90} step={5}
                    value={form.breakfastDurationMinutes ?? 30}
                    onChange={(e) => update("breakfastDurationMinutes", Number(e.target.value))}
                    className="w-full accent-indigo-500 mt-2" />
                </div>
              </div>
            )}
          </div>

          {/* Lunch */}
          <div className="border border-gray-600 rounded-xl overflow-hidden">
            <button onClick={() => setLunchEnabled((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-700/60 hover:bg-gray-700 transition-colors text-left">
              <div>
                <span className="text-sm font-medium text-gray-200">Lunch</span>
                <p className="text-xs text-gray-500 mt-0.5">Block off midday meal time</p>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${lunchEnabled ? "bg-indigo-600 border-indigo-500 text-white" : "bg-gray-700 border-gray-600 text-gray-400"}`}>
                {lunchEnabled ? "On" : "Off"}
              </span>
            </button>
            {lunchEnabled && (
              <div className="px-4 py-3 bg-gray-800/50 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Starts at</p>
                  <input type="time" value={form.lunchStart ?? "12:00"}
                    onChange={(e) => update("lunchStart", e.target.value)}
                    className="w-full bg-gray-700 text-white rounded-lg p-2 border border-gray-600 focus:border-indigo-500 focus:outline-none text-sm" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Duration: <span className="text-indigo-400 font-bold">{form.lunchDurationMinutes ?? 60} min</span></p>
                  <input type="range" min={20} max={120} step={10}
                    value={form.lunchDurationMinutes ?? 60}
                    onChange={(e) => update("lunchDurationMinutes", Number(e.target.value))}
                    className="w-full accent-indigo-500 mt-2" />
                </div>
              </div>
            )}
          </div>

          {/* Dinner */}
          <div className="border border-gray-600 rounded-xl overflow-hidden">
            <button onClick={() => setDinnerEnabled((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-700/60 hover:bg-gray-700 transition-colors text-left">
              <div>
                <span className="text-sm font-medium text-gray-200">Dinner</span>
                <p className="text-xs text-gray-500 mt-0.5">Block off evening meal time</p>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${dinnerEnabled ? "bg-indigo-600 border-indigo-500 text-white" : "bg-gray-700 border-gray-600 text-gray-400"}`}>
                {dinnerEnabled ? "On" : "Off"}
              </span>
            </button>
            {dinnerEnabled && (
              <div className="px-4 py-3 bg-gray-800/50 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Starts at</p>
                  <input type="time" value={form.dinnerTime ?? "18:30"}
                    onChange={(e) => update("dinnerTime", e.target.value)}
                    className="w-full bg-gray-700 text-white rounded-lg p-2 border border-gray-600 focus:border-indigo-500 focus:outline-none text-sm" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Duration: <span className="text-indigo-400 font-bold">{form.dinnerDurationMinutes ?? 60} min</span></p>
                  <input type="range" min={30} max={120} step={10}
                    value={form.dinnerDurationMinutes ?? 60}
                    onChange={(e) => update("dinnerDurationMinutes", Number(e.target.value))}
                    className="w-full accent-indigo-500 mt-2" />
                </div>
              </div>
            )}
          </div>
        </div>
      ),
    },

    // ── Step 4: Workload & Blocked Days ───────────────────────────────────────
    {
      title: "Workload & Blocked Days",
      content: (
        <div className="space-y-5">
          {/* Workload picker */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              How intense should your schedule be?
            </label>
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
                  className={`py-3 px-4 rounded-xl border text-left transition-colors ${
                    form.scheduleIntensity === opt.value
                      ? "bg-indigo-600 border-indigo-500 text-white"
                      : "bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500"
                  }`}
                >
                  <div className="text-sm font-medium">{opt.label}</div>
                  <div className="text-xs opacity-70 mt-0.5">{opt.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Blocked time blocks */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Blocked Time
              </label>
              <p className="text-xs text-gray-500">
                Add recurring commitments or times you&apos;re unavailable. The scheduler will skip these.
              </p>
            </div>

            {/* Existing blocks */}
            {(form.scheduleBlocks ?? []).length > 0 && (
              <div className="space-y-2">
                {(form.scheduleBlocks ?? []).map((b) => (
                  <div key={b.id} className="flex items-center justify-between bg-gray-700/60 px-3 py-2 border border-gray-600/50 rounded-lg">
                    <div className="min-w-0">
                      <p className="text-sm text-white font-medium">{b.name}</p>
                      <p className="text-xs text-gray-400">
                        {b.startTime}–{b.endTime} · {RECURRENCE_LABELS[b.recurrence]}
                        {b.date ? ` · ${b.date}` : ""}
                      </p>
                    </div>
                    <button onClick={() => removeScheduleBlock(b.id)} className="text-gray-500 hover:text-red-400 transition-colors ml-3 shrink-0 text-sm">✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* Add block form */}
            <div className="border border-gray-600 rounded-xl p-3 space-y-2.5 bg-gray-700/30">
              <input
                value={blockName}
                onChange={(e) => setBlockName(e.target.value)}
                placeholder="Event name (e.g. Gym, No work, Class)"
                className="w-full bg-gray-700 text-white text-sm px-3 py-2 border border-gray-600 rounded-lg focus:border-indigo-500 focus:outline-none placeholder-gray-500"
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Start time</p>
                  <input type="time" value={blockStart} onChange={(e) => setBlockStart(e.target.value)}
                    className="w-full bg-gray-700 text-white text-sm px-3 py-2 border border-gray-600 rounded-lg focus:border-indigo-500 focus:outline-none" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">End time</p>
                  <input type="time" value={blockEnd} onChange={(e) => setBlockEnd(e.target.value)}
                    className="w-full bg-gray-700 text-white text-sm px-3 py-2 border border-gray-600 rounded-lg focus:border-indigo-500 focus:outline-none" />
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Repeats</p>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(RECURRENCE_LABELS) as ScheduleBlockRecurrence[]).map((r) => (
                    <button key={r} onClick={() => setBlockRecurrence(r)}
                      className={`px-3 py-1 text-xs border rounded-full transition-colors ${blockRecurrence === r ? "bg-indigo-600 border-indigo-500 text-white" : "bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500"}`}>
                      {RECURRENCE_LABELS[r]}
                    </button>
                  ))}
                </div>
              </div>
              {(blockRecurrence === 'none' || blockRecurrence === 'weekly') && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">
                    {blockRecurrence === 'none' ? 'Date' : 'Starting date (sets day of week)'}
                  </p>
                  <input type="date" value={blockDate} onChange={(e) => setBlockDate(e.target.value)}
                    className="w-full bg-gray-700 text-white text-sm px-3 py-2 border border-gray-600 rounded-lg focus:border-indigo-500 focus:outline-none" />
                </div>
              )}
              <button
                onClick={addScheduleBlock}
                disabled={!blockName.trim() || !blockStart || !blockEnd || ((blockRecurrence === 'none' || blockRecurrence === 'weekly') && !blockDate)}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
              >
                + Add Block
              </button>
            </div>
          </div>
        </div>
      ),
    },
  ];

  const currentStep = steps[step];
  const isLast = step === steps.length - 1;

  const handleNext = () => {
    if (isLast) {
      // If meal toggles are off, clear the corresponding times
      const finalForm = { ...form };
      if (!breakfastEnabled) {
        finalForm.breakfastTime = "";
        finalForm.breakfastDurationMinutes = 0;
      }
      if (!lunchEnabled) {
        finalForm.lunchStart = "";
        finalForm.lunchDurationMinutes = 0;
      }
      if (!dinnerEnabled) {
        finalForm.dinnerTime = "";
        finalForm.dinnerDurationMinutes = 0;
      }
      onComplete({
        ...finalForm,
        completed: true,
        // Defaults for fields not in form
        name: finalForm.name ?? "",
        careerGoals: finalForm.careerGoals ?? "",
        professionalInterests: finalForm.professionalInterests ?? "",
        targetIndustries: finalForm.targetIndustries ?? "",
        dailyHoursAvailable: finalForm.dailyHoursAvailable ?? 4,
        preferredStartTime: finalForm.preferredStartTime ?? "09:00",
        preferredEndTime: finalForm.preferredEndTime ?? "22:00",
        typicalDaySnapshot: finalForm.typicalDaySnapshot ?? "",
        scheduleBlocks: finalForm.scheduleBlocks ?? [],
      } as UserProfile);
    } else {
      setStep((s) => s + 1);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Life Strategy Assistant
          </h1>
          <p className="text-gray-400">
            Let&apos;s personalize your experience
          </p>
        </div>

        {/* Progress bar */}
        <div className="flex gap-2 mb-6">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i <= step ? "bg-indigo-500" : "bg-gray-700"
              }`}
            />
          ))}
        </div>

        {/* Card */}
        <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-xl">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-white">
              {currentStep.title}
            </h2>
            <span className="text-xs text-gray-500">
              {step + 1} / {steps.length}
            </span>
          </div>

          {currentStep.content}

          <div className="flex justify-between mt-6">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="py-2 px-5 rounded-lg text-sm text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleNext}
              className="py-2 px-6 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
            >
              {isLast ? "Get Started →" : "Next →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
