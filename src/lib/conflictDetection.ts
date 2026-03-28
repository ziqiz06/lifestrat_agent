import { CalendarTask, Conflict } from '@/types';

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function tasksOverlap(a: CalendarTask, b: CalendarTask): boolean {
  if (a.date !== b.date) return false;
  const aStart = timeToMinutes(a.startTime);
  const aEnd = timeToMinutes(a.endTime);
  const bStart = timeToMinutes(b.startTime);
  const bEnd = timeToMinutes(b.endTime);
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Detect scheduling conflicts among calendar tasks.
 * Returns a list of Conflict objects.
 */
export function detectConflicts(tasks: CalendarTask[]): Conflict[] {
  const conflicts: Conflict[] = [];

  for (let i = 0; i < tasks.length; i++) {
    for (let j = i + 1; j < tasks.length; j++) {
      const a = tasks[i];
      const b = tasks[j];
      if (tasksOverlap(a, b)) {
        conflicts.push({
          id: `conflict-${a.id}-${b.id}`,
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
  }

  return conflicts;
}
