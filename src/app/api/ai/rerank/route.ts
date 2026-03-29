import { NextRequest } from 'next/server';

const API_URL = process.env.K2_API_URL!;
const API_KEY = process.env.K2_API_KEY!;
const MODEL   = process.env.K2_MODEL ?? 'MBZUAI-IFM/K2-Think-v2';

const SYSTEM_PROMPT = `You are ranking opportunities for career relevance.

Your job is to assign an aiPriority from 1 to 10 for each opportunity based primarily on how well it aligns with the user's career direction.

Prioritize:
1. long-term career goal alignment
2. alignment with target roles / industries
3. meaningful career advancement value
4. semantic relevance, even when exact wording differs

Important:
Do not rely mainly on exact keyword overlap.
Use conceptual matching.
Related concepts should count as strong relevance.

Examples:
- "diplomat" is strongly related to "foreign service", "diplomacy", "international affairs", "diplomatic history", and "government policy"
- "finance" is related to "banking", "investing", "markets", and "valuation"
- "software engineering" is related to "backend", "frontend", "systems", "coding", and "product engineering"

Scoring guide:
1-2 = not relevant
3-4 = weakly relevant
5-6 = somewhat relevant
7-8 = clearly relevant
9-10 = strongly aligned with the user's career direction

Return JSON only in this exact format, no markdown, no prose:
{
  "results": [
    { "opportunityId": "<id>", "aiPriority": <integer 1-10>, "aiReason": "<short specific reason>" }
  ]
}

Rules:
- Every input ID must appear in results exactly once
- aiPriority must be an integer 1–10
- Keep aiReason short and specific`;

interface OppInput {
  id: string;
  title: string;
  description: string;
  category: string;
  deadline: string | null;
  priority: number;
  priorityReason: string;
}

interface ProfileInput {
  careerGoals: string;
  professionalInterests: string;
  targetIndustries: string;
  experienceLevel: string;
  activelyLooking: boolean;
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    opportunities: OppInput[];
    profile: ProfileInput;
    topN?: number;
  };

  const { opportunities, profile, topN = 10 } = body;
  const toRerank = opportunities.slice(0, topN);

  const oppList = toRerank.map((o, i) =>
    `[${i + 1}] ID: ${o.id}
Title: ${o.title}
Category: ${o.category}
Deadline: ${o.deadline ?? 'none'}
Current heuristic score: ${o.priority}/10
Reason: ${o.priorityReason}
Description: ${o.description.slice(0, 200)}`
  ).join('\n\n');

  const userMessage = `USER PROFILE:
- Career goals: ${profile.careerGoals || 'not specified'}
- Professional interests: ${profile.professionalInterests || 'not specified'}
- Target industries/roles: ${profile.targetIndustries || 'not specified'}
- Experience level: ${profile.experienceLevel}
- Actively seeking internships: ${profile.activelyLooking ? 'yes' : 'no'}

OPPORTUNITIES TO RE-RANK:
${oppList}

Re-rank these ${toRerank.length} opportunities. Return only the JSON object.`;

  const upstream = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: userMessage },
      ],
      stream: false,
    }),
  });

  if (!upstream.ok) {
    const err = await upstream.text();
    return Response.json({ error: err }, { status: upstream.status });
  }

  const json = await upstream.json();
  const raw: string = json.choices?.[0]?.message?.content ?? '';

  // Strip <think>...</think> chain-of-thought
  const thinkClose = raw.indexOf('</think>');
  const clean = thinkClose !== -1
    ? raw.slice(thinkClose + '</think>'.length).trim()
    : raw.trim();

  const start = clean.indexOf('{');
  const end   = clean.lastIndexOf('}') + 1;
  if (start === -1 || end === 0) {
    return Response.json({ error: 'No JSON in AI response', raw: clean.slice(0, 300) }, { status: 500 });
  }

  try {
    const result = JSON.parse(clean.slice(start, end));
    return Response.json(result);
  } catch {
    return Response.json({ error: 'Failed to parse AI rerank response', raw: clean.slice(0, 300) }, { status: 500 });
  }
}
