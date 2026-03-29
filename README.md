# LifeStrat — AI Career Strategy Assistant

An AI-powered career companion that imports your real Gmail inbox, surfaces the opportunities that matter, and builds a personalized schedule around your goals — without the overwhelm.

---

## Features

- **Gmail Import** — Connect your Gmail account and LifeStrat fetches your inbox, categorizes every email (internship applications, networking events, deadlines, classes, and more), and extracts actionable opportunities automatically.
- **AI Opportunity Ranking** — A 4-layer scoring system combines urgency, effort, preference fit, and career value with an AI semantic rerank that understands conceptual relevance — not just keyword overlap.
- **AI Schedule Planner** — Generates a daily/weekly schedule that slots in your opportunities around blocked time, meals, and existing commitments. Repairs conflicts and respects decisions you've already made.
- **Calendar** — Full weekly calendar view with conflict detection, flexible/fixed event distinction, undo for recent actions, and manual event creation.
- **Character System** — RPG-style character that earns XP when you complete tasks and evolves based on your career archetype.
- **Goals Tracker** — Weekly goal-setting tied to your career direction.
- **Preferences** — Set blocked times, meal windows, schedule intensity, and timezone constraints that the AI planner respects.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| State | Zustand (with localStorage persistence) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth — email/password + Google OAuth (PKCE) |
| AI Model | K2-Think-v2 (MBZUAI-IFM) via K2 API |
| Email | Gmail API (read-only) |
| Deployment | Vercel |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [Google Cloud](https://console.cloud.google.com) project with Gmail API + OAuth enabled
- Access to the K2 API

### 1. Clone the repo

```bash
git clone https://github.com/your-username/lifestrat_agent.git
cd lifestrat_agent
npm install
```

### 2. Set up environment variables

Create a `.env.local` file in the project root:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# K2 AI
K2_API_URL=https://your-k2-endpoint/v1/chat/completions
K2_API_KEY=your-k2-api-key
K2_MODEL=MBZUAI-IFM/K2-Think-v2
```

### 3. Set up Supabase

Run the following in your Supabase SQL editor to create the required tables:

```sql
create table user_profiles (
  user_id uuid primary key references auth.users(id),
  profile jsonb not null,
  updated_at timestamptz default now()
);

create table opportunity_decisions (
  user_id uuid references auth.users(id),
  opportunity_id text,
  interested boolean,
  added_to_calendar boolean,
  updated_at timestamptz default now(),
  primary key (user_id, opportunity_id)
);

create table calendar_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  task jsonb not null,
  entry_type text not null  -- 'added' or 'removed'
);

create table user_goals (
  user_id uuid primary key references auth.users(id),
  goals jsonb not null,
  updated_at timestamptz default now()
);

create table user_emails (
  user_id uuid primary key references auth.users(id),
  emails jsonb not null,
  updated_at timestamptz default now()
);
```

Enable Row Level Security on all tables and add a policy allowing users to read/write only their own rows:

```sql
-- Example for user_profiles (repeat for each table)
alter table user_profiles enable row level security;

create policy "Users can manage their own profile"
  on user_profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

### 4. Configure Google OAuth

In your Supabase dashboard under **Authentication → Providers → Google**:
- Add your Google OAuth Client ID and Secret
- Set the authorized redirect URI to: `https://your-project.supabase.co/auth/v1/callback`

In Google Cloud Console:
- Enable the **Gmail API**
- Add `https://www.googleapis.com/auth/gmail.readonly` to your OAuth scopes
- Add your local and production URLs to the authorized JavaScript origins

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── ai/
│   │   │   ├── plan/        # AI schedule generation
│   │   │   └── rerank/      # AI opportunity reranking
│   │   └── gmail/
│   │       ├── fetch/       # Gmail inbox fetcher
│   │       └── categorize/  # AI email categorization
│   ├── auth/callback/       # OAuth callback handler
│   └── page.tsx             # Root — auth, onboarding, app shell
├── components/
│   ├── auth/                # Auth screen, signed-out page
│   ├── calendar/            # Calendar view, conflict UI
│   ├── character/           # RPG character + sprite
│   ├── dashboard/           # Dashboard with AI chat
│   ├── layout/              # Navigation
│   ├── onboarding/          # Onboarding survey
│   ├── opportunities/       # Opportunities view + modals
│   ├── preferences/         # Preferences + blocked time
│   └── ui/                  # Shared UI (UndoToast, etc.)
├── lib/
│   ├── conflictDetection.ts # Calendar conflict logic
│   ├── dayPlanner.ts        # Slot computation, isFixed
│   ├── emailParser.ts       # Email → Opportunity derivation
│   ├── opportunityRanking.ts# 4-layer scoring system
│   └── supabaseSync.ts      # Supabase read/write helpers
├── store/
│   └── appStore.ts          # Zustand global store
└── types/
    └── index.ts             # All shared TypeScript types
```

---

## Deployment

The app is designed for one-click deployment to **Vercel**:

1. Push to GitHub
2. Import the repo in Vercel
3. Add all environment variables from `.env.local`
4. Deploy

Make sure to add your Vercel production URL to:
- Google Cloud Console → Authorized redirect URIs
- Supabase → Authentication → URL Configuration → Site URL

---

## License

MIT
