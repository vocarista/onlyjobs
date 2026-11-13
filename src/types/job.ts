export type ApplicationStage =
  | 'Saved'
  | 'Applied'
  | 'Interview'
  | 'Offer'
  | 'Rejected';

export type WorkMode = 'Remote' | 'Hybrid' | 'Onsite';

export type Priority = 'High' | 'Medium' | 'Low';

export type InterviewType =
  | 'Phone Screen'
  | 'Technical'
  | 'Behavioral'
  | 'System Design'
  | 'Final'
  | 'Other';

export interface InterviewEvent {
  id: string;
  title: string;
  type: InterviewType;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM (24h)
  durationMinutes: number;
  locationOrLink: string;
  notes?: string;
  googleCalendarEventId?: string;
  googleCalendarHtmlLink?: string;
}

export interface JobAiInsights {
  skills: string[];
  interviewQuestions: string[];
  followUpDraft: string;
  analyzedAt: string;
}

export interface JobApplication {
  id: string;
  company: string;
  role: string;
  location: string;
  workMode: WorkMode;
  salaryRange: string;
  resumeVersion?: string;
  roundNotes?: string;
  jobUrl?: string;
  jobDescription?: string;
  aiInsights?: JobAiInsights;
  stage: ApplicationStage;
  appliedDate: string; // YYYY-MM-DD
  lastActivityDate: string; // YYYY-MM-DD
  followUpDate?: string; // YYYY-MM-DD
  deadlineDate?: string; // YYYY-MM-DD
  interviews: InterviewEvent[];
  followUpGoogleEventId?: string;
  followUpGoogleHtmlLink?: string;
  deadlineGoogleEventId?: string;
  deadlineGoogleHtmlLink?: string;
  contactName?: string;
  contactEmail?: string;
  notes?: string;
  priority: Priority;
  dismissedIdleAt?: string; // ISO date string when idle alert was dismissed
  createdAt: string;
  updatedAt: string;
}

export type FollowUpStatus = 'overdue' | 'due_today' | 'upcoming' | 'none';

export interface DueStatusInfo {
  status: FollowUpStatus;
  label: string;
  daysDelta: number;
  source: 'follow_up' | 'deadline' | null;
}

export interface AppSettings {
  idleThresholdDays: number;
  darkMode: boolean;
}

export interface GoogleCalendarEventItem {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  hangoutLink?: string;
  status?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  extendedProperties?: {
    private?: Record<string, string>;
  };
}

export type PrimaryView = 'pipeline' | 'applications' | 'calendar' | 'analytics';

export type QuickFilter = 'all' | 'due_today' | 'overdue' | 'idle' | 'interviews';

export type SortOption = 'urgency' | 'followup' | 'recent' | 'company';

export const PIPELINE_COLUMNS: ApplicationStage[] = [
  'Saved',
  'Applied',
  'Interview',
  'Offer',
];

export const APPLICATION_STAGES: ApplicationStage[] = [
  'Saved',
  'Applied',
  'Interview',
  'Offer',
  'Rejected',
];

export const ACTIVE_IDLE_ELIGIBLE_STAGES: ApplicationStage[] = [
  'Applied',
  'Interview',
];
