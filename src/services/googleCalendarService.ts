import { GoogleCalendarEventItem, InterviewEvent, JobApplication } from '../types/job';

const CALENDAR_BASE_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

export class CalendarApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'CalendarApiError';
    this.status = status;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Google Calendar error (${res.status})`;
    try {
      const errBody = await res.json();
      if (errBody?.error?.message) {
        message = errBody.error.message;
      }
    } catch {
      // ignore json parse failure
    }
    throw new CalendarApiError(message, res.status);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export async function listCalendarEvents(
  accessToken: string,
  timeMinIso: string,
  timeMaxIso: string
): Promise<GoogleCalendarEventItem[]> {
  const params = new URLSearchParams({
    timeMin: timeMinIso,
    timeMax: timeMaxIso,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '100',
  });

  const res = await fetch(`${CALENDAR_BASE_URL}?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await handleResponse<{ items?: GoogleCalendarEventItem[] }>(res);
  return data.items || [];
}

export interface CalendarEventPayload {
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{ method: 'popup' | 'email'; minutes: number }>;
  };
  extendedProperties?: {
    private: Record<string, string>;
  };
}

export async function createCalendarEvent(
  accessToken: string,
  payload: CalendarEventPayload
): Promise<GoogleCalendarEventItem> {
  const res = await fetch(CALENDAR_BASE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return handleResponse<GoogleCalendarEventItem>(res);
}

export async function updateCalendarEvent(
  accessToken: string,
  eventId: string,
  payload: CalendarEventPayload
): Promise<GoogleCalendarEventItem> {
  const res = await fetch(`${CALENDAR_BASE_URL}/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return handleResponse<GoogleCalendarEventItem>(res);
}

export async function deleteCalendarEvent(accessToken: string, eventId: string): Promise<void> {
  const res = await fetch(`${CALENDAR_BASE_URL}/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  await handleResponse<void>(res);
}

function getLocalTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

function addMinutesToLocalDateTime(dateStr: string, timeStr: string, minutesToAdd: number): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, hh || 9, (mm || 0) + minutesToAdd, 0);
}

function toIsoWithOffset(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absOffset = Math.abs(offsetMinutes);
  const offH = pad(Math.floor(absOffset / 60));
  const offM = pad(absOffset % 60);

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:00${sign}${offH}:${offM}`
  );
}

export function buildInterviewEventPayload(
  app: JobApplication,
  interview: InterviewEvent
): CalendarEventPayload {
  const tz = getLocalTimeZone();
  const start = addMinutesToLocalDateTime(interview.date, interview.startTime, 0);
  const end = addMinutesToLocalDateTime(
    interview.date,
    interview.startTime,
    interview.durationMinutes || 45
  );

  const lines = [
    `Company: ${app.company}`,
    `Role: ${app.role}`,
    `Round: ${interview.type}`,
    interview.locationOrLink ? `Location / Link: ${interview.locationOrLink}` : '',
    interview.notes ? `Prep Notes: ${interview.notes}` : '',
    app.jobUrl ? `Job Posting: ${app.jobUrl}` : '',
  ].filter(Boolean);

  return {
    summary: `[Interview] ${app.company} — ${interview.title}`,
    description: lines.join('\n'),
    location: interview.locationOrLink || app.location,
    start: { dateTime: toIsoWithOffset(start), timeZone: tz },
    end: { dateTime: toIsoWithOffset(end), timeZone: tz },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 30 },
        { method: 'popup', minutes: 10 },
      ],
    },
    extendedProperties: {
      private: {
        onlyjobsAppId: app.id,
        onlyjobsKind: 'interview',
        onlyjobsInterviewId: interview.id,
      },
    },
  };
}

export function buildFollowUpEventPayload(app: JobApplication): CalendarEventPayload {
  const dateStr = app.followUpDate!;
  const tz = getLocalTimeZone();
  const start = addMinutesToLocalDateTime(dateStr, '09:00', 0);
  const end = addMinutesToLocalDateTime(dateStr, '09:30', 0);

  const lines = [
    `Follow up on your ${app.stage} application for ${app.role} at ${app.company}.`,
    app.contactName ? `Contact: ${app.contactName}${app.contactEmail ? ` (${app.contactEmail})` : ''}` : '',
    app.notes ? `Notes: ${app.notes}` : '',
    app.jobUrl ? `Job Posting: ${app.jobUrl}` : '',
  ].filter(Boolean);

  return {
    summary: `[Follow-up] ${app.company} — ${app.role}`,
    description: lines.join('\n'),
    start: { dateTime: toIsoWithOffset(start), timeZone: tz },
    end: { dateTime: toIsoWithOffset(end), timeZone: tz },
    reminders: {
      useDefault: false,
      overrides: [{ method: 'popup', minutes: 15 }],
    },
    extendedProperties: {
      private: {
        onlyjobsAppId: app.id,
        onlyjobsKind: 'follow_up',
      },
    },
  };
}

export function buildDeadlineEventPayload(app: JobApplication): CalendarEventPayload {
  const dateStr = app.deadlineDate!;
  const tz = getLocalTimeZone();
  const start = addMinutesToLocalDateTime(dateStr, '17:00', 0);
  const end = addMinutesToLocalDateTime(dateStr, '17:30', 0);

  const lines = [
    `Deadline for ${app.role} at ${app.company} (${app.stage}).`,
    app.notes ? `Notes: ${app.notes}` : '',
    app.jobUrl ? `Job Posting: ${app.jobUrl}` : '',
  ].filter(Boolean);

  return {
    summary: `[Deadline] ${app.company} — ${app.role}`,
    description: lines.join('\n'),
    start: { dateTime: toIsoWithOffset(start), timeZone: tz },
    end: { dateTime: toIsoWithOffset(end), timeZone: tz },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 120 },
        { method: 'popup', minutes: 30 },
      ],
    },
    extendedProperties: {
      private: {
        onlyjobsAppId: app.id,
        onlyjobsKind: 'deadline',
      },
    },
  };
}
