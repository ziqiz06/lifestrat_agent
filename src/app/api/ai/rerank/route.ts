import { NextRequest } from 'next/server';

const API_URL = process.env.K2_API_URL!;
const API_KEY = process.env.K2_API_KEY!;
const MODEL   = process.env.K2_MODEL ?? 'MBZUAI-IFM/K2-Think-v2';

const SYSTEM_PROMPT = `You are an expert career advisor helping a college student prioritize opportunities.

You will receive:
1. A user profile (career goals, interests, target industries, experience level)
2. A list of opportunities already scored by a heuristic ranker

Your job is to re-rank them using deeper semantic reasoning — considering career trajectory, strategic timing, competitive advantage, and genuine fit with the user's goals.

CRITICAL OUTPUT REQUIREMENT:
Respond with ONLY a valid JSON object. No markdown, no prose, no explanation — just raw JSON.

{
  "reranked": [
    { "id": "<opp id>", "aiPriority": <integer 1-10>, "aiReason": "<1 concise sentence>" }
  ],
  "summary": "<1-2 sentences on the overall ranking rationale>"
}

Rules:
- Every input opportunity ID must appear in the output exactly once.
- aiPriority must be an integer 1–10.
- Strongly boost opportunities that directly match the user's stated career goals and interests.
- For internship applications and recruiting events near deadline, amplify urgency in your ranking.
- Downrank poor-fit opportunities even if they have high urgency (e.g. club elections, social events, internal announcements).
- Surface hidden gems — an opportunity may have a low heuristic score but high strategic value.
- Be specific in aiReason — explain WHY this ranks where it does, not just what it is.
- Do not simply echo the heuristic score.`;

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
