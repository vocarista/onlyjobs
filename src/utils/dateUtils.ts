import {
  ACTIVE_IDLE_ELIGIBLE_STAGES,
  ApplicationStage,
  DueStatusInfo,
  FollowUpStatus,
  InterviewEvent,
  JobApplication,
} from '../types/job';

export function getLocalDateString(baseDate: Date = new Date(), offsetDays = 0): string {
  const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function diffDaysFromToday(dateStr: string): number {
  const todayStr = getLocalDateString();
  const today = parseLocalDate(todayStr).getTime();
  const target = parseLocalDate(dateStr).getTime();
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

export function getFollowUpStatus(
  followUpDate?: string,
  stage?: ApplicationStage
): { status: FollowUpStatus; daysDelta: number; label: string } {
  if (!followUpDate || stage === 'Rejected') {
    return { status: 'none', daysDelta: 0, label: '' };
  }
  const delta = diffDaysFromToday(followUpDate);
  if (delta < 0) {
    const days = Math.abs(delta);
    return {
      status: 'overdue',
      daysDelta: delta,
      label: days === 1 ? 'Overdue · 1d' : `Overdue · ${days}d`,
    };
  }
  if (delta === 0) {
    return {
      status: 'due_today',
      daysDelta: 0,
      label: 'Due Today',
    };
  }
  return {
    status: 'upcoming',
    daysDelta: delta,
    label: delta === 1 ? 'Due Tomorrow' : `In ${delta}d`,
  };
}

export function getApplicationDueStatus(app: JobApplication): DueStatusInfo {
  if (app.stage === 'Rejected') {
    return { status: 'none', label: '', daysDelta: 0, source: null };
  }

  const candidates: Array<{
    source: 'follow_up' | 'deadline';
    delta: number;
    status: FollowUpStatus;
    label: string;
  }> = [];

  if (app.followUpDate) {
    const f = getFollowUpStatus(app.followUpDate, app.stage);
    if (f.status !== 'none') {
      candidates.push({
        source: 'follow_up',
        delta: f.daysDelta,
        status: f.status,
        label: f.label,
      });
    }
  }

  if (app.deadlineDate) {
    const delta = diffDaysFromToday(app.deadlineDate);
    if (delta < 0) {
      const days = Math.abs(delta);
      candidates.push({
        source: 'deadline',
        delta,
        status: 'overdue',
        label: days === 1 ? 'Overdue · 1d' : `Overdue · ${days}d`,
      });
    } else if (delta === 0) {
      candidates.push({
        source: 'deadline',
        delta: 0,
        status: 'due_today',
        label: 'Due Today',
      });
    } else {
      candidates.push({
        source: 'deadline',
        delta,
        status: 'upcoming',
        label: delta === 1 ? 'Due Tomorrow' : `In ${delta}d`,
      });
    }
  }

  if (candidates.length === 0) {
    return { status: 'none', label: '', daysDelta: 0, source: null };
  }

  // Most urgent first (smallest delta, so overdue < 0 beats due_today === 0 beats upcoming > 0)
  candidates.sort((a, b) => a.delta - b.delta);
  const top = candidates[0];
  return {
    status: top.status,
    label: top.label,
    daysDelta: top.delta,
    source: top.source,
  };
}

export function getDaysIdle(app: JobApplication): number {
  const reference = app.lastActivityDate || app.appliedDate;
  if (!reference) return 0;
  const delta = diffDaysFromToday(reference);
  return Math.max(0, -delta);
}

export function isApplicationIdle(app: JobApplication, thresholdDays: number): boolean {
  if (!ACTIVE_IDLE_ELIGIBLE_STAGES.includes(app.stage)) {
    return false;
  }
  const idleDays = getDaysIdle(app);
  if (idleDays < thresholdDays) {
    return false;
  }
  if (app.dismissedIdleAt) {
    const dismissedSince = diffDaysFromToday(app.dismissedIdleAt);
    // Keep dismissed for 3 days unless lastActivityDate changed
    if (dismissedSince >= -2 && app.dismissedIdleAt >= (app.lastActivityDate || '')) {
      return false;
    }
  }
  return true;
}

export function formatDisplayDate(dateStr?: string, includeYear = false): string {
  if (!dateStr) return '—';
  const date = parseLocalDate(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(includeYear ? { year: 'numeric' } : {}),
  });
}

export function formatTime12h(time24: string): string {
  if (!time24) return '';
  const [hStr, mStr] = time24.split(':');
  const h = Number(hStr);
  const m = Number(mStr || 0);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

export function getRelativeDayLabel(dateStr: string): string {
  const delta = diffDaysFromToday(dateStr);
  if (delta === 0) return 'Today';
  if (delta === 1) return 'Tomorrow';
  if (delta === -1) return 'Yesterday';
  if (delta > 1 && delta <= 6) return `In ${delta}d`;
  if (delta < -1) return `${Math.abs(delta)}d ago`;
  return formatDisplayDate(dateStr);
}

export interface UpcomingInterviewItem {
  interview: InterviewEvent;
  application: JobApplication;
  daysUntil: number;
}

export function getUpcomingInterviews(apps: JobApplication[]): UpcomingInterviewItem[] {
  const items: UpcomingInterviewItem[] = [];
  for (const app of apps) {
    if (app.stage === 'Rejected') continue;
    for (const interview of app.interviews || []) {
      const daysUntil = diffDaysFromToday(interview.date);
      if (daysUntil >= 0) {
        items.push({ interview, application: app, daysUntil });
      }
    }
  }

  items.sort((a, b) => {
    if (a.interview.date !== b.interview.date) {
      return a.interview.date.localeCompare(b.interview.date);
    }
    return a.interview.startTime.localeCompare(b.interview.startTime);
  });

  return items;
}
