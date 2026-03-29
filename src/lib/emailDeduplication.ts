/**
 * emailDeduplication.ts
 * ─────────────────────
 * Groups emails that describe the same underlying event/opportunity.
 *
 * Three rules (any one is sufficient to call two emails duplicates):
 *   1. Jaccard similarity of significant title words ≥ 0.5
 *   2. Same sender e-mail + same date + same category + both bodies < 100 chars
 *   3. Shared non-trivial URL in body
 *
 * Duplicate pairs are expanded transitively with Union-Find so that
 *  A≈B and B≈C → {A,B,C} all collapse to one opportunity.
 */

import { MockEmail } from '@/types';

// ── Stop-word list ────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  'the','a','an','in','at','to','for','of','is','it','and','or','on','with',
  'this','that','your','our','we','you','are','will','be','do','not','from',
  'i','me','my','was','get','has','have','re','fwd','fw','please','just',
  'come','see','next','week','today','tonight','tomorrow','now','reminder',
  'join','out','up','its','by','as','all','about','more','last','new',
]);

// ── Normalization ─────────────────────────────────────────────────────────────

/**
 * Strips:
 *   - Bracketed mailing-list / alert prefixes: [Bacch-talk], [ALERT], [Correction]…
 *   - Thread prefixes: Re:, Fwd:, FW:, Fw: (possibly chained)
 *   - Emojis (broad Unicode ranges)
 * Then lowercases and collapses whitespace.
 */
export function normalizeSubject(s: string): string {
  let t = s;
  // Strip bracketed prefixes (allow up to 60 chars inside brackets)
  t = t.replace(/\[[^\]]{1,60}\]/g, ' ');
  // Strip Re:/Fwd: chains
  t = t.replace(/\b(re|fwd?|fw)\s*[:]\s*/gi, '');
  // Strip emojis
  t = t.replace(/[\u{1F300}-\u{1FFFF}\u{2600}-\u{27BF}]/gu, '');
  // Lowercase then strip non-alphanumeric (keep spaces)
  t = t.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  // Collapse whitespace
  return t.replace(/\s+/g, ' ').trim();
}

/** Returns deduplicated significant words (length ≥ 3, not a stop-word). */
export function significantWords(normalized: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of normalized.split(/\s+/)) {
    if (w.length >= 3 && !STOPWORDS.has(w) && !seen.has(w)) {
      seen.add(w);
      out.push(w);
    }
  }
  return out;
}

export function jaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let inter = 0;
  setA.forEach((w) => { if (setB.has(w)) inter++; });
  const union = setA.size + setB.size - inter;
  return inter / union;
}

// ── Field extractors ──────────────────────────────────────────────────────────

/** Extracts the bare e-mail address from a "Display Name <addr>" string. */
export function extractSenderEmail(from: string): string {
  const m = from.match(/<([^>]+)>/);
  return (m ? m[1] : from).toLowerCase().trim();
}

/** Returns all http(s) URLs found in text, normalised (trailing punct stripped). */
export function extractURLs(text: string): string[] {
  return (text.match(/https?:\/\/[^\s"'>)]+/g) ?? [])
    .map((u) => u.replace(/[.,;!?]+$/, '').toLowerCase());
}

// ── Core duplicate predicate ──────────────────────────────────────────────────

export function emailsAreDuplicates(a: MockEmail, b: MockEmail): boolean {
  // Different categories → always separate opportunities
  if (a.category !== b.category) return false;

  const normA = normalizeSubject(a.subject);
  const normB = normalizeSubject(b.subject);
  const wordsA = significantWords(normA);
  const wordsB = significantWords(normB);

  // Rule 1 — strong title similarity
  if (jaccardSimilarity(wordsA, wordsB) >= 0.5) return true;

  // Rule 2 — same sender + same date + both bodies tiny (real-time "come now" bursts)
  if (
    extractSenderEmail(a.from) === extractSenderEmail(b.from) &&
    a.date === b.date &&
    a.body.length < 100 &&
    b.body.length < 100
  ) return true;

  // Rule 3 — shared non-trivial URL (both reference the same form / link)
  const urlsB = new Set(extractURLs(b.body));
  const sharedURL = extractURLs(a.body).find(
    (u) => u.length > 20 && urlsB.has(u),
  );
  if (sharedURL) return true;

  return false;
}

// ── Cluster builder (Union-Find) ──────────────────────────────────────────────

export function clusterEmails(emails: MockEmail[]): MockEmail[][] {
  const parent = emails.map((_, i) => i);

  function find(i: number): number {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]]; // path halving
      i = parent[i];
    }
    return i;
  }
  function unite(i: number, j: number) {
    parent[find(i)] = find(j);
  }

  for (let i = 0; i < emails.length; i++) {
    for (let j = i + 1; j < emails.length; j++) {
      if (emailsAreDuplicates(emails[i], emails[j])) {
        unite(i, j);
      }
    }
  }

  const clusters = new Map<number, MockEmail[]>();
  emails.forEach((email, i) => {
    const root = find(i);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root)!.push(email);
  });

  return Array.from(clusters.values());
}

// ── Canonical selection ───────────────────────────────────────────────────────

/**
 * Picks the most representative email from a cluster:
 * prefers the latest date, then the longest body (most informative).
 */
export function pickCanonical(cluster: MockEmail[]): MockEmail {
  return cluster.reduce((best, cur) => {
    if (cur.date > best.date) return cur;
    if (cur.date === best.date && cur.body.length > best.body.length) return cur;
    return best;
  });
}
