import { CalendarTask, Conflict, UserProfile } from '@/types';
import { timeToMinutes, getBlockedIntervalsForDay } from './dayPlanner';

function tasksOverlap(a: CalendarTask, b: CalendarTask): boolean {
  if (a.date !== b.date) return false;
  return timeToMinutes(a.startTime) < timeToMinutes(b.endTime) &&
         timeToMinutes(b.startTime) < timeToMinutes(a.endTime);
}

/**
 * Detects all scheduling conflicts:
 * 1. Task-to-task overlaps on the same day
 * 2. Task overlapping a blocked interval (sleep, meals, schedule blocks)
 */
export function detectConflicts(tasks: CalendarTask[], profile: UserProfile): Conflict[] {
  const conflicts: Conflict[] = [];
  const seen = new Set<string>();

  // ── Task-to-task overlaps ──────────────────────────────────────────────────
  for (let i = 0; i < tasks.length; i++) {
    for (let j = i + 1; j < tasks.length; j++) {
      const a = tasks[i];
      const b = tasks[j];
      if (!tasksOverlap(a, b)) continue;
      const id = `conflict-${a.id}-${b.id}`;
      if (seen.has(id)) continue;
      seen.add(id);
      conflicts.push({
        id,
        taskAId: a.id,
        taskBId: b.id,
        taskATitle: a.title,
        taskBTitle: b.title,
        date: a.date,
        reason: `"${a.title}" (${a.startTime}–${a.endTime}) overlaps with "${b.title}" (${b.startTime}–${b.endTime}) on ${a.date}.`,
        suggestions: [
          `Keep "${a.title}" and reschedule "${b.title}" to another slot.`,
          `Keep "${b.title}" and reschedule "${a.title}" to another slot.`,
          'Reduce workload for the day by removing one task.',
        ],
      });
    }
  }

  // ── Task-to-blocked-time overlaps ─────────────────────────────────────────
  // Group tasks by date so we only compute blocked intervals once per date
  const byDate = new Map<string, CalendarTask[]>();
  for (const task of tasks) {
    const list = byDate.get(task.date) ?? [];
    list.push(task);
    byDate.set(task.date, list);
  }

  for (const [date, dayTasks] of byDate) {
    const blocked = getBlockedIntervalsForDay(profile, date);

    for (const task of dayTasks) {
      const taskStart = timeToMinutes(task.startTime);
      const taskEnd = timeToMinutes(task.endTime);

      for (const interval of blocked) {
        if (taskStart >= interval.end || taskEnd <= interval.start) continue;

        // Compute overlap window for the reason text
        const overlapStart = Math.max(taskStart, interval.start);
        const overlapEnd = Math.min(taskEnd, interval.end);
        const fmt = (m: number) => {
          const h = Math.floor(m / 60);
          const min = m % 60;
          const suffix = h >= 12 ? 'PM' : 'AM';
          return `${((h % 12) || 12)}:${String(min).padStart(2, '0')} ${suffix}`;
        };

        const id = `blocked-${task.id}-${interval.label}`;
        if (seen.has(id)) continue;
        seen.add(id);

        conflicts.push({
          id,
          taskAId: task.id,
          taskBId: `blocked::${interval.label}`,
          taskATitle: task.title,
          taskBTitle: interval.label,
          date,
          reason: `"${task.title}" overlaps your blocked ${interval.label} (${fmt(overlapStart)}–${fmt(overlapEnd)}).`,
          suggestions: [
            `Move "${task.title}" to a time outside the blocked ${interval.label} window.`,
            `If this overlap is intentional, adjust the "${interval.label}" block in Preferences.`,
          ],
          isBlockedTime: true,
        });
        break; // only report the first blocked interval hit per task
      }
    }
  }

  return conflicts;
}
