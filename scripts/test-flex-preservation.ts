/**
 * test-flex-preservation.ts
 * ─────────────────────────
 * Tests that flexible tasks remain flexible after scheduling,
 * conflict override lifecycle, and description updates.
 * Run with:  npx ts-node scripts/test-flex-preservation.ts
 */

// ── Inline types ──────────────────────────────────────────────────────────────

type TaskFlex   = 'fixed' | 'flexible';
type TaskStatus = 'confirmed' | 'proposed' | 'confirmed_with_override' | string;

interface CalendarTask {
  id: string; title: string; type: string;
  flex?: TaskFlex; startTime: string; endTime: string; date: string; color: string;
  confirmed?: boolean; status?: TaskStatus;
  description?: string; conflictOverride?: boolean;
  recurrence?: { frequency: string };
}

// ── Helpers mirroring store logic ─────────────────────────────────────────────

function scheduleOpportunity(opp: {
  flexibility: 'fixed' | 'flexible'; startTime?: string; eventTime?: string; confirmed?: boolean;
}): CalendarTask {
  const isFixed = opp.flexibility === 'fixed';
  const startTime = isFixed ? (opp.eventTime ?? opp.startTime ?? '09:00') : (opp.startTime ?? '09:00');
  return {
    id: 'opp-task-test', title: 'Test Task', type: 'other',
    flex: isFixed ? 'fixed' : 'flexible',
    startTime, endTime: '11:00', date: '2026-04-01', color: '#6b7280',
    confirmed: opp.confirmed ?? false,
    status:   (opp.confirmed ?? false) ? 'confirmed' : 'proposed',
  };
}

/** updateCalendarTask — only allowed fields; cannot mutate flex. */
function updateTask(task: CalendarTask,
  updates: Partial<Pick<CalendarTask, 'title'|'startTime'|'endTime'|'date'|'description'>>
): CalendarTask { return { ...task, ...updates }; }

function acceptConflict(task: CalendarTask): CalendarTask {
  return { ...task, conflictOverride: true, status: 'confirmed_with_override', confirmed: true };
}

function undoConflictOverride(task: CalendarTask): CalendarTask {
  return { ...task, conflictOverride: false, status: 'confirmed' };
}

const isFlexible = (t: CalendarTask) => t.flex === 'flexible';

// ── Tests ─────────────────────────────────────────────────────────────────────

let passed = 0; let total = 0;
function test(label: string, fn: () => boolean) {
  total++;
  let ok = false;
  try { ok = fn(); } catch (e) { console.error(`  error in "${label}": ${e}`); }
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  if (ok) passed++;
}

// Feature 3 — flexibility preservation
test('flexible deadline scheduled → flex="flexible"', () =>
  scheduleOpportunity({ flexibility: 'flexible' }).flex === 'flexible');

test('fixed workshop scheduled → flex="fixed"', () =>
  scheduleOpportunity({ flexibility: 'fixed', eventTime: '14:00' }).flex === 'fixed');

test('flexible task is draggable (isFlexible=true)', () =>
  isFlexible(scheduleOpportunity({ flexibility: 'flexible', confirmed: true })));

test('fixed task is NOT draggable (isFlexible=false)', () =>
  !isFlexible(scheduleOpportunity({ flexibility: 'fixed' })));

test('assigning a planned time to flexible task does NOT change flex', () => {
  const t = scheduleOpportunity({ flexibility: 'flexible', confirmed: true });
  return updateTask(t, { startTime: '10:00', endTime: '12:00' }).flex === 'flexible';
});

test('assigning a planned time to fixed task does NOT change flex', () => {
  const t = scheduleOpportunity({ flexibility: 'fixed', eventTime: '14:00', confirmed: true });
  return updateTask(t, { startTime: '14:30', endTime: '16:00' }).flex === 'fixed';
});

test('confirming a flexible task keeps flex="flexible"', () => {
  const t = { ...scheduleOpportunity({ flexibility: 'flexible' }), confirmed: true, status: 'confirmed' as TaskStatus };
  return t.flex === 'flexible' && isFlexible(t);
});

// Feature 2 — conflict override lifecycle
test('acceptConflict → conflictOverride=true, status=confirmed_with_override', () => {
  const accepted = acceptConflict(scheduleOpportunity({ flexibility: 'flexible', confirmed: true }));
  return accepted.conflictOverride === true && accepted.status === 'confirmed_with_override';
});

test('acceptConflict does NOT change flex', () => {
  const accepted = acceptConflict(scheduleOpportunity({ flexibility: 'flexible', confirmed: true }));
  return accepted.flex === 'flexible';
});

test('undoConflictOverride → conflictOverride=false, status=confirmed', () => {
  const restored = undoConflictOverride(
    acceptConflict(scheduleOpportunity({ flexibility: 'flexible', confirmed: true }))
  );
  return restored.conflictOverride === false && restored.status === 'confirmed';
});

test('confirmed_with_override task has confirmed=true (not unconfirmed)', () =>
  acceptConflict(scheduleOpportunity({ flexibility: 'flexible', confirmed: true })).confirmed === true);

// Feature 1 — description preserved through updates
test('description survives time update', () => {
  let t = scheduleOpportunity({ flexibility: 'flexible', confirmed: true });
  t = updateTask(t, { description: 'Meeting notes' });
  t = updateTask(t, { startTime: '11:00', endTime: '12:00' });
  return t.description === 'Meeting notes' && t.flex === 'flexible';
});

test('clearing description does not affect flex', () => {
  let t = scheduleOpportunity({ flexibility: 'flexible', confirmed: true });
  t = updateTask(t, { description: 'temp' });
  t = updateTask(t, { description: undefined });
  return t.description === undefined && t.flex === 'flexible';
});

console.log(`\n${passed}/${total} tests passed`);
process.exit(passed === total ? 0 : 1);
