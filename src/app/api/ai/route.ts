import { NextRequest } from 'next/server';

const API_URL = process.env.K2_API_URL!;
const API_KEY = process.env.K2_API_KEY!;
const MODEL = process.env.K2_MODEL ?? 'MBZUAI-IFM/K2-Think-v2';

export async function POST(req: NextRequest) {
  const { messages, stream = true } = await req.json();

  const upstream = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
      Accept: 'application/json',
    },
    body: JSON.stringify({ model: MODEL, messages, stream }),
  });

  if (!upstream.ok) {
    const err = await upstream.text();
    return new Response(JSON.stringify({ error: err }), {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Pass the SSE stream straight through to the client
  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
