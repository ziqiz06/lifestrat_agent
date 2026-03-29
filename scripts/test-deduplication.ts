/**
 * test-deduplication.ts
 * ─────────────────────
 * Tests for email-level deduplication (mirrors src/lib/emailDeduplication.ts).
 * Run with:  npx ts-node scripts/test-deduplication.ts
 */

// ── Inline types ──────────────────────────────────────────────────────────────

interface Email {
  id:       string;
  from:     string;
  subject:  string;
  body:     string;
  date:     string;
  category: string;
}

// ── Inline deduplication logic (mirrors emailDeduplication.ts) ─────────────────

const STOPWORDS = new Set([
  'the','a','an','in','at','to','for','of','is','it','and','or','on','with',
  'this','that','your','our','we','you','are','will','be','do','not','from',
  'i','me','my','was','get','has','have','re','fwd','fw','please','just',
  'come','see','next','week','today','tonight','tomorrow','now','reminder',
  'join','out','up','its','by','as','all','about','more','last','new',
]);

function normalizeSubject(s: string): string {
  let t = s;
  t = t.replace(/\[[^\]]{1,60}\]/g, ' ');
  t = t.replace(/\b(re|fwd?|fw)\s*[:]\s*/gi, '');
  t = t.replace(/[\u{1F300}-\u{1FFFF}\u{2600}-\u{27BF}]/gu, '');
  t = t.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  return t.replace(/\s+/g, ' ').trim();
}

function significantWords(normalized: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of normalized.split(/\s+/)) {
    if (w.length >= 3 && !STOPWORDS.has(w) && !seen.has(w)) {
      seen.add(w); out.push(w);
    }
  }
  return out;
}

function jaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a); const setB = new Set(b);
  let inter = 0;
  setA.forEach((w) => { if (setB.has(w)) inter++; });
  return inter / (setA.size + setB.size - inter);
}

function extractSenderEmail(from: string): string {
  const m = from.match(/<([^>]+)>/);
  return (m ? m[1] : from).toLowerCase().trim();
}

function extractURLs(text: string): string[] {
  return (text.match(/https?:\/\/[^\s"'>)]+/g) ?? [])
    .map((u) => u.replace(/[.,;!?]+$/, '').toLowerCase());
}

function emailsAreDuplicates(a: Email, b: Email): boolean {
  if (a.category !== b.category) return false;
  const wordsA = significantWords(normalizeSubject(a.subject));
  const wordsB = significantWords(normalizeSubject(b.subject));
  if (jaccardSimilarity(wordsA, wordsB) >= 0.5) return true;
  if (
    extractSenderEmail(a.from) === extractSenderEmail(b.from) &&
    a.date === b.date &&
    a.body.length < 100 &&
    b.body.length < 100
  ) return true;
  const urlsB = new Set(extractURLs(b.body));
  if (extractURLs(a.body).some((u) => u.length > 20 && urlsB.has(u))) return true;
  return false;
}

function clusterEmails(emails: Email[]): Email[][] {
  const parent = emails.map((_, i) => i);
  function find(i: number): number {
    while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
    return i;
  }
  function unite(i: number, j: number) { parent[find(i)] = find(j); }
  for (let i = 0; i < emails.length; i++)
    for (let j = i + 1; j < emails.length; j++)
      if (emailsAreDuplicates(emails[i], emails[j])) unite(i, j);
  const clusters = new Map<number, Email[]>();
  emails.forEach((e, i) => {
    const r = find(i);
    if (!clusters.has(r)) clusters.set(r, []);
    clusters.get(r)!.push(e);
  });
  return Array.from(clusters.values());
}

function pickCanonical(cluster: Email[]): Email {
  return cluster.reduce((best, cur) => {
    if (cur.date > best.date) return cur;
    if (cur.date === best.date && cur.body.length > best.body.length) return cur;
    return best;
  });
}

// ── Test helpers ──────────────────────────────────────────────────────────────

let passed = 0; let total = 0;

function test(label: string, fn: () => boolean) {
  total++;
  let ok = false;
  try { ok = fn(); } catch (e) { console.error(`  error in "${label}": ${e}`); }
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  if (ok) passed++;
}

let _uid = 0;
function makeEmail(overrides: Partial<Email> & { subject: string }): Email {
  return {
    id:       `test-${_uid++}`,
    from:     'Alice <alice@example.com>',
    body:     '',
    date:     '2026-03-27',
    category: 'entertainment',
    ...overrides,
  };
}

// ── normalizeSubject ──────────────────────────────────────────────────────────

test('strips [Bacch-talk] prefix', () => {
  const n = normalizeSubject('[Bacch-talk] LOWELL TO BERG TO BERG');
  return !n.includes('[') && !n.includes('bacch');
});

test('strips chained [x][y] prefixes', () => {
  const n = normalizeSubject('[bacch-talk] [bacch-talk] Fwd: EXPRESSIONS SHOW TONIGHT!');
  return !n.includes('bacch') && !n.includes('fwd');
});

test('strips Re: and Fwd: prefixes', () => {
  const n = normalizeSubject('Re: Fwd: Apply for the Spring Aid Fund');
  return !n.startsWith('re') && !n.startsWith('fwd');
});

test('strips emojis', () => {
  const n = normalizeSubject('HOUSING DAY STEIN ‼️🔔😛');
  return !n.includes('🔔') && !n.includes('😛');
});

test('lowercases and collapses whitespace', () => {
  const n = normalizeSubject('[ALERT]  YOUR   $500   SCHOLARSHIP   IS DUE');
  return n === n.toLowerCase() && !n.includes('  ');
});

// ── jaccardSimilarity ─────────────────────────────────────────────────────────

test('jaccard: identical word sets = 1.0', () => {
  const w = ['apply', 'pitch', 'xfund'];
  return jaccardSimilarity(w, w) === 1.0;
});

test('jaccard: disjoint sets = 0', () => {
  return jaccardSimilarity(['apple'], ['banana']) === 0;
});

test('jaccard: partial overlap correct', () => {
  const j = jaccardSimilarity(
    ['apply', 'pitch', 'xfund', 'term', 'sheet'],
    ['last',  'chance', 'apply', 'pitch', 'xfund', 'term', 'sheet'],
  );
  // intersection=5, union=7
  return Math.abs(j - 5/7) < 0.001;
});

test('jaccard: both empty = 1', () => {
  return jaccardSimilarity([], []) === 1;
});

// ── emailsAreDuplicates — Rule 1 (title similarity) ───────────────────────────

test('Xfund deadline + correction → duplicates (Rule 1)', () => {
  const a = makeEmail({ subject: '[DEADLINE TONIGHT] Last Chance to Apply to Pitch Xfund and Polymarket for a $100K+ Term Sheet', category: 'deadline' });
  const b = makeEmail({ subject: '[Correction] Apply Tonight to Pitch Xfund and Polymarket for a $100K+ Term Sheet',              category: 'deadline' });
  return emailsAreDuplicates(a, b);
});

test('Fwd: variant of same subject → duplicate', () => {
  const a = makeEmail({ subject: 'COME SEE SANCTUARY CITY NEXT WEEK' });
  const b = makeEmail({ subject: '[Bacch-talk] Fwd: COME SEE SANCTUARY CITY NEXT WEEK!' });
  return emailsAreDuplicates(a, b);
});

test('Re: thread reply → duplicate', () => {
  const a = makeEmail({ subject: 'APPLY FOR THE SPRING AID FUND',              category: 'deadline' });
  const b = makeEmail({ subject: '[wics-chatter] Re: APPLY FOR THE SPRING AID FUND', category: 'deadline' });
  return emailsAreDuplicates(a, b);
});

test('"New threads in A, B, C" vs "New threads in B, A, C" → duplicate', () => {
  const a = makeEmail({ subject: 'New threads in COMPSCI 1240, Stat 111, and COMPSCI 1810', category: 'classes' });
  const b = makeEmail({ subject: 'New threads in Stat 111, COMPSCI 1240, and COMPSCI 1810', category: 'classes' });
  return emailsAreDuplicates(a, b);
});

test('identical Gradescope submission subjects → duplicate', () => {
  const a = makeEmail({ subject: '[CS 1240 on Gradescope] Successfully submitted to Programming Set 2', category: 'classes' });
  const b = makeEmail({ subject: '[CS 1240 on Gradescope] Successfully submitted to Programming Set 2', category: 'classes' });
  return emailsAreDuplicates(a, b);
});

test('minor subject variation (shared significant words ≥ 50%) → duplicate', () => {
  const a = makeEmail({ subject: 'Jump Trading Women in CS Recruiting Event', category: 'professional_event' });
  const b = makeEmail({ subject: '[wics-chatter] Jump Trading x Women in CS Recruiting Event', category: 'professional_event' });
  return emailsAreDuplicates(a, b);
});

// ── emailsAreDuplicates — Rule 2 (same sender + same date + short body) ───────

test('housing-day burst from same sender → duplicate (Rule 2)', () => {
  const from = 'Avani Rai <avani@college.harvard.edu>';
  const a = makeEmail({ from, subject: 'LOWELL TO BERG TO BERG', body: '',   date: '2026-03-27' });
  const b = makeEmail({ from, subject: 'WE LEAVE IN 5',           body: '', date: '2026-03-27' });
  return emailsAreDuplicates(a, b);
});

test('same sender + different day → not duplicate', () => {
  const from = 'Avani Rai <avani@college.harvard.edu>';
  const a = makeEmail({ from, subject: 'LOWELL TO BERG', body: '', date: '2026-03-26' });
  const b = makeEmail({ from, subject: 'WE LEAVE IN 5',  body: '', date: '2026-03-27' });
  return !emailsAreDuplicates(a, b);
});

test('same sender + same day + long body → not duplicate', () => {
  const from = 'Avani Rai <avani@college.harvard.edu>';
  // Subjects share no significant words, so Rule 1 can't fire either
  const a = makeEmail({ from, subject: 'Housing Day BERG run',    body: 'x'.repeat(200), date: '2026-03-27' });
  const b = makeEmail({ from, subject: 'Jesse Michels podcast',   body: '',              date: '2026-03-27' });
  return !emailsAreDuplicates(a, b);
});

// ── emailsAreDuplicates — Rule 3 (shared URL) ─────────────────────────────────

test('two emails sharing the same form URL → duplicate (Rule 3)', () => {
  const url = 'https://docs.google.com/forms/d/e/abc123/viewform';
  const a = makeEmail({ subject: 'Apply to our scholarship',          body: `Form: ${url}`, category: 'deadline' });
  const b = makeEmail({ subject: 'Reminder — scholarship closes tonight', body: `Link: ${url}`, category: 'deadline' });
  return emailsAreDuplicates(a, b);
});

// ── Category guard ────────────────────────────────────────────────────────────

test('same title, different category → not duplicate', () => {
  const a = makeEmail({ subject: 'Networking Night at Harvard', category: 'networking' });
  const b = makeEmail({ subject: 'Networking Night at Harvard', category: 'entertainment' });
  return !emailsAreDuplicates(a, b);
});

// ── clusterEmails ─────────────────────────────────────────────────────────────

test('Xfund pair + unrelated event → 2 clusters', () => {
  const emails = [
    makeEmail({ subject: '[DEADLINE TONIGHT] Last Chance to Apply to Pitch Xfund and Polymarket for a $100K+ Term Sheet', category: 'deadline' }),
    makeEmail({ subject: '[Correction] Apply Tonight to Pitch Xfund and Polymarket for a $100K+ Term Sheet',              category: 'deadline' }),
    makeEmail({ subject: 'Harvard Career Fair', category: 'professional_event' }),
  ];
  return clusterEmails(emails).length === 2;
});

test('same event forwarded 3× → single cluster (transitive closure)', () => {
  const emails = [
    makeEmail({ subject: 'Resume workshop tomorrow',           category: 'professional_event' }),
    makeEmail({ subject: 'Fwd: Resume workshop tomorrow',     category: 'professional_event' }),
    makeEmail({ subject: 'Re: Fwd: Resume workshop tomorrow', category: 'professional_event' }),
    // Different sender + long body ensures it can't merge via Rule 1 (no shared sig words with "resume workshop") or Rule 2
    makeEmail({ from: 'Bob <bob@example.com>', subject: 'Completely unrelated career fair', category: 'professional_event', body: 'x'.repeat(200) }),
  ];
  const clusters = clusterEmails(emails);
  return clusters.length === 2 && clusters.some((c) => c.length === 3);
});

test('housing-day same-sender burst → single cluster', () => {
  const from = 'Avani Rai <avani@college.harvard.edu>';
  const date  = '2026-03-27';
  const emails = [
    makeEmail({ from, date, subject: 'LOWELL TO BERG TO BERG' }),
    makeEmail({ from, date, subject: 'TO BERG BERG BERG' }),
    makeEmail({ from, date, subject: 'WE LEAVE IN 5' }),
    makeEmail({ from, date, subject: 'RALLY DHALL DHALL' }),
    makeEmail({ from: 'Other Person <other@example.com>', date, subject: 'Jesse Michels coming to campus', body: 'A great talk about alchemy.' }),
  ];
  const clusters = clusterEmails(emails);
  return clusters.length === 2 && clusters.some((c) => c.length === 4);
});

test('same opportunity found on refresh → single cluster (no append)', () => {
  // Same email parsed twice should not double-count
  const email = makeEmail({ subject: 'Internship Application', category: 'internship_application' });
  return clusterEmails([email]).length === 1 && clusterEmails([email, email]).length === 1;
});

test('distinctly different events on same day stay separate', () => {
  const date = '2026-03-27';
  const emails = [
    makeEmail({ from: 'Jay Gupta <jay@college.harvard.edu>',    subject: 'Jesse Michels coming to campus', body: 'A great talk about alchemy.', date }),
    makeEmail({ from: 'HRCSA <hrcsa@college.harvard.edu>',      subject: 'Traditional Medicine Lecture',   body: 'Join Professor Kuriyama for a special event.', date }),
    makeEmail({ from: 'Jennifer <jcoulomb@g.harvard.edu>',      subject: 'StoHo Homecoming Party',         body: 'Queens Head pub tonight — all Stoughton residents invited.', date }),
  ];
  return clusterEmails(emails).length === 3;
});

// ── pickCanonical ─────────────────────────────────────────────────────────────

test('pickCanonical: prefers latest date', () => {
  const a = makeEmail({ id: 'old', subject: 'Event', body: 'short', date: '2026-03-25' });
  const b = makeEmail({ id: 'new', subject: 'Event', body: '',      date: '2026-03-27' });
  return pickCanonical([a, b]).id === 'new';
});

test('pickCanonical: same date → prefers longer body', () => {
  const a = makeEmail({ id: 'short', subject: 'Event', body: 'hi',           date: '2026-03-27' });
  const b = makeEmail({ id: 'long',  subject: 'Event', body: 'x'.repeat(100), date: '2026-03-27' });
  return pickCanonical([a, b]).id === 'long';
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${passed}/${total} tests passed`);
process.exit(passed === total ? 0 : 1);
