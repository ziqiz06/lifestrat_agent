import { CalendarTask, UserProfile, TimeBlock, ScheduleResult, TaskStatus, ScheduleBlock } from '@/types';

export interface BlockedInterval {
  start: number; // minutes from midnight
  end: number;
  label: string; // human-readable, e.g. "lunch time", "sleep time", "Gym"
}

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
 * Returns whether a ScheduleBlock applies to a given date based on its recurrence.
 */
export function scheduleBlockAppliesToDate(block: ScheduleBlock, date: string): boolean {
  const d = new Date(date + 'T00:00:00');
  const dow = d.getDay(); // 0=Sun … 6=Sat
  switch (block.recurrence) {
    case 'none': return block.date === date;
    case 'daily': return true;
    case 'weekly': {
      if (!block.date) return false;
      return new Date(block.date + 'T00:00:00').getDay() === dow;
    }
    case 'weekdays': return dow >= 1 && dow <= 5;
    case 'weekends': return dow === 0 || dow === 6;
  }
}

/**
 * Returns all blocked intervals for a given date from the user's profile.
 * Includes sleep, meals, and all schedule blocks that apply to that date.
 */
export function getBlockedIntervalsForDay(profile: UserProfile, date: string): BlockedInterval[] {
  const intervals: BlockedInterval[] = [];

  if (profile.wakeTime) {
    intervals.push({ start: 0, end: timeToMinutes(profile.wakeTime), label: 'sleep time' });
  }
  if (profile.sleepTime) {
    intervals.push({ start: timeToMinutes(profile.sleepTime), end: 24 * 60, label: 'sleep time' });
  }
  if (profile.breakfastTime && (profile.breakfastDurationMinutes ?? 0) > 0) {
    const s = timeToMinutes(profile.breakfastTime);
    intervals.push({ start: s, end: s + profile.breakfastDurationMinutes, label: 'breakfast time' });
  }
  if (profile.lunchStart && (profile.lunchDurationMinutes ?? 0) > 0) {
    const s = timeToMinutes(profile.lunchStart);
    intervals.push({ start: s, end: s + profile.lunchDurationMinutes, label: 'lunch time' });
  }
  if (profile.dinnerTime && (profile.dinnerDurationMinutes ?? 0) > 0) {
    const s = timeToMinutes(profile.dinnerTime);
    intervals.push({ start: s, end: s + profile.dinnerDurationMinutes, label: 'dinner time' });
  }
  for (const block of profile.scheduleBlocks ?? []) {
    if (scheduleBlockAppliesToDate(block, date)) {
      intervals.push({
        start: timeToMinutes(block.startTime),
        end: timeToMinutes(block.endTime),
        label: block.name,
      });
    }
  }

  return intervals;
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

  // Add lifestyle blocks from profile
  if (profile.breakfastTime && profile.breakfastDurationMinutes > 0) {
    const s = timeToMinutes(profile.breakfastTime);
    blocked.push({ start: s, end: s + profile.breakfastDurationMinutes });
  }
  if (profile.lunchStart && profile.lunchDurationMinutes > 0) {
    const s = timeToMinutes(profile.lunchStart);
    blocked.push({ start: s, end: s + profile.lunchDurationMinutes });
  }
  if (profile.dinnerTime && profile.dinnerDurationMinutes > 0) {
    const s = timeToMinutes(profile.dinnerTime);
    blocked.push({ start: s, end: s + profile.dinnerDurationMinutes });
  }

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

// Workload budget in minutes per intensity level
const WORKLOAD_MINUTES: Record<string, number> = {
  light: 4 * 60,
  moderate: 6 * 60,
  heavy: 8 * 60,
  insane: 16 * 60,
};

const BUFFER_BETWEEN = 10; // minutes between flex tasks
const MIN_SLOT = 20;       // smallest slot worth placing a task into

/**
 * Schedules flexible tasks into available time blocks following strict rules:
 * - Tasks sorted by urgency (deadline) then priority
 * - Sequential stacking, prefer contiguous blocks
 * - Split tasks across blocks only when needed, label continuations "(continued)"
 * - Hard workload budget; overflow tasks marked 'deferred'
 * - Same-day deadline tasks that exceed budget marked 'needs_confirmation'
 * - Status label attached to every output task
 */
export function scheduleFlexibleTasks(
  flexTasks: CalendarTask[],
  availableBlocks: TimeBlock[],
  profile: UserProfile,
  date: string
): ScheduleResult {
  const budgetMinutes = WORKLOAD_MINUTES[profile.scheduleIntensity] ?? 6 * 60;

  const scheduled: CalendarTask[] = [];
  const deferred: CalendarTask[] = [];
  let usedMinutes = 0;

  // Mutable cursors for each block
  const slots = availableBlocks.map((b) => ({
    cursor: timeToMinutes(b.startTime),
    end: timeToMinutes(b.endTime),
  }));

  for (const task of flexTasks) {
    const totalDuration = estimateMinutes(task);
    const isDueToday = task.date === date;
    const withinBudget = usedMinutes + totalDuration <= budgetMinutes;

    // If this task would exceed budget and is not due today, defer it
    if (!withinBudget && !isDueToday) {
      deferred.push({
        ...task,
        flex: 'flexible',
        status: 'deferred' as TaskStatus,
      });
      continue;
    }

    // Try to place the task, splitting across slots if necessary
    let remaining = totalDuration;
    let blockIndex = -1; // first slot index used for this task
    const placedBlocks: CalendarTask[] = [];

    for (let si = 0; si < slots.length && remaining > 0; si++) {
      const slot = slots[si];
      const available = slot.end - slot.cursor;
      if (available < MIN_SLOT) continue;

      const chunk = Math.min(remaining, available);
      const startTime = minutesToTime(slot.cursor);
      const endTime = minutesToTime(slot.cursor + chunk);
      const isContinuation = placedBlocks.length > 0;
      const title = isContinuation ? `${task.title} (continued)` : task.title;
      const status: TaskStatus = (!withinBudget && isDueToday) ? 'needs_confirmation' : 'confirmed';

      placedBlocks.push({
        ...task,
        id: isContinuation ? `${task.id}-cont-${si}` : task.id,
        title,
        date,
        startTime,
        endTime,
        flex: 'flexible',
        status,
        splitGroup: totalDuration > chunk ? task.id : undefined,
        confirmed: status === 'needs_confirmation' ? false : task.confirmed,
      });

      if (blockIndex === -1) blockIndex = si;
      slot.cursor += chunk + BUFFER_BETWEEN;
      remaining -= chunk;
    }

    if (placedBlocks.length > 0) {
      // Annotate total scheduled minutes across all blocks
      const scheduledMins = totalDuration - remaining;
      const annotated = placedBlocks.map((b) => ({
        ...b,
        totalScheduledMinutes: scheduledMins,
      }));
      scheduled.push(...annotated);
      usedMinutes += scheduledMins;

      // If still has remaining (task too large for all free space)
      if (remaining > 0) {
        deferred.push({
          ...task,
          flex: 'flexible',
          status: 'unscheduled' as TaskStatus,
          title: `${task.title} (${Math.round(remaining / 60 * 10) / 10}h remaining)`,
        });
      }
    } else {
      // No slot fit at all
      const status: TaskStatus = isDueToday ? 'needs_confirmation' : 'deferred';
      deferred.push({ ...task, flex: 'flexible', status });
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
