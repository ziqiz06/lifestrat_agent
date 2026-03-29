import { NextRequest } from 'next/server';
import type { EmailCategory } from '@/types';

const API_URL = process.env.K2_API_URL!;
const API_KEY = process.env.K2_API_KEY!;
const MODEL   = process.env.K2_MODEL ?? 'MBZUAI-IFM/K2-Think-v2';

const SYSTEM_PROMPT = `You are an email classifier for a student career planning app.

Classify each email into exactly one category:

- internship_application  — job/internship application confirmations, interview invites, recruiting outreach from companies
- internship_research     — company info, career fair announcements, internship program descriptions
- professional_event      — workshops, career fairs, networking events, info sessions with a specific date/time
- networking              — alumni outreach, coffee chat requests, club networking, LinkedIn-style messages
- classes                 — course emails, homework, TA messages, professor updates, academic deadlines, registration
- deadline                — time-sensitive form submissions, RSVPs, sign-ups with an explicit cutoff date
- entertainment           — social events, parties, non-academic club events, fun activities
- personal                — personal/family/friend messages, non-professional
- ignore                  — newsletters, mass marketing, spam, promotional, system notifications, receipts

Rules:
- If an email has a specific event time (e.g. "6pm Tuesday") AND is career-related → professional_event
- If it asks you to submit something by a date → deadline (unless it's a job application → internship_application)
- If from a professor/TA/course system → classes
- When unsure between two categories, pick the one with higher career relevance

Respond with ONLY a JSON array in the same order as the input:
[{"id": "<id>", "category": "<category>"}, ...]`;

export async function POST(req: NextRequest) {
  const { emails } = await req.json() as {
    emails: Array<{ id: string; from: string; subject: string; body: string }>;
  };

  if (!emails?.length) return Response.json({ categories: [] });

  // Batch into groups of 20 to stay within context limits
  const allCategories: { id: string; category: EmailCategory }[] = [];

  const BATCH = 20;
  for (let i = 0; i < emails.length; i += BATCH) {
    const batch = emails.slice(i, i + BATCH);

    const userMessage = batch
      .map((e, idx) =>
        `[${idx + 1}] id=${e.id}\nFrom: ${e.from}\nSubject: ${e.subject}\nBody snippet: ${e.body.slice(0, 400)}`,
      )
      .join('\n\n---\n\n');

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
          { role: 'user', content: userMessage },
        ],
        stream: false,
      }),
    });

    if (!upstream.ok) continue;

    const json = await upstream.json();
    let raw: string = json.choices?.[0]?.message?.content ?? '[]';

    // Strip <think> chain-of-thought
    const thinkClose = raw.indexOf('</think>');
    if (thinkClose !== -1) raw = raw.slice(thinkClose + '</think>'.length).trim();

    const start = raw.indexOf('[');
    const end   = raw.lastIndexOf(']');
    if (start === -1 || end === -1) continue;

    try {
      const parsed: { id: string; category: EmailCategory }[] = JSON.parse(raw.slice(start, end + 1));
      allCategories.push(...parsed);
    } catch {
      // Skip bad batch — opportunities will be unranked but not crashed
    }
  }

  return Response.json({ categories: allCategories });
}
