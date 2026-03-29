"use client";
import { useState } from "react";
import { useAppStore } from "@/store/appStore";
import { Opportunity } from "@/types";

// ── Schedule Modal ─────────────────────────────────────────────────────────────
function ScheduleModal({
  opp,
  onConfirm,
  onSkip,
}: {
  opp: Opportunity;
  onConfirm: (opts: { endTime?: string; durationMinutes?: number; title?: string }) => void;
  onSkip: () => void;
}) {
  const isFixed = !!opp.eventTime;
  const hasEndTime = !!opp.eventEndTime;

  const defaultEnd = opp.eventEndTime ?? "";
  const [endTime, setEndTime] = useState(defaultEnd);
  const [hours, setHours] = useState(opp.estimatedHours);
  const [title, setTitle] = useState(opp.title);

  // If we have a full fixed time range already, skip the modal immediately
  if (isFixed && hasEndTime) {
    onConfirm({});
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onSkip(); }}>
      <div className="w-full max-w-sm bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl overflow-hidden">
        <div className="h-1 w-full" style={{ backgroundColor: "#6366f1" }} />
        <div className="p-5 space-y-4">
          <div>
            <p className="text-xs text-gray-500 mt-0.5">
              {isFixed
                ? `Scheduled at ${opp.eventTime} on ${opp.deadline} — when does it end?`
                : `Flexible task on ${opp.deadline} — how long will this take?`}
            </p>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Calendar label</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-600 focus:border-indigo-500 focus:outline-none"
              placeholder="Event name on calendar" />
          </div>

          {isFixed ? (
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">End time</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-600 focus:border-indigo-500 focus:outline-none" />
            </div>
          ) : (
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">
                Duration: <span className="text-indigo-400 font-bold">{hours}h</span>
              </label>
              <input type="range" min={0.5} max={8} step={0.5} value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
                className="w-full accent-indigo-500" />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>30 min</span><span>4h</span><span>8h</span>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={onSkip}
              className="flex-1 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm border border-gray-600 transition-colors">
              Skip
            </button>
            <button
              onClick={() => onConfirm(isFixed
                ? { endTime: endTime || undefined, title: title || undefined }
                : { durationMinutes: Math.round(hours * 60), title: title || undefined })}
              className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors">
              Add to Calendar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  internship_application: "Internship App",
  internship_research: "Internship Research",
  professional_event: "Professional Event",
  networking: "Networking",
  classes: "Academic",
  deadline: "Deadline",
  entertainment: "Entertainment",
  personal: "Personal",
  ignore: "Ignore",
};

const CATEGORY_COLORS: Record<string, string> = {
  internship_application: "bg-green-900/50 text-green-300 border-green-800",
  internship_research: "bg-blue-900/50 text-blue-300 border-blue-800",
  professional_event: "bg-purple-900/50 text-purple-300 border-purple-800",
  networking: "bg-pink-900/50 text-pink-300 border-pink-800",
  classes: "bg-indigo-900/50 text-indigo-300 border-indigo-800",
  deadline: "bg-red-900/50 text-red-300 border-red-800",
  entertainment: "bg-yellow-900/50 text-yellow-300 border-yellow-800",
  personal: "bg-gray-700 text-gray-300 border-gray-600",
  ignore: "bg-gray-800 text-gray-500 border-gray-700",
};

function PriorityBadge({ priority }: { priority: number }) {
  const color =
    priority >= 9
      ? "bg-red-500"
      : priority >= 7
        ? "bg-yellow-500"
        : "bg-green-500";
  return (
    <div
      className={`${color} text-white text-xs font-bold w-8 h-8 rounded-full flex items-center justify-center shrink-0`}
    >
      {priority}
    </div>
  );
}

function OpportunityCard({ opp }: { opp: Opportunity }) {
  const { setOpportunityInterest, addOpportunityToCalendar, deleteCalendarTask } = useAppStore();
  const [showModal, setShowModal] = useState(false);

  const handleAddToSchedule = () => {
    setOpportunityInterest(opp.id, true);
    if (opp.eventTime && opp.eventEndTime) {
      // Full time range known — add directly, no modal needed
      addOpportunityToCalendar(opp.id);
    } else {
      setShowModal(true);
    }
  };

  return (
    <>
      {showModal && (
        <ScheduleModal
          opp={opp}
          onConfirm={(opts) => {
            addOpportunityToCalendar(opp.id, opts);
            setShowModal(false);
          }}
          onSkip={() => setShowModal(false)}
        />
      )}
      <div
        className={`bg-gray-800 rounded-2xl p-5 border transition-all ${
          opp.addedToCalendar
            ? "border-green-700/50"
            : opp.interested === false
              ? "border-gray-700 opacity-60"
              : "border-gray-700 hover:border-gray-600"
        }`}
      >
        <div className="flex items-start gap-3 mb-3">
          <PriorityBadge priority={opp.priority} />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white text-sm mb-0.5">{opp.title}</h3>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[opp.category]}`}>
                {CATEGORY_LABELS[opp.category]}
              </span>
              {opp.deadline && (
                <span className="text-xs text-gray-500">📅 Due {opp.deadline}</span>
              )}
              {opp.eventTime && (
                <span className="text-xs text-indigo-400">🕐 {opp.eventTime}{opp.eventEndTime ? `–${opp.eventEndTime}` : ""}</span>
              )}
              <span className="text-xs text-gray-500">⏱ ~{opp.estimatedHours}h</span>
            </div>
          </div>
        </div>

        <p className="text-sm text-gray-400 mb-2">{opp.description}</p>
        <p className="text-xs text-indigo-300 italic mb-4">
          Why this matters: {opp.priorityReason}
        </p>

        {opp.addedToCalendar ? (
          <div className="flex items-center justify-between">
            <span className="text-sm text-green-400">📅 Added to calendar</span>
            <button
              onClick={() => {
                deleteCalendarTask(`opp-task-${opp.id}`);
                setOpportunityInterest(opp.id, null);
              }}
              className="text-xs text-gray-500 hover:text-red-400 transition-colors"
            >
              Remove ✕
            </button>
          </div>
        ) : opp.interested === false ? (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Not interested</span>
            <button
              onClick={() => setOpportunityInterest(opp.id, null)}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Undo
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleAddToSchedule}
              className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
            >
              + Add to Schedule
            </button>
            <button
              onClick={() => setOpportunityInterest(opp.id, false)}
              className="flex-1 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm transition-colors"
            >
              ✕ Not Interested
            </button>
          </div>
        )}
      </div>
    </>
  );
}

const CAREER_CATEGORIES = new Set([
  "internship_application", "internship_research", "professional_event",
  "networking", "classes", "deadline",
]);

export default function OpportunitiesView() {
  const { opportunities, emails } = useAppStore();
  const visible = opportunities.filter((o) => o.category !== "ignore");

  // Split career vs lifestyle
  const career = visible.filter((o) => CAREER_CATEGORIES.has(o.category));
  const lifestyle = visible.filter((o) => !CAREER_CATEGORIES.has(o.category));

  const scheduled = career.filter((o) => o.addedToCalendar);
  const undecided = career.filter((o) => !o.addedToCalendar && o.interested !== false);
  const notInterested = career.filter((o) => o.interested === false);

  const lifestyleScheduled = lifestyle.filter((o) => o.addedToCalendar);
  const lifestyleUndecided = lifestyle.filter((o) => !o.addedToCalendar && o.interested !== false);
  const lifestyleSkipped = lifestyle.filter((o) => o.interested === false);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Opportunities</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Detected from {emails.length} emails • Ranked by relevance &amp;
            urgency
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-indigo-400">
            {undecided.length}
          </div>
          <div className="text-xs text-gray-500">pending review</div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "Pending", count: undecided.length, color: "text-yellow-400" },
          { label: "Scheduled", count: scheduled.length, color: "text-green-400" },
          { label: "Skipped", count: notInterested.length, color: "text-gray-400" },
        ].map((s) => (
          <div key={s.label} className="bg-gray-800 rounded-xl p-3 border border-gray-700 text-center">
            <div className={`text-xl font-bold ${s.color}`}>{s.count}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Pending */}
      {undecided.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Needs Decision
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {undecided.map((opp) => (
              <OpportunityCard key={opp.id} opp={opp} />
            ))}
          </div>
        </section>
      )}

      {/* Scheduled */}
      {scheduled.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            On Calendar
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {scheduled.map((opp) => (
              <OpportunityCard key={opp.id} opp={opp} />
            ))}
          </div>
        </section>
      )}

      {/* Not interested */}
      {notInterested.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Not Interested
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {notInterested.map((opp) => (
              <OpportunityCard key={opp.id} opp={opp} />
            ))}
          </div>
        </section>
      )}

      {/* Entertainment & Personal */}
      {(lifestyleUndecided.length > 0 || lifestyleScheduled.length > 0 || lifestyleSkipped.length > 0) && (
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-gray-700/50" />
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Entertainment &amp; Personal
            </h2>
            <div className="flex-1 h-px bg-gray-700/50" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[...lifestyleUndecided, ...lifestyleScheduled, ...lifestyleSkipped].map((opp) => (
              <OpportunityCard key={opp.id} opp={opp} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
