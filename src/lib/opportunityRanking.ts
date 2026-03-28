import { Opportunity, UserProfile, EmailCategory } from '@/types';

const TODAY = '2026-03-28';

function daysUntil(deadline: string, today: string): number {
  const d = new Date(deadline);
  const t = new Date(today);
  return Math.ceil((d.getTime() - t.getTime()) / (1000 * 60 * 60 * 24));
}

/** Urgency: 0–10 scale with steep drop-off */
function urgencyScore(deadline: string | null, today: string): number {
  if (!deadline) return 1;
  const days = daysUntil(deadline, today);
  if (days <= 0) return 10;
  if (days <= 2) return 9;
  if (days <= 5) return 7;
  if (days <= 10) return 4;
  if (days <= 21) return 2;
  return 1;
}

/** Career impact: wide spread by category */
function impactScore(category: EmailCategory): number {
  const map: Record<EmailCategory, number> = {
    internship_application: 10,
    deadline: 9,
    classes: 8,
    networking: 5,
    professional_event: 4,
    internship_research: 3,
    entertainment: 2,
    personal: 1,
    ignore: 0,
  };
  return map[category] ?? 2;
}

/** Effort cost: penalize long tasks, reward quick wins */
function effortModifier(hours: number): number {
  if (hours >= 6) return -1.5;
  if (hours >= 4) return -0.5;
  if (hours <= 1) return 0.8;
  return 0;
}

/** Boost if opportunity text matches user interests */
function preferenceBoost(opp: Opportunity, profile: UserProfile): number {
  const interests = `${profile.professionalInterests ?? ''} ${profile.targetIndustries ?? ''}`.toLowerCase();
  if (!interests.trim()) return 0;
  const text = `${opp.title} ${opp.description}`.toLowerCase();
  const keywords = interests.split(/[\s,]+/).filter((k) => k.length > 3);
  return keywords.some((k) => text.includes(k)) ? 1 : 0;
}

/** Generate a specific, human-readable reason for this score */
function buildReason(opp: Opportunity, urgency: number, impact: number, today: string): string {
  const parts: string[] = [];

  if (opp.deadline) {
    const days = daysUntil(opp.deadline, today);
    if (days <= 0) parts.push('OVERDUE — act immediately');
    else if (days === 1) parts.push('Due tomorrow');
    else if (days <= 2) parts.push(`Due in ${days} days — very urgent`);
    else if (days <= 5) parts.push(`Deadline in ${days} days`);
    else parts.push(`Deadline in ${days} days`);
  }

  const categoryDetail: Partial<Record<EmailCategory, string>> = {
    internship_application: 'competitive internship — high career impact',
    networking: 'direct access to professionals and recruiters',
    professional_event: 'professional development with career value',
    classes: 'academic deadline that directly affects GPA',
    internship_research: 'early-stage research to identify fit before applying',
    deadline: 'hard deadline — cannot be rescheduled',
    entertainment: 'personal time — important for balance',
    personal: 'personal message',
  };
  const detail = categoryDetail[opp.category];
  if (detail) parts.push(detail);

  if (opp.estimatedHours >= 4) parts.push(`requires ~${opp.estimatedHours}h`);
  else if (opp.estimatedHours <= 1) parts.push('quick win — under 1h');

  // Suppress TS unused-var warning
  void urgency; void impact;

  return parts.join(' — ');
}

/**
 * Score a single opportunity. Returns 1–10 with clear separation.
 * Weights: urgency 50%, impact 40%, effort+pref 10%.
 */
export function scoreOpportunity(
  opp: Opportunity,
  profile: UserProfile,
  today: string = TODAY
): number {
  const urgency = urgencyScore(opp.deadline, today);
  const impact = impactScore(opp.category);
  const effort = effortModifier(opp.estimatedHours);
  const pref = preferenceBoost(opp, profile);

  const raw = urgency * 0.5 + impact * 0.4 + (effort + pref) * 0.1;
  return Math.min(10, Math.max(1, Math.round(raw)));
}

/**
 * Rank all opportunities and update their priority + priorityReason.
 */
export function rankOpportunities(
  opportunities: Opportunity[],
  profile: UserProfile,
  today: string = TODAY
): Opportunity[] {
  return opportunities
    .map((opp) => {
      const urgency = urgencyScore(opp.deadline, today);
      const impact = impactScore(opp.category);
      const effort = effortModifier(opp.estimatedHours);
      const pref = preferenceBoost(opp, profile);
      const raw = urgency * 0.5 + impact * 0.4 + (effort + pref) * 0.1;
      const priority = Math.min(10, Math.max(1, Math.round(raw)));
      const priorityReason = buildReason(opp, urgency, impact, today);
      return { ...opp, priority, priorityReason };
    })
    .sort((a, b) => b.priority - a.priority);
}
