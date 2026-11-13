import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Clock, X } from 'lucide-react';
import { JobApplication } from '../types/job';
import { getDaysIdle } from '../utils/dateUtils';

interface IdleAlertsBannerProps {
  idleApplications: JobApplication[];
  thresholdDays: number;
  onMarkFollowedUp: (appId: string) => void;
  onOpenApplication: (app: JobApplication) => void;
  onDismissAlert: (appId: string) => void;
}

export const IdleAlertsBanner: React.FC<IdleAlertsBannerProps> = ({
  idleApplications,
  thresholdDays,
  onMarkFollowedUp,
  onOpenApplication,
  onDismissAlert,
}) => {
  const [expanded, setExpanded] = useState(true);

  if (idleApplications.length === 0) return null;

  return (
    <section
      aria-label="Idle Application Alerts"
      className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 dark:border-amber-900/60 dark:bg-amber-950/30"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
          <p className="text-sm font-semibold text-amber-950 dark:text-amber-200">
            Idle Application Alerts
          </p>
          <span className="text-xs text-amber-800 dark:text-amber-300">
            {idleApplications.length}{' '}
            {idleApplications.length === 1 ? 'application has' : 'applications have'} had no
            activity for {thresholdDays}+ days
          </span>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 whitespace-nowrap shrink-0 dark:text-amber-200 dark:hover:bg-amber-900/50"
        >
          {expanded ? (
            <>
              Hide alerts <ChevronUp className="h-3.5 w-3.5" />
            </>
          ) : (
            <>
              Review ({idleApplications.length}) <ChevronDown className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 divide-y divide-amber-200/70 rounded-lg border border-amber-200/80 bg-white dark:divide-amber-900/40 dark:border-amber-900/50 dark:bg-slate-900">
          {idleApplications.map((app) => {
            const idleDays = getDaysIdle(app);
            return (
              <div
                key={app.id}
                className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <button
                      type="button"
                      onClick={() => onOpenApplication(app)}
                      className="truncate text-sm font-semibold text-slate-900 hover:text-blue-600 dark:text-slate-100 dark:hover:text-blue-400"
                    >
                      {app.company}
                    </button>
                    <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                      ·
                    </span>
                    <span className="truncate text-xs text-slate-600 dark:text-slate-400">
                      {app.role}
                    </span>
                    <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                      ·
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{app.stage}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="inline-flex items-center gap-1 font-mono text-xs font-medium text-amber-700 tabular-nums dark:text-amber-400">
                    <Clock className="h-3.5 w-3.5" />
                    Idle · {idleDays}d
                  </span>
                  <button
                    type="button"
                    onClick={() => onMarkFollowedUp(app.id)}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    Log Follow-up
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenApplication(app)}
                    className="rounded-md px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 whitespace-nowrap shrink-0 dark:text-blue-400 dark:hover:bg-blue-950/40"
                  >
                    Schedule
                  </button>
                  <button
                    type="button"
                    onClick={() => onDismissAlert(app.id)}
                    title="Dismiss idle alert for 3 days"
                    aria-label={`Dismiss idle alert for ${app.company}`}
                    className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  >
                    <X className="h-3.5 w-3.5" />
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
