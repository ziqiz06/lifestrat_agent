'use client';
import { useAppStore } from '@/store/appStore';
import { Opportunity } from '@/types';

const CATEGORY_LABELS: Record<string, string> = {
  internship_application: 'Internship App',
  internship_research: 'Internship Research',
  professional_event: 'Professional Event',
  networking: 'Networking',
  classes: 'Academic',
  deadline: 'Deadline',
  entertainment: 'Entertainment',
  personal: 'Personal',
  ignore: 'Ignore',
};

const CATEGORY_COLORS: Record<string, string> = {
  internship_application: 'bg-green-900/50 text-green-300 border-green-800',
  internship_research: 'bg-blue-900/50 text-blue-300 border-blue-800',
  professional_event: 'bg-purple-900/50 text-purple-300 border-purple-800',
  networking: 'bg-pink-900/50 text-pink-300 border-pink-800',
  classes: 'bg-indigo-900/50 text-indigo-300 border-indigo-800',
  deadline: 'bg-red-900/50 text-red-300 border-red-800',
  entertainment: 'bg-yellow-900/50 text-yellow-300 border-yellow-800',
  personal: 'bg-gray-700 text-gray-300 border-gray-600',
  ignore: 'bg-gray-800 text-gray-500 border-gray-700',
};

function PriorityBadge({ priority }: { priority: number }) {
  const color = priority >= 9 ? 'bg-red-500' : priority >= 7 ? 'bg-yellow-500' : 'bg-green-500';
  return (
    <div className={`${color} text-white text-xs font-bold w-8 h-8 rounded-full flex items-center justify-center shrink-0`}>
      {priority}
    </div>
  );
}

function OpportunityCard({ opp }: { opp: Opportunity }) {
  const { setOpportunityInterest, addOpportunityToCalendar } = useAppStore();

  return (
    <div className={`bg-gray-800 rounded-2xl p-5 border transition-all ${
      opp.interested === true ? 'border-indigo-600/60' :
      opp.interested === false ? 'border-gray-700 opacity-60' :
      'border-gray-700 hover:border-gray-600'
    }`}>
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
            <span className="text-xs text-gray-500">⏱ ~{opp.estimatedHours}h</span>
          </div>
        </div>
      </div>

      <p className="text-sm text-gray-400 mb-2">{opp.description}</p>
      <p className="text-xs text-indigo-300 italic mb-4">Why this matters: {opp.priorityReason}</p>

      {opp.interested === null ? (
        <div className="flex gap-2">
          <button
            onClick={() => setOpportunityInterest(opp.id, true)}
            className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
          >
            ✓ Interested
          </button>
          <button
            onClick={() => setOpportunityInterest(opp.id, false)}
            className="flex-1 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm transition-colors"
          >
            ✕ Not Interested
          </button>
        </div>
      ) : opp.interested === true ? (
        <div className="flex items-center gap-2">
          <span className="text-sm text-indigo-400">✓ Marked as interested</span>
          {!opp.addedToCalendar && opp.deadline && (
            <button
              onClick={() => addOpportunityToCalendar(opp.id)}
              className="ml-auto text-xs bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-600/50 rounded px-3 py-1 transition-colors"
            >
              + Add to Calendar
            </button>
          )}
          {opp.addedToCalendar && (
            <span className="ml-auto text-xs text-green-400">📅 Added to calendar</span>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Not interested</span>
          <button
            onClick={() => setOpportunityInterest(opp.id, null)}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}

export default function OpportunitiesView() {
  const { opportunities, emails } = useAppStore();
  const visible = opportunities.filter((o) => o.category !== 'ignore');
  const interested = visible.filter((o) => o.interested === true);
  const undecided = visible.filter((o) => o.interested === null);
  const notInterested = visible.filter((o) => o.interested === false);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Opportunities</h1>
          <p className="text-sm text-gray-400 mt-0.5">Detected from {emails.length} emails • Ranked by relevance &amp; urgency</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-indigo-400">{undecided.length}</div>
          <div className="text-xs text-gray-500">pending review</div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Undecided', count: undecided.length, color: 'text-yellow-400' },
          { label: 'Interested', count: interested.length, color: 'text-green-400' },
          { label: 'Skipped', count: notInterested.length, color: 'text-gray-400' },
        ].map((s) => (
          <div key={s.label} className="bg-gray-800 rounded-xl p-3 border border-gray-700 text-center">
            <div className={`text-xl font-bold ${s.color}`}>{s.count}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Undecided */}
      {undecided.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Needs Decision</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {undecided.map((opp) => <OpportunityCard key={opp.id} opp={opp} />)}
          </div>
        </section>
      )}

      {/* Interested */}
      {interested.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Interested</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {interested.map((opp) => <OpportunityCard key={opp.id} opp={opp} />)}
          </div>
        </section>
      )}

      {/* Not interested */}
      {notInterested.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Not Interested</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {notInterested.map((opp) => <OpportunityCard key={opp.id} opp={opp} />)}
          </div>
        </section>
      )}
    </div>
  );
}
