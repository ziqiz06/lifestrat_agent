/**
 * test-plan-repair.ts
 * ────────────────────
 * Tests for the AI Plan violation detection logic (local constraint checking).
 * Run with:  npx ts-node scripts/test-plan-repair.ts
 *
 * These tests validate that computeViolations() correctly flags:
 *   1. flexible tasks scheduled after their deadline
 *   2. flexible tasks overlapping a fixed event
 *   3. flexible tasks placed in blocked time
 *   4. multiple simultaneous violations
 *   5. valid placements produce no violations
 */

// ── Inline types ──────────────────────────────────────────────────────────────

interface CalendarTask {
  id: string;
  title: string;
  type: string;
  flex?: string;
  startTime: string;
  endTime: string;
  date: string;
  color: string;
  confirmed?: boolean;
}

interface UserProfile {
  preferredStartTime: string;
  preferredEndTime: string;
  wakeTime: string;
  sleepTime: string;
  breakfastTime: string;
  breakfastDurationMinutes: number;
  lunchStart: string;
  lunchDurationMinutes: number;
  dinnerTime: string;
  dinnerDurationMinutes: number;
  scheduleBlocks: Array<{ id: string; name: string; startTime: string; endTime: string; recurrence: string; date?: string }>;
}

// ── Inline helpers ────────────────────────────────────────────────────────────

function toMins(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(Math.min(h, 23)).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

const FIXED_TYPES = new Set(['career_fair', 'class', 'workshop', 'networking', 'deadline', 'entertainment', 'free_time']);
function isFixed(t: CalendarTask): boolean {
  return t.flex === 'fixed' || FIXED_TYPES.has(t.type);
}

function getFixedEventsForDay(tasks: CalendarTask[], date: string): CalendarTask[] {
  return tasks.filter(t => t.date === date && isFixed(t))
    .sort((a, b) => toMins(a.startTime) - toMins(b.startTime));
}

interface BlockedInterval { start: number; end: number; label: string; }

function getBlockedIntervalsForDay(profile: UserProfile, date: string): BlockedInterval[] {
  const intervals: BlockedInterval[] = [];
  if (profile.wakeTime) intervals.push({ start: 0, end: toMins(profile.wakeTime), label: 'sleep time' });
  if (profile.sleepTime) intervals.push({ start: toMins(profile.sleepTime), end: 24 * 60, label: 'sleep time' });
  if (profile.breakfastTime && profile.breakfastDurationMinutes > 0) {
    const s = toMins(profile.breakfastTime);
    intervals.push({ start: s, end: s + profile.breakfastDurationMinutes, label: 'breakfast time' });
  }
  if (profile.lunchStart && profile.lunchDurationMinutes > 0) {
    const s = toMins(profile.lunchStart);
    intervals.push({ start: s, end: s + profile.lunchDurationMinutes, label: 'lunch time' });
  }
  if (profile.dinnerTime && profile.dinnerDurationMinutes > 0) {
    const s = toMins(profile.dinnerTime);
    intervals.push({ start: s, end: s + profile.dinnerDurationMinutes, label: 'dinner time' });
  }
  void date; // schedule blocks with recurrence would check date — simplified here
  return intervals;
}

// ── The function under test (mirrors what aiPlanCalendar does) ─────────────────

function computeViolations(
  t: CalendarTask,
  deadline: string | null,
  dueAt: string | undefined,
  profile: UserProfile,
  allTasks: CalendarTask[],
): string[] {
  const violations: string[] = [];
  const taskStartM = toMins(t.startTime);
  const taskEndM   = toMins(t.endTime);

  // 1. After-deadline check
  if (deadline) {
    if (t.date > deadline) {
      violations.push(`after_deadline (placed ${t.date} but deadline is ${deadline})`);
    } else if (t.date === deadline && dueAt && taskEndM > toMins(dueAt)) {
      violations.push(`after_deadline (ends ${t.endTime} but dueAt is ${dueAt})`);
    }
  }

  // 2. Overlap with fixed events on the same day
  const fixedOnDay = getFixedEventsForDay(allTasks, t.date);
  for (const f of fixedOnDay) {
    const fStart = toMins(f.startTime);
    const fEnd   = toMins(f.endTime);
    if (fStart < taskEndM && fEnd > taskStartM) {
      violations.push(`overlaps_fixed_event "${f.title}" (${f.startTime}–${f.endTime})`);
    }
  }

  // 3. Overlap with blocked intervals
  const blocked = getBlockedIntervalsForDay(profile, t.date);
  for (const b of blocked) {
    if (b.start < taskEndM && b.end > taskStartM) {
      violations.push(`in_blocked_time "${b.label}" (${minutesToTime(b.start)}–${minutesToTime(b.end)})`);
      break;
    }
  }

  return violations;
}

// ── Test fixtures ─────────────────────────────────────────────────────────────

const DEFAULT_PROFILE: UserProfile = {
  preferredStartTime: '09:00',
  preferredEndTime: '22:00',
  wakeTime: '07:30',
  sleepTime: '23:00',
  breakfastTime: '07:30',
  breakfastDurationMinutes: 30,
  lunchStart: '12:00',
  lunchDurationMinutes: 60,
  dinnerTime: '18:30',
  dinnerDurationMinutes: 60,
  scheduleBlocks: [],
};

const WICS_WORKSHOP: CalendarTask = {
  id: 'wics-workshop',
  title: 'WiCS LinkedIn Workshop',
  type: 'workshop',   // fixed type
  flex: 'fixed',
  startTime: '18:00',
  endTime: '21:00',
  date: '2026-04-03',
  color: '#6366f1',
  confirmed: true,
};

function makeFlexTask(overrides: Partial<CalendarTask> & { date: string; startTime: string; endTime: string }): CalendarTask {
  return {
    id: 'humic-task',
    title: 'HUMIC Resume Book 2026',
    type: 'internship_application',
    flex: 'flexible',
    color: '#10b981',
    confirmed: true,
    ...overrides,
  };
}

// ── Test harness ──────────────────────────────────────────────────────────────

let passed = 0;
let total  = 0;

function test(label: string, fn: () => boolean) {
  total++;
  let ok = false;
  try { ok = fn(); } catch (e) { console.error(`  error in "${label}": ${e}`); }
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  if (ok) passed++;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

// 1. Valid placement — no violations
test('valid placement: no violations', () => {
  const task = makeFlexTask({ date: '2026-03-31', startTime: '10:00', endTime: '12:00' });
  const v = computeViolations(task, '2026-04-01', undefined, DEFAULT_PROFILE, []);
  return v.length === 0;
});

// 2. Task placed after deadline date
test('after_deadline: task date is after deadline', () => {
  const task = makeFlexTask({ date: '2026-04-03', startTime: '18:00', endTime: '20:00' });
  const v = computeViolations(task, '2026-04-01', undefined, DEFAULT_PROFILE, []);
  return v.some(s => s.startsWith('after_deadline'));
});

// 3. Task on deadline day but ends after dueAt time
test('after_deadline: ends after dueAt on deadline day', () => {
  const task = makeFlexTask({ date: '2026-04-01', startTime: '22:00', endTime: '23:59' });
  const v = computeViolations(task, '2026-04-01', '23:00', DEFAULT_PROFILE, []);
  return v.some(s => s.startsWith('after_deadline') && s.includes('dueAt'));
});

// 4. Task on deadline day ending before dueAt — valid
test('no violation: ends before dueAt on deadline day', () => {
  const task = makeFlexTask({ date: '2026-04-01', startTime: '10:00', endTime: '12:00' });
  const v = computeViolations(task, '2026-04-01', '23:59', DEFAULT_PROFILE, []);
  return !v.some(s => s.startsWith('after_deadline'));
});

// 5. Task overlaps a fixed event on the same day
test('overlaps_fixed_event: task overlaps WiCS workshop', () => {
  const task = makeFlexTask({ date: '2026-04-03', startTime: '18:00', endTime: '20:00' });
  const v = computeViolations(task, '2026-04-01', undefined, DEFAULT_PROFILE, [WICS_WORKSHOP]);
  return v.some(s => s.startsWith('overlaps_fixed_event') && s.includes('WiCS'));
});

// 6. Task does not overlap — different day
test('no violation: task on different day from fixed event', () => {
  const task = makeFlexTask({ date: '2026-04-01', startTime: '18:00', endTime: '20:00' });
  const v = computeViolations(task, '2026-04-01', undefined, DEFAULT_PROFILE, [WICS_WORKSHOP]);
  return !v.some(s => s.startsWith('overlaps_fixed_event'));
});

// 7. Task adjacent to fixed event (ends exactly when fixed starts) — no overlap
test('no overlap: task ends exactly when fixed event starts', () => {
  const task = makeFlexTask({ date: '2026-04-03', startTime: '16:00', endTime: '18:00' });
  const v = computeViolations(task, '2026-04-04', undefined, DEFAULT_PROFILE, [WICS_WORKSHOP]);
  return !v.some(s => s.startsWith('overlaps_fixed_event'));
});

// 8. Task in blocked time (dinner)
test('in_blocked_time: task during dinner window', () => {
  const task = makeFlexTask({ date: '2026-04-01', startTime: '18:30', endTime: '19:30' });
  const v = computeViolations(task, '2026-04-01', undefined, DEFAULT_PROFILE, []);
  return v.some(s => s.startsWith('in_blocked_time') && s.includes('dinner'));
});

// 9. Task during sleep
test('in_blocked_time: task during sleep', () => {
  const task = makeFlexTask({ date: '2026-04-01', startTime: '06:00', endTime: '07:00' });
  const v = computeViolations(task, '2026-04-01', undefined, DEFAULT_PROFILE, []);
  return v.some(s => s.startsWith('in_blocked_time') && s.includes('sleep'));
});

// 10. The exact HUMIC bug: after deadline AND overlaps fixed event
test('dual violation: after_deadline AND overlaps_fixed_event (HUMIC bug)', () => {
  const task = makeFlexTask({ date: '2026-04-03', startTime: '18:00', endTime: '20:00' });
  const v = computeViolations(task, '2026-04-01', '23:59', DEFAULT_PROFILE, [WICS_WORKSHOP]);
  return (
    v.some(s => s.startsWith('after_deadline')) &&
    v.some(s => s.startsWith('overlaps_fixed_event'))
  );
});

// 11. Task scheduled exactly on deadline — not a violation
test('no violation: task on deadline day', () => {
  const task = makeFlexTask({ date: '2026-04-01', startTime: '09:00', endTime: '11:00' });
  const v = computeViolations(task, '2026-04-01', '23:59', DEFAULT_PROFILE, []);
  return !v.some(s => s.startsWith('after_deadline'));
});

// 12. Task scheduled one day before deadline — valid
test('no violation: task one day before deadline', () => {
  const task = makeFlexTask({ date: '2026-03-31', startTime: '14:00', endTime: '16:00' });
  const v = computeViolations(task, '2026-04-01', undefined, DEFAULT_PROFILE, []);
  return v.length === 0;
});

// 13. Fixed event is not flagged as overlapping itself (should not appear in fixed set when checking flex)
test('fixed event itself: isFixed returns true for workshop type', () => {
  return isFixed(WICS_WORKSHOP);
});

// 14. Flexible task: isFixed returns false for internship_application flex
test('flex task: isFixed returns false for internship_application with flex=flexible', () => {
  const task = makeFlexTask({ date: '2026-04-01', startTime: '09:00', endTime: '11:00' });
  return !isFixed(task);
});

// 15. Task partially overlapping fixed event (starts before, ends during)
test('overlaps_fixed_event: starts before fixed event but ends inside it', () => {
  const task = makeFlexTask({ date: '2026-04-03', startTime: '17:00', endTime: '19:00' });
  const v = computeViolations(task, '2026-04-04', undefined, DEFAULT_PROFILE, [WICS_WORKSHOP]);
  return v.some(s => s.startsWith('overlaps_fixed_event'));
});

// 16. Task completely surrounding fixed event (starts before, ends after)
test('overlaps_fixed_event: task surrounds fixed event entirely', () => {
  const task = makeFlexTask({ date: '2026-04-03', startTime: '17:00', endTime: '22:00' });
  const v = computeViolations(task, '2026-04-04', undefined, DEFAULT_PROFILE, [WICS_WORKSHOP]);
  return v.some(s => s.startsWith('overlaps_fixed_event'));
});

// 17. No deadline (null) — no after_deadline violation possible
test('no violation: null deadline never triggers after_deadline', () => {
  const task = makeFlexTask({ date: '2099-12-31', startTime: '10:00', endTime: '11:00' });
  const v = computeViolations(task, null, undefined, DEFAULT_PROFILE, []);
  return !v.some(s => s.startsWith('after_deadline'));
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${passed}/${total} tests passed`);
process.exit(passed === total ? 0 : 1);
