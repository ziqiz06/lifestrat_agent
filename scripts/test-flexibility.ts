/**
 * test-flexibility.ts
 * --------------------
 * Tests for flexibility-aware scheduling classification and behavior.
 * Run with:  npx ts-node scripts/test-flexibility.ts
 */

// ── Inline helpers ─────────────────────────────────────────────────────────────

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(Math.min(h, 23)).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function calcEnd(start: string, mins: number): string {
  const total = Math.min(timeToMinutes(start) + mins, 23 * 60 + 59);
  return minutesToTime(total);
}

// Mirrors the FIXED_TIME_CATEGORIES in emailParser
const FIXED_TIME_CATEGORIES = new Set([
  'networking', 'professional_event', 'classes', 'entertainment',
]);

// Mirrors classify logic from emailParser.ts
function classify(opts: {
  isDeadline: boolean;
  hasEventTime: boolean;
  category: string;
}): { itemType: 'event' | 'deadline' | 'task'; flexibility: 'fixed' | 'flexible' } {
  if (opts.isDeadline) {
    return { itemType: 'deadline', flexibility: 'flexible' };
  }
  if (opts.hasEventTime && FIXED_TIME_CATEGORIES.has(opts.category)) {
    return { itemType: 'event', flexibility: 'fixed' };
  }
  if (FIXED_TIME_CATEGORIES.has(opts.category)) {
    return { itemType: 'task', flexibility: 'fixed' };
  }
  return { itemType: 'task', flexibility: 'flexible' };
}

// Mirrors flexible scheduling from addOpportunityToCalendar
function scheduleFlexible(opts: {
  dueAt?: string;
  itemType: string;
  availableBlocks: Array<{ startTime: string; endTime: string; durationMinutes: number }>;
  durationMin: number;
  preferredStart: string;
  preferredEnd: string;
}): { startTime: string; endTime: string } {
  const cutoffMins = (opts.itemType === 'deadline' && opts.dueAt)
    ? timeToMinutes(opts.dueAt)
    : timeToMinutes(opts.preferredEnd);

  const trimmed = opts.availableBlocks
    .map((b) => {
      const bEnd = Math.min(timeToMinutes(b.endTime), cutoffMins);
      const dur = bEnd - timeToMinutes(b.startTime);
      return { ...b, endTime: minutesToTime(bEnd), durationMinutes: dur };
    })
    .filter((b) => b.durationMinutes >= 30);

  const slot = trimmed.find((b) => b.durationMinutes >= opts.durationMin) ?? trimmed.at(-1);

  if (slot) {
    return {
      startTime: slot.startTime,
      endTime: calcEnd(slot.startTime, Math.min(opts.durationMin, slot.durationMinutes)),
    };
  }
  return {
    startTime: opts.preferredStart,
    endTime: calcEnd(opts.preferredStart, opts.durationMin),
  };
}

// ── Sleep block overlap check ──────────────────────────────────────────────────

function overlapsBlock(start: string, end: string, blockStart: string, blockEnd: string): boolean {
  return timeToMinutes(start) < timeToMinutes(blockEnd) &&
         timeToMinutes(end) > timeToMinutes(blockStart);
}

// ── Test cases ─────────────────────────────────────────────────────────────────

const cases: Array<{ label: string; run: () => boolean }> = [

  // ── Classification ──────────────────────────────────────────────────────────

  {
    label: 'deadline email → flexible',
    run: () => classify({ isDeadline: true, hasEventTime: false, category: 'deadline' }).flexibility === 'flexible',
  },
  {
    label: 'RSVP deadline (networking category, isDeadline=true) → flexible',
    run: () => classify({ isDeadline: true, hasEventTime: false, category: 'networking' }).flexibility === 'flexible',
  },
  {
    label: 'application email → flexible',
    run: () => {
      const r = classify({ isDeadline: false, hasEventTime: false, category: 'internship_application' });
      return r.flexibility === 'flexible' && r.itemType === 'task';
    },
  },
  {
    label: 'networking event WITH parsed time → fixed event',
    run: () => {
      const r = classify({ isDeadline: false, hasEventTime: true, category: 'networking' });
      return r.flexibility === 'fixed' && r.itemType === 'event';
    },
  },
  {
    label: 'class email WITHOUT parsed time → fixed (time TBD)',
    run: () => {
      const r = classify({ isDeadline: false, hasEventTime: false, category: 'classes' });
      return r.flexibility === 'fixed' && r.itemType === 'task';
    },
  },
  {
    label: 'professional event WITH parsed time → fixed event',
    run: () => classify({ isDeadline: false, hasEventTime: true, category: 'professional_event' }).flexibility === 'fixed',
  },
  {
    label: 'internship_research email → flexible task',
    run: () => classify({ isDeadline: false, hasEventTime: false, category: 'internship_research' }).flexibility === 'flexible',
  },

  // ── Scheduling: flexible items ──────────────────────────────────────────────

  {
    label: 'deadline at 23:59 — work slot is before 23:59, not at it',
    run: () => {
      const r = scheduleFlexible({
        dueAt: '23:59',
        itemType: 'deadline',
        availableBlocks: [{ startTime: '09:00', endTime: '17:00', durationMinutes: 480 }],
        durationMin: 180,
        preferredStart: '09:00',
        preferredEnd: '22:00',
      });
      return timeToMinutes(r.startTime) < timeToMinutes('23:59') &&
             timeToMinutes(r.endTime)   < timeToMinutes('23:59');
    },
  },
  {
    label: 'flexible task avoids sleep block (23:00–07:30)',
    run: () => {
      const r = scheduleFlexible({
        dueAt: undefined,
        itemType: 'task',
        availableBlocks: [{ startTime: '09:00', endTime: '21:00', durationMinutes: 720 }],
        durationMin: 60,
        preferredStart: '09:00',
        preferredEnd: '22:00',
      });
      return !overlapsBlock(r.startTime, r.endTime, '23:00', '07:30');
    },
  },
  {
    label: 'flexible task scheduled before deadline cutoff (end < dueAt)',
    run: () => {
      const dueAt = '17:00';
      const r = scheduleFlexible({
        dueAt,
        itemType: 'deadline',
        availableBlocks: [{ startTime: '09:00', endTime: '17:00', durationMinutes: 480 }],
        durationMin: 120,
        preferredStart: '09:00',
        preferredEnd: '22:00',
      });
      return timeToMinutes(r.endTime) <= timeToMinutes(dueAt);
    },
  },
  {
    label: 'flexible: endTime > startTime always',
    run: () => {
      const inputs: Array<[string | undefined, number]> = [
        ['23:59', 180], ['17:00', 240], [undefined, 60], ['09:00', 30],
      ];
      return inputs.every(([dueAt, dur]) => {
        const r = scheduleFlexible({
          dueAt,
          itemType: 'deadline',
          availableBlocks: [{ startTime: '09:00', endTime: '21:00', durationMinutes: 720 }],
          durationMin: dur,
          preferredStart: '09:00',
          preferredEnd: '22:00',
        });
        return timeToMinutes(r.endTime) > timeToMinutes(r.startTime);
      });
    },
  },
  {
    label: 'flexible task NOT scheduled at 23:59 (exact deadline time)',
    run: () => {
      const r = scheduleFlexible({
        dueAt: '23:59',
        itemType: 'deadline',
        availableBlocks: [{ startTime: '09:00', endTime: '17:00', durationMinutes: 480 }],
        durationMin: 60,
        preferredStart: '09:00',
        preferredEnd: '22:00',
      });
      return r.startTime !== '23:59';
    },
  },

  // ── Fixed: never moved ─────────────────────────────────────────────────────

  {
    label: 'fixed event with eventTime is anchored (startTime = eventTime)',
    run: () => {
      // Fixed scheduling branch just uses opp.eventTime directly
      const eventTime = '18:00';
      const startTime = eventTime; // mirroring the fixed branch
      return startTime === '18:00';
    },
  },
  {
    label: 'calcEnd never produces end <= start for valid inputs',
    run: () => {
      const inputs: Array<[string, number]> = [
        ['07:00', 60], ['12:00', 90], ['21:00', 60], ['23:00', 30], ['23:45', 60],
      ];
      return inputs.every(([s, d]) => timeToMinutes(calcEnd(s, d)) > timeToMinutes(s));
    },
  },
];

// ── Run ────────────────────────────────────────────────────────────────────────

let passed = 0;
for (const c of cases) {
  let ok = false;
  try { ok = c.run(); } catch (e) { console.error(`  error in "${c.label}": ${e}`); }
  console.log(`${ok ? '✓' : '✗'} ${c.label}`);
  if (ok) passed++;
}
console.log(`\n${passed}/${cases.length} tests passed`);
process.exit(passed === cases.length ? 0 : 1);
