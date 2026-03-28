Build a full-stack web app called “Personal AI Life Strategy Assistant.”

The app should help users make better life decisions through structured guidance, time management, opportunity detection, and personalized career planning.

Use a clean, modern UI. Prioritize a working MVP with clear logic and simple flows over excessive polish.

CORE PRODUCT IDEA:
This is a personalized planning assistant. It should learn about the user first, then help them organize time, identify career opportunities, and build a realistic daily plan.

MAIN FEATURES:

1. ONBOARDING SURVEY
When the user first opens the app, show a short adapted survey with around 10 questions total. Use a mix of yes/no and short-answer questions.

The survey should ask about:
- career goals
- professional interests
- current experience level
- industries or roles they care about
- whether they are actively looking for internships/opportunities
- time availability each day
- preferred work start time
- preferred work end time
- a snapshot of their usual daily schedule
- how intense of a schedule they are willing to commit to (light / moderate / intense)
- entertainment or personal time preferences
- days/times they generally do not want work-like tasks scheduled

This onboarding data should later be editable in a Settings or Preferences tab.

2. USER PROFILE + PLANNING PREFERENCES
Store the survey answers in app state and use them to generate planning constraints:
- top priorities
- available hours
- ideal scheduling windows
- intensity level
- preferred entertainment/free time
- do-not-schedule windows

3. EMAIL SCANNING / OPPORTUNITY DETECTION
Create a section that simulates or supports scanning user emails for:
- internship opportunities
- career fairs
- networking events
- workshops
- professional development events
- class-related messages
- entertainment/social messages
- irrelevant items

Each email should be classified with one label/tag, such as:
- entertainment
- internship research
- internship application
- professional event
- classes
- networking
- deadline
- personal
- ignore

For MVP, it is okay to use mock email data in JSON instead of a real email integration. Structure the app so real email integration can be added later.

4. OPPORTUNITIES TAB
Create a dedicated Opportunities tab/page.
This tab should:
- list opportunities extracted from emails
- rank them by importance
- show why they are important
- allow the user to click “Interested” / “Not Interested” before adding anything to the calendar
- show deadline, category, estimated time required, and priority
- avoid automatically adding opportunities to the schedule until user confirms interest

Ranking should consider:
- relevance to user goals
- urgency/deadline
- career impact
- fit with experience level
- fit with available time and intensity preference

5. CALENDAR / DAY PLANNING
Create a planning tab that generates a realistic daily schedule.
The schedule should:
- populate calendar blocks based on the user’s availability and preferred working hours
- include classes, career tasks, events, and entertainment/free time
- respect intensity level
- avoid overloading the user
- make the plan feel realistic and balanced

Examples of tasks that may be scheduled:
- attend career fair
- apply to internship
- research company
- update resume
- attend workshop
- class time
- entertainment/free time

6. CONFLICT DETECTION
If there is a time conflict, clearly point it out in the UI.
Do not silently resolve every conflict.
Show the user:
- which events/tasks conflict
- why the conflict exists
- a message asking them to resolve it

Optional: suggest options like:
- keep Event A and remove Event B
- move task to another open slot
- reduce workload for the day

7. GOALS + FOLLOW-UP QUESTIONS
After processing the survey, generate clear user goals such as:
- apply to 2 internships this week
- attend 1 networking event
- spend 4 hours on career development
- preserve 1 hour of entertainment time nightly

For each major goal or recommendation, include a small follow-up yes/no confirmation question in the UI, such as:
- “Do you want this added to your plan?”
- “Are you interested in this event?”
- “Do you want to prioritize internship applications this week?”

8. APP STRUCTURE
Use a clean tab-based interface with at least these tabs:
- Dashboard
- Calendar / Plan
- Opportunities
- Preferences

Dashboard should show:
- top priorities
- today’s plan
- detected opportunities
- conflicts
- quick actions

Preferences should allow editing:
- work hours
- intensity
- interests
- entertainment time
- scheduling constraints

9. TECHNICAL IMPLEMENTATION
Choose a practical stack for a hackathon MVP.
Recommended:
- Next.js
- React
- TypeScript
- Tailwind CSS
- simple local state or lightweight database
- mock data for email/calendar if needed

Use component-based architecture and keep code organized.

10. IMPORTANT MVP BEHAVIOR
Make the app functional even without external APIs.
Use realistic mock data for:
- emails
- opportunities
- events
- user schedule

The app should feel demo-ready:
- onboarding survey works
- opportunities are classified and ranked
- user can mark interest
- calendar gets populated reasonably
- conflicts are shown clearly
- preferences affect scheduling

DELIVERABLES:
- write the app code
- include sample/mock data
- include clear folder structure
- include setup instructions
- include comments in important parts
- make the UI polished enough for a hackathon demo

Start by generating:
1. the project structure
2. the main pages/components
3. mock data models
4. the onboarding survey flow
5. the opportunity ranking logic
6. the calendar scheduling logic
7. the conflict detection logic

Then write the actual code.