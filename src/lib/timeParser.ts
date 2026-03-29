/**
 * Parses real event start/end times from free-form text like email subjects/bodies.
 *
 * Supports:
 *   "7pm"  "10am"  "5pm EST"  "3:30pm"
 *   "10am–3pm"  "9am-9pm"  "2pm–6pm"  "10am to 3pm"
 */

function to24h(hourStr: string, minStr: string | undefined, meridiem: string): string {
  let h = parseInt(hourStr, 10);
  const m = minStr ? parseInt(minStr, 10) : 0;
  const mer = meridiem.toLowerCase();
  if (mer === 'pm' && h !== 12) h += 12;
  if (mer === 'am' && h === 12) h = 0;
  return `${String(Math.min(h, 23)).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Matches: "10am", "5pm", "3:30pm", "11:59pm"
const TIME_TOKEN = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)/gi;

// Matches: "10am–3pm", "10am-3pm", "10am to 3pm"  (any separator)
const RANGE_RE =
  /(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*(?:[–\-]|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i;

export function parseEventTimes(text: string): { startTime?: string; endTime?: string } {
  // Try range first
  const rangeMatch = text.match(RANGE_RE);
  if (rangeMatch) {
    return {
      startTime: to24h(rangeMatch[1], rangeMatch[2], rangeMatch[3]),
      endTime: to24h(rangeMatch[4], rangeMatch[5], rangeMatch[6]),
    };
  }

  // Try single time
  TIME_TOKEN.lastIndex = 0;
  const single = TIME_TOKEN.exec(text);
  if (single) {
    return { startTime: to24h(single[1], single[2], single[3]) };
  }

  return {};
}
