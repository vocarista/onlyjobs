import React from 'react';
import {
  AlertTriangle,
  Calendar,
  CalendarCheck2,
  CheckCircle2,
  Clock,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { ApplicationStage, APPLICATION_STAGES, JobApplication } from '../types/job';
import {
  formatDisplayDate,
  getApplicationDueStatus,
  getDaysIdle,
  isApplicationIdle,
} from '../utils/dateUtils';

interface ApplicationsTableProps {
  applications: JobApplication[];
  idleThresholdDays: number;
  syncingKey: string | null;
  onSelect: (app: JobApplication) => void;
  onStageChange: (appId: string, stage: ApplicationStage) => void;
  onMarkFollowedUp: (appId: string) => void;
  onSyncFollowUp: (app: JobApplication) => void;
}

export const ApplicationsTable: React.FC<ApplicationsTableProps> = ({
  applications,
  idleThresholdDays,
  syncingKey,
  onSelect,
  onStageChange,
  onMarkFollowedUp,
  onSyncFollowUp,
}) => {
  if (applications.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
          No applications match the active filters
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Clear your search or filter selection to see your full pipeline.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
              <th className="px-4 py-3">Company & Role</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3">Pay Range</th>
              <th className="px-4 py-3">Resume Version</th>
              <th className="px-4 py-3">Round Notes</th>
              <th className="px-4 py-3">Follow-up</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {applications.map((app) => {
              const due = getApplicationDueStatus(app);
              const idle = isApplicationIdle(app, idleThresholdDays);
              const idleDays = getDaysIdle(app);
              const isSynced = Boolean(app.followUpGoogleEventId);
              const isSyncing = syncingKey === `followup:${app.id}`;
              const displayRoundNotes = app.roundNotes || app.notes || '—';

              return (
                <tr
                  key={app.id}
                  className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onSelect(app)}
                        className="text-left font-semibold text-slate-900 hover:text-blue-600 dark:text-slate-100 dark:hover:text-blue-400"
                      >
                        {app.company}
                      </button>
                      {app.jobUrl && (
                        <a
                          href={app.jobUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                          aria-label={`Open ${app.company} posting`}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {app.role} · {app.location} · {app.workMode}
                    </p>
                  </td>

                  <td className="px-4 py-3">
                    <select
                      aria-label={`Stage for ${app.company}`}
                      value={app.stage}
                      onChange={(e) =>
                        onStageChange(app.id, e.target.value as ApplicationStage)
                      }
                      className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      {APPLICATION_STAGES.map((stage) => (
                        <option key={stage} value={stage}>
                          {stage}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="px-4 py-3 font-mono text-xs font-medium text-slate-800 tabular-nums whitespace-nowrap dark:text-slate-200">
                    {app.salaryRange || '—'}
                  </td>

                  <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap dark:text-slate-300">
                    {app.resumeVersion || '—'}
                  </td>

                  <td className="max-w-[240px] px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                    <p className="line-clamp-2">{displayRoundNotes}</p>
                  </td>

                  <td className="px-4 py-3 font-mono text-xs text-slate-700 tabular-nums whitespace-nowrap dark:text-slate-300">
                    {app.followUpDate ? formatDisplayDate(app.followUpDate) : '—'}
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {due.status === 'overdue' && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-red-700 tabular-nums whitespace-nowrap dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-400">
                          <AlertTriangle className="h-3 w-3" />
                          {due.label}
                        </span>
                      )}
                      {due.status === 'due_today' && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 whitespace-nowrap dark:border-amber-900/60 dark:bg-amber-950/60 dark:text-amber-300">
                          <Clock className="h-3 w-3" />
                          Due Today
                        </span>
                      )}
                      {idle && (
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] font-medium text-amber-700 tabular-nums whitespace-nowrap dark:text-amber-400">
                          Idle · {idleDays}d
                        </span>
                      )}
                      {due.status !== 'overdue' && due.status !== 'due_today' && !idle && (
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          On track
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center justify-end gap-1.5">
                      {app.followUpDate && (
                        <button
                          type="button"
                          disabled={isSyncing}
                          onClick={() => onSyncFollowUp(app)}
                          title={
                            isSynced
                              ? 'Update follow-up on Google Calendar'
                              : 'Sync follow-up to Google Calendar'
                          }
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                            isSynced
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-400'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {isSyncing ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : isSynced ? (
                            <CalendarCheck2 className="h-3 w-3" />
                          ) : (
                            <Calendar className="h-3 w-3" />
                          )}
                          {isSynced ? 'Synced' : 'Sync'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onMarkFollowedUp(app.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                        Follow Up
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
