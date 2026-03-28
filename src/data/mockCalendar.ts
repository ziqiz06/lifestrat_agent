import { CalendarTask } from "@/types";

// Today is 2026-03-30 (Monday)
// Default week view: Mon Mar 30 – Sun Apr 5
// Previous week (offset -1): Mon Mar 23 – Sun Mar 29

export const mockCalendarTasks: CalendarTask[] = [
  // ── Previous week ─────────────────────────────────────────────────────────
  // Sunday March 29
  {
    id: "ct1",
    title: "Resume Workshop",
    type: "workshop",
    startTime: "11:00",
    endTime: "13:00",
    date: "2026-03-29",
    opportunityId: "o5",
    color: "#6366f1",
    confirmed: true,
  },
  {
    id: "ct2",
    title: "Entertainment / Free Time",
    type: "entertainment",
    startTime: "19:00",
    endTime: "21:00",
    date: "2026-03-29",
    color: "#f59e0b",
    confirmed: true,
  },

  // ── Current week (Mon Mar 30 – Sun Apr 5) ─────────────────────────────────
  // Monday March 30
  {
    id: "ct3",
    title: "Amazon Application — Draft",
    type: "internship_application",
    startTime: "09:00",
    endTime: "11:00",
    date: "2026-03-30",
    opportunityId: "o6",
    color: "#10b981",
    confirmed: true,
  },
  {
    // ct4 runs 14:00–16:00  ──┐ intentional overlap: ct5 starts at 15:00
    id: "ct4",
    title: "CS 401 Study Session",
    type: "class",
    startTime: "14:00",
    endTime: "16:00",
    date: "2026-03-30",
    opportunityId: "o3",
    color: "#3b82f6",
    confirmed: true,
  },
  {
    // ct5 starts at 15:00 → overlaps ct4 (14:00–16:00) by 1 hour
    id: "ct5",
    title: "Research Google Internship Roles",
    type: "company_research",
    startTime: "15:00",
    endTime: "17:00",
    date: "2026-03-30",
    opportunityId: "o1",
    color: "#8b5cf6",
    confirmed: true,
  },

  // Tuesday March 31
  {
    id: "ct6",
    title: "Spotify Info Session (Virtual)",
    type: "networking",
    startTime: "17:00",
    endTime: "18:00",
    date: "2026-03-31",
    opportunityId: "o7",
    color: "#ec4899",
    confirmed: true,
  },
  {
    id: "ct7",
    title: "Amazon Application — Finalize & Submit",
    type: "internship_application",
    startTime: "09:00",
    endTime: "11:00",
    date: "2026-03-31",
    opportunityId: "o6",
    color: "#10b981",
    confirmed: true,
  },
  {
    // Unconfirmed demo task — shows with dashed outline on the calendar
    id: "ct_unconfirmed",
    title: "AI Professionals Meetup",
    type: "networking",
    startTime: "18:30",
    endTime: "20:30",
    date: "2026-03-31",
    opportunityId: "o4",
    color: "#ec4899",
    confirmed: false,
  },
  {
    id: "ct8",
    title: "Entertainment / Free Time",
    type: "entertainment",
    startTime: "21:00",
    endTime: "22:30",
    date: "2026-03-31",
    color: "#f59e0b",
    confirmed: true,
  },

  // Wednesday April 1 — Amazon deadline!
  {
    id: "ct9",
    title: "Amazon Application DEADLINE",
    type: "deadline",
    startTime: "23:00",
    endTime: "23:59",
    date: "2026-04-01",
    opportunityId: "o6",
    color: "#ef4444",
    confirmed: true,
  },
  {
    id: "ct10",
    title: "CS 401 Study — Office Hours",
    type: "class",
    startTime: "10:00",
    endTime: "12:00",
    date: "2026-04-01",
    opportunityId: "o3",
    color: "#3b82f6",
    confirmed: true,
  },
  {
    id: "ct11",
    title: "Google Application — Draft",
    type: "internship_application",
    startTime: "14:00",
    endTime: "16:00",
    date: "2026-04-01",
    opportunityId: "o1",
    color: "#10b981",
    confirmed: true,
  },

  // Thursday April 2
  {
    id: "ct12",
    title: "Spring Career Fair",
    type: "career_fair",
    startTime: "10:00",
    endTime: "13:00",
    date: "2026-04-02",
    opportunityId: "o2",
    color: "#f97316",
    confirmed: true,
  },
  {
    id: "ct13",
    title: "CS 401 Midterm Prep",
    type: "class",
    startTime: "13:00",
    endTime: "16:00",
    date: "2026-04-02",
    opportunityId: "o3",
    color: "#3b82f6",
    confirmed: true,
  },
];
