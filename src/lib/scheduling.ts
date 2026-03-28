import { CalendarTask, UserProfile, Opportunity, TaskType } from '@/types';
import { mockCalendarTasks } from '@/data/mockCalendar';

const TASK_COLORS: Record<TaskType, string> = {
  career_fair: '#f97316',
  internship_application: '#10b981',
  company_research: '#8b5cf6',
  resume_update: '#6366f1',
  workshop: '#6366f1',
  class: '#3b82f6',
  entertainment: '#f59e0b',
  networking: '#ec4899',
  free_time: '#f59e0b',
  deadline: '#ef4444',
  other: '#6b7280',
};

/**
 * Generate a base schedule from mock data.
 * In a real app, this would use user profile + AI to generate a dynamic schedule.
 */
export function generateSchedule(
  profile: UserProfile,
  confirmedOpportunities: Opportunity[]
): CalendarTask[] {
  // Start with mock base tasks
  const tasks: CalendarTask[] = [...mockCalendarTasks];

  // Add confirmed opportunities not yet in calendar
  confirmedOpportunities.forEach((opp) => {
    const alreadyAdded = tasks.some((t) => t.opportunityId === opp.id);
    if (!alreadyAdded && opp.deadline) {
      const type: TaskType =
        opp.category === 'internship_application'
          ? 'internship_application'
          : opp.category === 'networking'
          ? 'networking'
          : opp.category === 'professional_event'
          ? 'workshop'
          : opp.category === 'classes'
          ? 'class'
          : 'other';

      tasks.push({
        id: `gen-${opp.id}`,
        title: opp.title,
        type,
        startTime: profile.preferredStartTime || '09:00',
        endTime: addHours(profile.preferredStartTime || '09:00', opp.estimatedHours),
        date: opp.deadline,
        opportunityId: opp.id,
        color: TASK_COLORS[type],
      });
    }
  });

  return tasks;
}

function addHours(time: string, hours: number): string {
  const [h, m] = time.split(':').map(Number);
  const totalMinutes = h * 60 + m + Math.round(hours * 60);
  const newH = Math.min(Math.floor(totalMinutes / 60), 23);
  const newM = totalMinutes % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}
