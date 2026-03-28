import { Opportunity, UserProfile, StrategyAction, DailyStrategy, Plan, EmailCategory } from '@/types';

const TODAY = '2026-03-28';

function daysUntil(deadline: string, today: string): number {
  const d = new Date(deadline);
  const t = new Date(today);
  return Math.ceil((d.getTime() - t.getTime()) / (1000 * 60 * 60 * 24));
}

const ACTION_VERBS: Partial<Record<EmailCategory, string>> = {
  internship_application: 'Apply',
  internship_research: 'Research',
  professional_event: 'Attend',
  networking: 'Attend',
  classes: 'Prepare for',
  deadline: 'Complete',
  entertainment: 'Enjoy',
  personal: 'Handle',
};

function buildActionReason(opp: Opportunity, today: string): string {
  const parts: string[] = [];

  if (opp.deadline) {
    const days = daysUntil(opp.deadline, today);
    if (days <= 0) parts.push('overdue — immediate action required');
    else if (days === 1) parts.push('due tomorrow');
    else if (days <= 2) parts.push(`due in ${days} days`);
    else if (days <= 5) parts.push(`deadline in ${days} days`);
    else parts.push(`deadline ${opp.deadline}`);
  }

  const impactText: Partial<Record<EmailCategory, string>> = {
    internship_application: 'top career priority',
    networking: 'expands professional network',
    professional_event: 'career development',
    classes: 'GPA impact',
    deadline: 'cannot defer',
    internship_research: 'informs your applications',
  };
  const impact = impactText[opp.category];
  if (impact) parts.push(impact);

  return parts.join(', ');
}

function toStrategyAction(opp: Opportunity, today: string): StrategyAction {
  const verb = ACTION_VERBS[opp.category] ?? 'Handle';
  return {
    opportunityId: opp.id,
    title: opp.title,
    action: `${verb}: ${opp.title}`,
    reason: buildActionReason(opp, today),
    estimatedHours: opp.estimatedHours,
  };
}

/**
 * Generate today's top 3–5 actions and deferred items.
 */
export function generateDailyStrategy(
  opportunities: Opportunity[],
  profile: UserProfile,
  today: string = TODAY
): DailyStrategy {
  const available = profile.dailyHoursAvailable || 4;

  // Only consider undecided or interested opps that aren't ignored
  const pool = opportunities.filter(
    (o) => o.category !== 'ignore' && o.interested !== false && o.priority > 2
  );

  // Already sorted by priority from rankOpportunities
  const topActions: StrategyAction[] = [];
  const deferredItems: StrategyAction[] = [];
  let hoursUsed = 0;

  for (const opp of pool) {
    const item = toStrategyAction(opp, today);
    const wouldOverload = hoursUsed + opp.estimatedHours > available * 1.25;

    if (topActions.length < 5 && !wouldOverload) {
      topActions.push(item);
      hoursUsed += opp.estimatedHours;
    } else {
      deferredItems.push(item);
    }
  }

  return {
    date: today,
    topActions,
    deferredItems: deferredItems.slice(0, 5),
    overloaded: hoursUsed > available,
    totalScheduledHours: hoursUsed,
    availableHours: available,
  };
}

function buildPlan(
  opportunities: Opportunity[],
  categoryOrder: EmailCategory[],
  available: number,
  today: string
): StrategyAction[] {
  const sorted = [...opportunities].sort((a, b) => {
    const ai = categoryOrder.indexOf(a.category);
    const bi = categoryOrder.indexOf(b.category);
    const aIdx = ai === -1 ? 99 : ai;
    const bIdx = bi === -1 ? 99 : bi;
    if (aIdx !== bIdx) return aIdx - bIdx;
    return b.priority - a.priority;
  });

  const items: StrategyAction[] = [];
  let hours = 0;
  for (const opp of sorted) {
    if (items.length >= 4) break;
    if (hours + opp.estimatedHours > available * 1.1) continue;
    items.push(toStrategyAction(opp, today));
    hours += opp.estimatedHours;
  }
  return items;
}

/**
 * Generate Plan A (career-focused) and Plan B (networking-focused)
 * when the user has a scheduling conflict or overload.
 */
export function generatePlans(
  opportunities: Opportunity[],
  profile: UserProfile,
  today: string = TODAY
): Plan[] {
  const available = profile.dailyHoursAvailable || 4;
  const pool = opportunities.filter(
    (o) => o.category !== 'ignore' && o.interested !== false && o.priority > 2
  );

  const planAItems = buildPlan(
    pool,
    ['internship_application', 'deadline', 'classes', 'professional_event', 'networking', 'internship_research'],
    available,
    today
  );

  const planBItems = buildPlan(
    pool,
    ['networking', 'professional_event', 'internship_application', 'classes', 'internship_research'],
    available,
    today
  );

  return [
    {
      name: 'Plan A',
      focus: 'Career-Focused',
      items: planAItems,
      explanation:
        'Prioritizes internship applications and academic deadlines. Best if your goal is to maximize career outcomes this week.',
    },
    {
      name: 'Plan B',
      focus: 'Networking-Focused',
      items: planBItems,
      explanation:
        'Prioritizes events and connections. Best if you want to expand your professional network and explore opportunities.',
    },
  ];
}
