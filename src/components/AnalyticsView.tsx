import React from 'react';
import { APPLICATION_STAGES, JobApplication } from '../types/job';
import {
  getApplicationDueStatus,
  getUpcomingInterviews,
  isApplicationIdle,
} from '../utils/dateUtils';

interface AnalyticsViewProps {
  applications: JobApplication[];
  idleThresholdDays: number;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  applications,
  idleThresholdDays,
}) => {
  const total = applications.length;
  const active = applications.filter(
    (a) => a.stage !== 'Rejected' && a.stage !== 'Saved'
  ).length;
  const responded = applications.filter(
    (a) => a.stage === 'Interview' || a.stage === 'Offer'
  ).length;
  const submitted = applications.filter((a) => a.stage !== 'Saved').length;
  const responseRate = submitted > 0 ? Math.round((responded / submitted) * 100) : 0;

  const dueTodayCount = applications.filter(
    (a) => getApplicationDueStatus(a).status === 'due_today'
  ).length;
  const overdueCount = applications.filter(
    (a) => getApplicationDueStatus(a).status === 'overdue'
  ).length;
  const idleCount = applications.filter((a) =>
    isApplicationIdle(a, idleThresholdDays)
  ).length;
  const upcomingInterviewsCount = getUpcomingInterviews(applications).length;

  const stageCounts = APPLICATION_STAGES.map((stage) => ({
    stage,
    count: applications.filter((a) => a.stage === stage).length,
  }));
  const maxStageCount = Math.max(1, ...stageCounts.map((s) => s.count));

  // Resume version breakdown
  const resumeStatsMap = new Map<
    string,
    { total: number; interviewsOrOffers: number }
  >();
  for (const app of applications) {
    const key = app.resumeVersion?.trim() || 'Untagged';
    const current = resumeStatsMap.get(key) || { total: 0, interviewsOrOffers: 0 };
    current.total += 1;
    if (app.stage === 'Interview' || app.stage === 'Offer') {
      current.interviewsOrOffers += 1;
    }
    resumeStatsMap.set(key, current);
  }
  const resumeStats = Array.from(resumeStatsMap.entries()).sort(
    (a, b) => b[1].total - a[1].total
  );

  return (
    <div className="space-y-6">
      {/* Top Metric Strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Active Pipeline
          </p>
          <p className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums dark:text-slate-100">
            {active}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums dark:text-slate-400">
            of {total} total applications
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Interview Conversion
          </p>
          <p className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums dark:text-slate-100">
            {responseRate}%
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums dark:text-slate-400">
            {responded} of {submitted} submitted roles
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Follow-up Attention
          </p>
          <p className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums dark:text-slate-100">
            {dueTodayCount + overdueCount}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums dark:text-slate-400">
            {overdueCount} overdue · {dueTodayCount} due today
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Upcoming Interviews
          </p>
          <p className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums dark:text-slate-100">
            {upcomingInterviewsCount}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums dark:text-slate-400">
            {idleCount} idle alerts active
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Stage Funnel Distribution */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Pipeline Breakdown
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Applications across Saved, Applied, Interview, Offer, and Rejected.
          </p>

          <div className="mt-5 space-y-3">
            {stageCounts.map(({ stage, count }) => {
              const widthPct = Math.round((count / maxStageCount) * 100);
              return (
                <div key={stage} className="grid grid-cols-12 items-center gap-3">
                  <span className="col-span-3 text-xs font-medium text-slate-700 dark:text-slate-300">
                    {stage}
                  </span>
                  <div className="col-span-7 h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className={`h-full rounded-full transition-all ${
                        stage === 'Offer'
                          ? 'bg-emerald-600'
                          : stage === 'Rejected'
                          ? 'bg-slate-400 dark:bg-slate-600'
                          : 'bg-blue-600'
                      }`}
                      style={{ width: `${count === 0 ? 0 : Math.max(4, widthPct)}%` }}
                    />
                  </div>
                  <span className="col-span-2 text-right font-mono text-xs font-semibold text-slate-700 tabular-nums dark:text-slate-300">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Resume Version Effectiveness */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Resume Version Performance
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Applications and interview/offer conversion by resume file version.
          </p>

          <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
            {resumeStats.map(([version, stats]) => {
              const rate =
                stats.total > 0
                  ? Math.round((stats.interviewsOrOffers / stats.total) * 100)
                  : 0;
              return (
                <div
                  key={version}
                  className="flex items-center justify-between gap-3 py-2.5 text-xs"
                >
                  <span className="truncate font-mono font-medium text-slate-800 dark:text-slate-200">
                    {version}
                  </span>
                  <div className="flex shrink-0 items-center gap-4 font-mono tabular-nums">
                    <span className="text-slate-500 dark:text-slate-400">
                      {stats.total} apps
                    </span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      {stats.interviewsOrOffers} advancing ({rate}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
