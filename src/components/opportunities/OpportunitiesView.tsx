"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import { RankingDebug } from "@/types";
import { useAppStore } from "@/store/appStore";
import { Opportunity } from "@/types";
import { isOpportunityExpired } from "@/lib/timeParser";
import { computeProposedSlot, timeToMinutes } from "@/lib/dayPlanner";
import PixelSprite from "@/components/character/PixelSprite";
import { getArchetypePalette } from "@/lib/characterEngine";
import UndoToast from "@/components/ui/UndoToast";

const DOT  = { fontFamily: "var(--font-dot)"  } as const;
const MONO = { fontFamily: "var(--font-mono)" } as const;

// ── Proposal Modal ─────────────────────────────────────────────────────────────

function ProposalRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs text-gray-600 shrink-0 w-16" style={MONO}>{label}</span>
      <span className={`text-xs break-words ${accent ?? "text-gray-300"}`} style={MONO}>{value}</span>
    </div>
  );
}

function ProposalModal({ opp, onClose }: { opp: Opportunity; onClose: () => void }) {
  const { profile, calendarTasks, addOpportunityToCalendar, setOpportunityInterest } = useAppStore();

  // Compute the recommended slot once on mount
  const proposal = useMemo(
    () => computeProposedSlot(opp, profile, calendarTasks),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const today = new Date().toISOString().slice(0, 10);

  const [title, setTitle]         = useState(opp.title);
  const [editing, setEditing]     = useState(false);
  const [startTime, setStart]     = useState(proposal?.startTime ?? "09:00");
  const [endTime, setEnd]         = useState(proposal?.endTime   ?? "10:00");
  const [manualDate, setManualDate] = useState(today);
  const [error, setError]         = useState("");

  // Live conflict check against existing calendar tasks
  const conflicts = useMemo(() => {
    const date = proposal?.date ?? (opp.deadline || manualDate);
    if (!date) return [];
    const ts = timeToMinutes(startTime);
    const te = timeToMinutes(endTime);
    return calendarTasks.filter((t) => {
      if (t.date !== date) return false;
      return ts < timeToMinutes(t.endTime) && te > timeToMinutes(t.startTime);
    });
  }, [startTime, endTime, calendarTasks, proposal, opp.deadline, manualDate]);

  const handleConfirm = () => {
    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
      setError("End time must be after start time.");
      return;
    }
    setOpportunityInterest(opp.id, true);
    addOpportunityToCalendar(opp.id, {
      startTime,
      endTime,
      title: title.trim() || undefined,
      durationMinutes: Math.max(timeToMinutes(endTime) - timeToMinutes(startTime), 15),
      confirmed: true,
      date: proposal ? undefined : manualDate,
    });
    onClose();
  };

  const handleToggleEdit = () => {
    if (editing && proposal) {
      // Revert to recommendation
      setStart(proposal.startTime);
      setEnd(proposal.endTime);
      setError("");
    }
    setEditing((v) => !v);
  };

  const backdrop = "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4";
  const card     = "w-full max-w-sm bg-gray-900 border border-gray-700 shadow-2xl overflow-hidden";

  if (!proposal) {
    return (
      <div className={backdrop} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className={card}>
          <div className="h-1 w-full bg-gray-600" />
          <div className="p-5 space-y-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1" style={MONO}>
                Schedule Manually
              </p>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-transparent text-white text-sm font-semibold border-b border-gray-700 focus:border-indigo-500 focus:outline-none pb-0.5"
                style={MONO}
                placeholder="Calendar label"
              />
            </div>
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-gray-500 mb-0.5" style={MONO}>Date</label>
                <input type="date" value={manualDate}
                  onChange={(e) => { setManualDate(e.target.value); setError(""); }}
                  className="w-full bg-gray-900 text-white text-sm px-2 py-1.5 border border-gray-600 focus:border-indigo-500 focus:outline-none"
                  style={MONO} />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-0.5" style={MONO}>Start</label>
                  <input type="time" value={startTime}
                    onChange={(e) => { setStart(e.target.value); setError(""); }}
                    className="w-full bg-gray-900 text-white text-sm px-2 py-1.5 border border-gray-600 focus:border-indigo-500 focus:outline-none"
                    style={MONO} />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-0.5" style={MONO}>End</label>
                  <input type="time" value={endTime}
                    onChange={(e) => { setEnd(e.target.value); setError(""); }}
                    className="w-full bg-gray-900 text-white text-sm px-2 py-1.5 border border-gray-600 focus:border-indigo-500 focus:outline-none"
                    style={MONO} />
                </div>
              </div>
            </div>
            {conflicts.length > 0 && (
              <div className="text-xs text-orange-300 border border-orange-800/50 bg-orange-950/30 px-3 py-2" style={MONO}>
                ⚠ Overlaps: {conflicts.map((c) => `"${c.title}"`).join(", ")}. Confirm anyway or edit the time.
              </div>
            )}
            {error && <p className="text-xs text-red-400" style={MONO}>{error}</p>}
            <div className="flex gap-2 pt-1">
              <button onClick={onClose}
                className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm border border-gray-600 transition-colors"
                style={MONO}>
                Cancel
              </button>
              <button onClick={handleConfirm}
                className={`flex-1 py-2 text-white text-sm font-medium transition-colors ${
                  conflicts.length > 0
                    ? "bg-orange-700 hover:bg-orange-600"
                    : "bg-indigo-600 hover:bg-indigo-500"
                }`}
                style={MONO}>
                Add to Calendar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={backdrop} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={card}>
        <div className="h-1 w-full bg-indigo-600" />
        <div className="p-5 space-y-4">

          {/* Header */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1" style={MONO}>
              Proposed Schedule
            </p>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-transparent text-white text-sm font-semibold border-b border-gray-700 focus:border-indigo-500 focus:outline-none pb-0.5"
              style={MONO}
              placeholder="Calendar label"
            />
          </div>

          {/* Proposal summary */}
          <div className="bg-gray-800/60 border border-gray-700 p-3 space-y-1.5">
            <ProposalRow label="Date"     value={proposal.date} />
            <ProposalRow label="Time"     value={`${startTime} – ${endTime}`} />
            <ProposalRow label="Duration" value={`${Math.round(proposal.durationMin / 60 * 10) / 10}h`} />
            {opp.dueAt && (
              <ProposalRow label="Cutoff" value={`${opp.deadline} ${opp.dueAt}`} accent="text-orange-400" />
            )}
            <ProposalRow label="Reason"   value={proposal.reason} accent="text-gray-500" />
          </div>

          {/* Conflict warning */}
          {conflicts.length > 0 && (
            <div className="text-xs text-orange-300 border border-orange-800/50 bg-orange-950/30 px-3 py-2" style={MONO}>
              ⚠ Overlaps: {conflicts.map((c) => `"${c.title}"`).join(", ")}. Confirm anyway or edit the time.
            </div>
          )}

          {/* Inline time editor */}
          {editing && (
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-0.5" style={MONO}>Start</label>
                <input type="time" value={startTime}
                  onChange={(e) => { setStart(e.target.value); setError(""); }}
                  className="w-full bg-gray-900 text-white text-sm px-2 py-1.5 border border-gray-600 focus:border-indigo-500 focus:outline-none"
                  style={MONO} />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-0.5" style={MONO}>End</label>
                <input type="time" value={endTime}
                  onChange={(e) => { setEnd(e.target.value); setError(""); }}
                  className="w-full bg-gray-900 text-white text-sm px-2 py-1.5 border border-gray-600 focus:border-indigo-500 focus:outline-none"
                  style={MONO} />
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-400" style={MONO}>{error}</p>}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose}
              className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm border border-gray-600 transition-colors"
              style={MONO}>
              Cancel
            </button>
            <button onClick={handleToggleEdit}
              className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm border border-gray-600 transition-colors"
              style={MONO}>
              {editing ? "↺ Recommended" : "✏ Edit time"}
            </button>
            <button onClick={handleConfirm}
              className={`flex-1 py-2 text-white text-sm font-medium transition-colors ${
                conflicts.length > 0
                  ? "bg-orange-700 hover:bg-orange-600"
                  : "bg-indigo-600 hover:bg-indigo-500"
              }`}
              style={MONO}>
              Confirm
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

function ScoreBar({ value, max = 10, color }: { value: number; max?: number; color: string }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span style={{ color, ...MONO }} className="text-xs w-6 text-right">{value.toFixed(1)}</span>
    </div>
  );
}

function DebugPanel({ d }: { d: RankingDebug }) {
  const hasAI = d.aiRelevanceScore !== null && d.aiRelevanceScore !== undefined;
  return (
    <div className="mt-2 mb-3 p-3 bg-gray-900 border border-gray-700 text-xs space-y-2.5" style={MONO}>
      <p className="text-gray-400 font-bold tracking-wider">SCORE BREAKDOWN</p>

      {/* Layer 1 — Base Actionability */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-gray-500">Base Actionability</span>
          <span className="text-blue-400 text-xs">{hasAI ? '×0.10' : '×0.30'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-600 w-24">actionability</span>
          <ScoreBar value={d.baseActionabilityScore} color="#60a5fa" />
        </div>
        <div className="flex gap-4 mt-1 text-gray-700">
          <span>urgency {d.urgency.toFixed(0)}</span>
          <span>effort {d.effort.toFixed(0)}</span>
          <span>confidence {d.confidence.toFixed(0)}</span>
        </div>
      </div>

      {/* Layer 2 — Preference Fit */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-gray-500">Preference Fit</span>
          <span className="text-violet-400 text-xs">{hasAI ? '×0.25' : '×0.40'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-600 w-24">pref fit</span>
          <ScoreBar value={d.preferenceFitScore} color="#a78bfa" />
        </div>
        {d.profileCoverage > 0 && (
          <p className="text-gray-700 mt-0.5">coverage {(d.profileCoverage * 100).toFixed(0)}% of profile terms</p>
        )}
        {d.matchedSignals.length > 0 && (
          <p className="text-gray-600 mt-0.5">{d.matchedSignals.join(' · ')}</p>
        )}
        {d.matchedTerms.length > 0 && (
          <p className="text-gray-700">matched: {d.matchedTerms.slice(0, 5).join(', ')}</p>
        )}
        {d.preferenceFitScore === 0 && (
          <p className="text-amber-800 mt-0.5">no profile terms found in this opportunity</p>
        )}
      </div>

      {/* Layer 3 — Career Value */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-gray-500">Career Value</span>
          <span className="text-emerald-400 text-xs">{hasAI ? '×0.20' : '×0.30'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-600 w-24">category</span>
          <ScoreBar value={d.careerValueScore} color="#34d399" />
        </div>
      </div>

      {/* Layer 4 — AI Relevance */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <span className={hasAI ? 'text-gray-500' : 'text-gray-700'}>AI Relevance</span>
          {hasAI && <span className="text-yellow-400 text-xs">×0.45</span>}
        </div>
        {hasAI ? (
          <>
            <div className="flex items-center gap-2">
              <span className="text-gray-600 w-24">ai score</span>
              <ScoreBar value={d.aiRelevanceScore!} color="#facc15" />
            </div>
            {d.aiExplanation && (
              <p className="text-gray-600 mt-0.5 italic">{d.aiExplanation}</p>
            )}
          </>
        ) : (
          <p className="text-gray-700">not yet run — click AI Rerank to activate</p>
        )}
      </div>

      {/* Final */}
      <div className="border-t border-gray-700 pt-2 space-y-1">
        {d.penalty > 0 && (
          <div className="flex justify-between text-red-500">
            <span>Penalty</span><span>−{d.penalty.toFixed(1)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-gray-400 font-bold">Final Score</span>
          <span className="text-white font-bold">{d.finalScore}/10</span>
        </div>
        {d.explanation && (
          <p className="text-gray-500 pt-0.5 italic leading-relaxed">{d.explanation}</p>
        )}
      </div>

      <p className="text-gray-800">today {d.today}</p>
    </div>
  );
}

function OpportunityCard({ opp, accent, showDebug }: { opp: Opportunity; accent: string; showDebug: boolean }) {
  const { setOpportunityInterest, deleteCalendarTask } = useAppStore();
  const [showProposal, setShowProposal] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const catColor = CATEGORY_COLOR[opp.category] ?? "#374151";
  const expired = isOpportunityExpired(opp);
  const isLong = opp.description.length > 160;

  const handleAddToSchedule = () => {
    if (expired) return;
    setShowProposal(true);
  };

  return (
    <>
      {showProposal && (
        <ProposalModal opp={opp} onClose={() => setShowProposal(false)} />
      )}
      <div
        className={`bg-gray-900 p-5 border border-gray-700 transition-all ${opp.interested === false ? "opacity-50" : "hover:border-gray-600"}`}
      >
        <div className="flex items-start gap-3 mb-3">
          <PriorityBadge priority={opp.priority} />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white text-base mb-0.5" style={MONO}>{opp.title}</h3>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-sm px-2 py-0.5 text-gray-500"
                style={{ ...MONO, border: `2px solid ${catColor}90` }}
              >
                {CATEGORY_LABELS[opp.category]}
              </span>
              {opp.deadline && (
                <span
                  className="text-sm"
                  style={{ ...MONO, color: expired ? '#ef4444' : '#6b7280' }}
                >
                  {expired ? 'Expired' : `Due ${opp.deadline}`}
                </span>
              )}
              {opp.eventTime && (
                <span className="text-sm text-gray-500" style={MONO}>{opp.eventTime}{opp.eventEndTime ? `–${opp.eventEndTime}` : ""}</span>
              )}
              {opp.dueAt && opp.itemType === 'deadline' && (
                <span className="text-sm text-gray-500" style={MONO}>cutoff {opp.dueAt}</span>
              )}
              {opp.flexibility && (
                <span
                  className="text-xs px-1.5 py-0.5"
                  style={{
                    ...MONO,
                    color: opp.flexibility === 'fixed' ? '#818cf8' : '#6b7280',
                    border: `1px solid ${opp.flexibility === 'fixed' ? '#3730a3' : '#374151'}`,
                  }}
                >
                  {opp.flexibility === 'fixed' ? 'Fixed Event' : 'Flexible'}
                </span>
              )}
              <span className="text-sm text-gray-500" style={MONO}>~{opp.estimatedHours}h</span>
              {opp.sourceCount !== undefined && opp.sourceCount > 1 && (
                <span className="text-xs text-gray-600 px-1.5 py-0.5 border border-gray-700" style={MONO} title={`Merged from ${opp.sourceCount} emails`}>
                  {opp.sourceCount} emails
                </span>
              )}
            </div>
          </div>
        </div>

        <p
          className={`text-base text-gray-400 mb-2 break-words${expanded ? "" : " line-clamp-3"}`}
          style={{ ...MONO, overflowWrap: "anywhere" }}
        >
          {opp.description}
        </p>
        {isLong && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors mb-2 -mt-1"
            style={MONO}
          >
            {expanded ? "Show less ▴" : "Read more ▾"}
          </button>
        )}
        <p className="text-sm text-gray-500 mb-4" style={MONO}>
          {opp.priorityReason}
        </p>

        {showDebug && opp.rankingDebug && <DebugPanel d={opp.rankingDebug} />}

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
        ) : expired ? (
          <div className="flex items-center gap-2">
            <span className="text-sm px-2 py-0.5 text-red-400 border border-red-800" style={MONO}>
              Deadline passed
            </span>
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

// ── Status groups ─────────────────────────────────────────────────────────────

const CAREER_CATEGORIES = new Set([
  "internship_application", "internship_research", "professional_event",
  "networking", "classes", "deadline",
]);

type OppStatus = "active" | "scheduled" | "dismissed" | "expired";

function getStatus(opp: Opportunity): OppStatus {
  if (isOpportunityExpired(opp)) return "expired";
  if (opp.addedToCalendar)       return "scheduled";
  if (opp.interested === false)  return "dismissed";
  return "active";
}

// ── Expired item card (compact history row) ────────────────────────────────────

function ExpiredCard({ opp }: { opp: Opportunity }) {
  const catColor = CATEGORY_COLOR[opp.category] ?? "#374151";
  const when = opp.deadline
    ? opp.dueAt ? `${opp.deadline} ${opp.dueAt}` : opp.deadline
    : "unknown date";
  return (
    <div className="bg-gray-950 border border-gray-800 px-4 py-3 flex items-start gap-3 opacity-50">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span
            className="text-xs px-1.5 py-0.5 text-gray-600"
            style={{ ...MONO, border: `1px solid ${catColor}50` }}
          >
            {CATEGORY_LABELS[opp.category]}
          </span>
          <span className="text-xs text-red-900" style={MONO}>Deadline passed {when}</span>
        </div>
        <p className="text-sm text-gray-600 truncate" style={MONO}>{opp.title}</p>
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function OpportunitiesView() {
  const {
    opportunities, emails, character,
    rerankWithK2, rerankLoading,
    lastCalendarUndo, undoLastCalendarAction, clearCalendarUndo,
    gmailConnected, setEmails,
  } = useAppStore();

  const [showDebug, setShowDebug]       = useState(false);
  const [showExpired, setShowExpired]   = useState(false);
  const [importing, setImporting]       = useState(false);
  const [importError, setImportError]   = useState<string | null>(null);
  const [importStep, setImportStep]     = useState<string>("");

  // Called from page.tsx via a custom event after Gmail OAuth completes
  const runGmailImport = useCallback(async (providerToken: string, userId: string) => {
    setImporting(true);
    setImportError(null);
    try {
      // Step 1 — fetch raw emails from Gmail API
      setImportStep("Fetching emails from Gmail…");
      const fetchRes = await fetch("/api/gmail/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: providerToken }),
      });
      if (!fetchRes.ok) throw new Error("Failed to fetch Gmail messages");
      const { emails: rawEmails } = await fetchRes.json() as {
        emails: Array<{ id: string; from: string; subject: string; body: string; date: string }>;
      };

      // Step 2 — categorise with AI
      setImportStep(`Categorising ${rawEmails.length} emails…`);
      const catRes = await fetch("/api/gmail/categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: rawEmails }),
      });
      const { categories } = catRes.ok
        ? await catRes.json() as { categories: Array<{ id: string; category: import("@/types").EmailCategory }> }
        : { categories: [] };

      const catMap = new Map(categories.map((c) => [c.id, c.category]));

      // Step 3 — assemble MockEmail array
      const mockEmails: import("@/types").MockEmail[] = rawEmails.map((e) => ({
        id: e.id,
        from: e.from,
        subject: e.subject,
        body: e.body,
        date: e.date,
        category: catMap.get(e.id) ?? "ignore",
      }));

      // Step 4 — update store (re-derives opportunities automatically)
      setEmails(mockEmails);

      // Step 5 — persist to Supabase
      setImportStep("Saving…");
      const { saveUserEmails } = await import("@/lib/supabaseSync");
      await saveUserEmails(userId, mockEmails).catch(() => {});

    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
      setImportStep("");
    }
  }, [setEmails]);

  // Listen for the custom event dispatched by page.tsx after OAuth callback
  useEffect(() => {
    const handler = (e: Event) => {
      const { providerToken, userId } = (e as CustomEvent<{ providerToken: string; userId: string }>).detail;
      runGmailImport(providerToken, userId);
    };
    window.addEventListener("gmail:connected", handler);
    return () => window.removeEventListener("gmail:connected", handler);
  }, [runGmailImport]);

  const handleConnectGmail = async () => {
    const { createClient } = await import("@/utils/supabase/client");
    const supabase = createClient();
    // Encode the next URL so the ?gmail=connected param survives the redirect chain
    const next = encodeURIComponent('/?gmail=connected');
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes: "https://www.googleapis.com/auth/gmail.readonly email profile",
        redirectTo: `${window.location.origin}/auth/callback?next=${next}`,
      },
    });
  };

  const visible = opportunities.filter((o) => o.category !== "ignore");

  // Partition by status — expired is mutually exclusive with all other groups
  const byStatus = (list: Opportunity[]) => ({
    active:    list.filter((o) => getStatus(o) === "active"),
    scheduled: list.filter((o) => getStatus(o) === "scheduled"),
    dismissed: list.filter((o) => getStatus(o) === "dismissed"),
    expired:   list.filter((o) => getStatus(o) === "expired"),
  });

  const career    = visible.filter((o) => CAREER_CATEGORIES.has(o.category));
  const lifestyle = visible.filter((o) => !CAREER_CATEGORIES.has(o.category));

  const careerGroups    = byStatus(career);
  const lifestyleGroups = byStatus(lifestyle);

  const allExpired = [...careerGroups.expired, ...lifestyleGroups.expired];

  const archetype = character?.archetype ?? "The Sage";
  const palette   = getArchetypePalette(archetype);
  const accent    = palette.glow;

  // ── Gmail not connected: show connect screen ────────────────────────────────
  if (!gmailConnected) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col items-center justify-center min-h-[60vh] gap-8">
        <div className="text-center space-y-3">
          <p className="text-6xl">📬</p>
          <h1 className="text-4xl font-bold text-white" style={DOT}>Connect Gmail</h1>
          <p className="text-gray-400 text-sm max-w-sm" style={MONO}>
            Link your Gmail account so LifeStrat can import your emails and surface real opportunities — internships, events, deadlines, and more.
          </p>
        </div>

        {importing ? (
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-gray-400 text-sm" style={MONO}>{importStep || "Importing…"}</p>
          </div>
        ) : (
          <button
            onClick={handleConnectGmail}
            className="flex items-center gap-3 px-6 py-3 bg-white hover:bg-gray-100 text-gray-900 font-medium text-sm transition-colors"
            style={MONO}
          >
            <svg width="20" height="20" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Connect Gmail Account
          </button>
        )}

        {importError && (
          <p className="text-red-400 text-xs border border-red-800/40 bg-red-950/20 px-4 py-2" style={MONO}>
            {importError}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex flex-col gap-4">
          <h1 className="text-6xl font-bold text-white" style={DOT}>Opportunities</h1>
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline gap-3">
              <span className="text-5xl font-bold text-yellow-400" style={MONO}>{careerGroups.active.length}</span>
              <span className="text-base uppercase text-yellow-400" style={MONO}>Pending</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-5xl font-bold text-green-400" style={MONO}>{careerGroups.scheduled.length}</span>
              <span className="text-base uppercase text-green-400" style={MONO}>Scheduled</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-5xl font-bold text-gray-400" style={MONO}>{careerGroups.dismissed.length}</span>
              <span className="text-base uppercase text-gray-400" style={MONO}>Skipped</span>
            </div>
          </div>
          <p className="text-base text-gray-500" style={MONO}>
            Detected from {emails.length} emails
          </p>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-3">
          <PixelSprite palette={palette} scale={10} pose="ponder" />
          <div className="flex gap-2 flex-wrap justify-end">
            <button onClick={handleConnectGmail} disabled={importing}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 text-sm border border-gray-600 transition-colors"
              style={MONO}>
              {importing ? importStep || "Syncing…" : "↺ Sync Gmail"}
            </button>
            <button onClick={() => rerankWithK2()} disabled={rerankLoading}
              className="px-3 py-1.5 bg-indigo-800 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-wait text-white text-sm border border-indigo-600 transition-colors"
              style={MONO}>
              {rerankLoading ? "Reranking…" : "✦ AI Rerank"}
            </button>
            <button onClick={() => setShowDebug(v => !v)}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-500 text-sm border border-gray-600 transition-colors"
              style={MONO}>
              {showDebug ? "Hide Debug" : "Debug"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Career section ── */}
      {(careerGroups.active.length > 0 || careerGroups.scheduled.length > 0 || careerGroups.dismissed.length > 0) && (
        <div className="mb-2">
          <h2 className="text-2xl font-bold text-gray-300" style={DOT}>Career Opportunities</h2>
        </div>
      )}

      {careerGroups.active.length > 0 && (
        <section className="mb-6">
          <h3 className="text-lg font-bold text-gray-400 uppercase tracking-wider mb-3" style={MONO}>
            Needs Decision
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {careerGroups.active.map((opp) => (
              <OpportunityCard key={opp.id} opp={opp} accent={accent} showDebug={showDebug} />
            ))}
          </div>
        </section>
      )}

      {careerGroups.scheduled.length > 0 && (
        <section className="mb-6">
          <h3 className="text-lg font-bold text-gray-400 uppercase tracking-wider mb-3" style={MONO}>
            On Calendar
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {careerGroups.scheduled.map((opp) => (
              <OpportunityCard key={opp.id} opp={opp} accent={accent} showDebug={showDebug} />
            ))}
          </div>
        </section>
      )}

      {careerGroups.dismissed.length > 0 && (
        <section className="mb-8">
          <h3 className="text-lg font-bold text-gray-400 uppercase tracking-wider mb-3" style={MONO}>
            Not Interested
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {careerGroups.dismissed.map((opp) => (
              <OpportunityCard key={opp.id} opp={opp} accent={accent} showDebug={showDebug} />
            ))}
          </div>
        </section>
      )}

      {/* ── Lifestyle section ── */}
      {(lifestyleGroups.active.length > 0 || lifestyleGroups.scheduled.length > 0 || lifestyleGroups.dismissed.length > 0) && (
        <section className="mb-8">
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-gray-300" style={DOT}>
              Entertainment &amp; Personal
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[...lifestyleGroups.active, ...lifestyleGroups.scheduled, ...lifestyleGroups.dismissed].map((opp) => (
              <OpportunityCard key={opp.id} opp={opp} accent={accent} showDebug={showDebug} />
            ))}
          </div>
        </section>
      )}

      {/* ── Past & Expired — collapsed by default ── */}
      {allExpired.length > 0 && (
        <section className="mt-4 border-t border-gray-800 pt-4">
          <button
            onClick={() => setShowExpired(v => !v)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-400 transition-colors mb-3 w-full text-left"
            style={MONO}
          >
            <span className="text-sm">{showExpired ? "▾" : "▸"}</span>
            <span className="text-sm uppercase tracking-wider">
              Past &amp; Expired
            </span>
            <span className="text-sm text-gray-700 ml-1">({allExpired.length})</span>
          </button>
          {showExpired && (
            <div className="flex flex-col gap-1">
              {allExpired.map((opp) => (
                <ExpiredCard key={opp.id} opp={opp} />
              ))}
            </div>
          )}
        </section>
      )}

      {lastCalendarUndo && (
        <UndoToast
          label={lastCalendarUndo.label}
          onUndo={() => undoLastCalendarAction()}
          onDismiss={() => clearCalendarUndo()}
        />
      )}
    </div>
  );
}
