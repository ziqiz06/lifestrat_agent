import { CalendarTask } from "@/types";

// Today is 2026-03-30 (Monday)
// Default week view: Mon Mar 30 – Sun Apr 5
// Previous week (offset -1): Mon Mar 23 – Sun Mar 29

export const mockCalendarTasks: CalendarTask[] = [
  // ── Previous week ─────────────────────────────────────────────────────────
  // Sunday March 29 — Resume Workshop 11am (email: "Saturday 11am", treated as Mar 29)
  {
    id: "ct1",
    title: "Resume Workshop",
    type: "workshop",
    flex: "fixed",
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
    flex: "fixed",
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
    flex: "flexible",
    startTime: "09:00",
    endTime: "13:00",  // 4h estimate for internship application
    date: "2026-03-30",
    opportunityId: "o6",
    color: "#10b981",
    confirmed: true,
  },
  {
    // CS 401 Study — fixed class block in the afternoon
    id: "ct4",
    title: "CS 401 Study Session",
    type: "class",
    flex: "fixed",
    startTime: "14:00",
    endTime: "16:00",
    date: "2026-03-30",
    opportunityId: "o3",
    color: "#3b82f6",
    confirmed: true,
  },
  {
    // 1:1 Resume Review — email says "March 30, 3pm" → fixed at 15:00
    id: "ct_resume_review",
    title: "1:1 Resume Review Slot",
    type: "workshop",
    flex: "fixed",
    startTime: "15:00",
    endTime: "16:00",
    date: "2026-03-30",
    opportunityId: "o19",
    color: "#6366f1",
    confirmed: false,
  },
  {
    // Startup Networking Night — email says "March 30, 7pm" → fixed at 19:00
    id: "ct_startup_net",
    title: "Startup Networking Night",
    type: "networking",
    flex: "fixed",
    startTime: "19:00",
    endTime: "21:00",
    date: "2026-03-30",
    opportunityId: "o10",
    color: "#ec4899",
    confirmed: false,
  },

  // Tuesday March 31
  {
    id: "ct7",
    title: "Amazon Application — Finalize & Submit",
    type: "internship_application",
    flex: "flexible",
    startTime: "09:00",
    endTime: "11:00",
    date: "2026-03-31",
    opportunityId: "o6",
    color: "#10b981",
    confirmed: true,
  },
  {
    // Spotify Info Session — email says "March 31 at 5pm EST" → fixed at 17:00
    id: "ct6",
    title: "Spotify Info Session (Virtual)",
    type: "networking",
    flex: "fixed",
    startTime: "17:00",
    endTime: "18:00",
    date: "2026-03-31",
    opportunityId: "o7",
    color: "#ec4899",
    confirmed: true,
  },
  {
    id: "ct8",
    title: "Entertainment / Free Time",
    type: "entertainment",
    flex: "fixed",
    startTime: "21:00",
    endTime: "22:30",
    date: "2026-03-31",
    color: "#f59e0b",
    confirmed: true,
  },

  // Wednesday April 1
  {
    id: "ct10",
    title: "CS 401 Study — Office Hours",
    type: "class",
    flex: "fixed",
    startTime: "10:00",
    endTime: "12:00",
    date: "2026-04-01",
    opportunityId: "o3",
    color: "#3b82f6",
    confirmed: true,
  },
  {
    // Recruiting Dinner — email says "April 1, 6pm" → fixed at 18:00
    id: "ct_recruit_dinner",
    title: "Top 50 Students Recruiting Dinner",
    type: "networking",
    flex: "fixed",
    startTime: "18:00",
    endTime: "20:00",
    date: "2026-04-01",
    opportunityId: "o11",
    color: "#ec4899",
    confirmed: false,
  },
  {
    id: "ct11",
    title: "Google Application — Draft",
    type: "internship_application",
    flex: "flexible",
    startTime: "13:00",
    endTime: "15:00",
    date: "2026-04-01",
    opportunityId: "o1",
    color: "#10b981",
    confirmed: true,
  },
  {
    id: "ct9",
    title: "Amazon Application DEADLINE",
    type: "deadline",
    flex: "fixed",
    startTime: "23:00",
    endTime: "23:59",
    date: "2026-04-01",
    opportunityId: "o6",
    color: "#ef4444",
    confirmed: true,
  },

  // Thursday April 2 — Spring Career Fair 10am–3pm
  {
    id: "ct12",
    title: "Spring Career Fair",
    type: "career_fair",
    flex: "fixed",
    startTime: "10:00",
    endTime: "15:00",
    date: "2026-04-02",
    opportunityId: "o2",
    color: "#f97316",
    confirmed: true,
  },
  {
    id: "ct13",
    title: "CS 401 Midterm Prep",
    type: "class",
    flex: "flexible",
    startTime: "16:00",
    endTime: "18:00",
    date: "2026-04-02",
    opportunityId: "o3",
    color: "#3b82f6",
    confirmed: true,
  },

  // Friday April 3 — CS 401 Midterm at 2pm
  {
    id: "ct_midterm",
    title: "CS 401 Midterm",
    type: "class",
    flex: "fixed",
    startTime: "14:00",
    endTime: "16:00",
    date: "2026-04-03",
    opportunityId: "o3",
    color: "#3b82f6",
    confirmed: true,
  },

  // Tuesday April 8 — AI Professionals Meetup at 6pm
  {
    id: "ct_ai_meetup",
    title: "AI Professionals Meetup",
    type: "networking",
    flex: "fixed",
    startTime: "18:00",
    endTime: "20:00",
    date: "2026-04-08",
    opportunityId: "o4",
    color: "#ec4899",
    confirmed: false,
  },
];
