"""
fetch_gmail.py
--------------
Fetches recent emails from Gmail, categorizes them with K2, and writes
the result to src/data/realEmails.json for the Next.js app to consume.

Usage:
  source .venv/bin/activate
  python3 fetch_gmail.py

On first run it will open a browser to authorize with your Google account.
The token is saved to token.json so you don't need to re-authorize each time.
"""

import os
import json
import base64
import re
import requests
from datetime import datetime, timezone

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

# ── Config ────────────────────────────────────────────────────────────────────

CLIENT_SECRET_FILE = "client_secret_331544355828-ulu5avpm3pjqq8fi04q44kl2ae828rif.apps.googleusercontent.com.json"
TOKEN_FILE         = "token.json"
OUTPUT_FILE        = "src/data/realEmails.json"
ENV_FILE           = ".env.local"

SCOPES     = ["https://www.googleapis.com/auth/gmail.readonly"]
MAX_EMAILS = 100
BATCH_SIZE = 20   # emails per K2 categorization call

VALID_CATEGORIES = {
    "internship_application", "internship_research", "professional_event",
    "networking", "classes", "deadline", "entertainment", "personal", "ignore",
}

# ── Load K2 credentials from .env.local ───────────────────────────────────────

def load_env(path=ENV_FILE):
    env = {}
    if not os.path.exists(path):
        return env
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                env[k.strip()] = v.strip()
    return env

# ── Gmail auth ────────────────────────────────────────────────────────────────

def get_credentials():
    creds = None
    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRET_FILE, SCOPES)
            try:
                creds = flow.run_local_server(port=0)
            except Exception:
                print("\nLocal server auth failed — falling back to manual flow.")
                creds = flow.run_console()
        with open(TOKEN_FILE, "w") as f:
            f.write(creds.to_json())
    return creds

# ── Email parsing helpers ─────────────────────────────────────────────────────

def decode_body(payload):
    mime = payload.get("mimeType", "")
    if mime == "text/plain":
        data = payload.get("body", {}).get("data", "")
        if data:
            return base64.urlsafe_b64decode(data + "==").decode("utf-8", errors="replace")
    if mime.startswith("multipart/"):
        for part in payload.get("parts", []):
            result = decode_body(part)
            if result:
                return result
    return ""

def get_header(headers, name):
    for h in headers:
        if h["name"].lower() == name.lower():
            return h["value"]
    return ""

def parse_date(raw_date: str) -> str:
    for fmt in [
        "%a, %d %b %Y %H:%M:%S %z",
        "%a, %d %b %Y %H:%M:%S %Z",
        "%d %b %Y %H:%M:%S %z",
    ]:
        try:
            dt = datetime.strptime(raw_date.strip(), fmt)
            return dt.astimezone(timezone.utc).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return datetime.now().strftime("%Y-%m-%d")

def clean_body(text: str) -> str:
    text = re.sub(r"\r\n|\r", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()[:1500]

# ── K2 categorization ─────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are an email categorization assistant for a college student's life strategy app.

Categorize each email into exactly one of these categories:
- internship_application  — job/internship applications, recruiting emails, offer letters, interview invites
- internship_research     — company research, industry news relevant to job search, career tips
- professional_event      — career fairs, info sessions, recruiting events, company presentations
- networking              — networking invites, LinkedIn, alumni events, coffee chats
- classes                 — course emails, professor messages, homework, assignments, Ed posts, academic announcements
- deadline                — payment deadlines, registration deadlines, form submissions, urgent action required
- entertainment           — social events, parties, clubs, sports, concerts, dining, recreational activities
- personal                — personal messages from friends/family, housing, sublets, personal matters
- ignore                  — newsletters, mailing lists, automated digests, spam, promotional bulk email, unsubscribe

EMAIL REASONING RULES — apply these when deciding category:

1. Prefer future-facing emails. Prioritize emails about upcoming meetings, deadlines, events, follow-ups, and pending tasks. Deprioritize old resolved threads.
2. Treat time carefully. Compare the email's actual timestamp to today's date. Distinguish past, upcoming, overdue, and unscheduled. Never assume relative words like "tomorrow" without grounding them in the sent date.
3. Prefer actionable threads. Surface emails requiring a reply, decision, attendance, payment, confirmation, or document submission.
4. Mark a thread as actionable only if there is a pending task, unresolved question, future event, or expected follow-up. Mark it ignore if the matter is clearly resolved or purely informational.
5. Extract deadlines. For each email, consider: what is happening, when, and whether action is needed. Use this to inform the category.
6. Be explicit about uncertainty — if an email could fit multiple categories, choose the most actionable one.
7. Never assume an email is unimportant just because it is short.

Category guidance:
- Only return the JSON object, no explanation.
- Every email must get exactly one category.
- When in doubt between ignore and a real category, prefer the real category if it has genuine relevance.
- Mailing list digests (Harvard Gazette, bulk newsletters, Ed course digests with no specific action) → ignore
- Ed posts about specific assignments/deadlines → classes
- Club emails with actual upcoming events or deadlines → networking or professional_event
- Club social/party emails → entertainment
- Recruiting events from companies (Jump Trading, Stripe, etc.) → professional_event
- Resume books, LinkedIn outreach → networking"""

def categorize_batch(emails_batch, k2_url, k2_key, k2_model):
    """Send a batch of emails to K2 and return a dict of id → category."""
    lines = []
    for i, e in enumerate(emails_batch):
        snippet = f"From: {e['from'][:60]}\nSubject: {e['subject'][:120]}\nBody snippet: {e['body'][:300]}"
        lines.append(f"[{i}] ID={e['id']}\n{snippet}")

    user_message = (
        "Categorize each of the following emails. "
        "Return ONLY a JSON object mapping each email's ID to its category string.\n"
        "Example: {\"gmail-abc\": \"networking\", \"gmail-xyz\": \"ignore\"}\n\n"
        + "\n\n---\n\n".join(lines)
    )

    payload = {
        "model": k2_model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": user_message},
        ],
        "stream": False,
    }

    resp = requests.post(
        k2_url,
        headers={"Authorization": f"Bearer {k2_key}", "Content-Type": "application/json"},
        json=payload,
        timeout=120,
    )
    resp.raise_for_status()

    raw = resp.json()["choices"][0]["message"]["content"]

    # Strip <think>...</think> chain-of-thought
    think_end = raw.find("</think>")
    clean = raw[think_end + len("</think>"):].strip() if think_end != -1 else raw.strip()

    # Extract JSON object
    start = clean.find("{")
    end   = clean.rfind("}") + 1
    if start == -1 or end == 0:
        print(f"  Warning: could not find JSON in K2 response, defaulting batch to 'ignore'")
        return {}

    result = json.loads(clean[start:end])
    # Validate categories
    return {k: v if v in VALID_CATEGORIES else "ignore" for k, v in result.items()}

# ── Main ──────────────────────────────────────────────────────────────────────

def fetch_emails():
    env = load_env()
    k2_url   = env.get("K2_API_URL", "https://api.k2think.ai/v1/chat/completions")
    k2_key   = env.get("K2_API_KEY", "")
    k2_model = env.get("K2_MODEL", "MBZUAI-IFM/K2-Think-v2")

    if not k2_key:
        print("Warning: K2_API_KEY not found in .env.local — emails will not be categorized.")

    print("Authenticating with Gmail…")
    creds   = get_credentials()
    service = build("gmail", "v1", credentials=creds)

    print(f"Fetching up to {MAX_EMAILS} emails…")
    results  = service.users().messages().list(userId="me", maxResults=MAX_EMAILS, labelIds=["INBOX"]).execute()
    messages = results.get("messages", [])
    print(f"Found {len(messages)} messages. Fetching details…")

    emails = []
    for i, msg_ref in enumerate(messages):
        msg     = service.users().messages().get(userId="me", id=msg_ref["id"], format="full").execute()
        headers = msg.get("payload", {}).get("headers", [])

        emails.append({
            "id":      f"gmail-{msg_ref['id']}",
            "from":    get_header(headers, "From"),
            "subject": get_header(headers, "Subject"),
            "body":    clean_body(decode_body(msg.get("payload", {}))),
            "date":    parse_date(get_header(headers, "Date") or ""),
            "category": "ignore",
        })

        if (i + 1) % 10 == 0:
            print(f"  {i + 1}/{len(messages)} fetched…")

    # Sort newest first
    emails.sort(key=lambda e: e["date"], reverse=True)

    # ── Categorize with K2 ────────────────────────────────────────────────────
    if k2_key:
        print(f"\nCategorizing with K2 in batches of {BATCH_SIZE}…")
        categories: dict = {}
        batches = [emails[i:i + BATCH_SIZE] for i in range(0, len(emails), BATCH_SIZE)]

        for b_idx, batch in enumerate(batches):
            print(f"  Batch {b_idx + 1}/{len(batches)}…")
            try:
                result = categorize_batch(batch, k2_url, k2_key, k2_model)
                categories.update(result)
            except Exception as ex:
                print(f"  Batch {b_idx + 1} failed: {ex} — defaulting to 'ignore'")

        for email in emails:
            email["category"] = categories.get(email["id"], "ignore")

        non_ignore = sum(1 for e in emails if e["category"] != "ignore")
        print(f"  Categorized: {non_ignore}/{len(emails)} emails as actionable")

    os.makedirs("src/data", exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(emails, f, indent=2, ensure_ascii=False)

    print(f"\nDone. {len(emails)} emails saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    fetch_emails()
