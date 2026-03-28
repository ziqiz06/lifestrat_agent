'use client';
import { useState } from 'react';
import { UserProfile } from '@/types';

interface Props {
  onComplete: (profile: UserProfile) => void;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function OnboardingSurvey({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Partial<UserProfile>>({
    activelyLooking: true,
    scheduleIntensity: 'moderate',
    experienceLevel: 'student',
    doNotScheduleDays: [],
    dailyHoursAvailable: 4,
    preferredStartTime: '09:00',
    preferredEndTime: '22:00',
  });

  const update = (key: keyof UserProfile, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleDay = (day: string) => {
    const days = (form.doNotScheduleDays ?? []);
    update('doNotScheduleDays', days.includes(day) ? days.filter((d) => d !== day) : [...days, day]);
  };

  const steps = [
    {
      title: 'Career Goals',
      content: (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">What are your main career goals?</label>
            <textarea
              className="w-full bg-gray-700 text-white rounded-lg p-3 border border-gray-600 focus:border-indigo-500 focus:outline-none resize-none"
              rows={3}
              placeholder="e.g. Land a software engineering internship, break into data science..."
              value={form.careerGoals ?? ''}
              onChange={(e) => update('careerGoals', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">What are your professional interests?</label>
            <textarea
              className="w-full bg-gray-700 text-white rounded-lg p-3 border border-gray-600 focus:border-indigo-500 focus:outline-none resize-none"
              rows={2}
              placeholder="e.g. AI, web development, product management, finance..."
              value={form.professionalInterests ?? ''}
              onChange={(e) => update('professionalInterests', e.target.value)}
            />
          </div>
        </div>
      ),
    },
    {
      title: 'Experience & Targets',
      content: (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Experience level</label>
            <div className="grid grid-cols-2 gap-2">
              {(['student', 'entry', 'mid', 'senior'] as const).map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => update('experienceLevel', lvl)}
                  className={`py-2 px-4 rounded-lg border text-sm capitalize transition-colors ${
                    form.experienceLevel === lvl
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  {lvl === 'student' ? 'Student' : lvl === 'entry' ? 'Entry Level' : lvl === 'mid' ? 'Mid Level' : 'Senior'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Target industries / roles</label>
            <textarea
              className="w-full bg-gray-700 text-white rounded-lg p-3 border border-gray-600 focus:border-indigo-500 focus:outline-none resize-none"
              rows={2}
              placeholder="e.g. Tech, Finance, Startups — SWE, Data Science, PM roles..."
              value={form.targetIndustries ?? ''}
              onChange={(e) => update('targetIndustries', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Are you actively looking for internships/opportunities?
            </label>
            <div className="flex gap-3">
              {[true, false].map((val) => (
                <button
                  key={String(val)}
                  onClick={() => update('activelyLooking', val)}
                  className={`py-2 px-6 rounded-lg border text-sm transition-colors ${
                    form.activelyLooking === val
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  {val ? 'Yes' : 'No'}
                </button>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Time & Schedule',
      content: (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Hours available per day for career/study work: <span className="text-indigo-400 font-bold">{form.dailyHoursAvailable}h</span>
            </label>
            <input
              type="range"
              min={1}
              max={10}
              value={form.dailyHoursAvailable ?? 4}
              onChange={(e) => update('dailyHoursAvailable', Number(e.target.value))}
              className="w-full accent-indigo-500"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>1h</span><span>5h</span><span>10h</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Preferred start time</label>
              <input
                type="time"
                value={form.preferredStartTime ?? '09:00'}
                onChange={(e) => update('preferredStartTime', e.target.value)}
                className="w-full bg-gray-700 text-white rounded-lg p-3 border border-gray-600 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Preferred end time</label>
              <input
                type="time"
                value={form.preferredEndTime ?? '22:00'}
                onChange={(e) => update('preferredEndTime', e.target.value)}
                className="w-full bg-gray-700 text-white rounded-lg p-3 border border-gray-600 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Describe your typical day</label>
            <textarea
              className="w-full bg-gray-700 text-white rounded-lg p-3 border border-gray-600 focus:border-indigo-500 focus:outline-none resize-none"
              rows={2}
              placeholder="e.g. Morning class 9–11, lunch, free afternoon, gym at 5, dinner at 7..."
              value={form.typicalDaySnapshot ?? ''}
              onChange={(e) => update('typicalDaySnapshot', e.target.value)}
            />
          </div>
        </div>
      ),
    },
    {
      title: 'Intensity & Preferences',
      content: (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Schedule intensity</label>
            <div className="grid grid-cols-3 gap-2">
              {(['light', 'moderate', 'intense'] as const).map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => update('scheduleIntensity', lvl)}
                  className={`py-3 rounded-lg border text-sm capitalize transition-colors ${
                    form.scheduleIntensity === lvl
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  {lvl === 'light' ? '🌱 Light' : lvl === 'moderate' ? '⚡ Moderate' : '🔥 Intense'}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {form.scheduleIntensity === 'light' ? 'Relaxed pace, few tasks per day' :
               form.scheduleIntensity === 'moderate' ? 'Balanced mix of work and rest' :
               'Packed schedule, maximize productivity'}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Entertainment / personal time preferences</label>
            <textarea
              className="w-full bg-gray-700 text-white rounded-lg p-3 border border-gray-600 focus:border-indigo-500 focus:outline-none resize-none"
              rows={2}
              placeholder="e.g. 1 hour of TV/gaming each evening, social time on weekends..."
              value={form.entertainmentPreferences ?? ''}
              onChange={(e) => update('entertainmentPreferences', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Days you do NOT want work scheduled</label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((day) => (
                <button
                  key={day}
                  onClick={() => toggleDay(day)}
                  className={`py-1 px-3 rounded-full border text-xs transition-colors ${
                    (form.doNotScheduleDays ?? []).includes(day)
                      ? 'bg-red-600 border-red-500 text-white'
                      : 'bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Times to avoid scheduling (e.g. after 9pm)</label>
            <input
              type="text"
              className="w-full bg-gray-700 text-white rounded-lg p-3 border border-gray-600 focus:border-indigo-500 focus:outline-none"
              placeholder="e.g. After 9pm, before 8am, 12–1pm lunch break"
              value={form.doNotScheduleWindows ?? ''}
              onChange={(e) => update('doNotScheduleWindows', e.target.value)}
            />
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
          <h1 className="text-3xl font-bold text-white mb-2">Life Strategy Assistant</h1>
          <p className="text-gray-400">Let&apos;s personalize your experience</p>
        </div>

        {/* Progress */}
        <div className="flex gap-2 mb-6">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i <= step ? 'bg-indigo-500' : 'bg-gray-700'
              }`}
            />
          ))}
        </div>

        {/* Card */}
        <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-xl">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-white">{currentStep.title}</h2>
            <span className="text-xs text-gray-500">{step + 1} / {steps.length}</span>
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
              {isLast ? 'Get Started →' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
