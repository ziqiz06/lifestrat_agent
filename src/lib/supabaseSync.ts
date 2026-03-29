import { createClient } from '@/utils/supabase/client';
import { UserProfile, Opportunity, CalendarTask, Goal } from '@/types';

// Save the user's onboarding profile
export async function saveProfile(userId: string, profile: UserProfile) {
  const supabase = createClient();
  await supabase.from('user_profiles').upsert({
    user_id: userId,
    profile: profile,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
}

// Load the user's profile
export async function loadProfile(userId: string): Promise<UserProfile | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from('user_profiles')
    .select('profile')
    .eq('user_id', userId)
    .single();
  return data?.profile ?? null;
}

// Save opportunity interest decisions
export async function saveOpportunityDecisions(
  userId: string,
  opportunities: Opportunity[]
) {
  const supabase = createClient();
  const rows = opportunities
    .filter((o) => o.interested !== null)
    .map((o) => ({
      user_id: userId,
      opportunity_id: o.id,
      interested: o.interested,
      added_to_calendar: o.addedToCalendar,
      updated_at: new Date().toISOString(),
    }));

  if (rows.length === 0) return;
  await supabase.from('opportunity_decisions').upsert(rows, {
    onConflict: 'user_id,opportunity_id',
  });
}

// Load opportunity decisions
export async function loadOpportunityDecisions(
  userId: string
): Promise<Record<string, { interested: boolean; addedToCalendar: boolean }>> {
  const supabase = createClient();
  const { data } = await supabase
    .from('opportunity_decisions')
    .select('opportunity_id, interested, added_to_calendar')
    .eq('user_id', userId);

  const map: Record<string, { interested: boolean; addedToCalendar: boolean }> = {};
  for (const row of data ?? []) {
    map[row.opportunity_id] = {
      interested: row.interested,
      addedToCalendar: row.added_to_calendar,
    };
  }
  return map;
}

// Save calendar state: user-added tasks + which mock tasks were removed
export async function saveCalendarTasks(userId: string, tasks: CalendarTask[], allMockIds: string[]) {
  const supabase = createClient();
  const currentIds = new Set(tasks.map((t) => t.id));
  const userTasks = tasks.filter((t) => !allMockIds.includes(t.id));
  const removedMockIds = allMockIds.filter((id) => !currentIds.has(id));

  console.log('[saveCalendarTasks] userTasks:', userTasks.map(t => t.id));
  console.log('[saveCalendarTasks] removedMockIds:', removedMockIds);

  await supabase.from('calendar_tasks').delete().eq('user_id', userId);

  const rows = [
    ...userTasks.map((t) => ({ user_id: userId, task: t, entry_type: 'added' })),
    ...removedMockIds.map((id) => ({ user_id: userId, task: { id } as CalendarTask, entry_type: 'removed' })),
  ];
  if (rows.length > 0) {
    const { error } = await supabase.from('calendar_tasks').insert(rows);
    if (error) console.error('[saveCalendarTasks] insert error:', error);
  }
}

// Load calendar state
export async function loadCalendarTasks(userId: string): Promise<{ added: CalendarTask[]; removedIds: string[] }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('calendar_tasks')
    .select('task, entry_type')
    .eq('user_id', userId);

  console.log('[loadCalendarTasks] rows:', data, 'error:', error);

  const added: CalendarTask[] = [];
  const removedIds: string[] = [];
  for (const row of data ?? []) {
    if (row.entry_type === 'removed') {
      removedIds.push((row.task as { id: string }).id);
    } else {
      added.push(row.task as CalendarTask);
    }
  }
  console.log('[loadCalendarTasks] added:', added.map(t => t.id), 'removedIds:', removedIds);
  return { added, removedIds };
}

// Clear calendar decisions and opportunity decisions (keeps profile/goals)
export async function clearCalendarAndDecisions(userId: string) {
  const supabase = createClient();
  await Promise.all([
    supabase.from('calendar_tasks').delete().eq('user_id', userId),
    supabase.from('opportunity_decisions').delete().eq('user_id', userId),
  ]);
}

// Save goals
export async function saveGoals(userId: string, goals: Goal[]) {
  const supabase = createClient();
  await supabase.from('user_goals').upsert({
    user_id: userId,
    goals,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
}

// Load goals
export async function loadGoals(userId: string): Promise<Goal[] | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from('user_goals')
    .select('goals')
    .eq('user_id', userId)
    .single();
  return data?.goals ?? null;
}
