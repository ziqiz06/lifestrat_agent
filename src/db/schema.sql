-- User profiles (onboarding survey answers)
create table if not exists user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile jsonb not null,
  updated_at timestamptz default now()
);

-- Opportunity interest decisions
create table if not exists opportunity_decisions (
  user_id uuid references auth.users(id) on delete cascade,
  opportunity_id text not null,
  interested boolean not null,
  added_to_calendar boolean default false,
  updated_at timestamptz default now(),
  primary key (user_id, opportunity_id)
);

-- User-added calendar tasks
create table if not exists calendar_tasks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  task jsonb not null
);

-- Weekly goals
create table if not exists user_goals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  goals jsonb not null,
  updated_at timestamptz default now()
);

-- Enable Row Level Security
alter table user_profiles enable row level security;
alter table opportunity_decisions enable row level security;
alter table calendar_tasks enable row level security;
alter table user_goals enable row level security;

-- RLS policies: users can only read/write their own data
create policy "users_own_profile" on user_profiles for all using (auth.uid() = user_id);
create policy "users_own_decisions" on opportunity_decisions for all using (auth.uid() = user_id);
create policy "users_own_tasks" on calendar_tasks for all using (auth.uid() = user_id);
create policy "users_own_goals" on user_goals for all using (auth.uid() = user_id);
