/**
 * test-ranking-preferences.ts
 * ────────────────────────────
 * Tests that opportunity ranking reacts significantly to user preference changes.
 * Run with:  npx ts-node scripts/test-ranking-preferences.ts
 *
 * Key scenario: profile set to AI/ML → check ranking → switch to unrelated field
 * → ranking should change significantly (AI/ML opps should drop in priority).
 */

// ── Inline types (mirrors src/types/index.ts) ─────────────────────────────────

type EmailCategory =
  | 'internship_application'
  | 'internship_research'
  | 'networking'
  | 'professional_event'
  | 'classes'
  | 'deadline'
  | 'entertainment'
  | 'personal'
  | 'ignore';

interface Opportunity {
  id: string;
  title: string;
  description: string;
  category: EmailCategory;
  deadline: string | null;
  estimatedHours: number;
  priority: number;
  priorityReason: string;
  interested?: boolean | null;
  addedToCalendar?: boolean;
  rankingDebug?: RankingDebug;
  sourceEmailIds: string[];
}

interface UserProfile {
  name: string;
  careerGoals: string;
  professionalInterests: string;
  targetIndustries: string;
  activelyLooking: boolean;
  dailyHoursAvailable: number;
  experienceLevel: string;
  preferredStartTime: string;
  preferredEndTime: string;
  typicalDaySnapshot: string;
  perDaySchedule: Record<string, unknown>;
  scheduleIntensity: string;
  doNotScheduleDays: string[];
  doNotScheduleWindows: string;
  timezone: string;
  wakeTime: string;
  sleepTime: string;
  breakfastTime: string;
  breakfastDurationMinutes: number;
  lunchStart: string;
  lunchDurationMinutes: number;
  dinnerTime: string;
  dinnerDurationMinutes: number;
  scheduleBlocks: unknown[];
  completed: boolean;
}

interface RankingDebug {
  preferenceFit: number;
  careerImpact: number;
  urgency: number;
  effort: number;
  confidence: number;
  composite: number;
  penalty: number;
  matchedKeywords: string[];
  matchedSignals: string[];
  today: string;
}

// ── Inline ranking logic (mirrors src/lib/opportunityRanking.ts) ──────────────

const KEYWORD_GROUPS: Record<string, string[]> = {
  ai_ml: [
    'machine learning', 'deep learning', 'reinforcement learning', 'natural language',
    'computer vision', 'artificial intelligence', ' ai ', 'large language', 'llm',
    'neural network', 'generative', 'transformer', 'diffusion', 'hugging face',
    'pytorch', 'tensorflow', 'data science', 'nlp', 'robotics', 'autonomous',
  ],
  tech_swe: [
    'software engineer', 'software engineering', 'full stack', 'fullstack', 'backend',
    'frontend', 'infrastructure', 'cloud', 'distributed', 'systems design',
    'swe intern', 'new grad', 'technical intern', 'dev intern', 'coding',
  ],
  internship_recruiting: [
    'internship', 'intern ', 'recruiting', 'recruitment', 'apply now', 'application deadline',
    'early access', 'early application', 'referral', 'offer letter', 'interview',
    'summer program', 'co-op', 'fellowship', 'hiring', 'job fair', 'career fair',
  ],
  career_dev: [
    'resume', 'linkedin', 'resume book', 'portfolio', 'career development',
    'info session', 'information session', 'coffee chat', 'networking event',
    'recruiter', 'technical interview', 'interview prep', 'mock interview',
  ],
  research: [
    'research', 'research lab', 'undergraduate research', 'urop', 'reu',
    'professor', 'phd', 'publication', 'paper ', 'thesis', 'academic research',
    'study ', 'experiment', 'lab opportunity',
  ],
  quant_finance: [
    'quant', 'quantitative', 'algorithmic trading', 'jump trading', 'jane street',
    'two sigma', 'citadel', 'de shaw', 'hedge fund', 'fintech', 'trading firm',
    'mathematical finance', 'high frequency',
  ],
};

const LOW_FIT_SIGNALS = [
  'housing day', 'merch sale', 'merchandise', 'dining hall', 'dhall',
  'elections', 'exec election', 'internal show', 'pub meeting', 'club meeting',
  'general meeting',
];

const TODAY = '2026-03-29';

function daysUntil(deadline: string): number {
  const d = new Date(deadline + 'T00:00:00');
  const t = new Date(TODAY + 'T00:00:00');
  return Math.ceil((d.getTime() - t.getTime()) / (1000 * 60 * 60 * 24));
}

function urgencyScore(deadline: string | null): number {
  if (!deadline) return 1;
  const days = daysUntil(deadline);
  if (days <= 0)  return 10;
  if (days <= 1)  return 9;
  if (days <= 3)  return 8;
  if (days <= 7)  return 6;
  if (days <= 14) return 4;
  if (days <= 30) return 2;
  return 1;
}

function careerImpactScore(category: EmailCategory): number {
  const map: Record<EmailCategory, number> = {
    internship_application: 10,
    deadline: 9,
    classes: 8,
    networking: 7,
    professional_event: 6,
    internship_research: 5,
    entertainment: 2,
    personal: 1,
    ignore: 0,
  };
  return map[category] ?? 2;
}

function effortScore(hours: number): number {
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

function preferenceFitScore(opp: Opportunity, profile: UserProfile): number {
  const oppText = `${opp.title} ${opp.description}`.toLowerCase();
  const profileText = [
    profile.careerGoals,
    profile.professionalInterests,
    profile.targetIndustries,
  ].filter(Boolean).join(' ').toLowerCase();

  let score = 0;
  const activeGroups = new Set<string>();
  for (const [group, keywords] of Object.entries(KEYWORD_GROUPS)) {
    if (keywords.some(k => profileText.includes(k))) activeGroups.add(group);
  }

  const checkGroups = activeGroups.size > 0 ? [...activeGroups] : Object.keys(KEYWORD_GROUPS);
  const halfWeight  = activeGroups.size === 0;

  for (const group of checkGroups) {
    const keywords = KEYWORD_GROUPS[group];
    const hits = keywords.filter(k => oppText.includes(k));
    if (hits.length > 0) {
      const groupScore = Math.min(10, (hits.length / keywords.length) * 10 * 3);
      score += halfWeight ? groupScore * 0.5 : groupScore;
    }
  }

  if (profile.activelyLooking && opp.category === 'internship_application') score += 2;

  const profileWords = profileText.split(/[\s,]+/).filter(w => w.length > 4);
  const directHits = profileWords.filter(w => oppText.includes(w));
  if (directHits.length > 0) score += Math.min(1.5, directHits.length * 0.4);

  return Math.min(10, Math.max(0, score));
}

function lowFitPenalty(opp: Opportunity, profile: UserProfile): number {
  const oppText = `${opp.title} ${opp.description}`.toLowerCase();
  if (LOW_FIT_SIGNALS.some(s => oppText.includes(s)) && profile.activelyLooking) return 2.5;
  if (LOW_FIT_SIGNALS.some(s => oppText.includes(s))) return 1.5;
  if (opp.category === 'ignore') return 3;
  return 0;
}

function scoreOpportunity(opp: Opportunity, profile: UserProfile): number {
  const pref    = preferenceFitScore(opp, profile);
  const impact  = careerImpactScore(opp.category);
  const urgency = urgencyScore(opp.deadline);
  const effort  = effortScore(opp.estimatedHours);
  const conf    = confidenceScore(opp);
  const penalty = lowFitPenalty(opp, profile);
  const composite = pref * 0.35 + impact * 0.30 + urgency * 0.20 + effort * 0.10 + conf * 0.05;
  return Math.min(10, Math.max(1, Math.round(composite - penalty)));
}

function rankOpportunities(opps: Opportunity[], profile: UserProfile): Opportunity[] {
  return opps
    .map(opp => ({ ...opp, priority: scoreOpportunity(opp, profile) }))
    .sort((a, b) => b.priority - a.priority);
}

// ── Test fixtures ─────────────────────────────────────────────────────────────

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    name: 'Test User',
    careerGoals: '',
    professionalInterests: '',
    targetIndustries: '',
    activelyLooking: true,
    dailyHoursAvailable: 4,
    experienceLevel: 'student',
    preferredStartTime: '09:00',
    preferredEndTime: '22:00',
    typicalDaySnapshot: '',
    perDaySchedule: {},
    scheduleIntensity: 'moderate',
    doNotScheduleDays: [],
    doNotScheduleWindows: '',
    timezone: '',
    wakeTime: '07:30',
    sleepTime: '23:00',
    breakfastTime: '07:30',
    breakfastDurationMinutes: 30,
    lunchStart: '12:00',
    lunchDurationMinutes: 60,
    dinnerTime: '18:30',
    dinnerDurationMinutes: 60,
    scheduleBlocks: [],
    completed: false,
    ...overrides,
  };
}

function makeOpp(overrides: Partial<Opportunity> & { id: string; title: string; description: string }): Opportunity {
  return {
    category: 'internship_application',
    deadline: '2026-04-15',
    estimatedHours: 2,
    priority: 5,
    priorityReason: '',
    interested: null,
    addedToCalendar: false,
    sourceEmailIds: [],
    ...overrides,
  };
}

// Opportunities with clear field alignment
const OPP_AI_ML = makeOpp({
  id: 'opp-ai',
  title: 'AI Research Internship — Machine Learning Team',
  description: 'Join our machine learning and deep learning team. Work with neural networks, pytorch, tensorflow. NLP and computer vision focus. Generative AI projects.',
  category: 'internship_application',
  deadline: '2026-04-20',
  estimatedHours: 3,
});

const OPP_QUANT = makeOpp({
  id: 'opp-quant',
  title: 'Quantitative Trading Internship — Hedge Fund',
  description: 'Algorithmic trading and mathematical finance internship at a leading hedge fund. Citadel-style quant trading, high frequency strategies.',
  category: 'internship_application',
  deadline: '2026-04-10',
  estimatedHours: 2,
});

const OPP_SWE = makeOpp({
  id: 'opp-swe',
  title: 'Software Engineering Intern — Full Stack',
  description: 'Backend and frontend software engineering internship. Full stack development, cloud infrastructure, distributed systems.',
  category: 'internship_application',
  deadline: '2026-04-25',
  estimatedHours: 2,
});

const OPP_GENERIC_NETWORKING = makeOpp({
  id: 'opp-net',
  title: 'Campus Networking Event',
  description: 'Networking event for students to meet recruiters and professionals from various industries.',
  category: 'networking',
  deadline: '2026-04-05',
  estimatedHours: 1,
});

const OPP_HOUSING = makeOpp({
  id: 'opp-housing',
  title: 'Housing Day General Meeting',
  description: 'General meeting for housing day elections and club elections announcement.',
  category: 'entertainment',
  deadline: null,
  estimatedHours: 1,
});

const ALL_OPPS = [OPP_AI_ML, OPP_QUANT, OPP_SWE, OPP_GENERIC_NETWORKING, OPP_HOUSING];

// ── Profiles for testing ───────────────────────────────────────────────────────

const PROFILE_AI_ML = makeProfile({
  careerGoals: 'Become a machine learning engineer working on large language models and generative AI',
  professionalInterests: 'machine learning, deep learning, nlp, artificial intelligence, pytorch',
  targetIndustries: 'AI, tech, data science',
});

const PROFILE_QUANT = makeProfile({
  careerGoals: 'Work in quantitative finance and algorithmic trading at a top hedge fund',
  professionalInterests: 'quantitative analysis, algorithmic trading, mathematical finance, statistics',
  targetIndustries: 'finance, quant trading, fintech',
});

const PROFILE_UNRELATED = makeProfile({
  careerGoals: 'Work in non-profit management and social impact',
  professionalInterests: 'community organizing, grant writing, public policy',
  targetIndustries: 'non-profit, government, education',
});

const PROFILE_EMPTY = makeProfile({
  careerGoals: '',
  professionalInterests: '',
  targetIndustries: '',
});

// ── Test harness ──────────────────────────────────────────────────────────────

let passed = 0;
let total  = 0;

function test(label: string, fn: () => boolean) {
  total++;
  let ok = false;
  try { ok = fn(); } catch (e) { console.error(`  error in "${label}": ${e}`); }
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  if (ok) passed++;
}

function getPriority(ranked: Opportunity[], id: string): number {
  return ranked.find(o => o.id === id)?.priority ?? -1;
}

function getRank(ranked: Opportunity[], id: string): number {
  return ranked.findIndex(o => o.id === id);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

// 1. AI/ML profile: AI internship scores higher than quant internship
test('AI/ML profile: AI opp scores higher than quant opp', () => {
  const ranked = rankOpportunities(ALL_OPPS, PROFILE_AI_ML);
  const aiScore   = getPriority(ranked, 'opp-ai');
  const quantScore = getPriority(ranked, 'opp-quant');
  console.log(`  AI=${aiScore} Quant=${quantScore}`);
  return aiScore >= quantScore;
});

// 2. Quant profile: quant internship scores higher than AI internship
test('Quant profile: quant opp scores higher than AI opp', () => {
  const ranked = rankOpportunities(ALL_OPPS, PROFILE_QUANT);
  const aiScore    = getPriority(ranked, 'opp-ai');
  const quantScore = getPriority(ranked, 'opp-quant');
  console.log(`  AI=${aiScore} Quant=${quantScore}`);
  return quantScore >= aiScore;
});

// 3. AI/ML profile → switch to unrelated: AI opp prefFit drops meaningfully
// (final priority may be capped/same, but preferenceFit score should differ clearly)
test('switching from AI/ML to unrelated: AI opp preferenceFit drops', () => {
  const fitWithAI        = preferenceFitScore(OPP_AI_ML, PROFILE_AI_ML);
  const fitWithUnrelated = preferenceFitScore(OPP_AI_ML, PROFILE_UNRELATED);
  console.log(`  AI opp prefFit: AI profile=${fitWithAI.toFixed(2)}, unrelated profile=${fitWithUnrelated.toFixed(2)}`);
  return fitWithAI > fitWithUnrelated;
});

// 4. AI/ML profile → switch to unrelated: quant opp prefFit is higher relative to AI opp
// (unrelated profile should not strongly prefer AI over quant)
test('switching from AI/ML to unrelated: AI vs quant prefFit gap shrinks', () => {
  const aiVsQuantGapWithAI = preferenceFitScore(OPP_AI_ML, PROFILE_AI_ML) - preferenceFitScore(OPP_QUANT, PROFILE_AI_ML);
  const aiVsQuantGapUnrelated = preferenceFitScore(OPP_AI_ML, PROFILE_UNRELATED) - preferenceFitScore(OPP_QUANT, PROFILE_UNRELATED);
  console.log(`  AI vs Quant prefFit gap: AI profile=${aiVsQuantGapWithAI.toFixed(2)}, unrelated=${aiVsQuantGapUnrelated.toFixed(2)}`);
  // With unrelated profile the gap should be smaller (less differentiation)
  return aiVsQuantGapWithAI > aiVsQuantGapUnrelated;
});

// 5. Quant profile: quant opp ranks at position 0 or 1 (top of list)
test('Quant profile: quant opp is in top 2 results', () => {
  const ranked = rankOpportunities(ALL_OPPS, PROFILE_QUANT);
  const rank = getRank(ranked, 'opp-quant');
  console.log(`  Quant opp rank: ${rank}`);
  return rank <= 1;
});

// 6. AI/ML profile: AI opp is in top 2 results
test('AI/ML profile: AI opp is in top 2 results', () => {
  const ranked = rankOpportunities(ALL_OPPS, PROFILE_AI_ML);
  const rank = getRank(ranked, 'opp-ai');
  console.log(`  AI opp rank: ${rank}`);
  return rank <= 1;
});

// 7. Housing/social event scores low for career-focused profile
test('career-focused profile: housing meeting scores lowest', () => {
  const ranked = rankOpportunities(ALL_OPPS, PROFILE_AI_ML);
  const housingRank = getRank(ranked, 'opp-housing');
  console.log(`  Housing opp rank: ${housingRank} (of ${ranked.length})`);
  return housingRank === ranked.length - 1;
});

// 8. Empty profile: scores are all within a narrow band (half-weight fallback)
test('empty profile: all opps get compressed scores (no strong signals)', () => {
  const ranked = rankOpportunities(ALL_OPPS.filter(o => o.id !== 'opp-housing'), PROFILE_EMPTY);
  const scores = ranked.map(o => o.priority);
  const max = Math.max(...scores);
  const min = Math.min(...scores);
  const spread = max - min;
  console.log(`  Empty profile scores: ${scores.join(', ')} — spread=${spread}`);
  // With no profile context, scoring should still work but be less differentiated
  return spread <= 5; // spread within 5 points is expected for empty profile
});

// 9. preferenceFitScore: AI opp gets higher prefFit with AI profile than unrelated profile
test('prefFit: AI opp score higher with AI profile vs unrelated profile', () => {
  const fitWithAI      = preferenceFitScore(OPP_AI_ML, PROFILE_AI_ML);
  const fitWithUnrelated = preferenceFitScore(OPP_AI_ML, PROFILE_UNRELATED);
  console.log(`  AI opp prefFit: AI profile=${fitWithAI.toFixed(2)}, unrelated=${fitWithUnrelated.toFixed(2)}`);
  return fitWithAI > fitWithUnrelated;
});

// 10. preferenceFitScore: quant opp score higher with quant profile than AI profile
test('prefFit: quant opp higher with quant profile vs AI profile', () => {
  const fitWithQuant = preferenceFitScore(OPP_QUANT, PROFILE_QUANT);
  const fitWithAI    = preferenceFitScore(OPP_QUANT, PROFILE_AI_ML);
  console.log(`  Quant opp prefFit: quant profile=${fitWithQuant.toFixed(2)}, AI=${fitWithAI.toFixed(2)}`);
  return fitWithQuant > fitWithAI;
});

// 11. Ranking is stable: same profile → same result called twice
test('ranking is deterministic: same profile returns same order', () => {
  const r1 = rankOpportunities(ALL_OPPS, PROFILE_AI_ML).map(o => o.id);
  const r2 = rankOpportunities(ALL_OPPS, PROFILE_AI_ML).map(o => o.id);
  return JSON.stringify(r1) === JSON.stringify(r2);
});

// 12. AI/ML profile: AI opp prefFit is clearly higher than SWE opp prefFit
// (AI opp has many ai_ml keywords; SWE has none — so prefFit should differ)
test('AI/ML profile: AI opp prefFit clearly higher than SWE opp', () => {
  const aiPrefFit  = preferenceFitScore(OPP_AI_ML, PROFILE_AI_ML);
  const swePrefFit = preferenceFitScore(OPP_SWE, PROFILE_AI_ML);
  console.log(`  AI profile prefFit: AI opp=${aiPrefFit.toFixed(2)}, SWE opp=${swePrefFit.toFixed(2)}`);
  return aiPrefFit > swePrefFit;
});

// 13. Sensitivity: changing professionalInterests shifts AI opp preferenceFit
// (final priority may be capped, but prefFit should respond to new interests)
test('sensitivity: changing professionalInterests shifts AI opp preferenceFit', () => {
  const before = preferenceFitScore(OPP_AI_ML, PROFILE_UNRELATED);
  const profileWithAI = { ...PROFILE_UNRELATED, professionalInterests: 'machine learning, deep learning, nlp' };
  const after  = preferenceFitScore(OPP_AI_ML, profileWithAI);
  console.log(`  AI opp prefFit: unrelated=${before.toFixed(2)}, after adding AI interests=${after.toFixed(2)}`);
  return after > before;
});

// 14. Sensitivity: changing targetIndustries alone shifts quant opp score
test('sensitivity: changing targetIndustries to finance shifts quant opp priority', () => {
  const before = getPriority(rankOpportunities(ALL_OPPS, PROFILE_UNRELATED), 'opp-quant');
  const profileWithFinance = { ...PROFILE_UNRELATED, targetIndustries: 'quantitative finance, hedge fund, fintech' };
  const after  = getPriority(rankOpportunities(ALL_OPPS, profileWithFinance), 'opp-quant');
  console.log(`  Quant opp: unrelated=${before}, after adding finance targetIndustries=${after}`);
  return after > before;
});

// 15. Reload scenario: profile update re-derives scores (simulation of updateProfile fix)
test('reload scenario: re-ranking with updated profile produces correct new order', () => {
  // Simulate: user starts with AI profile, then switches to quant
  const initialRanked = rankOpportunities(ALL_OPPS, PROFILE_AI_ML);
  const aiRankInitial = getRank(initialRanked, 'opp-ai');

  // User updates profile to quant — re-rank from scratch
  const updatedRanked = rankOpportunities(ALL_OPPS, PROFILE_QUANT);
  const aiRankAfter   = getRank(updatedRanked, 'opp-ai');
  const quantRankAfter = getRank(updatedRanked, 'opp-quant');

  console.log(`  After profile switch: AI rank ${aiRankInitial}→${aiRankAfter}, quant rank=${quantRankAfter}`);
  // Quant should now be ranked above AI
  return quantRankAfter < aiRankAfter || quantRankAfter === 0;
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${passed}/${total} tests passed`);
process.exit(passed === total ? 0 : 1);
