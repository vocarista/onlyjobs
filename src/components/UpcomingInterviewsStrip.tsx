import React from 'react';
import {
  Calendar,
  CalendarCheck2,
  ExternalLink,
  Plus,
  RefreshCw,
  Video,
} from 'lucide-react';
import { InterviewEvent, JobApplication } from '../types/job';
import {
  formatDisplayDate,
  formatTime12h,
  getRelativeDayLabel,
  UpcomingInterviewItem,
} from '../utils/dateUtils';

interface UpcomingInterviewsStripProps {
  items: UpcomingInterviewItem[];
  isGoogleConnected: boolean;
  syncingId: string | null;
  onSelectApplication: (app: JobApplication) => void;
  onSyncInterview: (app: JobApplication, interview: InterviewEvent) => void;
  onOpenCalendarTab: () => void;
  onScheduleInterviewClick: () => void;
}

export const UpcomingInterviewsStrip: React.FC<UpcomingInterviewsStripProps> = ({
  items,
  isGoogleConnected,
  syncingId,
  onSelectApplication,
  onSyncInterview,
  onOpenCalendarTab,
  onScheduleInterviewClick,
}) => {
  return (
    <section
      aria-label="Upcoming Interviews"
      className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Upcoming Interviews
          </h2>
          <span className="font-mono text-xs text-slate-500 tabular-nums dark:text-slate-400">
            {items.length} scheduled
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onScheduleInterviewClick}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Plus className="h-3.5 w-3.5" />
            Schedule Interview
          </button>
          <button
            type="button"
            onClick={onOpenCalendarTab}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap shrink-0 dark:text-blue-400 dark:hover:text-blue-300"
          >
            <Calendar className="h-3.5 w-3.5" />
            Open Calendar
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-slate-200 px-4 py-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <span>No upcoming interviews scheduled yet. Add an interview on any application to track it here and sync to Google Calendar.</span>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {items.slice(0, 4).map(({ interview, application, daysUntil }) => {
            const isToday = daysUntil === 0;
            const isSynced = Boolean(interview.googleCalendarEventId);
            const isBusy = syncingId === interview.id;
            const isUrl =
              interview.locationOrLink?.startsWith('http://') ||
              interview.locationOrLink?.startsWith('https://');

            return (
              <div
                key={interview.id}
                className="flex min-w-0 flex-col justify-between overflow-hidden rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950/60 dark:hover:border-slate-700"
              >
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1.5 truncate text-xs font-semibold tabular-nums ${
                        isToday
                          ? 'text-amber-700 dark:text-amber-400'
                          : 'text-blue-700 dark:text-blue-400'
                      }`}
                    >
                      {getRelativeDayLabel(interview.date)} · {formatTime12h(interview.startTime)}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                      {formatDisplayDate(interview.date)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectApplication(application)}
                    className="mt-1.5 block w-full min-w-0 text-left"
                  >
                    <p className="truncate text-sm font-semibold text-slate-900 hover:text-blue-600 dark:text-slate-100 dark:hover:text-blue-400">
                      {application.company}
                    </p>
                    <p className="truncate text-xs text-slate-600 dark:text-slate-400">
                      {interview.title} · {interview.type}
                    </p>
                  </button>
                </div>

                <div className="mt-3 flex min-w-0 items-center justify-between gap-2 border-t border-slate-200/80 pt-2.5 dark:border-slate-800">
                  {isUrl ? (
                    <a
                      href={interview.locationOrLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-blue-600 whitespace-nowrap shrink-0 dark:text-slate-300 dark:hover:text-blue-400"
                    >
                      <Video className="h-3.5 w-3.5" />
                      Join Call
                      <ExternalLink className="h-3 w-3 opacity-60" />
                    </a>
                  ) : (
                    <span className="min-w-0 flex-1 truncate text-xs text-slate-500 dark:text-slate-400">
                      {interview.locationOrLink || `${interview.durationMinutes} min`}
                    </span>
                  )}

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => onSyncInterview(application, interview)}
                    title={
                      isSynced
                        ? 'Update interview event in Google Calendar'
                        : isGoogleConnected
                        ? 'Add interview to Google Calendar'
                        : 'Sign in with Google to sync'
                    }
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      isSynced
                        ? 'text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40'
                        : 'text-slate-700 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                  >
                    {isBusy ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : isSynced ? (
                      <CalendarCheck2 className="h-3.5 w-3.5" />
                    ) : (
                      <Calendar className="h-3.5 w-3.5" />
                    )}
                    {isSynced ? 'Synced' : 'Sync'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
