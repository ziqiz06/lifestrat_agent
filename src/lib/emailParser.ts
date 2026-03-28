import { MockEmail, Opportunity, EmailCategory } from '@/types';

const ESTIMATED_HOURS: Record<EmailCategory, number> = {
  internship_application: 4,
  internship_research: 1,
  professional_event: 2,
  networking: 2,
  classes: 5,
  deadline: 3,
  entertainment: 1,
  personal: 0.5,
  ignore: 0,
};

const PRIORITY_REASONS: Record<EmailCategory, string> = {
  internship_application: 'Internship application — high career impact, apply before deadline.',
  internship_research: 'Research opportunity — good career exposure with low time cost.',
  professional_event: 'Professional development event — builds skills and network.',
  networking: 'Networking opportunity — expands professional connections.',
  classes: 'Academic commitment — affects GPA, do not miss.',
  deadline: 'Time-sensitive deadline — act soon.',
  entertainment: 'Personal/social time — important for wellbeing.',
  personal: 'Personal message.',
  ignore: 'Low priority.',
};

// Parses a date like "April 15", "March 30th", "April 2" from free text
function parseDeadline(text: string): string | null {
  const monthMap: Record<string, string> = {
    january: '01', february: '02', march: '03', april: '04',
    may: '05', june: '06', july: '07', august: '08',
    september: '09', october: '10', november: '11', december: '12',
  };

  const match = text.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?\b(?:,?\s*(\d{4}))?/i
  );
  if (!match) return null;

  const month = monthMap[match[1].toLowerCase()];
  const day = match[2].padStart(2, '0');
  const year = match[3] ?? '2026';
  return `${year}-${month}-${day}`;
}

/**
 * Derives an Opportunity for every non-ignored email.
 * Deduplicates by email id so duplicate entries in the email list are safe.
 */
export function deriveOpportunitiesFromEmails(emails: MockEmail[]): Opportunity[] {
  const seen = new Set<string>();

  return emails
    .filter((e) => {
      if (e.category === 'ignore') return false;
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    })
    .map((email) => {
      const searchText = `${email.subject} ${email.body}`;
      const deadline = parseDeadline(searchText);

      return {
        id: `opp-${email.id}`,
        title: email.subject,
        description: email.body.length > 160
          ? email.body.slice(0, 157) + '...'
          : email.body,
        category: email.category,
        deadline,
        estimatedHours: ESTIMATED_HOURS[email.category] ?? 1,
        priority: 5, // re-ranked by rankOpportunities() in the store
        priorityReason: PRIORITY_REASONS[email.category] ?? 'Detected from email.',
        emailId: email.id,
        interested: null,
        addedToCalendar: false,
      };
    });
}
