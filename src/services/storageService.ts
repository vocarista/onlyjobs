import { buildSeedApplications } from '../data/seedApplications';
import { AppSettings, ApplicationStage, APPLICATION_STAGES, JobApplication } from '../types/job';
import { getLocalDateString } from '../utils/dateUtils';

const STORAGE_KEY = 'onlyjobs_applications_v1';
const SETTINGS_KEY = 'onlyjobs_settings_v1';

// Legacy keys that might exist from earlier OnlyJobs versions — read non-destructively!
const LEGACY_KEYS = [
  'onlyjobs_applications',
  'onlyjobs_jobs',
  'onlyjobs_data',
  'onlyjobs',
  'job_applications',
  'applications',
];

const DEFAULT_SETTINGS: AppSettings = {
  idleThresholdDays: 7,
  darkMode: false,
};

function normalizeStage(raw: unknown): ApplicationStage {
  if (typeof raw === 'string') {
    const lower = raw.toLowerCase();
    if (lower === 'saved' || lower.includes('wish') || lower.includes('bookmark')) return 'Saved';
    if (lower === 'applied') return 'Applied';
    if (
      lower === 'interview' ||
      lower.includes('phone') ||
      lower.includes('screen') ||
      lower.includes('tech') ||
      lower.includes('onsite') ||
      lower.includes('final')
    ) {
      return 'Interview';
    }
    if (lower === 'offer') return 'Offer';
    if (lower.includes('reject') || lower.includes('declin') || lower.includes('archiv')) {
      return 'Rejected';
    }
    const exact = APPLICATION_STAGES.find((s) => s.toLowerCase() === lower);
    if (exact) return exact;
  }
  return 'Applied';
}

function normalizeApplication(raw: Record<string, unknown>, idx: number): JobApplication {
  const today = getLocalDateString();
  const appliedDate =
    typeof raw.appliedDate === 'string' && raw.appliedDate
      ? raw.appliedDate.slice(0, 10)
      : typeof raw.dateApplied === 'string' && raw.dateApplied
      ? raw.dateApplied.slice(0, 10)
      : today;

  const lastActivityDate =
    typeof raw.lastActivityDate === 'string' && raw.lastActivityDate
      ? raw.lastActivityDate.slice(0, 10)
      : typeof raw.updatedAt === 'string' && raw.updatedAt
      ? raw.updatedAt.slice(0, 10)
      : appliedDate;

  const followUpDate =
    typeof raw.followUpDate === 'string' && raw.followUpDate
      ? raw.followUpDate.slice(0, 10)
      : undefined;

  const deadlineDate =
    typeof raw.deadlineDate === 'string' && raw.deadlineDate
      ? raw.deadlineDate.slice(0, 10)
      : undefined;

  let aiInsights: JobApplication['aiInsights'] = undefined;
  if (raw.aiInsights && typeof raw.aiInsights === 'object') {
    const rawAi = raw.aiInsights as Record<string, unknown>;
    const skills = Array.isArray(rawAi.skills)
      ? rawAi.skills.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
      : [];
    const interviewQuestions = Array.isArray(rawAi.interviewQuestions)
      ? rawAi.interviewQuestions.filter(
          (q): q is string => typeof q === 'string' && q.trim().length > 0
        )
      : [];
    const followUpDraft =
      typeof rawAi.followUpDraft === 'string' ? rawAi.followUpDraft : '';
    const analyzedAt =
      typeof rawAi.analyzedAt === 'string' ? rawAi.analyzedAt : new Date().toISOString();
    if (skills.length > 0 || interviewQuestions.length > 0 || followUpDraft) {
      aiInsights = {
        skills,
        interviewQuestions,
        followUpDraft,
        analyzedAt,
      };
    }
  }

  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `app-migrated-${idx}-${Date.now()}`,
    company: String(raw.company || raw.companyName || 'Untitled Company'),
    role: String(raw.role || raw.position || raw.title || 'Software Engineer'),
    location: String(raw.location || 'Remote'),
    workMode:
      raw.workMode === 'Remote' || raw.workMode === 'Hybrid' || raw.workMode === 'Onsite'
        ? raw.workMode
        : 'Hybrid',
    salaryRange: String(raw.salaryRange || raw.salary || raw.compensation || 'Not listed'),
    resumeVersion:
      typeof raw.resumeVersion === 'string'
        ? raw.resumeVersion
        : typeof raw.resume === 'string'
        ? raw.resume
        : undefined,
    roundNotes:
      typeof raw.roundNotes === 'string'
        ? raw.roundNotes
        : typeof raw.notes === 'string'
        ? raw.notes
        : undefined,
    jobUrl: typeof raw.jobUrl === 'string' ? raw.jobUrl : typeof raw.url === 'string' ? raw.url : undefined,
    jobDescription: typeof raw.jobDescription === 'string' ? raw.jobDescription : undefined,
    aiInsights,
    stage: normalizeStage(raw.stage || raw.status),
    appliedDate,
    lastActivityDate,
    followUpDate,
    deadlineDate,
    interviews: Array.isArray(raw.interviews) ? raw.interviews : [],
    followUpGoogleEventId: typeof raw.followUpGoogleEventId === 'string' ? raw.followUpGoogleEventId : undefined,
    followUpGoogleHtmlLink: typeof raw.followUpGoogleHtmlLink === 'string' ? raw.followUpGoogleHtmlLink : undefined,
    deadlineGoogleEventId: typeof raw.deadlineGoogleEventId === 'string' ? raw.deadlineGoogleEventId : undefined,
    deadlineGoogleHtmlLink: typeof raw.deadlineGoogleHtmlLink === 'string' ? raw.deadlineGoogleHtmlLink : undefined,
    contactName: typeof raw.contactName === 'string' ? raw.contactName : undefined,
    contactEmail: typeof raw.contactEmail === 'string' ? raw.contactEmail : undefined,
    notes: typeof raw.notes === 'string' ? raw.notes : undefined,
    priority:
      raw.priority === 'High' || raw.priority === 'Medium' || raw.priority === 'Low'
        ? raw.priority
        : 'Medium',
    dismissedIdleAt: typeof raw.dismissedIdleAt === 'string' ? raw.dismissedIdleAt : undefined,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
  };
}

export function loadApplications(): JobApplication[] {
  try {
    const primaryRaw = localStorage.getItem(STORAGE_KEY);
    if (primaryRaw) {
      const parsed = JSON.parse(primaryRaw);
      if (Array.isArray(parsed)) {
        return parsed.map((item, idx) => normalizeApplication(item as Record<string, unknown>, idx));
      }
    }

    // Check legacy keys cleanly so existing localStorage data remains intact
    for (const key of LEGACY_KEYS) {
      const legacyRaw = localStorage.getItem(key);
      if (!legacyRaw) continue;
      try {
        const parsed = JSON.parse(legacyRaw);
        const list = Array.isArray(parsed)
          ? parsed
          : parsed && Array.isArray((parsed as { applications?: unknown[] }).applications)
          ? (parsed as { applications: unknown[] }).applications
          : null;
        if (list && list.length > 0) {
          const migrated = list.map((item, idx) =>
            normalizeApplication(item as Record<string, unknown>, idx)
          );
          saveApplications(migrated);
          return migrated;
        }
      } catch {
        // Ignore malformed legacy entry and continue
      }
    }
  } catch {
    // Fallback to seed if storage unavailable
  }

  const seeded = buildSeedApplications();
  saveApplications(seeded);
  return seeded;
}

export function saveApplications(apps: JobApplication[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(apps));
  } catch (err) {
    console.error('Failed to save OnlyJobs applications to localStorage:', err);
  }
}

export function resetToDemoApplications(): JobApplication[] {
  const seeded = buildSeedApplications();
  saveApplications(seeded);
  return seeded;
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        idleThresholdDays:
          typeof parsed.idleThresholdDays === 'number' && parsed.idleThresholdDays >= 1
            ? parsed.idleThresholdDays
            : DEFAULT_SETTINGS.idleThresholdDays,
        darkMode: Boolean(parsed.darkMode),
      };
    }
  } catch {
    // ignore
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}
