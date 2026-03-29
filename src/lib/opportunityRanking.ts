import { Opportunity, UserProfile, EmailCategory, RankingDebug } from '@/types';
import { isOpportunityExpired } from './timeParser';

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 1 — BASE ACTIONABILITY
// Pure email-derived facts: urgency, effort, confidence.
// Identical output for all users — profile has no influence here.
// ─────────────────────────────────────────────────────────────────────────────

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysUntil(deadline: string, today: string): number {
  const d = new Date(deadline + 'T00:00:00');
  const t = new Date(today + 'T00:00:00');
  return Math.ceil((d.getTime() - t.getTime()) / (1000 * 60 * 60 * 24));
}

function urgencyScore(deadline: string | null, today: string): number {
  if (!deadline) return 1;
  const days = daysUntil(deadline, today);
  if (days <= 0)  return 10;
  if (days <= 1)  return 9;
  if (days <= 3)  return 8;
  if (days <= 7)  return 6;
  if (days <= 14) return 4;
  if (days <= 30) return 2;
  return 1;
}

function effortScore(hours: number): number {
  // Low effort = more immediately actionable = higher score
  if (hours <= 0.5) return 10;
  if (hours <= 1)   return 9;
  if (hours <= 2)   return 7;
  if (hours <= 4)   return 5;
  if (hours <= 6)   return 3;
  return 1;
}

function confidenceScore(opp: Opportunity): number {
  const hasDeadline = !!opp.deadline;
  const hasHours    = opp.estimatedHours > 0;
  const hasDesc     = opp.description.length > 40;
  if (hasDeadline && hasHours && hasDesc) return 10;
  if (hasDeadline && hasHours)           return 7;
  if (hasDeadline)                       return 5;
  if (hasHours)                          return 4;
  return 2;
}

function computeBaseActionability(opp: Opportunity, today: string): {
  score: number; urgency: number; effort: number; confidence: number;
} {
  const urgency    = urgencyScore(opp.deadline, today);
  const effort     = effortScore(opp.estimatedHours);
  const confidence = confidenceScore(opp);
  const score      = Math.min(10, urgency * 0.6 + effort * 0.2 + confidence * 0.2);
  return { score, urgency, effort, confidence };
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 2 — PREFERENCE FIT
// Field-agnostic: works for any major, any career goal, any occupation.
// Extracts meaningful terms from the user's own profile text and checks how
// many appear in the opportunity title + description.
// No hardcoded domain lists are used as the primary signal.
// ─────────────────────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'have', 'from', 'they', 'will',
  'been', 'were', 'their', 'what', 'when', 'who', 'which', 'into', 'about',
  'more', 'want', 'would', 'could', 'should', 'work', 'like', 'also', 'make',
  'some', 'there', 'than', 'then', 'know', 'just', 'very', 'your', 'our',
  'become', 'looking', 'seek', 'find', 'help', 'using', 'through', 'across',
  'within', 'skills', 'field', 'areas', 'focus', 'based', 'related', 'get',
  'can', 'all', 'its', 'are', 'has', 'had', 'not', 'but', 'any', 'out',
  'you', 'new', 'use', 'way', 'how', 'his', 'her', 'my', 'we', 'be', 'by',
  'do', 'at', 'an', 'or', 'in', 'is', 'it', 'of', 'to', 'a', 'as', 'on',
  'if', 'so', 'up', 'me', 'he', 'she', 'no', 'go',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s,;.!?()\[\]"'\-\/\\:]+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

interface ProfileTerms {
  unigrams: Set<string>;
  bigrams:  Set<string>;
}

function extractProfileTerms(profile: UserProfile): ProfileTerms {
  const text = [
    profile.careerGoals,
    profile.professionalInterests,
    profile.targetIndustries,
    // name of major often appears in targetIndustries/goals, but also capture
    // experienceLevel as a signal (e.g. "student", "entry")
  ].filter(Boolean).join(' ');

  const tokens  = tokenize(text);
  const unigrams = new Set(tokens.filter(w => w.length > 3));
  const bigrams  = new Set<string>();

  for (let i = 0; i < tokens.length - 1; i++) {
    if (tokens[i].length > 3 && tokens[i + 1].length > 3) {
      bigrams.add(`${tokens[i]} ${tokens[i + 1]}`);
    }
  }

  return { unigrams, bigrams };
}

interface PrefFitResult {
  score:           number;
  profileCoverage: number;
  matchedTerms:    string[];
  matchedSignals:  string[];
}

function computePreferenceFit(opp: Opportunity, profile: UserProfile): PrefFitResult {
  const profileText = [
    profile.careerGoals,
    profile.professionalInterests,
    profile.targetIndustries,
  ].filter(Boolean).join(' ').trim();

  // Empty profile — no preference signal; urgency/category take over
  if (!profileText) {
    const signals: string[] = [];
    let bonus = 0;
    if (profile.activelyLooking && opp.category === 'internship_application') {
      bonus = 2;
      signals.push('actively seeking');
    }
    return { score: Math.min(10, bonus), profileCoverage: 0, matchedTerms: [], matchedSignals: signals };
  }

  const oppText = `${opp.title} ${opp.description}`.toLowerCase();
  const { unigrams, bigrams } = extractProfileTerms(profile);

  // Bigram matches (2-word phrases): weighted ×2 — "english teacher" beats "teacher" alone
  const matchedBigrams  = [...bigrams].filter(b => oppText.includes(b));
  // Unigram matches: single meaningful words from the profile
  const matchedUnigrams = [...unigrams].filter(w => oppText.includes(w));

  const matchedTerms = [...new Set([...matchedBigrams, ...matchedUnigrams])];

  // profileCoverage: fraction of profile unigrams found in the opp text
  const profileCoverage = unigrams.size > 0
    ? matchedUnigrams.length / unigrams.size
    : 0;

  // Weighted hit count: bigrams worth 2, unigrams worth 1
  const weightedHits  = matchedBigrams.length * 2 + matchedUnigrams.length;
  const weightedTotal = bigrams.size * 2 + unigrams.size;

  // Base score from coverage — amplified so even sparse profiles get meaningful signal
  // Cap at 8 so AI layer can always add up to 2 more points on top
  const coverageScore = weightedTotal > 0
    ? Math.min(8, (weightedHits / weightedTotal) * 10 * 2.5)
    : 0;

  // Actively-looking bonus (up to +2) for internship_application category
  const lookingBonus = (profile.activelyLooking && opp.category === 'internship_application') ? 2 : 0;

  const score = Math.min(10, Math.max(0, coverageScore + lookingBonus));

  const matchedSignals: string[] = [];
  if (matchedBigrams.length > 0)  matchedSignals.push(`${matchedBigrams.length} phrase match${matchedBigrams.length > 1 ? 'es' : ''}`);
  if (matchedUnigrams.length > 0) matchedSignals.push(`${matchedUnigrams.length} keyword match${matchedUnigrams.length > 1 ? 'es' : ''}`);
  if (lookingBonus > 0)           matchedSignals.push('actively seeking');
  if (matchedTerms.length === 0 && profileText)  matchedSignals.push('no profile match');

  return { score, profileCoverage, matchedTerms, matchedSignals };
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 3 — CAREER VALUE
// Category-based career impact. Deterministic, not profile-dependent.
// ─────────────────────────────────────────────────────────────────────────────

function careerValueScore(category: EmailCategory): number {
  const map: Record<EmailCategory, number> = {
    internship_application: 10,
    deadline:                9,
    classes:                 8,
    networking:              7,
    professional_event:      6,
    internship_research:     5,
    entertainment:           2,
    personal:                1,
    ignore:                  0,
  };
  return map[category] ?? 2;
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 4 — AI RELEVANCE (overlay, applied after AI runs)
// The AI score is stored on opp.aiRelevanceScore and persists across heuristic
// re-ranks. It is blended into the finalScore only when present.
// ─────────────────────────────────────────────────────────────────────────────

// Weights used when AI score is absent
const W_NO_AI = { pref: 0.40, career: 0.30, action: 0.30 };
// Weights used when AI score is present — AI gets majority of influence
const W_AI    = { ai: 0.45, pref: 0.25, career: 0.20, action: 0.10 };

export function computeFinalScore(
  prefFit:    number,
  careerVal:  number,
  baseAction: number,
  penalty:    number,
  aiScore:    number | null,
): number {
  const composite = aiScore !== null
    ? aiScore * W_AI.ai + prefFit * W_AI.pref + careerVal * W_AI.career + baseAction * W_AI.action
    : prefFit * W_NO_AI.pref + careerVal * W_NO_AI.career + baseAction * W_NO_AI.action;
  return Math.min(10, Math.max(1, Math.round(composite - penalty)));
}

// ─────────────────────────────────────────────────────────────────────────────
// PENALTY
// ─────────────────────────────────────────────────────────────────────────────

const LOW_FIT_SIGNALS = [
  'housing day', 'merch sale', 'merchandise', 'dining hall', 'dhall',
  'elections', 'exec election', 'internal show', 'pub meeting', 'club meeting',
  'general meeting', 'lowell on top', 'bacch-talk', 'rally ', 'puffer',
  'wake up lowell', 'expressions show',
];

function computePenalty(opp: Opportunity, profile: UserProfile): number {
  const oppText = `${opp.title} ${opp.description}`.toLowerCase();
  const hasLowFitSignal = LOW_FIT_SIGNALS.some(s => oppText.includes(s));
  if (hasLowFitSignal && profile.activelyLooking) return 2.5;
  if (hasLowFitSignal)                            return 1.5;
  if (opp.category === 'ignore')                  return 3;
  if (opp.category === 'entertainment' && profile.activelyLooking) return 1;
  if (opp.category === 'personal' && profile.activelyLooking)      return 0.5;
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPLANATION BUILDER
// Produces one human-readable sentence summarising why the opp ranked where it did.
// ─────────────────────────────────────────────────────────────────────────────

function buildExplanation(
  opp:     Opportunity,
  prefFit: PrefFitResult,
  urgency: number,
  aiScore: number | null,
  aiExpl:  string,
  today:   string,
): string {
  if (aiScore !== null && aiExpl) return `[AI] ${aiExpl}`;

  const parts: string[] = [];

  if (opp.deadline) {
    const days = daysUntil(opp.deadline, today);
    if (days <= 0)       parts.push('OVERDUE — act immediately');
    else if (days === 1) parts.push('Due tomorrow');
    else if (days <= 3)  parts.push(`Due in ${days} days — urgent`);
    else if (urgency >= 4) parts.push(`Deadline in ${days} days`);
  }

  if (prefFit.matchedTerms.length > 0) {
    const samples = prefFit.matchedTerms.slice(0, 3).join(', ');
    parts.push(`matches your profile (${samples})`);
  } else if (prefFit.score === 0) {
    parts.push('no profile match — ranked by urgency & category');
  }

  const categoryDetail: Partial<Record<EmailCategory, string>> = {
    internship_application: 'high-impact application',
    networking:             'direct recruiter/professional access',
    professional_event:     'professional development',
    classes:                'academic deadline',
    internship_research:    'career research',
    deadline:               'hard deadline',
    entertainment:          'personal balance',
    personal:               'personal message',
  };
  if (categoryDetail[opp.category]) parts.push(categoryDetail[opp.category]!);

  if (opp.estimatedHours <= 1)    parts.push('quick win — under 1h');
  else if (opp.estimatedHours >= 4) parts.push(`requires ~${opp.estimatedHours}h`);

  return parts.join(' — ') || 'Detected from email';
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Re-rank a list of opportunities using the 4-layer scoring model.
 * Any previously stored aiRelevanceScore on each opp is preserved and blended in.
 */
export function rankOpportunities(
  opportunities: Opportunity[],
  profile: UserProfile,
  today?: string,
): Opportunity[] {
  const t = today ?? getTodayString();

  const profileSummary = [
    profile.careerGoals,
    profile.professionalInterests,
    profile.targetIndustries,
  ].filter(Boolean).join(' | ') || '(empty)';

  const ranked = opportunities.map((opp): Opportunity => {
    // Expired — sink immediately, no scoring needed
    if (isOpportunityExpired(opp)) {
      const debug: RankingDebug = {
        baseActionabilityScore: 0, urgency: 0, effort: 0, confidence: 0,
        preferenceFitScore: 0, profileCoverage: 0, matchedTerms: [], matchedSignals: [],
        careerValueScore: 0,
        aiRelevanceScore: opp.aiRelevanceScore ?? null,
        aiExplanation: opp.aiExplanation ?? '',
        penalty: 0, finalScore: 0,
        explanation: 'Deadline has passed',
        today: t,
        // backward compat
        preferenceFit: 0, careerImpact: 0, composite: 0, matchedKeywords: [],
      };
      return { ...opp, priority: 0, priorityReason: 'Deadline has passed.', rankingDebug: debug };
    }

    // Layer 1
    const base    = computeBaseActionability(opp, t);
    // Layer 2
    const pref    = computePreferenceFit(opp, profile);
    // Layer 3
    const career  = careerValueScore(opp.category);
    // Layer 4 — use previously stored AI score if present
    const aiScore = opp.aiRelevanceScore ?? null;
    const aiExpl  = opp.aiExplanation ?? '';
    // Penalty
    const penalty = computePenalty(opp, profile);

    const finalScore = computeFinalScore(pref.score, career, base.score, penalty, aiScore);
    const explanation = buildExplanation(opp, pref, base.urgency, aiScore, aiExpl, t);

    const composite = pref.score * W_NO_AI.pref + career * W_NO_AI.career + base.score * W_NO_AI.action;

    const debug: RankingDebug = {
      // Layer 1
      baseActionabilityScore: Math.round(base.score * 10) / 10,
      urgency:    base.urgency,
      effort:     base.effort,
      confidence: base.confidence,
      // Layer 2
      preferenceFitScore: Math.round(pref.score * 10) / 10,
      profileCoverage:    Math.round(pref.profileCoverage * 100) / 100,
      matchedTerms:       pref.matchedTerms,
      matchedSignals:     pref.matchedSignals,
      // Layer 3
      careerValueScore: career,
      // Layer 4
      aiRelevanceScore: aiScore !== null ? Math.round(aiScore * 10) / 10 : null,
      aiExplanation:    aiExpl,
      // Composite
      penalty:     Math.round(penalty * 10) / 10,
      finalScore,
      explanation,
      today: t,
      // Backward compat aliases
      preferenceFit:   Math.round(pref.score * 10) / 10,
      careerImpact:    career,
      composite:       Math.round(composite * 100) / 100,
      matchedKeywords: pref.matchedTerms,
    };

    console.debug(
      `[rank] "${opp.title}" | pref=${debug.preferenceFitScore} career=${career} action=${debug.baseActionabilityScore} ai=${aiScore ?? '—'} final=${finalScore} | matched=[${pref.matchedTerms.slice(0, 3).join(',')}] | profile="${profileSummary.slice(0, 80)}"`,
    );

    return {
      ...opp,
      priority:      finalScore,
      priorityReason: explanation,
      rankingDebug:  debug,
    };
  });

  console.debug(`[rank] Ranked ${ranked.length} opps | profile: "${profileSummary.slice(0, 80)}"`);
  return ranked.sort((a, b) => b.priority - a.priority);
}

/**
 * Score a single opportunity (used outside of bulk ranking).
 */
export function scoreOpportunity(
  opp:     Opportunity,
  profile: UserProfile,
  today?:  string,
): number {
  const t       = today ?? getTodayString();
  const base    = computeBaseActionability(opp, t);
  const pref    = computePreferenceFit(opp, profile);
  const career  = careerValueScore(opp.category);
  const penalty = computePenalty(opp, profile);
  return computeFinalScore(pref.score, career, base.score, penalty, opp.aiRelevanceScore ?? null);
}
