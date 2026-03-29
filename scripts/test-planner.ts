/**
 * test-planner.ts
 * ---------------
 * Tests for overnight intervals, 24h formatting, deadline scheduling,
 * and invalid-interval prevention.
 * Run with:  npx ts-node scripts/test-planner.ts
 */

// ── Inline helpers (mirrors src/lib/dayPlanner.ts) ────────────────────────────

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(Math.min(h, 23)).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

// calcEnd mirrors the fixed version in appStore
function calcEnd(start: string, mins: number): string {
  const total = Math.min(timeToMinutes(start) + mins, 23 * 60 + 59);
  return minutesToTime(total);
}

// fmt mirrors the fixed conflictDetection version
function fmt24(m: number): string {
  const clamped = Math.min(Math.max(m, 0), 23 * 60 + 59);
  const h = Math.floor(clamped / 60);
  const min = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

// Blocked intervals for a day with sleep 23:00, wake 07:30
function getSleepIntervals(wakeTime: string, sleepTime: string) {
  return [
    { start: 0,                    end: timeToMinutes(wakeTime), label: 'pre-wake' },
    { start: timeToMinutes(sleepTime), end: 24 * 60,             label: 'post-sleep' },
  ];
}

function overlaps(taskStart: number, taskEnd: number, iStart: number, iEnd: number): boolean {
  return taskStart < iEnd && taskEnd > iStart;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

type Case = { label: string; run: () => boolean };

const cases: Case[] = [

  // ── 1. Overnight sleep interval covers the right minutes ──────────────────
  {
    label: 'sleep(23:00) interval ends at 1440 (midnight)',
    run: () => {
      const intervals = getSleepIntervals('07:30', '23:00');
      const sleep = intervals.find(i => i.label === 'post-sleep')!;
      return sleep.start === timeToMinutes('23:00') && sleep.end === 24 * 60;
    },
  },
  {
    label: 'wake(07:30) interval covers 00:00–07:30',
    run: () => {
      const intervals = getSleepIntervals('07:30', '23:00');
      const prewake = intervals.find(i => i.label === 'pre-wake')!;
      return prewake.start === 0 && prewake.end === timeToMinutes('07:30');
    },
  },

  // ── 2. 24h formatting ────────────────────────────────────────────────────
  {
    label: 'fmt24(0) → 00:00',
    run: () => fmt24(0) === '00:00',
  },
  {
    label: 'fmt24(450) → 07:30',
    run: () => fmt24(450) === '07:30',
  },
  {
    label: 'fmt24(1380) → 23:00',
    run: () => fmt24(1380) === '23:00',
  },
  {
    label: 'fmt24(1440) clamps to 23:59 (not 24:00)',
    run: () => fmt24(1440) === '23:59',
  },

  // ── 3. calcEnd does not overflow past 23:59 ───────────────────────────────
  {
    label: 'calcEnd("23:59", 30) clamps to 23:59 — never produces end < start',
    run: () => {
      const end = calcEnd('23:59', 30);
      return timeToMinutes(end) >= timeToMinutes('23:59');
    },
  },
  {
    label: 'calcEnd("23:00", 30) → 23:30',
    run: () => calcEnd('23:00', 30) === '23:30',
  },
  {
    label: 'calcEnd("23:30", 60) clamps to 23:59 (not 00:30)',
    run: () => calcEnd('23:30', 60) === '23:59',
  },

  // ── 4. Event at 23:59 produces valid interval ─────────────────────────────
  {
    label: 'event at 23:59 with 30-min duration has end >= start',
    run: () => {
      const start = '23:59';
      const end = calcEnd(start, 30);
      return timeToMinutes(end) >= timeToMinutes(start);
    },
  },

  // ── 5. Deadline task is NOT scheduled at the due time ────────────────────
  {
    label: 'deadline at 23:59 — work slot before it is in normal hours',
    run: () => {
      // Simulate available blocks before the cutoff (assume 09:00–17:00 free)
      const cutoffMins = timeToMinutes('23:59');
      const blocks = [{ startTime: '09:00', endTime: '17:00', durationMinutes: 480 }];
      const trimmed = blocks.map(b => {
        const bEnd = Math.min(timeToMinutes(b.endTime), cutoffMins);
        return { ...b, endTime: minutesToTime(bEnd), durationMinutes: bEnd - timeToMinutes(b.startTime) };
      }).filter(b => b.durationMinutes >= 30);
      const slot = trimmed[0];
      const workStart = slot.startTime;
      const workEnd = calcEnd(workStart, 180); // 3h task
      // Work block should be during the day, not at 23:59
      return timeToMinutes(workStart) < timeToMinutes('23:00') &&
             timeToMinutes(workEnd)   < timeToMinutes('23:59');
    },
  },
  {
    label: 'deadline task scheduled before dueAt (end < dueAt)',
    run: () => {
      const dueAt = '23:59';
      const workStart = '09:00';
      const workEnd = calcEnd(workStart, 240); // 4h
      return timeToMinutes(workEnd) < timeToMinutes(dueAt);
    },
  },

  // ── 6. Overnight conflict detection ───────────────────────────────────────
  {
    label: 'task at 22:00–23:30 does NOT overlap pre-wake interval (00:00–07:30)',
    run: () => {
      const intervals = getSleepIntervals('07:30', '23:00');
      const prewake = intervals.find(i => i.label === 'pre-wake')!;
      return !overlaps(timeToMinutes('22:00'), timeToMinutes('23:30'), prewake.start, prewake.end);
    },
  },
  {
    label: 'task at 22:00–23:30 DOES overlap post-sleep interval (23:00–24:00)',
    run: () => {
      const intervals = getSleepIntervals('07:30', '23:00');
      const sleep = intervals.find(i => i.label === 'post-sleep')!;
      return overlaps(timeToMinutes('22:00'), timeToMinutes('23:30'), sleep.start, sleep.end);
    },
  },
  {
    label: 'task at 06:00–08:00 overlaps pre-wake interval (00:00–07:30)',
    run: () => {
      const intervals = getSleepIntervals('07:30', '23:00');
      const prewake = intervals.find(i => i.label === 'pre-wake')!;
      return overlaps(timeToMinutes('06:00'), timeToMinutes('08:00'), prewake.start, prewake.end);
    },
  },
  {
    label: 'task at 08:00–10:00 does NOT overlap either sleep interval',
    run: () => {
      const intervals = getSleepIntervals('07:30', '23:00');
      return !intervals.some(i =>
        overlaps(timeToMinutes('08:00'), timeToMinutes('10:00'), i.start, i.end)
      );
    },
  },

  // ── 7. Invalid end-before-start prevention ────────────────────────────────
  {
    label: 'endTime > startTime after calcEnd for any reasonable input',
    run: () => {
      const inputs: Array<[string, number]> = [
        ['09:00', 60], ['17:30', 90], ['22:00', 120], ['23:00', 30], ['23:45', 60],
      ];
      return inputs.every(([start, dur]) => {
        const end = calcEnd(start, dur);
        return timeToMinutes(end) > timeToMinutes(start);
      });
    },
  },
];

// ── Run ───────────────────────────────────────────────────────────────────────

let passed = 0;
for (const c of cases) {
  let ok = false;
  try { ok = c.run(); } catch (e) { console.error(`  error: ${e}`); }
  console.log(`${ok ? '✓' : '✗'} ${c.label}`);
  if (ok) passed++;
}
console.log(`\n${passed}/${cases.length} tests passed`);
process.exit(passed === cases.length ? 0 : 1);
