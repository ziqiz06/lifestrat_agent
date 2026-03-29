import type { CalendarTask } from '@/types';

/**
 * XP multiplier per task type.
 * Higher multiplier = more XP for the same duration.
 */
const XP_MULTIPLIERS: Record<string, number> = {
  internship_application: 2.0,
  company_research:       1.2,
  resume_update:          1.5,
  networking:             1.8,
  career_fair:            1.8,
  workshop:               1.4,
  class:                  1.2,
  deadline:               1.6,
  free_time:              0.6,
  entertainment:          0.5,
  other:                  1.0,
};

function toMins(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Compute the XP value for a completed task.
 * Formula: 1 XP per 10 minutes × category multiplier, capped at 30 XP per event.
 */
export function computeTaskXP(task: CalendarTask): number {
  const durationMins = Math.max(0, toMins(task.endTime) - toMins(task.startTime));
  const multiplier = XP_MULTIPLIERS[task.type] ?? 1.0;
  return Math.min(30, Math.round((durationMins / 10) * multiplier));
}
