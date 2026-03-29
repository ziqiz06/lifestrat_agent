import { NextRequest } from 'next/server';

interface GmailHeader { name: string; value: string; }
interface GmailPart {
  mimeType: string;
  body: { data?: string; size: number };
  parts?: GmailPart[];
}
interface GmailMessage {
  id: string;
  internalDate: string;
  payload: {
    headers: GmailHeader[];
    mimeType: string;
    body: { data?: string; size: number };
    parts?: GmailPart[];
  };
}

function decodeBase64url(str: string): string {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  try {
    return Buffer.from(base64, 'base64').toString('utf-8');
  } catch {
    return '';
  }
}

function extractPlainText(payload: GmailMessage['payload']): string {
  // Direct plain-text body (simple messages)
  if (payload.mimeType === 'text/plain' && payload.body.data) {
    return decodeBase64url(payload.body.data);
  }
  // Walk parts — prefer text/plain
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body.data) {
        return decodeBase64url(part.body.data);
      }
    }
    // Recurse into multipart children
    for (const part of payload.parts) {
      if (part.parts) {
        const nested = extractPlainText({ ...payload, mimeType: part.mimeType, body: part.body, parts: part.parts });
        if (nested) return nested;
      }
    }
    // Fallback: HTML stripped of tags
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body.data) {
        const html = decodeBase64url(part.body.data);
        return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      }
    }
  }
  return '';
}

function getHeader(headers: GmailHeader[], name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
}

export async function POST(req: NextRequest) {
  const { token } = await req.json() as { token: string };
  if (!token) return Response.json({ error: 'No token' }, { status: 400 });

  // Fetch list of recent inbox messages (last 60 days)
  const listRes = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50&labelIds=INBOX&q=newer_than:60d',
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!listRes.ok) {
    const err = await listRes.text();
    return Response.json({ error: 'Gmail list failed', detail: err }, { status: listRes.status });
  }

  const list = await listRes.json() as { messages?: { id: string }[] };
  const ids = list.messages?.map((m) => m.id) ?? [];

  // Fetch full messages in batches of 15 to avoid rate limits
  const emails: Array<{ id: string; from: string; subject: string; body: string; date: string }> = [];

  for (let i = 0; i < ids.length; i += 15) {
    const batch = ids.slice(i, i + 15);
    const results = await Promise.all(
      batch.map((id) =>
        fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => (r.ok ? r.json() : null)),
      ),
    );

    for (const raw of results) {
      if (!raw) continue;
      const msg = raw as GmailMessage;
      const subject = getHeader(msg.payload.headers, 'subject') || '(no subject)';
      const from    = getHeader(msg.payload.headers, 'from');
      const date    = new Date(parseInt(msg.internalDate)).toISOString().slice(0, 10);
      const body    = extractPlainText(msg.payload).slice(0, 3000);
      emails.push({ id: `gmail-${msg.id}`, from, subject, body, date });
    }
  }

  return Response.json({ emails });
}
