import { CalendarTask, UserProfile, TimeBlock, ScheduleResult } from '@/types';

// Task types considered "fixed" (anchored to a real time)
const FIXED_TYPES = new Set([
  'career_fair', 'class', 'workshop', 'networking', 'deadline', 'entertainment', 'free_time',
]);

export function isFixed(task: CalendarTask): boolean {
  return task.flex === 'fixed' || FIXED_TYPES.has(task.type);
}

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(Math.min(h, 23)).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/**
 * Returns fixed events for a given date, sorted by start time.
 */
export function getFixedEventsForDay(tasks: CalendarTask[], date: string): CalendarTask[] {
  return tasks
    .filter((t) => t.date === date && isFixed(t))
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
}

/**
 * Finds open time blocks in a day given fixed events and user preferences.
 * Adds a 15-min buffer after each fixed event.
 */
export function getAvailableTimeBlocks(
  fixedEvents: CalendarTask[],
  profile: UserProfile,
  date: string
): TimeBlock[] {
  void date;
  const BUFFER = 15;
  const dayStart = timeToMinutes(profile.preferredStartTime || '09:00');
  const dayEnd = timeToMinutes(profile.preferredEndTime || '22:00');

  // Build list of blocked intervals from fixed events
  const blocked: Array<{ start: number; end: number }> = fixedEvents.map((e) => ({
    start: timeToMinutes(e.startTime),
    end: timeToMinutes(e.endTime) + BUFFER,
  }));

  // Sort and merge overlapping blocked intervals
  blocked.sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [];
  for (const b of blocked) {
    if (merged.length === 0 || b.start > merged[merged.length - 1].end) {
      merged.push({ ...b });
    } else {
      merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, b.end);
    }
  }

  // Find free gaps between merged blocked intervals
  const blocks: TimeBlock[] = [];
  let cursor = dayStart;
  for (const block of merged) {
    if (block.start > cursor) {
      const duration = block.start - cursor;
      if (duration >= 30) {
        blocks.push({ startTime: minutesToTime(cursor), endTime: minutesToTime(block.start), durationMinutes: duration });
      }
    }
    cursor = Math.max(cursor, block.end);
  }
  if (cursor < dayEnd) {
    const duration = dayEnd - cursor;
    if (duration >= 30) {
      blocks.push({ startTime: minutesToTime(cursor), endTime: minutesToTime(dayEnd), durationMinutes: duration });
    }
  }

  return blocks;
}

/**
 * Schedules flexible tasks into available time blocks.
 * Tasks are expected to be pre-sorted by priority (highest first).
 * Respects intensity: light = max 60% of blocks, moderate = 80%, intense = 100%.
 */
export function scheduleFlexibleTasks(
  flexTasks: CalendarTask[],
  availableBlocks: TimeBlock[],
  profile: UserProfile,
  date: string
): ScheduleResult {
  const intensityFactor = profile.scheduleIntensity === 'light' ? 0.6
    : profile.scheduleIntensity === 'moderate' ? 0.8 : 1.0;

  const scheduled: CalendarTask[] = [];
  const deferred: CalendarTask[] = [];

  // Work through blocks, filling with tasks
  const blocks = availableBlocks.map((b) => ({
    cursor: timeToMinutes(b.startTime),
    end: timeToMinutes(b.endTime),
    capacity: Math.floor(b.durationMinutes * intensityFactor),
    used: 0,
  }));

  let blockIdx = 0;

  for (const task of flexTasks) {
    const durationMin = Math.round(task.type === 'deadline' ? 30 : (
      // Use hours encoded in the title or fall back to type estimate
      estimateMinutes(task)
    ));

    let placed = false;
    while (blockIdx < blocks.length) {
      const block = blocks[blockIdx];
      const remaining = block.end - block.cursor;
      if (remaining >= durationMin && block.used + durationMin <= block.capacity) {
        const startTime = minutesToTime(block.cursor);
        const endTime = minutesToTime(block.cursor + durationMin);
        scheduled.push({ ...task, date, startTime, endTime, flex: 'flexible' });
        block.cursor += durationMin + 10; // 10 min break between flex tasks
        block.used += durationMin;
        placed = true;
        break;
      } else {
        blockIdx++;
      }
    }
    if (!placed) {
      deferred.push({ ...task, flex: 'flexible' });
    }
  }

  return { scheduled, deferred, overflow: deferred.length > 0 };
}

/**
 * Extends a flexible task's duration and reflows subsequent flexible tasks.
 */
export function extendTaskAndReflowDay(
  tasks: CalendarTask[],
  taskId: string,
  extraMinutes: number,
  profile: UserProfile
): CalendarTask[] {
  const task = tasks.find((t) => t.id === taskId);
  if (!task || isFixed(task)) return tasks;

  const date = task.date;
  const newEndMinutes = timeToMinutes(task.endTime) + extraMinutes;
  const newEndTime = minutesToTime(newEndMinutes);

  // Update the extended task
  const updated = tasks.map((t) =>
    t.id === taskId ? { ...t, endTime: newEndTime } : t
  );

  // Reflow: push flexible tasks that start after this task on the same day
  const sorted = [...updated]
    .filter((t) => t.date === date && !isFixed(t) && t.id !== taskId)
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

  let cursor = newEndMinutes + 10;
  const dayEnd = timeToMinutes(profile.preferredEndTime || '22:00');
  const reflowed = new Map<string, CalendarTask>();

  for (const t of sorted) {
    if (timeToMinutes(t.startTime) >= timeToMinutes(task.endTime)) {
      const duration = timeToMinutes(t.endTime) - timeToMinutes(t.startTime);
      if (cursor + duration <= dayEnd) {
        reflowed.set(t.id, { ...t, startTime: minutesToTime(cursor), endTime: minutesToTime(cursor + duration) });
        cursor += duration + 10;
      }
    }
  }

  return updated.map((t) => reflowed.get(t.id) ?? t);
}

/**
 * Detects overflow: tasks that don't fit in available hours.
 */
export function detectOverflow(
  tasks: CalendarTask[],
  date: string,
  profile: UserProfile
): { fits: CalendarTask[]; overflow: CalendarTask[] } {
  const dayStart = timeToMinutes(profile.preferredStartTime || '09:00');
  const dayEnd = timeToMinutes(profile.preferredEndTime || '22:00');
  const available = dayEnd - dayStart;
  const dayTasks = tasks.filter((t) => t.date === date);
  const total = dayTasks.reduce((sum, t) => sum + timeToMinutes(t.endTime) - timeToMinutes(t.startTime), 0);
  if (total <= available) return { fits: dayTasks, overflow: [] };
  // Mark overflow as the lowest priority flexible tasks that exceed capacity
  const fixed = dayTasks.filter(isFixed);
  const flex = dayTasks.filter((t) => !isFixed(t));
  let used = fixed.reduce((s, t) => s + timeToMinutes(t.endTime) - timeToMinutes(t.startTime), 0);
  const fits: CalendarTask[] = [...fixed];
  const overflow: CalendarTask[] = [];
  for (const t of flex) {
    const dur = timeToMinutes(t.endTime) - timeToMinutes(t.startTime);
    if (used + dur <= available) { fits.push(t); used += dur; }
    else overflow.push(t);
  }
  return { fits, overflow };
}

function estimateMinutes(task: CalendarTask): number {
  // Types map to typical durations in minutes
  const map: Record<string, number> = {
    internship_application: 240,
    company_research: 90,
    resume_update: 60,
    other: 60,
    free_time: 60,
  };
  return map[task.type] ?? 60;
}

/**
 * Reflows all flexible tasks on the calendar to respect updated profile preferences.
 * Fixed tasks are never moved. Flexible tasks are re-packed into available time blocks
 * for each day, in their original order (priority order).
 * Tasks that no longer fit are kept at their original time (conflict detection will flag them).
 */
export function reflowCalendar(tasks: CalendarTask[], profile: UserProfile): CalendarTask[] {
  const allDates = [...new Set(tasks.map((t) => t.date))];
  const result: CalendarTask[] = [];

  const BREAK = 10; // minutes between back-to-back flexible tasks

  for (const date of allDates) {
    const dayTasks = tasks.filter((t) => t.date === date);
    const fixed = dayTasks.filter(isFixed);
    const flexible = dayTasks.filter((t) => !isFixed(t));

    // Fixed tasks are anchored — keep exactly as-is
    result.push(...fixed);

    if (flexible.length === 0) continue;

    // Skip days the user doesn't want scheduled
    const dayName = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
    if (profile.doNotScheduleDays?.includes(dayName)) {
      result.push(...flexible); // leave them but they'll show as conflicts
      continue;
    }

    const blocks = getAvailableTimeBlocks(fixed, profile, date);

    if (blocks.length === 0) {
      // No open time — leave tasks at original time
      result.push(...flexible);
      continue;
    }

    let bIdx = 0;
    let cursor = timeToMinutes(blocks[0].startTime);
    let blockEnd = timeToMinutes(blocks[0].endTime);

    for (const task of flexible) {
      const duration = timeToMinutes(task.endTime) - timeToMinutes(task.startTime);
      const taskDur = duration > 0 ? duration : estimateMinutes(task);

      // Advance to a block that can fit this task
      while (bIdx < blocks.length && blockEnd - cursor < taskDur) {
        bIdx++;
        if (bIdx < blocks.length) {
          cursor = timeToMinutes(blocks[bIdx].startTime);
          blockEnd = timeToMinutes(blocks[bIdx].endTime);
        }
      }

      if (bIdx < blocks.length) {
        result.push({
          ...task,
          startTime: minutesToTime(cursor),
          endTime: minutesToTime(cursor + taskDur),
        });
        cursor += taskDur + BREAK;
      } else {
        // Day is full — keep original position (will appear as overflow)
        result.push(task);
      }
    }
  }

  return result;
}
