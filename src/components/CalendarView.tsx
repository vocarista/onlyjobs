import React, { useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  CalendarCheck2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { GoogleCalendarEventItem, InterviewEvent, JobApplication } from '../types/job';
import {
  formatDisplayDate,
  formatTime12h,
  getLocalDateString,
  parseLocalDate,
} from '../utils/dateUtils';
import { GoogleSignInButton } from './GoogleSignInButton';

interface CalendarViewProps {
  applications: JobApplication[];
  googleEvents: GoogleCalendarEventItem[];
  isGoogleConnected: boolean;
  isLoadingGoogleEvents: boolean;
  syncingKey: string | null;
  onGoogleSignIn: () => void;
  onRefreshGoogleEvents: () => void;
  onSyncAllToGoogle: () => void;
  onSyncInterview: (app: JobApplication, interview: InterviewEvent) => void;
  onSyncFollowUp: (app: JobApplication) => void;
  onSyncDeadline: (app: JobApplication) => void;
  onDeleteGoogleEvent: (event: GoogleCalendarEventItem) => void;
  onSelectApplication: (app: JobApplication) => void;
}

interface UnifiedDayItem {
  id: string;
  date: string;
  timeLabel: string;
  kind: 'interview' | 'follow_up' | 'deadline' | 'google';
  title: string;
  subtitle: string;
  synced: boolean;
  htmlLink?: string;
  app?: JobApplication;
  interview?: InterviewEvent;
  googleEvent?: GoogleCalendarEventItem;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const CalendarView: React.FC<CalendarViewProps> = ({
  applications,
  googleEvents,
  isGoogleConnected,
  isLoadingGoogleEvents,
  syncingKey,
  onGoogleSignIn,
  onRefreshGoogleEvents,
  onSyncAllToGoogle,
  onSyncInterview,
  onSyncFollowUp,
  onSyncDeadline,
  onDeleteGoogleEvent,
  onSelectApplication,
}) => {
  const todayStr = getLocalDateString();
  const [cursorDate, setCursorDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const monthYearLabel = cursorDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  // Collect all OnlyJobs calendar items + non-duplicate Google Calendar events
  const allItemsByDate = useMemo(() => {
    const map = new Map<string, UnifiedDayItem[]>();
    const knownGoogleIds = new Set<string>();

    const pushItem = (item: UnifiedDayItem) => {
      const list = map.get(item.date) || [];
      list.push(item);
      map.set(item.date, list);
    };

    for (const app of applications) {
      if (app.stage === 'Rejected') continue;

      for (const iv of app.interviews || []) {
        if (iv.googleCalendarEventId) knownGoogleIds.add(iv.googleCalendarEventId);
        pushItem({
          id: `iv-${iv.id}`,
          date: iv.date,
          timeLabel: formatTime12h(iv.startTime),
          kind: 'interview',
          title: `${app.company}: ${iv.title}`,
          subtitle: `${iv.type} · ${app.role}`,
          synced: Boolean(iv.googleCalendarEventId),
          htmlLink: iv.googleCalendarHtmlLink,
          app,
          interview: iv,
        });
      }

      if (app.followUpDate) {
        if (app.followUpGoogleEventId) knownGoogleIds.add(app.followUpGoogleEventId);
        pushItem({
          id: `fu-${app.id}`,
          date: app.followUpDate,
          timeLabel: '9:00 AM',
          kind: 'follow_up',
          title: `Follow-up: ${app.company}`,
          subtitle: `${app.role} (${app.stage})`,
          synced: Boolean(app.followUpGoogleEventId),
          htmlLink: app.followUpGoogleHtmlLink,
          app,
        });
      }

      if (app.deadlineDate) {
        if (app.deadlineGoogleEventId) knownGoogleIds.add(app.deadlineGoogleEventId);
        pushItem({
          id: `dl-${app.id}`,
          date: app.deadlineDate,
          timeLabel: '5:00 PM',
          kind: 'deadline',
          title: `Deadline: ${app.company}`,
          subtitle: `${app.role}`,
          synced: Boolean(app.deadlineGoogleEventId),
          htmlLink: app.deadlineGoogleHtmlLink,
          app,
        });
      }
    }

    for (const ev of googleEvents) {
      if (knownGoogleIds.has(ev.id)) continue;
      const rawStart = ev.start.dateTime || ev.start.date;
      if (!rawStart) continue;
      const dateStr = rawStart.slice(0, 10);
      let timeLabel = 'All day';
      if (ev.start.dateTime) {
        const dt = new Date(ev.start.dateTime);
        timeLabel = dt.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        });
      }
      pushItem({
        id: `gcal-${ev.id}`,
        date: dateStr,
        timeLabel,
        kind: 'google',
        title: ev.summary || '(Untitled Google Event)',
        subtitle: ev.location || 'Google Calendar',
        synced: true,
        htmlLink: ev.htmlLink,
        googleEvent: ev,
      });
    }

    return map;
  }, [applications, googleEvents]);

  const calendarCells = useMemo(() => {
    const year = cursorDate.getFullYear();
    const month = cursorDate.getMonth();
    const firstDayWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: Array<{ dateStr: string; dayNumber: number; inMonth: boolean }> = [];
    // Leading days from previous month
    for (let i = firstDayWeekday - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      cells.push({
        dateStr: getLocalDateString(d),
        dayNumber: d.getDate(),
        inMonth: false,
      });
    }
    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      cells.push({
        dateStr: getLocalDateString(d),
        dayNumber: day,
        inMonth: true,
      });
    }
    // Trailing days to complete 35 or 42 cell grid
    const targetCells = cells.length > 35 ? 42 : 35;
    let nextDay = 1;
    while (cells.length < targetCells) {
      const d = new Date(year, month + 1, nextDay++);
      cells.push({
        dateStr: getLocalDateString(d),
        dayNumber: d.getDate(),
        inMonth: false,
      });
    }
    return cells;
  }, [cursorDate]);

  const unsyncedCount = useMemo(() => {
    let count = 0;
    for (const app of applications) {
      if (app.stage === 'Rejected') continue;
      if (app.followUpDate && !app.followUpGoogleEventId) count++;
      if (app.deadlineDate && !app.deadlineGoogleEventId) count++;
      for (const iv of app.interviews || []) {
        if (!iv.googleCalendarEventId) count++;
      }
    }
    return count;
  }, [applications]);

  const selectedDayItems = allItemsByDate.get(selectedDate) || [];

  const getKindBadgeClass = (kind: UnifiedDayItem['kind']) => {
    switch (kind) {
      case 'interview':
        return 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900/60';
      case 'follow_up':
        return 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900/60';
      case 'deadline':
        return 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900/60';
      case 'google':
        return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    }
  };

  return (
    <div className="space-y-4">
      {/* Calendar Header & Google Sync Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() =>
                setCursorDate(new Date(cursorDate.getFullYear(), cursorDate.getMonth() - 1, 1))
              }
              className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                setCursorDate(new Date(now.getFullYear(), now.getMonth(), 1));
                setSelectedDate(todayStr);
              }}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() =>
                setCursorDate(new Date(cursorDate.getFullYear(), cursorDate.getMonth() + 1, 1))
              }
              className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {monthYearLabel}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {!isGoogleConnected ? (
            <GoogleSignInButton onClick={onGoogleSignIn} />
          ) : (
            <>
              <button
                type="button"
                disabled={isLoadingGoogleEvents}
                onClick={onRefreshGoogleEvents}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isLoadingGoogleEvents ? 'animate-spin' : ''}`}
                />
                Refresh Calendar
              </button>
              <button
                type="button"
                disabled={unsyncedCount === 0 || syncingKey === 'bulk'}
                onClick={onSyncAllToGoogle}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <UploadCloud className="h-3.5 w-3.5" />
                {syncingKey === 'bulk'
                  ? 'Syncing...'
                  : unsyncedCount > 0
                  ? `Sync ${unsyncedCount} Event${unsyncedCount === 1 ? '' : 's'} to Google`
                  : 'All Events Synced'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Split: Month Grid + Selected Day Agenda */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Month Grid */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white lg:col-span-8 dark:border-slate-800 dark:bg-slate-900">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/60">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="px-2 py-2.5 text-center text-xs font-semibold text-slate-500 dark:text-slate-400"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 dark:divide-slate-800">
            {calendarCells.map((cell) => {
              const dayItems = allItemsByDate.get(cell.dateStr) || [];
              const isToday = cell.dateStr === todayStr;
              const isSelected = cell.dateStr === selectedDate;

              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  onClick={() => setSelectedDate(cell.dateStr)}
                  className={`flex min-h-[104px] min-w-0 flex-col items-stretch overflow-hidden p-2 text-left transition-colors ${
                    !cell.inMonth
                      ? 'bg-slate-50/50 text-slate-400 dark:bg-slate-950/40 dark:text-slate-600'
                      : 'bg-white text-slate-900 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800/40'
                  } ${isSelected ? 'ring-2 ring-inset ring-blue-600' : ''}`}
                >
                  <div className="flex min-w-0 items-center justify-between gap-1">
                    <span
                      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-mono text-xs font-semibold tabular-nums ${
                        isToday
                          ? 'bg-blue-600 text-white'
                          : cell.inMonth
                          ? 'text-slate-700 dark:text-slate-200'
                          : 'text-slate-400 dark:text-slate-600'
                      }`}
                    >
                      {cell.dayNumber}
                    </span>
                    {dayItems.length > 0 && (
                      <span className="font-mono text-[10px] text-slate-400 tabular-nums">
                        {dayItems.length}
                      </span>
                    )}
                  </div>

                  <div className="mt-1.5 min-w-0 space-y-1">
                    {dayItems.slice(0, 3).map((item) => (
                      <div
                        key={item.id}
                        className={`truncate rounded border px-1.5 py-0.5 text-[10px] font-medium ${getKindBadgeClass(
                          item.kind
                        )}`}
                      >
                        {item.title}
                      </div>
                    ))}
                    {dayItems.length > 3 && (
                      <div className="truncate px-1 text-[10px] font-medium text-slate-500">
                        +{dayItems.length - 3} more
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Date Agenda */}
        <aside className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 lg:col-span-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {parseLocalDate(selectedDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                })}
              </h3>
              <p className="mt-0.5 font-mono text-xs text-slate-500 tabular-nums dark:text-slate-400">
                {selectedDayItems.length} event{selectedDayItems.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <span>Interviews · Follow-ups · Deadlines</span>
            </div>
          </div>

          {selectedDayItems.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
              <CalendarIcon className="h-7 w-7 text-slate-300 dark:text-slate-700" />
              <p className="mt-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                No interviews, deadlines, or events on {formatDisplayDate(selectedDate)}
              </p>
            </div>
          ) : (
            <div className="mt-3 space-y-2.5 overflow-y-auto">
              {selectedDayItems.map((item) => {
                const syncTargetKey =
                  item.kind === 'interview' && item.interview
                    ? item.interview.id
                    : item.kind === 'follow_up' && item.app
                    ? `followup:${item.app.id}`
                    : item.kind === 'deadline' && item.app
                    ? `deadline:${item.app.id}`
                    : '';
                const isBusy = syncingKey === syncTargetKey;

                return (
                  <div
                    key={item.id}
                    className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/60"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${getKindBadgeClass(
                          item.kind
                        )}`}
                      >
                        {item.kind === 'follow_up'
                          ? 'Follow-up'
                          : item.kind === 'google'
                          ? 'Google Calendar'
                          : item.kind}
                      </span>
                      <span className="font-mono text-xs text-slate-500 tabular-nums dark:text-slate-400">
                        {item.timeLabel}
                      </span>
                    </div>

                    {item.app ? (
                      <button
                        type="button"
                        onClick={() => onSelectApplication(item.app!)}
                        className="mt-1.5 block text-left text-sm font-semibold text-slate-900 hover:text-blue-600 dark:text-slate-100 dark:hover:text-blue-400"
                      >
                        {item.title}
                      </button>
                    ) : (
                      <p className="mt-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {item.title}
                      </p>
                    )}

                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {item.subtitle}
                    </p>

                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/70 pt-2 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        {item.kind !== 'google' && item.app && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => {
                              if (item.kind === 'interview' && item.interview) {
                                onSyncInterview(item.app!, item.interview);
                              } else if (item.kind === 'follow_up') {
                                onSyncFollowUp(item.app!);
                              } else if (item.kind === 'deadline') {
                                onSyncDeadline(item.app!);
                              }
                            }}
                            className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium ${
                              item.synced
                                ? 'text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40'
                                : 'text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40'
                            }`}
                          >
                            {isBusy ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            ) : item.synced ? (
                              <CalendarCheck2 className="h-3.5 w-3.5" />
                            ) : (
                              <CalendarIcon className="h-3.5 w-3.5" />
                            )}
                            {item.synced ? 'Update on Google' : 'Add to Google'}
                          </button>
                        )}

                        {item.googleEvent && (
                          <button
                            type="button"
                            onClick={() => onDeleteGoogleEvent(item.googleEvent!)}
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        )}
                      </div>

                      {item.htmlLink && (
                        <a
                          href={item.htmlLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
                        >
                          Open
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
