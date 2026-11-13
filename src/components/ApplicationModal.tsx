import React, { useEffect, useState } from 'react';
import {
  Calendar,
  CalendarCheck2,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  ApplicationStage,
  APPLICATION_STAGES,
  InterviewEvent,
  InterviewType,
  JobAiInsights,
  JobApplication,
  Priority,
  WorkMode,
} from '../types/job';
import { formatDisplayDate, formatTime12h, getLocalDateString } from '../utils/dateUtils';
import { analyzeJobDescription } from '../services/jdAnalyzerService';

interface ApplicationModalProps {
  isOpen: boolean;
  application: JobApplication | null; // null = create mode
  initialStage?: ApplicationStage;
  initialFocusInterview?: boolean;
  isGoogleConnected: boolean;
  syncingKey: string | null;
  onClose: () => void;
  onSave: (app: JobApplication) => void;
  onDelete: (app: JobApplication) => void;
  onSyncInterview: (app: JobApplication, interview: InterviewEvent) => void;
  onRemoveInterviewFromCalendar: (app: JobApplication, interview: InterviewEvent) => void;
  onSyncFollowUp: (app: JobApplication) => void;
  onRemoveFollowUpFromCalendar: (app: JobApplication) => void;
  onSyncDeadline: (app: JobApplication) => void;
  onRemoveDeadlineFromCalendar: (app: JobApplication) => void;
}

const INTERVIEW_TYPES: InterviewType[] = [
  'Phone Screen',
  'Technical',
  'Behavioral',
  'System Design',
  'Final',
  'Other',
];

export const ApplicationModal: React.FC<ApplicationModalProps> = ({
  isOpen,
  application,
  initialStage = 'Applied',
  initialFocusInterview = false,
  isGoogleConnected,
  syncingKey,
  onClose,
  onSave,
  onDelete,
  onSyncInterview,
  onRemoveInterviewFromCalendar,
  onSyncFollowUp,
  onRemoveFollowUpFromCalendar,
  onSyncDeadline,
  onRemoveDeadlineFromCalendar,
}) => {
  const today = getLocalDateString();

  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [location, setLocation] = useState('');
  const [workMode, setWorkMode] = useState<WorkMode>('Hybrid');
  const [salaryRange, setSalaryRange] = useState('');
  const [resumeVersion, setResumeVersion] = useState('');
  const [roundNotes, setRoundNotes] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [stage, setStage] = useState<ApplicationStage>('Applied');
  const [priority, setPriority] = useState<Priority>('Medium');
  const [appliedDate, setAppliedDate] = useState(today);
  const [followUpDate, setFollowUpDate] = useState('');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [aiInsights, setAiInsights] = useState<JobAiInsights | undefined>(undefined);
  const [isAnalyzingJd, setIsAnalyzingJd] = useState(false);
  const [jdError, setJdError] = useState<string | null>(null);
  const [copiedDraft, setCopiedDraft] = useState(false);
  const [interviews, setInterviews] = useState<InterviewEvent[]>([]);

  // Inline new interview form
  const [showInterviewForm, setShowInterviewForm] = useState(false);
  const [ivTitle, setIvTitle] = useState('');
  const [ivType, setIvType] = useState<InterviewType>('Technical');
  const [ivDate, setIvDate] = useState(today);
  const [ivTime, setIvTime] = useState('11:00');
  const [ivDuration, setIvDuration] = useState(45);
  const [ivLocation, setIvLocation] = useState('');
  const [ivNotes, setIvNotes] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setFormError('');
    setJdError(null);
    setCopiedDraft(false);
    if (application) {
      setCompany(application.company);
      setRole(application.role);
      setLocation(application.location);
      setWorkMode(application.workMode);
      setSalaryRange(application.salaryRange || '');
      setResumeVersion(application.resumeVersion || '');
      setRoundNotes(application.roundNotes || '');
      setJobUrl(application.jobUrl || '');
      setJobDescription(application.jobDescription || '');
      setAiInsights(application.aiInsights);
      setStage(application.stage);
      setPriority(application.priority);
      setAppliedDate(application.appliedDate);
      setFollowUpDate(application.followUpDate || '');
      setDeadlineDate(application.deadlineDate || '');
      setContactName(application.contactName || '');
      setContactEmail(application.contactEmail || '');
      setNotes(application.notes || '');
      setInterviews(application.interviews || []);
      setShowInterviewForm(initialFocusInterview);
    } else {
      setCompany('');
      setRole('');
      setLocation('Remote');
      setWorkMode('Remote');
      setSalaryRange('');
      setResumeVersion('Staff_FE_Payments_v4.pdf');
      setRoundNotes('');
      setJobUrl('');
      setJobDescription('');
      setAiInsights(undefined);
      setStage(initialStage);
      setPriority('Medium');
      setAppliedDate(today);
      setFollowUpDate(getLocalDateString(new Date(), 4));
      setDeadlineDate('');
      setContactName('');
      setContactEmail('');
      setNotes('');
      setInterviews([]);
      setShowInterviewForm(initialFocusInterview);
    }
    setIvTitle('');
    setIvType('Technical');
    setIvDate(today);
    setIvTime('11:00');
    setIvDuration(45);
    setIvLocation('');
    setIvNotes('');
  }, [isOpen, application, initialStage, initialFocusInterview, today]);

  if (!isOpen) return null;

  const buildDraftApp = (): JobApplication => {
    const nowIso = new Date().toISOString();
    return {
      id: application?.id || `app-${Date.now()}`,
      company: company.trim(),
      role: role.trim(),
      location: location.trim() || 'Remote',
      workMode,
      salaryRange: salaryRange.trim() || 'Not listed',
      resumeVersion: resumeVersion.trim() || undefined,
      roundNotes: roundNotes.trim() || undefined,
      jobUrl: jobUrl.trim() || undefined,
      jobDescription: jobDescription.trim() || undefined,
      aiInsights,
      stage,
      appliedDate: appliedDate || today,
      lastActivityDate: today,
      followUpDate: followUpDate || undefined,
      deadlineDate: deadlineDate || undefined,
      interviews,
      followUpGoogleEventId: application?.followUpGoogleEventId,
      followUpGoogleHtmlLink: application?.followUpGoogleHtmlLink,
      deadlineGoogleEventId: application?.deadlineGoogleEventId,
      deadlineGoogleHtmlLink: application?.deadlineGoogleHtmlLink,
      contactName: contactName.trim() || undefined,
      contactEmail: contactEmail.trim() || undefined,
      notes: notes.trim() || undefined,
      priority,
      dismissedIdleAt: undefined,
      createdAt: application?.createdAt || nowIso,
      updatedAt: nowIso,
    };
  };

  const handleAnalyzeModalJd = async () => {
    const trimmed = jobDescription.trim();
    if (trimmed.length < 20) {
      setJdError('Paste at least 20 characters of the job description first.');
      return;
    }
    setJdError(null);
    setIsAnalyzingJd(true);
    try {
      const result = await analyzeJobDescription({
        jobDescription: trimmed,
        company: company.trim() || 'Target Company',
        role: role.trim() || 'Target Role',
        stage,
        contactName: contactName.trim() || undefined,
        roundNotes: roundNotes.trim() || notes.trim() || undefined,
      });
      setAiInsights(result);
    } catch (err) {
      setJdError(
        err instanceof Error ? err.message : 'Unable to analyze job description right now.'
      );
    } finally {
      setIsAnalyzingJd(false);
    }
  };

  const handleCopyModalDraft = async () => {
    if (!aiInsights?.followUpDraft) return;
    try {
      await navigator.clipboard.writeText(aiInsights.followUpDraft);
      setCopiedDraft(true);
      window.setTimeout(() => setCopiedDraft(false), 2000);
    } catch {
      setJdError('Clipboard access unavailable. Select and copy the draft manually.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!company.trim() || !role.trim()) {
      setFormError('Company name and role title are required.');
      return;
    }
    onSave(buildDraftApp());
  };

  const handleAddInterview = () => {
    if (!ivTitle.trim() || !ivDate || !ivTime) {
      setFormError('Interview title, date, and start time are required.');
      return;
    }
    const newInterview: InterviewEvent = {
      id: `iv-${Date.now()}`,
      title: ivTitle.trim(),
      type: ivType,
      date: ivDate,
      startTime: ivTime,
      durationMinutes: Number(ivDuration) || 45,
      locationOrLink: ivLocation.trim() || 'Video Call',
      notes: ivNotes.trim() || undefined,
    };
    setInterviews((prev) => [...prev, newInterview]);
    setIvTitle('');
    setIvLocation('');
    setIvNotes('');
    setShowInterviewForm(false);
    setFormError('');
  };

  const handleDeleteLocalInterview = (ivId: string) => {
    setInterviews((prev) => prev.filter((item) => item.id !== ivId));
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-modal-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div>
            <h2
              id="app-modal-title"
              className="text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              {application ? `${application.company} — Edit Application` : 'Add Job Application'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Changes save to localStorage and update your idle timer automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <form onSubmit={handleSubmit} className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {formError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300">
              {formError}
            </div>
          )}

          {/* Core Info */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Company *
              </label>
              <input
                type="text"
                required
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Stripe"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Role Title *
              </label>
              <input
                type="text"
                required
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Senior Frontend Engineer"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Column / Stage
              </label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as ApplicationStage)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                {APPLICATION_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Work Mode
                </label>
                <select
                  value={workMode}
                  onChange={(e) => setWorkMode(e.target.value as WorkMode)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="Remote">Remote</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="Onsite">Onsite</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Pay Range
              </label>
              <input
                type="text"
                value={salaryRange}
                onChange={(e) => setSalaryRange(e.target.value)}
                placeholder="$180k – $220k"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Resume Version
              </label>
              <input
                type="text"
                value={resumeVersion}
                onChange={(e) => setResumeVersion(e.target.value)}
                placeholder="e.g. Staff_FE_Payments_v4.pdf"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="San Francisco, CA"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Job Posting URL
              </label>
              <input
                type="url"
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
                placeholder="https://..."
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Round Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Round Notes (shown on card)
            </label>
            <textarea
              rows={2}
              value={roundNotes}
              onChange={(e) => setRoundNotes(e.target.value)}
              placeholder="e.g. R2 Technical: Live React state resilience & payment latency architecture prep."
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          {/* Job Description & AI Interview Prep */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/60">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
                  <Sparkles className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  Job Description & AI Interview Prep
                </h3>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  Paste the job description to extract key skills, 3 interview questions, and a recruiter follow-up note.
                </p>
              </div>
              <button
                type="button"
                disabled={isAnalyzingJd}
                onClick={handleAnalyzeModalJd}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                {isAnalyzingJd ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {isAnalyzingJd
                  ? 'Analyzing...'
                  : aiInsights
                  ? 'Re-analyze JD'
                  : 'Extract & Generate'}
              </button>
            </div>

            <textarea
              rows={4}
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste full job description here..."
              className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />

            {jdError && (
              <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300">
                {jdError}
              </div>
            )}

            {aiInsights && (
              <div className="mt-3 space-y-3 border-t border-slate-200 pt-3 dark:border-slate-800">
                {aiInsights.skills.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Key Required Skills
                    </h4>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {aiInsights.skills.map((skill, idx) => (
                        <span
                          key={`${skill}-${idx}`}
                          className="rounded border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {aiInsights.interviewQuestions.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      3 Tailored Interview Questions
                    </h4>
                    <ol className="mt-1.5 space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                      {aiInsights.interviewQuestions.map((question, idx) => (
                        <li key={idx} className="flex items-start gap-2 leading-relaxed">
                          <span className="font-mono text-xs font-semibold text-blue-600 tabular-nums shrink-0 dark:text-blue-400">
                            {idx + 1}.
                          </span>
                          <span>{question}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {aiInsights.followUpDraft && (
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Concise Recruiter Follow-up Note
                      </h4>
                      <button
                        type="button"
                        onClick={handleCopyModalDraft}
                        className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
                      >
                        {copiedDraft ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            Copy Note
                          </>
                        )}
                      </button>
                    </div>
                    <p className="mt-1.5 rounded-lg border border-slate-200 bg-white p-2.5 text-xs leading-relaxed text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                      {aiInsights.followUpDraft}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Dates & Google Calendar Sync */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/60">
            <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              Schedule, Follow-up & Deadlines
            </h3>

            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Applied Date
                </label>
                <input
                  type="date"
                  value={appliedDate}
                  onChange={(e) => setAppliedDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Follow-up Date
                  </label>
                  {application && followUpDate && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={syncingKey === `followup:${application.id}`}
                        onClick={() => onSyncFollowUp({ ...buildDraftApp(), id: application.id })}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                      >
                        {syncingKey === `followup:${application.id}` ? (
                          <RefreshCw className="h-3 w-3 animate-spin" />
                        ) : application.followUpGoogleEventId ? (
                          <CalendarCheck2 className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <Calendar className="h-3 w-3" />
                        )}
                        {application.followUpGoogleEventId ? 'Update Cal' : 'Sync Cal'}
                      </button>
                      {application.followUpGoogleEventId && (
                        <button
                          type="button"
                          onClick={() => onRemoveFollowUpFromCalendar(application)}
                          className="text-[11px] font-medium text-red-600 hover:text-red-700 dark:text-red-400"
                          title="Remove follow-up from Google Calendar"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Deadline
                  </label>
                  {application && deadlineDate && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={syncingKey === `deadline:${application.id}`}
                        onClick={() => onSyncDeadline({ ...buildDraftApp(), id: application.id })}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                      >
                        {syncingKey === `deadline:${application.id}` ? (
                          <RefreshCw className="h-3 w-3 animate-spin" />
                        ) : application.deadlineGoogleEventId ? (
                          <CalendarCheck2 className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <Calendar className="h-3 w-3" />
                        )}
                        {application.deadlineGoogleEventId ? 'Update Cal' : 'Sync Cal'}
                      </button>
                      {application.deadlineGoogleEventId && (
                        <button
                          type="button"
                          onClick={() => onRemoveDeadlineFromCalendar(application)}
                          className="text-[11px] font-medium text-red-600 hover:text-red-700 dark:text-red-400"
                          title="Remove deadline from Google Calendar"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <input
                  type="date"
                  value={deadlineDate}
                  onChange={(e) => setDeadlineDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          </div>

          {/* Interviews Section */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Interviews ({interviews.length})
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Interviews appear in the Upcoming Interviews strip and can be synced to Google Calendar.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowInterviewForm((prev) => !prev)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Interview
              </button>
            </div>

            {showInterviewForm && (
              <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input
                    type="text"
                    value={ivTitle}
                    onChange={(e) => setIvTitle(e.target.value)}
                    placeholder="Round title (e.g. Technical Deep Dive)"
                    className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  <select
                    value={ivType}
                    onChange={(e) => setIvType(e.target.value as InterviewType)}
                    className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    {INTERVIEW_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <input
                    type="date"
                    value={ivDate}
                    onChange={(e) => setIvDate(e.target.value)}
                    className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="time"
                    value={ivTime}
                    onChange={(e) => setIvTime(e.target.value)}
                    className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="number"
                    min={15}
                    max={300}
                    step={15}
                    value={ivDuration}
                    onChange={(e) => setIvDuration(Number(e.target.value))}
                    placeholder="Mins"
                    className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="text"
                    value={ivLocation}
                    onChange={(e) => setIvLocation(e.target.value)}
                    placeholder="Meet / Zoom link"
                    className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowInterviewForm(false)}
                    className="rounded-md px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200/70 dark:text-slate-400 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddInterview}
                    className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Add to List
                  </button>
                </div>
              </div>
            )}

            {interviews.length > 0 && (
              <div className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                {interviews.map((iv) => {
                  const isSynced = Boolean(iv.googleCalendarEventId);
                  const isBusy = syncingKey === iv.id;
                  return (
                    <div
                      key={iv.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {iv.title} · {iv.type}
                        </p>
                        <p className="font-mono text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                          {formatDisplayDate(iv.date)} at {formatTime12h(iv.startTime)} ({iv.durationMinutes}m)
                          {iv.locationOrLink ? ` · ${iv.locationOrLink}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {application && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              onSyncInterview({ ...buildDraftApp(), id: application.id }, iv)
                            }
                            title={
                              isGoogleConnected
                                ? isSynced
                                  ? 'Update Google Calendar event'
                                  : 'Add interview to Google Calendar'
                                : 'Sign in with Google to sync'
                            }
                            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium ${
                              isSynced
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-400'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                            }`}
                          >
                            {isBusy ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : isSynced ? (
                              <CalendarCheck2 className="h-3 w-3" />
                            ) : (
                              <Calendar className="h-3 w-3" />
                            )}
                            {isSynced ? 'Update Cal' : 'Add to Cal'}
                          </button>
                        )}
                        {application && isSynced && (
                          <button
                            type="button"
                            onClick={() => onRemoveInterviewFromCalendar(application, iv)}
                            className="rounded-md px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                          >
                            Unsync
                          </button>
                        )}
                        {iv.googleCalendarHtmlLink && (
                          <a
                            href={iv.googleCalendarHtmlLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-md p-1 text-slate-400 hover:text-blue-600"
                            title="Open in Google Calendar"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteLocalInterview(iv.id)}
                          className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                          aria-label={`Remove ${iv.title}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Contact & General Notes */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Recruiter / Contact
              </label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Maya Lin"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Contact Email
              </label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="maya@company.com"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Additional Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Referral context, compensation notes, follow-up links..."
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
            {application ? (
              <button
                type="button"
                onClick={() => onDelete(application)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Application
              </button>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                {application ? 'Save Changes' : 'Add Application'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
