"use client";
import { useState } from "react";
import { useAppStore } from "@/store/appStore";
import { UserProfile } from "@/types";
import { saveProfile } from "@/lib/supabaseSync";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

interface PreferencesProps {
  userId?: string | null;
}

export default function PreferencesView({ userId }: PreferencesProps) {
  const { profile, updateProfile } = useAppStore();
  const [form, setForm] = useState<UserProfile>({ ...profile });
  const [saved, setSaved] = useState(false);

  const update = (key: keyof UserProfile, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const toggleDay = (day: string) => {
    const days = form.doNotScheduleDays ?? [];
    update(
      "doNotScheduleDays",
      days.includes(day) ? days.filter((d) => d !== day) : [...days, day],
    );
  };

  const handleSave = () => {
    updateProfile(form);
    if (userId) {
      saveProfile(userId, form);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Preferences</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Edit your planning constraints
          </p>
        </div>
        <button
          onClick={handleSave}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
            saved
              ? "bg-green-600 text-white"
              : "bg-indigo-600 hover:bg-indigo-500 text-white"
          }`}
        >
          {saved ? "✓ Saved!" : "Save Changes"}
        </button>
      </div>

      {/* Career */}
      <section className="bg-gray-800 rounded-2xl p-5 border border-gray-700 space-y-4">
        <h2 className="font-semibold text-white">Career &amp; Interests</h2>
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">
            Career goals
          </label>
          <textarea
            className="w-full bg-gray-700 text-white rounded-lg p-3 border border-gray-600 focus:border-indigo-500 focus:outline-none resize-none text-sm"
            rows={2}
            value={form.careerGoals}
            onChange={(e) => update("careerGoals", e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">
            Professional interests
          </label>
          <textarea
            className="w-full bg-gray-700 text-white rounded-lg p-3 border border-gray-600 focus:border-indigo-500 focus:outline-none resize-none text-sm"
            rows={2}
            value={form.professionalInterests}
            onChange={(e) => update("professionalInterests", e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">
            Target industries / roles
          </label>
          <input
            type="text"
            className="w-full bg-gray-700 text-white rounded-lg p-3 border border-gray-600 focus:border-indigo-500 focus:outline-none text-sm"
            value={form.targetIndustries}
            onChange={(e) => update("targetIndustries", e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-2">
            Experience level
          </label>
          <div className="grid grid-cols-4 gap-2">
            {(["student", "entry", "mid", "senior"] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => update("experienceLevel", lvl)}
                className={`py-2 rounded-lg border text-xs capitalize transition-colors ${
                  form.experienceLevel === lvl
                    ? "bg-indigo-600 border-indigo-500 text-white"
                    : "bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500"
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <label className="text-sm text-gray-400">
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

      {/* Schedule */}
      <section className="bg-gray-800 rounded-2xl p-5 border border-gray-700 space-y-4">
        <h2 className="font-semibold text-white">Work Hours &amp; Schedule</h2>
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">
            Hours available per day:{" "}
            <span className="text-indigo-400 font-bold">
              {form.dailyHoursAvailable}h
            </span>
          </label>
          <input
            type="range"
            min={1}
            max={10}
            value={form.dailyHoursAvailable}
            onChange={(e) =>
              update("dailyHoursAvailable", Number(e.target.value))
            }
            className="w-full accent-indigo-500"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">
              Start time
            </label>
            <input
              type="time"
              className="w-full bg-gray-700 text-white rounded-lg p-2.5 border border-gray-600 focus:border-indigo-500 focus:outline-none text-sm"
              value={form.preferredStartTime}
              onChange={(e) => update("preferredStartTime", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">
              End time
            </label>
            <input
              type="time"
              className="w-full bg-gray-700 text-white rounded-lg p-2.5 border border-gray-600 focus:border-indigo-500 focus:outline-none text-sm"
              value={form.preferredEndTime}
              onChange={(e) => update("preferredEndTime", e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-2">
            Schedule intensity
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(["light", "moderate", "intense"] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => update("scheduleIntensity", lvl)}
                className={`py-2 rounded-lg border text-xs capitalize transition-colors ${
                  form.scheduleIntensity === lvl
                    ? "bg-indigo-600 border-indigo-500 text-white"
                    : "bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500"
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Blocked time */}
      <section className="bg-gray-800 rounded-2xl p-5 border border-gray-700 space-y-4">
        <h2 className="font-semibold text-white">Scheduling Constraints</h2>
        <div>
          <label className="block text-sm text-gray-400 mb-2">
            No-schedule days
          </label>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((day) => (
              <button
                key={day}
                onClick={() => toggleDay(day)}
                className={`py-1 px-3 rounded-full border text-xs transition-colors ${
                  (form.doNotScheduleDays ?? []).includes(day)
                    ? "bg-red-600 border-red-500 text-white"
                    : "bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500"
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">
            Time windows to avoid
          </label>
          <input
            type="text"
            className="w-full bg-gray-700 text-white rounded-lg p-2.5 border border-gray-600 focus:border-indigo-500 focus:outline-none text-sm"
            value={form.doNotScheduleWindows}
            onChange={(e) => update("doNotScheduleWindows", e.target.value)}
          />
        </div>
      </section>
    </div>
  );
}
