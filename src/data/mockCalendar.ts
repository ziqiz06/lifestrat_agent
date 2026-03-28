import { CalendarTask } from '@/types';

// Today is 2026-03-28 (Saturday)
// Generate tasks for the week of March 28 – April 3

export const mockCalendarTasks: CalendarTask[] = [
  // Saturday March 29
  {
    id: 'ct1',
    title: 'Resume Workshop',
    type: 'workshop',
    startTime: '11:00',
    endTime: '13:00',
    date: '2026-03-29',
    opportunityId: 'o5',
    color: '#6366f1',
  },
  {
    id: 'ct2',
    title: 'Entertainment / Free Time',
    type: 'entertainment',
    startTime: '19:00',
    endTime: '21:00',
    date: '2026-03-29',
    color: '#f59e0b',
  },

  // Monday March 30
  {
    id: 'ct3',
    title: 'Amazon Application — Draft',
    type: 'internship_application',
    startTime: '09:00',
    endTime: '11:00',
    date: '2026-03-30',
    opportunityId: 'o6',
    color: '#10b981',
  },
  {
    id: 'ct4',
    title: 'CS 401 Study Session',
    type: 'class',
    startTime: '14:00',
    endTime: '16:00',
    date: '2026-03-30',
    opportunityId: 'o3',
    color: '#3b82f6',
  },
  {
    id: 'ct5',
    title: 'Research Google Internship Roles',
    type: 'company_research',
    startTime: '16:00',
    endTime: '17:30',
    date: '2026-03-30',
    opportunityId: 'o1',
    color: '#8b5cf6',
    // Overlaps with ct4 end time — will be flagged
  },

  // Tuesday March 31
  {
    id: 'ct6',
    title: 'Spotify Info Session (Virtual)',
    type: 'networking',
    startTime: '17:00',
    endTime: '18:00',
    date: '2026-03-31',
    opportunityId: 'o7',
    color: '#ec4899',
  },
  {
    id: 'ct7',
    title: 'Amazon Application — Finalize & Submit',
    type: 'internship_application',
    startTime: '09:00',
    endTime: '11:00',
    date: '2026-03-31',
    opportunityId: 'o6',
    color: '#10b981',
  },
  {
    id: 'ct8',
    title: 'Entertainment / Free Time',
    type: 'entertainment',
    startTime: '20:00',
    endTime: '22:00',
    date: '2026-03-31',
    color: '#f59e0b',
  },

  // Wednesday April 1 — Amazon deadline!
  {
    id: 'ct9',
    title: 'Amazon Application DEADLINE',
    type: 'deadline',
    startTime: '23:59',
    endTime: '23:59',
    date: '2026-04-01',
    opportunityId: 'o6',
    color: '#ef4444',
  },
  {
    id: 'ct10',
    title: 'CS 401 Study — Office Hours',
    type: 'class',
    startTime: '10:00',
    endTime: '12:00',
    date: '2026-04-01',
    opportunityId: 'o3',
    color: '#3b82f6',
  },
  {
    id: 'ct11',
    title: 'Google Application — Draft',
    type: 'internship_application',
    startTime: '14:00',
    endTime: '16:00',
    date: '2026-04-01',
    opportunityId: 'o1',
    color: '#10b981',
  },

  // Thursday April 3 — Career Fair!
  {
    id: 'ct12',
    title: 'Spring Career Fair',
    type: 'career_fair',
    startTime: '10:00',
    endTime: '13:00',
    date: '2026-04-03',
    opportunityId: 'o2',
    color: '#f97316',
  },
  {
    id: 'ct13',
    title: 'CS 401 Midterm Prep',
    type: 'class',
    startTime: '13:00',
    endTime: '16:00',
    date: '2026-04-03',
    opportunityId: 'o3',
    color: '#3b82f6',
    // Note: Career Fair ends at 1pm, midterm prep starts at 1pm — tight but no conflict
  },
];
