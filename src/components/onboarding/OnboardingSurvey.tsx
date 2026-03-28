"use client";
import { useState } from "react";
import { UserProfile } from "@/types";

interface Props {
  onComplete: (profile: UserProfile) => void;
}

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const DAY_SHORT: Record<string, string> = {
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat",
  Sunday: "Sun",
};

export default function OnboardingSurvey({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [perDayEnabled, setPerDayEnabled] = useState(false);
  const [form, setForm] = useState<Partial<UserProfile>>({
    activelyLooking: true,
    scheduleIntensity: "moderate",
    experienceLevel: "student",
    doNotScheduleDays: [],
    dailyHoursAvailable: 4,
    preferredStartTime: "09:00",
    preferredEndTime: "22:00",
    typicalDaySnapshot: "",
    perDaySchedule: {},
    doNotScheduleWindows: "",
  });

  const update = (key: keyof UserProfile, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleDay = (day: string) => {
    const days = form.doNotScheduleDays ?? [];
    update(
      "doNotScheduleDays",
      days.includes(day) ? days.filter((d) => d !== day) : [...days, day],
    );
  };

  const updatePerDay = (day: string, value: string) => {
    update("perDaySchedule", { ...(form.perDaySchedule ?? {}), [day]: value });
  };

  const steps = [
    // ── Step 1: Career Goals ──────────────────────────────────────────────────
    {
      title: "Career Goals",
      content: (
        <div className="space-y-4">
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

    // ── Step 3: Daily Schedule Snapshot ──────────────────────────────────────
    {
      title: "Your Daily Schedule",
      content: (
        <div className="space-y-5">
          {/* Availability window */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Hours available per day for career / study work:{" "}
              <span className="text-indigo-400 font-bold">
                {form.dailyHoursAvailable}h
              </span>
            </label>
            <input
              type="range"
              min={1}
              max={12}
              value={form.dailyHoursAvailable ?? 4}
              onChange={(e) =>
                update("dailyHoursAvailable", Number(e.target.value))
              }
              className="w-full accent-indigo-500"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>1h</span>
              <span>6h</span>
              <span>12h</span>
            </div>
          </div>

          {/* Preferred window */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Preferred start time
              </label>
              <input
                type="time"
                value={form.preferredStartTime ?? "09:00"}
                onChange={(e) => update("preferredStartTime", e.target.value)}
                className="w-full bg-gray-700 text-white rounded-lg p-3 border border-gray-600 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Preferred end time
              </label>
              <input
                type="time"
                value={form.preferredEndTime ?? "22:00"}
                onChange={(e) => update("preferredEndTime", e.target.value)}
                className="w-full bg-gray-700 text-white rounded-lg p-3 border border-gray-600 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Typical day snapshot */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Describe your typical day
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Give a general picture — we'll use this to schedule tasks around
              your existing routine.
            </p>
            <textarea
              className="w-full bg-gray-700 text-white rounded-lg p-3 border border-gray-600 focus:border-indigo-500 focus:outline-none resize-none"
              rows={3}
              placeholder="e.g. Classes 9–12, lunch break, free afternoon, gym around 5pm, dinner at 7, wind down by 10…"
              value={form.typicalDaySnapshot ?? ""}
              onChange={(e) => update("typicalDaySnapshot", e.target.value)}
            />
          </div>

          {/* Per-day customization toggle */}
          <div className="border border-gray-600 rounded-xl overflow-hidden">
            <button
              onClick={() => setPerDayEnabled((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-700/60 hover:bg-gray-700 transition-colors text-left"
            >
              <div>
                <span className="text-sm font-medium text-gray-200">
                  My schedule varies a lot day-to-day
                </span>
                <p className="text-xs text-gray-500 mt-0.5">
                  Optionally describe each day individually
                </p>
              </div>
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                  perDayEnabled
                    ? "bg-indigo-600 border-indigo-500 text-white"
                    : "bg-gray-700 border-gray-600 text-gray-400"
                }`}
              >
                {perDayEnabled ? "On" : "Off"}
              </span>
            </button>

            {perDayEnabled && (
              <div className="divide-y divide-gray-700">
                {DAYS.map((day) => (
                  <div
                    key={day}
                    className="flex items-start gap-3 px-4 py-3 bg-gray-800/50"
                  >
                    <span className="text-xs font-semibold text-indigo-400 w-8 pt-2.5 shrink-0">
                      {DAY_SHORT[day]}
                    </span>
                    <textarea
                      className="flex-1 bg-gray-700 text-white text-sm rounded-lg p-2 border border-gray-600 focus:border-indigo-500 focus:outline-none resize-none"
                      rows={2}
                      placeholder={
                        day === "Saturday" || day === "Sunday"
                          ? "e.g. Relaxed morning, social plans in the afternoon…"
                          : "e.g. Lab section 2–4pm, busy evening with club meeting…"
                      }
                      value={(form.perDaySchedule ?? {})[day] ?? ""}
                      onChange={(e) => updatePerDay(day, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ),
    },

    // ── Step 4: Blocked Times ─────────────────────────────────────────────────
    {
      title: "Blocked Times & Intensity",
      content: (
        <div className="space-y-5">
          {/* Do-not-schedule days */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Days you do <span className="text-red-400">not</span> want
              work-like tasks scheduled
            </label>
            <p className="text-xs text-gray-500 mb-2">
              No career tasks, applications, or study blocks will be placed on
              these days.
            </p>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((day) => (
                <button
                  key={day}
                  onClick={() => toggleDay(day)}
                  className={`py-1.5 px-3 rounded-full border text-xs font-medium transition-colors ${
                    (form.doNotScheduleDays ?? []).includes(day)
                      ? "bg-red-600/80 border-red-500 text-white"
                      : "bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500"
                  }`}
                >
                  {(form.doNotScheduleDays ?? []).includes(day) ? "✕ " : ""}
                  {day}
                </button>
              ))}
            </div>
          </div>

          {/* Do-not-schedule time windows */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Time windows to keep free of work tasks
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Describe any recurring blocks you want left open — mornings,
              lunch, evenings, etc.
            </p>
            <input
              type="text"
              className="w-full bg-gray-700 text-white rounded-lg p-3 border border-gray-600 focus:border-indigo-500 focus:outline-none"
              placeholder="e.g. Before 9am, after 9pm, 12–1pm lunch break every day"
              value={form.doNotScheduleWindows ?? ""}
              onChange={(e) => update("doNotScheduleWindows", e.target.value)}
            />
          </div>

          {/* Schedule intensity */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Schedule intensity
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["light", "moderate", "intense"] as const).map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => update("scheduleIntensity", lvl)}
                  className={`py-3 rounded-lg border text-sm capitalize transition-colors ${
                    form.scheduleIntensity === lvl
                      ? "bg-indigo-600 border-indigo-500 text-white"
                      : "bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500"
                  }`}
                >
                  {lvl === "light"
                    ? "🌱 Light"
                    : lvl === "moderate"
                      ? "⚡ Moderate"
                      : "🔥 Intense"}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {form.scheduleIntensity === "light"
                ? "Relaxed pace — a few focused tasks per day, plenty of breathing room."
                : form.scheduleIntensity === "moderate"
                  ? "Balanced mix of productivity and rest."
                  : "Packed schedule — maximize every available slot."}
            </p>
          </div>
        </div>
      ),
    },
  ];

  const currentStep = steps[step];
  const isLast = step === steps.length - 1;

  const handleNext = () => {
    if (isLast) {
      onComplete({ ...form, completed: true } as UserProfile);
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
