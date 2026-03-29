"use client";
import { useState } from "react";
import { useAppStore } from "@/store/appStore";
import { Opportunity } from "@/types";
import PixelSprite from "@/components/character/PixelSprite";
import { getArchetypePalette } from "@/lib/characterEngine";

const DOT  = { fontFamily: "var(--font-dot)"  } as const;
const MONO = { fontFamily: "var(--font-mono)" } as const;

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
      <div className="w-full max-w-sm bg-gray-900 border border-gray-700 shadow-2xl overflow-hidden">
        <div className="h-1 w-full" style={{ backgroundColor: "#6366f1" }} />
        <div className="p-5 space-y-4">
          <div>
            <p className="text-sm text-gray-500 mt-0.5" style={MONO}>
              {isFixed
                ? `Scheduled at ${opp.eventTime} on ${opp.deadline} — when does it end?`
                : `Flexible task on ${opp.deadline} — how long will this take?`}
            </p>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1.5" style={MONO}>Calendar label</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-gray-800 text-white px-3 py-2 text-base border border-gray-600 focus:border-indigo-500 focus:outline-none"
              style={MONO}
              placeholder="Event name on calendar" />
          </div>

          {isFixed ? (
            <div>
              <label className="block text-sm text-gray-400 mb-1.5" style={MONO}>End time</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-gray-800 text-white px-3 py-2 text-sm border border-gray-600 focus:border-indigo-500 focus:outline-none"
                style={MONO} />
            </div>
          ) : (
            <div>
              <label className="block text-sm text-gray-400 mb-1.5" style={MONO}>
                Duration: <span className="text-indigo-400 font-bold">{hours}h</span>
              </label>
              <input type="range" min={0.5} max={8} step={0.5} value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
                className="w-full accent-indigo-500" />
              <div className="flex justify-between text-sm text-gray-600 mt-1" style={MONO}>
                <span>30 min</span><span>4h</span><span>8h</span>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={onSkip}
              className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 text-base border border-gray-600 transition-colors"
              style={MONO}>
              Skip
            </button>
            <button
              onClick={() => onConfirm(isFixed
                ? { endTime: endTime || undefined, title: title || undefined }
                : { durationMinutes: Math.round(hours * 60), title: title || undefined })}
              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-base font-medium transition-colors"
              style={MONO}>
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

const CATEGORY_COLOR: Record<string, string> = {
  internship_application: "#22C55E",
  internship_research:    "#3B82F6",
  professional_event:     "#A855F7",
  networking:             "#EC4899",
  classes:                "#6366F1",
  deadline:               "#EF4444",
  entertainment:          "#EAB308",
  personal:               "#9CA3AF",
  ignore:                 "#374151",
};


function PriorityBadge({ priority }: { priority: number }) {
  return (
    <div
      className="text-sm font-bold w-8 h-8 flex items-center justify-center shrink-0 border border-gray-700 text-gray-400"
      style={MONO}
    >
      {priority}
    </div>
  );
}

function OpportunityCard({ opp, accent }: { opp: Opportunity; accent: string }) {
  const { setOpportunityInterest, addOpportunityToCalendar, deleteCalendarTask } = useAppStore();
  const [showModal, setShowModal] = useState(false);
  const catColor = CATEGORY_COLOR[opp.category] ?? "#374151";

  const handleAddToSchedule = () => {
    setOpportunityInterest(opp.id, true);
    if (opp.eventTime && opp.eventEndTime) {
      // Full time range known — add directly, no modal needed
      addOpportunityToCalendar(opp.id);
    } else {
      setShowModal(true);
    }
  };

  const borderStyle: React.CSSProperties = opp.interested === false
    ? { border: `1px solid #37415155` }
    : opp.addedToCalendar
      ? { border: `1px solid ${catColor}80` }
      : { border: `1px solid ${catColor}45` };

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
        className={`bg-gray-900 p-5 transition-all ${opp.interested === false ? "opacity-50" : ""}`}
        style={borderStyle}
      >
        <div className="flex items-start gap-3 mb-3">
          <PriorityBadge priority={opp.priority} />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white text-base mb-0.5" style={MONO}>{opp.title}</h3>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm px-2 py-0.5 border border-gray-700 text-gray-500" style={MONO}>
                {CATEGORY_LABELS[opp.category]}
              </span>
              {opp.deadline && (
                <span className="text-sm text-gray-500" style={MONO}>Due {opp.deadline}</span>
              )}
              {opp.eventTime && (
                <span className="text-sm text-gray-500" style={MONO}>{opp.eventTime}{opp.eventEndTime ? `–${opp.eventEndTime}` : ""}</span>
              )}
              <span className="text-sm text-gray-500" style={MONO}>~{opp.estimatedHours}h</span>
            </div>
          </div>
        </div>

        <p className="text-base text-gray-400 mb-2" style={MONO}>{opp.description}</p>
        <p className="text-sm text-gray-500 mb-4" style={MONO}>
          {opp.priorityReason}
        </p>

        {opp.addedToCalendar ? (
          <div className="flex items-center justify-between">
            <span className="text-base font-medium" style={{ ...MONO, color: accent }}>✓ On calendar</span>
            <button
              onClick={() => {
                deleteCalendarTask(`opp-task-${opp.id}`);
                setOpportunityInterest(opp.id, null);
              }}
              className="text-sm text-gray-500 hover:text-red-400 transition-colors"
              style={MONO}
            >
              Remove ✕
            </button>
          </div>
        ) : opp.interested === false ? (
          <div className="flex items-center justify-between">
            <span className="text-base text-gray-500" style={MONO}>Not interested</span>
            <button
              onClick={() => setOpportunityInterest(opp.id, null)}
              className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
              style={MONO}
            >
              Undo
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleAddToSchedule}
              className="flex-1 py-2 text-white text-base font-medium transition-colors"
              style={{ ...MONO, backgroundColor: `${accent}cc` }}
            >
              + Add to Schedule
            </button>
            <button
              onClick={() => setOpportunityInterest(opp.id, false)}
              className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-base transition-colors"
              style={MONO}
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
  const { opportunities, emails, character } = useAppStore();
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

  const archetype = character?.archetype ?? "The Sage";
  const palette = getArchetypePalette(archetype);
  const accent = palette.glow;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex flex-col gap-4">
          <h1 className="text-6xl font-bold text-white" style={DOT}>Opportunities</h1>
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline gap-3">
              <span className="text-5xl font-bold text-yellow-400" style={MONO}>{undecided.length}</span>
              <span className="text-base uppercase text-yellow-400" style={MONO}>Pending</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-5xl font-bold text-green-400" style={MONO}>{scheduled.length}</span>
              <span className="text-base uppercase text-green-400" style={MONO}>Scheduled</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-5xl font-bold text-gray-400" style={MONO}>{notInterested.length}</span>
              <span className="text-base uppercase text-gray-400" style={MONO}>Skipped</span>
            </div>
          </div>
          <p className="text-base text-gray-500" style={MONO}>
            Detected from {emails.length} emails
          </p>
        </div>
        <div className="shrink-0">
          <PixelSprite palette={palette} scale={10} pose="ponder" />
        </div>
      </div>

      {/* Career Opportunities section header */}
      {(undecided.length > 0 || scheduled.length > 0 || notInterested.length > 0) && (
        <div className="mb-2">
          <h2 className="text-2xl font-bold text-gray-300" style={DOT}>Career Opportunities</h2>
        </div>
      )}

      {/* Pending */}
      {undecided.length > 0 && (
        <section className="mb-6">
          <h3 className="text-lg font-bold text-gray-400 uppercase tracking-wider mb-3" style={MONO}>
            Needs Decision
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {undecided.map((opp) => (
              <OpportunityCard key={opp.id} opp={opp} accent={accent} />
            ))}
          </div>
        </section>
      )}

      {/* Scheduled */}
      {scheduled.length > 0 && (
        <section className="mb-6">
          <h3 className="text-lg font-bold text-gray-400 uppercase tracking-wider mb-3" style={MONO}>
            On Calendar
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {scheduled.map((opp) => (
              <OpportunityCard key={opp.id} opp={opp} accent={accent} />
            ))}
          </div>
        </section>
      )}

      {/* Not interested */}
      {notInterested.length > 0 && (
        <section className="mb-8">
          <h3 className="text-lg font-bold text-gray-400 uppercase tracking-wider mb-3" style={MONO}>
            Not Interested
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {notInterested.map((opp) => (
              <OpportunityCard key={opp.id} opp={opp} accent={accent} />
            ))}
          </div>
        </section>
      )}

      {/* Entertainment & Personal */}
      {(lifestyleUndecided.length > 0 || lifestyleScheduled.length > 0 || lifestyleSkipped.length > 0) && (
        <section>
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-gray-300" style={DOT}>
              Entertainment &amp; Personal
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[...lifestyleUndecided, ...lifestyleScheduled, ...lifestyleSkipped].map((opp) => (
              <OpportunityCard key={opp.id} opp={opp} accent={accent} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
