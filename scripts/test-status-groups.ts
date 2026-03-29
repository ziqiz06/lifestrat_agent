/**
 * test-status-groups.ts
 * ----------------------
 * Tests for opportunity status grouping logic.
 * Run with:  npx ts-node scripts/test-status-groups.ts
 *
 * Simulated "now": 2026-03-29 10:00:00
 */

// ── Freeze time ───────────────────────────────────────────────────────────────
const FROZEN_NOW = new Date('2026-03-29T10:00:00').getTime();
const _realNow = Date.now;
Date.now = () => FROZEN_NOW;

// ── Inline isOpportunityExpired (mirrors src/lib/timeParser.ts) ───────────────
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

// ── Inline getStatus (mirrors OpportunitiesView logic) ────────────────────────
type OppStatus = 'active' | 'scheduled' | 'dismissed' | 'expired';

function getStatus(opp: {
  deadline: string | null;
  dueAt?: string;
  eventTime?: string;
  itemType?: 'event' | 'deadline' | 'task';
  addedToCalendar: boolean;
  interested: boolean | null;
}): OppStatus {
  if (isOpportunityExpired(opp)) return 'expired';
  if (opp.addedToCalendar)       return 'scheduled';
  if (opp.interested === false)  return 'dismissed';
  return 'active';
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeOpp(overrides: Partial<Parameters<typeof getStatus>[0]>) {
  return {
    deadline: null,
    dueAt: undefined,
    eventTime: undefined,
    itemType: 'task' as const,
    addedToCalendar: false,
    interested: null,
    ...overrides,
  };
}

// ── Test cases ────────────────────────────────────────────────────────────────
const cases: Array<{ label: string; run: () => boolean }> = [

  // ── Expired deadlines excluded from active feed ───────────────────────────
  {
    label: 'deadline Mar 26 @ 23:59 → expired (today is Mar 29)',
    run: () => getStatus(makeOpp({ deadline: '2026-03-26', dueAt: '23:59', itemType: 'deadline' })) === 'expired',
  },
  {
    label: 'deadline yesterday end-of-day → expired',
    run: () => getStatus(makeOpp({ deadline: '2026-03-28', itemType: 'deadline' })) === 'expired',
  },
  {
    label: 'past event (Mar 26 @ 19:00) → expired',
    run: () => getStatus(makeOpp({ deadline: '2026-03-26', eventTime: '19:00', itemType: 'event' })) === 'expired',
  },

  // ── Future deadlines remain in active feed ────────────────────────────────
  {
    label: 'deadline tomorrow @ 23:59 → active',
    run: () => getStatus(makeOpp({ deadline: '2026-03-30', dueAt: '23:59', itemType: 'deadline' })) === 'active',
  },
  {
    label: 'deadline today but later (23:59, now is 10:00) → active',
    run: () => getStatus(makeOpp({ deadline: '2026-03-29', dueAt: '23:59', itemType: 'deadline' })) === 'active',
  },
  {
    label: 'deadline Apr 1 → active',
    run: () => getStatus(makeOpp({ deadline: '2026-04-01', dueAt: '23:59', itemType: 'deadline' })) === 'active',
  },

  // ── Scheduled items ───────────────────────────────────────────────────────
  {
    label: 'non-expired + addedToCalendar → scheduled',
    run: () => getStatus(makeOpp({ deadline: '2026-04-05', addedToCalendar: true })) === 'scheduled',
  },
  {
    label: 'expired + addedToCalendar → expired (expired overrides scheduled)',
    run: () => getStatus(makeOpp({ deadline: '2026-03-26', dueAt: '23:59', itemType: 'deadline', addedToCalendar: true })) === 'expired',
  },

  // ── Dismissed items ───────────────────────────────────────────────────────
  {
    label: 'non-expired + interested=false → dismissed',
    run: () => getStatus(makeOpp({ deadline: '2026-04-05', interested: false })) === 'dismissed',
  },
  {
    label: 'expired + interested=false → expired (expired overrides dismissed)',
    run: () => getStatus(makeOpp({ deadline: '2026-03-26', dueAt: '23:59', itemType: 'deadline', interested: false })) === 'expired',
  },

  // ── No deadline → never expired ───────────────────────────────────────────
  {
    label: 'no deadline + no interested → active',
    run: () => getStatus(makeOpp({})) === 'active',
  },
  {
    label: 'no deadline + interested=false → dismissed',
    run: () => getStatus(makeOpp({ interested: false })) === 'dismissed',
  },

  // ── Status group partitioning ─────────────────────────────────────────────
  {
    label: 'partition: expired items excluded from active group',
    run: () => {
      const opps = [
        makeOpp({ deadline: '2026-03-26', dueAt: '23:59', itemType: 'deadline' }), // expired
        makeOpp({ deadline: '2026-04-01', dueAt: '23:59', itemType: 'deadline' }), // active
        makeOpp({ deadline: '2026-04-05', addedToCalendar: true }),                 // scheduled
        makeOpp({ interested: false }),                                              // dismissed
      ];
      const active = opps.filter(o => getStatus(o) === 'active');
      return active.length === 1;
    },
  },
  {
    label: 'partition: all past events go to expired group',
    run: () => {
      const opps = [
        makeOpp({ deadline: '2026-03-20', eventTime: '18:00', itemType: 'event' }),
        makeOpp({ deadline: '2026-03-25', eventTime: '14:00', itemType: 'event' }),
        makeOpp({ deadline: '2026-04-02', eventTime: '18:00', itemType: 'event' }), // future
      ];
      const expired = opps.filter(o => getStatus(o) === 'expired');
      return expired.length === 2;
    },
  },
  {
    label: 'dismissed items do not reappear — getStatus stays dismissed',
    run: () => {
      const opp = makeOpp({ deadline: '2026-04-10', interested: false });
      return getStatus(opp) === 'dismissed' && getStatus(opp) === 'dismissed'; // stable
    },
  },
];

// ── Run ────────────────────────────────────────────────────────────────────────
Date.now = _realNow;

let passed = 0;
// Restore freeze for actual test run
Date.now = () => FROZEN_NOW;

for (const c of cases) {
  let ok = false;
  try { ok = c.run(); } catch (e) { console.error(`  error in "${c.label}": ${e}`); }
  console.log(`${ok ? '✓' : '✗'} ${c.label}`);
  if (ok) passed++;
}

Date.now = _realNow;
console.log(`\n${passed}/${cases.length} tests passed`);
process.exit(passed === cases.length ? 0 : 1);
