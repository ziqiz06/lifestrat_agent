/**
 * test-expiry.ts
 * --------------
 * Tests for isOpportunityExpired().
 * Run with:  npx ts-node scripts/test-expiry.ts
 *
 * Mocks Date.now() so tests are reproducible regardless of when they run.
 * Simulated "now": 2026-03-29 10:00:00 local time.
 */

// ── Inline copy of isOpportunityExpired (avoids TS alias resolution in ts-node) ──

function isOpportunityExpired(opp: {
  deadline: string | null;
  dueAt?: string;
  eventTime?: string;
  itemType?: 'event' | 'deadline' | 'task';
}): boolean {
  if (!opp.deadline) return false;
  const time =
    opp.itemType === 'deadline' ? (opp.dueAt    ?? '23:59') :
    opp.itemType === 'event'    ? (opp.eventTime ?? '23:59') :
                                   '23:59';
  return new Date(`${opp.deadline}T${time}:00`).getTime() < Date.now();
}

// ── Freeze time at 2026-03-29 10:00:00 ──────────────────────────────────────────

const FROZEN_NOW = new Date('2026-03-29T10:00:00').getTime();
const _realDateNow = Date.now;
Date.now = () => FROZEN_NOW;

// ── Test cases ───────────────────────────────────────────────────────────────────

const cases: Array<{
  label: string;
  opp: Parameters<typeof isOpportunityExpired>[0];
  expected: boolean;
}> = [
  {
    label: 'Deadline already passed (March 26 @ 23:59)',
    opp: { deadline: '2026-03-26', dueAt: '23:59', itemType: 'deadline' },
    expected: true,
  },
  {
    label: 'Deadline passed earlier today (10:00 now, deadline was 09:00 today)',
    opp: { deadline: '2026-03-29', dueAt: '09:00', itemType: 'deadline' },
    expected: true,
  },
  {
    label: 'Deadline later today (10:00 now, deadline at 23:59 today)',
    opp: { deadline: '2026-03-29', dueAt: '23:59', itemType: 'deadline' },
    expected: false,
  },
  {
    label: 'Deadline tomorrow',
    opp: { deadline: '2026-03-30', dueAt: '23:59', itemType: 'deadline' },
    expected: false,
  },
  {
    label: 'Event that already happened (March 26 @ 19:00)',
    opp: { deadline: '2026-03-26', eventTime: '19:00', itemType: 'event' },
    expected: true,
  },
  {
    label: 'Event later today (10:00 now, event at 18:00)',
    opp: { deadline: '2026-03-29', eventTime: '18:00', itemType: 'event' },
    expected: false,
  },
  {
    label: 'Task with deadline date in the past (no time)',
    opp: { deadline: '2026-03-28', itemType: 'task' },
    expected: true,
  },
  {
    label: 'Task with deadline today (not yet expired — end-of-day 23:59)',
    opp: { deadline: '2026-03-29', itemType: 'task' },
    expected: false,
  },
  {
    label: 'No deadline — never expired',
    opp: { deadline: null, itemType: 'deadline' },
    expected: false,
  },
  {
    label: 'Xfund pitch email (March 26 @ 23:59) — overdue item discovered after the fact',
    opp: { deadline: '2026-03-26', dueAt: '23:59', itemType: 'deadline' },
    expected: true,
  },
];

// ── Run ───────────────────────────────────────────────────────────────────────────

let passed = 0;
for (const c of cases) {
  const got = isOpportunityExpired(c.opp);
  const ok = got === c.expected;
  console.log(`${ok ? '✓' : '✗'} ${c.label}`);
  if (!ok) console.log(`    expected: ${c.expected}  got: ${got}`);
  if (ok) passed++;
}

Date.now = _realDateNow;
console.log(`\n${passed}/${cases.length} tests passed`);
process.exit(passed === cases.length ? 0 : 1);
