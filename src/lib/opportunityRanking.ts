import { Opportunity, UserProfile } from '@/types';

// Score modifiers based on user profile
function urgencyScore(deadline: string | null): number {
  if (!deadline) return 2;
  const today = new Date('2026-03-28');
  const due = new Date(deadline);
  const daysLeft = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (daysLeft <= 3) return 10;
  if (daysLeft <= 7) return 8;
  if (daysLeft <= 14) return 6;
  if (daysLeft <= 30) return 4;
  return 2;
}

function careerImpactScore(category: Opportunity['category']): number {
  const scores: Record<string, number> = {
    internship_application: 10,
    networking: 8,
    professional_event: 7,
    internship_research: 6,
    classes: 5,
    deadline: 9,
    entertainment: 2,
    personal: 2,
    ignore: 0,
  };
  return scores[category] ?? 3;
}

function intensityFit(estimatedHours: number, intensity: UserProfile['scheduleIntensity']): number {
  if (intensity === 'intense') return 10;
  if (intensity === 'moderate') return estimatedHours <= 4 ? 8 : 5;
  return estimatedHours <= 2 ? 8 : 4; // light
}

/**
 * Rank opportunities based on user profile.
 * Returns sorted array (highest priority first).
 */
export function rankOpportunities(
  opportunities: Opportunity[],
  profile: UserProfile
): Opportunity[] {
  const scored = opportunities.map((opp) => {
    const urgency = urgencyScore(opp.deadline);
    const impact = careerImpactScore(opp.category);
    const fit = intensityFit(opp.estimatedHours, profile.scheduleIntensity);
    const score = Math.round((urgency * 0.4 + impact * 0.4 + fit * 0.2));
    return { ...opp, priority: score };
  });

  return scored.sort((a, b) => b.priority - a.priority);
}
