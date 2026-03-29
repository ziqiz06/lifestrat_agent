/**
 * test-ai-plan-writeback.ts
 * ─────────────────────────
 * End-to-end test for the AI Plan repair pipeline.
 * Does NOT call the real AI model — it owns the mock AI response so we can
 * verify the full path: violation detection → payload → writeback → calendar state.
 *
 * Run with:
 *   npx ts-node --skip-project --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' scripts/test-ai-plan-writeback.ts
 *
 * Tests prove:
 *  1. A flexible task after its deadline and overlapping a fixed event IS flagged
 *     with correct violation strings in the payload.
 *  2. Given a valid AI repair response, the writeback moves HUMIC to the new slot.
 *  3. Original properties (confirmed, opportunityId, completionStatus) survive writeback.
 *  4. A task the AI silently omits is RETAINED in place (not dropped).
 *  5. Fixed tasks are never touched by the writeback.
 */

// ── Inline types ──────────────────────────────────────────────────────────────

type TaskFlex = 'fixed' | 'flexible';

interface CalendarTask {
  id: string;
  title: string;
  type: string;
  flex?: TaskFlex;
  startTime: string;
  endTime: string;
  date: string;
  color: string;
  confirmed?: boolean;
  opportunityId?: string;
  completionStatus?: string;
  xpAwarded?: boolean;
  status?: string;
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
  scheduleBlocks: unknown[];
}

interface Opportunity {
  id: string;
  deadline: string | null;
  dueAt?: string;
}

// ── Inline helpers (mirrors src/lib/dayPlanner.ts) ────────────────────────────

const FIXED_TYPES = new Set([
  'career_fair', 'class', 'workshop', 'networking', 'deadline', 'entertainment', 'free_time',
]);

function isFixed(t: CalendarTask): boolean {
  return t.flex === 'fixed' || FIXED_TYPES.has(t.type);
}

function toMins(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(Math.min(h, 23)).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function getFixedEventsForDay(tasks: CalendarTask[], date: string): CalendarTask[] {
  return tasks.filter(t => t.date === date && isFixed(t));
}

interface BlockedInterval { start: number; end: number; label: string; }

function getBlockedIntervalsForDay(profile: UserProfile, _date: string): BlockedInterval[] {
  const intervals: BlockedInterval[] = [];
  if (profile.wakeTime)    intervals.push({ start: 0,                      end: toMins(profile.wakeTime),  label: 'sleep time' });
  if (profile.sleepTime)   intervals.push({ start: toMins(profile.sleepTime), end: 24 * 60,                label: 'sleep time' });
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
  return intervals;
}

// ── Violation detection (mirrors aiPlanCalendar inline function) ──────────────

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

  if (deadline) {
    if (t.date > deadline) {
      violations.push(`after_deadline (placed ${t.date} but deadline is ${deadline})`);
    } else if (t.date === deadline && dueAt && taskEndM > toMins(dueAt)) {
      violations.push(`after_deadline (ends ${t.endTime} but dueAt is ${dueAt})`);
    }
  }

  for (const f of getFixedEventsForDay(allTasks, t.date)) {
    if (toMins(f.startTime) < taskEndM && toMins(f.endTime) > taskStartM) {
      violations.push(`overlaps_fixed_event "${f.title}" (${f.startTime}–${f.endTime})`);
    }
  }

  for (const b of getBlockedIntervalsForDay(profile, t.date)) {
    if (b.start < taskEndM && b.end > taskStartM) {
      violations.push(`in_blocked_time "${b.label}" (${minutesToTime(b.start)}–${minutesToTime(b.end)})`);
      break;
    }
  }

  return violations;
}

// ── Writeback logic (mirrors the fixed aiPlanCalendar store action) ───────────

interface AITask {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  type: string;
  flex: string;
  status: string;
  color: string;
  opportunityId?: string;
}

interface AIPlan {
  scheduledTasks: AITask[];
  unscheduled?: Array<{ id: string; title: string; reason: string }>;
  warnings?: string[];
  summary?: string;
}

function applyAIPlanWriteback(
  calendarTasks: CalendarTask[],
  plan: AIPlan,
): CalendarTask[] {
  const fixed = calendarTasks.filter(t => isFixed(t));

  const originalFlexMap = new Map(
    calendarTasks.filter(t => !isFixed(t)).map(t => [t.id, t]),
  );

  const plannedIds = new Set<string>();
  const mergedFlexTasks: CalendarTask[] = plan.scheduledTasks.map((aiTask) => {
    plannedIds.add(aiTask.id);
    const original = originalFlexMap.get(aiTask.id);
    return {
      ...(original ?? {}),
      ...aiTask,
      confirmed:        original?.confirmed        ?? false,
      opportunityId:    original?.opportunityId    ?? aiTask.opportunityId,
      completionStatus: original?.completionStatus,
      xpAwarded:        original?.xpAwarded,
    } as CalendarTask;
  });

  // Safety net: retain tasks the AI silently omitted
  const retainedFlexTasks = calendarTasks.filter(
    t => !isFixed(t) && !plannedIds.has(t.id),
  );

  return [...fixed, ...mergedFlexTasks, ...retainedFlexTasks];
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

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

const HUMIC_OPP: Opportunity = {
  id: 'opp-humic',
  deadline: '2026-04-01',
  dueAt: '23:59',
};

// HUMIC manually dragged to April 3 18:00-20:00 (invalid: after deadline + overlaps WiCS)
const HUMIC_TASK: CalendarTask = {
  id: 'opp-task-opp-humic',
  title: 'HUMIC Resume Book 2026',
  type: 'internship_application',
  flex: 'flexible',
  startTime: '18:00',
  endTime:   '20:00',
  date:      '2026-04-03',
  color:     '#10b981',
  confirmed:        true,
  opportunityId:    'opp-humic',
  completionStatus: 'scheduled' as CalendarTask['completionStatus'],
  xpAwarded:        false,
};

// WiCS LinkedIn Workshop — fixed, same day as HUMIC's bad placement
const WICS_TASK: CalendarTask = {
  id: 'wics-workshop',
  title: 'WiCS LinkedIn Workshop',
  type: 'workshop',
  flex: 'fixed',
  startTime: '18:00',
  endTime:   '21:00',
  date:      '2026-04-03',
  color:     '#6366f1',
  confirmed: true,
};

// A second flexible task that the AI will omit from its response (to test safety net)
const OTHER_FLEX_TASK: CalendarTask = {
  id: 'other-flex-1',
  title: 'Resume Update',
  type: 'other',
  flex: 'flexible',
  startTime: '10:00',
  endTime:   '11:00',
  date:      '2026-03-30',
  color:     '#8b5cf6',
  confirmed: true,
  opportunityId: 'opp-resume',
};

const ALL_TASKS = [HUMIC_TASK, WICS_TASK, OTHER_FLEX_TASK];

// AI response: HUMIC correctly moved to March 31, 10:00-12:00
const VALID_REPAIR_RESPONSE: AIPlan = {
  scheduledTasks: [
    {
      id:        'opp-task-opp-humic',
      title:     'HUMIC Resume Book 2026',
      date:      '2026-03-31',
      startTime: '10:00',
      endTime:   '12:00',
      type:      'internship_application',
      flex:      'flexible',
      status:    'confirmed',
      color:     '#10b981',
      // Note: AI does NOT return opportunityId — tests that writeback preserves it
    },
  ],
  warnings: ["Repaired: moved 'HUMIC Resume Book 2026' from 2026-04-03 18:00–20:00 to 2026-03-31 10:00–12:00 — reason: after_deadline; overlaps_fixed_event"],
  summary:  'HUMIC moved before its April 1 deadline. WiCS workshop unchanged.',
};

// AI response: model silently omits HUMIC (should trigger safety net)
const OMIT_HUMIC_RESPONSE: AIPlan = {
  scheduledTasks: [
    // HUMIC not included — safety net should retain it at its current position
    {
      id:        'other-flex-1',
      title:     'Resume Update',
      date:      '2026-03-30',
      startTime: '10:00',
      endTime:   '11:00',
      type:      'other',
      flex:      'flexible',
      status:    'confirmed',
      color:     '#8b5cf6',
    },
  ],
  summary: 'Scheduled Resume Update. HUMIC omitted.',
};

// ── Test harness ──────────────────────────────────────────────────────────────

let passed = 0;
let total  = 0;

function test(label: string, fn: () => boolean) {
  total++;
  let ok = false;
  try { ok = fn(); } catch (e) { console.error(`  ERROR in "${label}": ${e}`); }
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  if (ok) passed++;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

// ── Section A: Violation detection confirms payload is correct ────────────────

test('violation detection: HUMIC flagged as after_deadline', () => {
  const v = computeViolations(HUMIC_TASK, HUMIC_OPP.deadline, HUMIC_OPP.dueAt, DEFAULT_PROFILE, ALL_TASKS);
  return v.some(s => s.startsWith('after_deadline'));
});

test('violation detection: HUMIC flagged as overlapping WiCS', () => {
  const v = computeViolations(HUMIC_TASK, HUMIC_OPP.deadline, HUMIC_OPP.dueAt, DEFAULT_PROFILE, ALL_TASKS);
  return v.some(s => s.startsWith('overlaps_fixed_event') && s.includes('WiCS'));
});

test('violation detection: at least 2 violations (after_deadline + overlaps_fixed_event)', () => {
  const v = computeViolations(HUMIC_TASK, HUMIC_OPP.deadline, HUMIC_OPP.dueAt, DEFAULT_PROFILE, ALL_TASKS);
  // Also hits in_blocked_time (dinner 18:30–19:30), so total ≥ 2
  console.log(`  violations: ${v.join(' | ')}`);
  return v.length >= 2
    && v.some(s => s.startsWith('after_deadline'))
    && v.some(s => s.startsWith('overlaps_fixed_event'));
});

test('violation detection: no deadline = null → no after_deadline violation', () => {
  const v = computeViolations(HUMIC_TASK, null, undefined, DEFAULT_PROFILE, ALL_TASKS);
  return !v.some(s => s.startsWith('after_deadline'));
});

// ── Section B: Writeback moves HUMIC to repaired slot ────────────────────────

test('writeback: HUMIC moves to repaired date (2026-03-31)', () => {
  const result = applyAIPlanWriteback(ALL_TASKS, VALID_REPAIR_RESPONSE);
  const humic = result.find(t => t.id === 'opp-task-opp-humic');
  console.log(`  HUMIC after writeback: ${humic?.date} ${humic?.startTime}–${humic?.endTime}`);
  return humic?.date === '2026-03-31';
});

test('writeback: HUMIC repaired startTime is 10:00', () => {
  const result = applyAIPlanWriteback(ALL_TASKS, VALID_REPAIR_RESPONSE);
  const humic = result.find(t => t.id === 'opp-task-opp-humic');
  return humic?.startTime === '10:00';
});

test('writeback: repaired HUMIC is before its deadline (2026-04-01)', () => {
  const result = applyAIPlanWriteback(ALL_TASKS, VALID_REPAIR_RESPONSE);
  const humic = result.find(t => t.id === 'opp-task-opp-humic');
  return !!humic && humic.date <= '2026-04-01';
});

test('writeback: repaired HUMIC does not overlap WiCS (different date)', () => {
  const result = applyAIPlanWriteback(ALL_TASKS, VALID_REPAIR_RESPONSE);
  const humic = result.find(t => t.id === 'opp-task-opp-humic');
  return !!humic && humic.date !== '2026-04-03';
});

// ── Section C: Original properties survive writeback ─────────────────────────

test('writeback: confirmed=true preserved on HUMIC after repair', () => {
  const result = applyAIPlanWriteback(ALL_TASKS, VALID_REPAIR_RESPONSE);
  const humic = result.find(t => t.id === 'opp-task-opp-humic');
  console.log(`  HUMIC confirmed: ${humic?.confirmed}`);
  return humic?.confirmed === true;
});

test('writeback: opportunityId preserved on HUMIC after repair', () => {
  const result = applyAIPlanWriteback(ALL_TASKS, VALID_REPAIR_RESPONSE);
  const humic = result.find(t => t.id === 'opp-task-opp-humic');
  console.log(`  HUMIC opportunityId: ${humic?.opportunityId}`);
  return humic?.opportunityId === 'opp-humic';
});

test('writeback: completionStatus preserved on HUMIC after repair', () => {
  const result = applyAIPlanWriteback(ALL_TASKS, VALID_REPAIR_RESPONSE);
  const humic = result.find(t => t.id === 'opp-task-opp-humic');
  return humic?.completionStatus === 'scheduled';
});

test('writeback: xpAwarded preserved (false) on HUMIC after repair', () => {
  const result = applyAIPlanWriteback(ALL_TASKS, VALID_REPAIR_RESPONSE);
  const humic = result.find(t => t.id === 'opp-task-opp-humic');
  return humic?.xpAwarded === false;
});

// ── Section D: Fixed tasks are never touched ──────────────────────────────────

test('writeback: WiCS workshop still at April 3 18:00 (unchanged)', () => {
  const result = applyAIPlanWriteback(ALL_TASKS, VALID_REPAIR_RESPONSE);
  const wics = result.find(t => t.id === 'wics-workshop');
  return wics?.date === '2026-04-03' && wics?.startTime === '18:00';
});

test('writeback: WiCS still present in result', () => {
  const result = applyAIPlanWriteback(ALL_TASKS, VALID_REPAIR_RESPONSE);
  return result.some(t => t.id === 'wics-workshop');
});

// ── Section E: Safety net — AI-omitted tasks are retained, not dropped ────────

test('safety net: task omitted by AI is retained at original position', () => {
  // In OMIT_HUMIC_RESPONSE, the AI only returns OTHER_FLEX_TASK; HUMIC is missing.
  const result = applyAIPlanWriteback(ALL_TASKS, OMIT_HUMIC_RESPONSE);
  const humic = result.find(t => t.id === 'opp-task-opp-humic');
  console.log(`  HUMIC retained at: ${humic?.date} ${humic?.startTime}–${humic?.endTime}`);
  // HUMIC must be present (retained), still at April 3 (its unchanged position)
  return !!humic && humic.date === '2026-04-03';
});

test('safety net: retained HUMIC still has opportunityId for next violation scan', () => {
  const result = applyAIPlanWriteback(ALL_TASKS, OMIT_HUMIC_RESPONSE);
  const humic = result.find(t => t.id === 'opp-task-opp-humic');
  return humic?.opportunityId === 'opp-humic';
});

test('safety net: task returned by AI still gets AI-assigned position', () => {
  const result = applyAIPlanWriteback(ALL_TASKS, OMIT_HUMIC_RESPONSE);
  const other = result.find(t => t.id === 'other-flex-1');
  return other?.date === '2026-03-30';
});

// ── Section F: Violation scan AFTER repair verifies HUMIC is now clean ────────

test('post-repair: repaired HUMIC has no violations in new slot', () => {
  const result = applyAIPlanWriteback(ALL_TASKS, VALID_REPAIR_RESPONSE);
  const humic = result.find(t => t.id === 'opp-task-opp-humic');
  if (!humic) return false;
  const v = computeViolations(humic, HUMIC_OPP.deadline, HUMIC_OPP.dueAt, DEFAULT_PROFILE, result);
  console.log(`  Post-repair violations: ${v.length > 0 ? v.join('; ') : 'none'}`);
  return v.length === 0;
});

test('post-repair: HUMIC date is before deadline (no after_deadline)', () => {
  const result = applyAIPlanWriteback(ALL_TASKS, VALID_REPAIR_RESPONSE);
  const humic = result.find(t => t.id === 'opp-task-opp-humic');
  return !!humic && humic.date < '2026-04-01';
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${passed}/${total} tests passed`);
process.exit(passed === total ? 0 : 1);
