import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CalendarCheck2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  ExternalLink,
  FileText,
  GripVertical,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import {
  ApplicationStage,
  APPLICATION_STAGES,
  JobAiInsights,
  JobApplication,
} from '../types/job';
import {
  formatDisplayDate,
  formatTime12h,
  getApplicationDueStatus,
  getDaysIdle,
  isApplicationIdle,
} from '../utils/dateUtils';
import { analyzeJobDescription } from '../services/jdAnalyzerService';

interface ApplicationCardProps {
  application: JobApplication;
  idleThresholdDays: number;
  syncingKey: string | null;
  onSelect: (app: JobApplication) => void;
  onStageChange: (appId: string, stage: ApplicationStage) => void;
  onMarkFollowedUp: (appId: string) => void;
  onSyncFollowUp: (app: JobApplication) => void;
  onUpdateJobAiData: (
    appId: string,
    updates: {
      jobDescription?: string;
      aiInsights?: JobAiInsights;
      roundNotes?: string;
    }
  ) => void;
  onDragStart?: (appId: string) => void;
}

export const ApplicationCard: React.FC<ApplicationCardProps> = ({
  application,
  idleThresholdDays,
  syncingKey,
  onSelect,
  onStageChange,
  onMarkFollowedUp,
  onSyncFollowUp,
  onUpdateJobAiData,
  onDragStart,
}) => {
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [jdDraft, setJdDraft] = useState(application.jobDescription || '');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [copiedNote, setCopiedNote] = useState(false);

  useEffect(() => {
    setJdDraft(application.jobDescription || '');
  }, [application.jobDescription]);

  const dueStatus = getApplicationDueStatus(application);
  const isIdle = isApplicationIdle(application, idleThresholdDays);
  const idleDays = getDaysIdle(application);
  const nextInterview = (application.interviews || [])
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .find((iv) => iv.date >= new Date().toISOString().slice(0, 10));

  const isFollowUpSynced = Boolean(application.followUpGoogleEventId);
  const isSyncingFollowUp = syncingKey === `followup:${application.id}`;
  const displayRoundNotes = application.roundNotes || application.notes;
  const insights = application.aiInsights;

  const handleJdBlur = () => {
    const trimmed = jdDraft.trim();
    if (trimmed !== (application.jobDescription || '').trim()) {
      onUpdateJobAiData(application.id, {
        jobDescription: trimmed || undefined,
      });
    }
  };

  const handleAnalyzeJd = async () => {
    const trimmed = jdDraft.trim();
    if (trimmed.length < 20) {
      setAiError('Paste at least 20 characters of the job description first.');
      return;
    }
    setAiError(null);
    setIsAnalyzing(true);
    try {
      const result = await analyzeJobDescription({
        jobDescription: trimmed,
        company: application.company,
        role: application.role,
        stage: application.stage,
        contactName: application.contactName,
        roundNotes: displayRoundNotes,
      });
      onUpdateJobAiData(application.id, {
        jobDescription: trimmed,
        aiInsights: result,
      });
    } catch (err) {
      setAiError(
        err instanceof Error ? err.message : 'Unable to analyze job description right now.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCopyFollowUp = async () => {
    if (!insights?.followUpDraft) return;
    try {
      await navigator.clipboard.writeText(insights.followUpDraft);
      setCopiedNote(true);
      window.setTimeout(() => setCopiedNote(false), 2000);
    } catch {
      setAiError('Clipboard access unavailable. Select and copy the draft text manually.');
    }
  };

  return (
    <article
      draggable={Boolean(onDragStart) && !isAiOpen}
      onDragStart={(e) => {
        if (!onDragStart || isAiOpen) return;
        e.dataTransfer.setData('text/plain', application.id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart(application.id);
      }}
      className="flex min-w-0 w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
    >
      {/* Primary Identity */}
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-1.5">
          {onDragStart && (
            <GripVertical
              className="mt-0.5 h-4 w-4 shrink-0 cursor-grab text-slate-300 hover:text-slate-500 dark:text-slate-700 dark:hover:text-slate-500"
              aria-hidden="true"
            />
          )}
          <button
            type="button"
            onClick={() => onSelect(application)}
            className="min-w-0 flex-1 text-left"
          >
            <h3 className="truncate text-sm font-semibold text-slate-900 hover:text-blue-600 dark:text-slate-100 dark:hover:text-blue-400">
              {application.company}
            </h3>
            <p className="mt-0.5 truncate text-xs font-medium text-slate-700 dark:text-slate-300">
              {application.role}
            </p>
          </button>
        </div>

        {application.jobUrl && (
          <a
            href={application.jobUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open job posting"
            aria-label={`Open job posting for ${application.company}`}
            className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {/* Pay Range, Location & Work Mode (Unboxed inline metadata) */}
      <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
        <span className="font-mono font-semibold text-slate-800 tabular-nums dark:text-slate-200">
          {application.salaryRange || 'Pay N/A'}
        </span>
        <span aria-hidden="true">·</span>
        <span className="max-w-full truncate">{application.location}</span>
        <span aria-hidden="true">·</span>
        <span className="shrink-0">{application.workMode}</span>
      </div>

      {/* Resume Version & Round Notes */}
      <div className="mt-2.5 min-w-0 space-y-1.5 text-xs">
        <div className="flex min-w-0 items-center gap-1.5 text-slate-600 dark:text-slate-400">
          <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="truncate font-mono text-[11px]">
            {application.resumeVersion || 'No resume tagged'}
          </span>
        </div>

        {displayRoundNotes && (
          <p className="line-clamp-2 break-words text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            {displayRoundNotes}
          </p>
        )}
      </div>

      {/* Follow-up Date & Due Today / Overdue Status Row */}
      <div className="mt-3 min-w-0 space-y-1.5 border-t border-slate-100 pt-2.5 dark:border-slate-800">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-1.5">
          <span className="truncate text-xs text-slate-500 dark:text-slate-400">
            Follow-up:{' '}
            <span className="font-mono font-medium text-slate-800 tabular-nums dark:text-slate-200">
              {application.followUpDate ? formatDisplayDate(application.followUpDate) : 'Not set'}
            </span>
          </span>

          {dueStatus.status === 'overdue' && (
            <span className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-red-700 tabular-nums whitespace-nowrap shrink-0 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-400">
              <AlertTriangle className="h-3 w-3" />
              {dueStatus.label}
            </span>
          )}

          {dueStatus.status === 'due_today' && (
            <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 whitespace-nowrap shrink-0 dark:border-amber-900/60 dark:bg-amber-950/60 dark:text-amber-300">
              <Clock className="h-3 w-3" />
              Due Today
            </span>
          )}
        </div>

        {application.deadlineDate && (
          <div className="flex min-w-0 items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="truncate">
              Deadline:{' '}
              <span className="font-mono font-medium text-slate-700 tabular-nums dark:text-slate-300">
                {formatDisplayDate(application.deadlineDate)}
              </span>
            </span>
          </div>
        )}

        {isIdle && (
          <div className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate tabular-nums">
              Idle alert · {idleDays}d since activity
            </span>
          </div>
        )}

        {nextInterview && (
          <div className="flex min-w-0 items-center justify-between gap-2 rounded-md bg-blue-50/70 px-2.5 py-1.5 text-xs text-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
            <span className="min-w-0 flex-1 truncate font-medium">
              {nextInterview.type}: {formatDisplayDate(nextInterview.date)} ·{' '}
              <span className="font-mono tabular-nums">{formatTime12h(nextInterview.startTime)}</span>
            </span>
            {nextInterview.googleCalendarEventId && (
              <CalendarCheck2
                className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                aria-label="Interview synced to Google Calendar"
              />
            )}
          </div>
        )}
      </div>

      {/* Inline Job Description & AI Prep Drawer on Every Card */}
      <div className="mt-2.5 min-w-0 border-t border-slate-100 pt-2.5 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setIsAiOpen((prev) => !prev)}
          aria-expanded={isAiOpen}
          className="flex w-full min-w-0 items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50/80 px-2.5 py-1.5 text-left text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <span className="inline-flex min-w-0 items-center gap-1.5 truncate">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
            <span className="truncate">
              {insights
                ? `JD Prep · ${insights.skills.length} skills · ${insights.interviewQuestions.length} Qs`
                : 'Paste JD for AI Prep'}
            </span>
          </span>
          {isAiOpen ? (
            <ChevronUp className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          )}
        </button>

        {isAiOpen && (
          <div className="mt-2.5 min-w-0 space-y-3 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-950/60">
            <div className="min-w-0">
              <label
                htmlFor={`jd-input-${application.id}`}
                className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300"
              >
                Job Description
              </label>
              <textarea
                id={`jd-input-${application.id}`}
                rows={3}
                value={jdDraft}
                onChange={(e) => setJdDraft(e.target.value)}
                onBlur={handleJdBlur}
                placeholder="Paste the job description here to extract skills, 3 interview questions, and a recruiter follow-up note..."
                className="mt-1 block w-full min-w-0 resize-y rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                disabled={isAnalyzing}
                onClick={handleAnalyzeJd}
                className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap"
              >
                {isAnalyzing ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {isAnalyzing
                  ? 'Analyzing...'
                  : insights
                  ? 'Re-analyze JD'
                  : 'Extract & Generate'}
              </button>

              {insights?.analyzedAt && (
                <span className="font-mono text-[10px] text-slate-400 tabular-nums">
                  Updated {new Date(insights.analyzedAt).toLocaleDateString()}
                </span>
              )}
            </div>

            {aiError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-medium text-red-700 break-words dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300">
                {aiError}
              </div>
            )}

            {insights && (
              <div className="min-w-0 space-y-3 border-t border-slate-200 pt-2.5 dark:border-slate-800">
                {/* Key Required Skills */}
                {insights.skills.length > 0 && (
                  <div className="min-w-0">
                    <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Key Required Skills
                    </h4>
                    <div className="mt-1.5 flex min-w-0 flex-wrap gap-1.5">
                      {insights.skills.map((skill, idx) => (
                        <span
                          key={`${skill}-${idx}`}
                          className="max-w-full break-words rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3 Tailored Interview Questions */}
                {insights.interviewQuestions.length > 0 && (
                  <div className="min-w-0">
                    <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Tailored Interview Questions
                    </h4>
                    <ol className="mt-1.5 space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                      {insights.interviewQuestions.map((question, idx) => (
                        <li
                          key={idx}
                          className="flex min-w-0 items-start gap-1.5 leading-relaxed"
                        >
                          <span className="font-mono text-[11px] font-semibold text-blue-600 tabular-nums shrink-0 dark:text-blue-400">
                            {idx + 1}.
                          </span>
                          <span className="min-w-0 break-words">{question}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Concise Recruiter Follow-up Note */}
                {insights.followUpDraft && (
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Recruiter Follow-up Draft
                      </h4>
                      <button
                        type="button"
                        onClick={handleCopyFollowUp}
                        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40 whitespace-nowrap shrink-0"
                      >
                        {copiedNote ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-600" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                    <p className="mt-1 rounded-md border border-slate-200 bg-white p-2 text-xs leading-relaxed text-slate-700 break-words dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                      {insights.followUpDraft}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Actions & Stage Switcher */}
      <div className="mt-3 flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5 dark:border-slate-800">
        <select
          aria-label={`Change stage for ${application.company}`}
          value={application.stage}
          onChange={(e) => onStageChange(application.id, e.target.value as ApplicationStage)}
          className="min-w-0 flex-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          {APPLICATION_STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {stage}
            </option>
          ))}
        </select>

        <div className="flex shrink-0 items-center gap-1">
          {application.followUpDate && (
            <button
              type="button"
              disabled={isSyncingFollowUp}
              onClick={() => onSyncFollowUp(application)}
              title={
                isFollowUpSynced
                  ? 'Update follow-up reminder on Google Calendar'
                  : 'Sync follow-up date to Google Calendar'
              }
              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                isFollowUpSynced
                  ? 'text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {isSyncingFollowUp ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : isFollowUpSynced ? (
                <CalendarCheck2 className="h-3.5 w-3.5" />
              ) : (
                <Calendar className="h-3.5 w-3.5" />
              )}
              <span>{isFollowUpSynced ? 'Synced' : 'Cal'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onMarkFollowedUp(application.id)}
            title="Mark followed up today (resets idle timer & advances follow-up)"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Follow Up</span>
          </button>
        </div>
      </div>
    </article>
  );
};
