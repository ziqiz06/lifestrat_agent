/**
 * timeParser.ts
 * -------------
 * Parses times from email text, distinguishing between:
 *   - Event start/end times  ("Join us at 7pm", "10am–3pm")
 *   - Deadline times         ("submit by 11:59pm", "due by April 1 at midnight")
 *
 * The core rule: if a time token appears AFTER deadline-context language
 * (by, due, before, closes, deadline, no later than, RSVP by, …) it is a
 * due time, NOT an event start time.
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

function to24h(hourStr: string, minStr: string | undefined, meridiem: string): string {
  let h = parseInt(hourStr, 10);
  const m = minStr ? parseInt(minStr, 10) : 0;
  const mer = meridiem.toLowerCase();
  if (mer === 'pm' && h !== 12) h += 12;
  if (mer === 'am' && h === 12) h = 0;
  return `${String(Math.min(h, 23)).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Single time token: "10am", "5pm", "3:30pm", "11:59pm"
const TIME_TOKEN = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i;
const TIME_TOKEN_G = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)/gi;

// Explicit time range: "10am–3pm", "10am-3pm", "10am to 3pm"
const RANGE_RE =
  /(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*(?:[–—\-]|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i;

// Words/phrases that indicate a time is a cutoff, not an event start.
// We look for these in the ~80 characters BEFORE a time token.
const DEADLINE_TRIGGERS =
  /\b(?:by|due|submit(?:ted)?|deadline[:\s]|closes?|ends?\s+at|no\s+later\s+than|before|rsvp\s+by|register\s+by|respond\s+by|application\s+(?:due|closes)|cutoff|last\s+day|until|at\s+midnight|midnight)\b/i;

// Words that strongly suggest this IS an event start time.
const EVENT_TRIGGERS =
  /\b(?:join\s+us|starts?\s+at|begin(?:s|ning)?\s+at|from\s+\d|open(?:s)?\s+at|doors\s+at|kick(?:s)?(?:\s*off)?\s+at|happening\s+at|event\s+at|session\s+at|meeting\s+at|talk\s+at|seminar\s+at|workshop\s+at|dinner\s+at|lunch\s+at|reception\s+at)\b/i;

// ── Public interface ──────────────────────────────────────────────────────────

export interface ParsedTimes {
  /** Start time of a real calendar event (HH:MM). */
  startTime?: string;
  /** End time of a real calendar event (HH:MM). Present only for ranges. */
  endTime?: string;
  /** Cutoff/due time for a deadline item (HH:MM). NOT an event start. */
  dueTime?: string;
  /** Whether the parsed time is clearly a deadline/cutoff, not an event. */
  isDeadline: boolean;
}

/**
 * Parse event or deadline times from free-form email text.
 *
 * Decision logic:
 *  1. If there is an explicit range (10am–3pm) → event with start + end.
 *  2. If a single time is found, inspect the preceding context (up to 80 chars):
 *     a. Deadline trigger word → dueTime (isDeadline = true)
 *     b. Event trigger word   → startTime (isDeadline = false)
 *     c. No clear signal      → use the email category as tiebreaker (caller's job)
 *  3. If midnight/11:59 pm appears after a deadline trigger → dueTime.
 */
export function parseEmailTimes(text: string, isDeadlineCategory = false): ParsedTimes {
  const lower = text.toLowerCase();

  // 1 — Explicit time range is always an event
  const rangeMatch = text.match(RANGE_RE);
  if (rangeMatch) {
    return {
      startTime: to24h(rangeMatch[1], rangeMatch[2], rangeMatch[3]),
      endTime:   to24h(rangeMatch[4], rangeMatch[5], rangeMatch[6]),
      isDeadline: false,
    };
  }

  // 2 — Single time: check context
  TIME_TOKEN_G.lastIndex = 0;
  const m = TIME_TOKEN_G.exec(text);
  if (m) {
    const before = text.slice(Math.max(0, m.index - 80), m.index);
    const time = to24h(m[1], m[2], m[3]);

    const hasDeadlineTrigger = DEADLINE_TRIGGERS.test(before) || isDeadlineCategory;
    const hasEventTrigger    = EVENT_TRIGGERS.test(before);

    // Explicit event trigger wins over deadline trigger only when there is no deadline language
    if (hasEventTrigger && !hasDeadlineTrigger) {
      return { startTime: time, isDeadline: false };
    }
    if (hasDeadlineTrigger) {
      return { dueTime: time, isDeadline: true };
    }

    // No clear signal: if category is deadline treat as dueTime, else startTime
    if (isDeadlineCategory) {
      return { dueTime: time, isDeadline: true };
    }
    return { startTime: time, isDeadline: false };
  }

  // 3 — Check for midnight / end-of-day language even without a time token
  if (DEADLINE_TRIGGERS.test(lower) && /midnight|end\s+of\s+day|eod|11:59/.test(lower)) {
    return { dueTime: '23:59', isDeadline: true };
  }

  return { isDeadline: isDeadlineCategory };
}

/**
 * Legacy wrapper — kept so existing callers (emailParser) compile unchanged.
 * Prefer parseEmailTimes for new code.
 */
export function parseEventTimes(text: string): { startTime?: string; endTime?: string } {
  const result = parseEmailTimes(text, false);
  // Only return startTime/endTime if it is genuinely an event (not a deadline)
  if (result.isDeadline) return {};
  return { startTime: result.startTime, endTime: result.endTime };
}

/**
 * Returns true if the opportunity's deadline/event time has already passed.
 *
 * Logic:
 *  - 'deadline' items: expired when deadline date + dueAt time (or 23:59) is in the past.
 *  - 'event'    items: expired when deadline date + eventTime (or 23:59) is in the past.
 *  - 'task'     items: expired when the deadline date end-of-day has passed.
 *  - No deadline field → never considered expired.
 *
 * Always uses Date.now() so the result stays correct across sessions.
 */
export function isOpportunityExpired(opp: {
  deadline: string | null;
  dueAt?: string;
  eventTime?: string;
  itemType?: 'event' | 'deadline' | 'task';
}): boolean {
  if (!opp.deadline) return false;
  const time =
    opp.itemType === 'deadline' ? (opp.dueAt   ?? '23:59') :
    opp.itemType === 'event'    ? (opp.eventTime ?? '23:59') :
                                   '23:59';
  return new Date(`${opp.deadline}T${time}:00`).getTime() < Date.now();
}

