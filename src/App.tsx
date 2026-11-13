import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  CalendarCheck2,
  LogOut,
  Moon,
  Plus,
  RotateCcw,
  Search,
  Sun,
  UploadCloud,
} from 'lucide-react';
import {
  ApplicationStage,
  APPLICATION_STAGES,
  AppSettings,
  GoogleCalendarEventItem,
  InterviewEvent,
  JobAiInsights,
  JobApplication,
  PIPELINE_COLUMNS,
  PrimaryView,
  QuickFilter,
  SortOption,
  WorkMode,
} from './types/job';
import {
  getApplicationDueStatus,
  getLocalDateString,
  getUpcomingInterviews,
  isApplicationIdle,
} from './utils/dateUtils';
import {
  loadApplications,
  loadSettings,
  resetToDemoApplications,
  saveApplications,
  saveSettings,
} from './services/storageService';
import {
  clearCachedAccessToken,
  getAccessToken,
  googleSignIn,
  initAuth,
  logoutGoogle,
} from './services/googleAuthService';
import {
  buildDeadlineEventPayload,
  buildFollowUpEventPayload,
  buildInterviewEventPayload,
  CalendarApiError,
  createCalendarEvent,
  deleteCalendarEvent,
  listCalendarEvents,
  updateCalendarEvent,
} from './services/googleCalendarService';
import { GoogleSignInButton } from './components/GoogleSignInButton';
import { ConfirmDialog, ConfirmDialogState } from './components/ConfirmDialog';
import { UpcomingInterviewsStrip } from './components/UpcomingInterviewsStrip';
import { IdleAlertsBanner } from './components/IdleAlertsBanner';
import { ApplicationCard } from './components/ApplicationCard';
import { ApplicationsTable } from './components/ApplicationsTable';
import { CalendarView } from './components/CalendarView';
import { AnalyticsView } from './components/AnalyticsView';
import { ApplicationModal } from './components/ApplicationModal';

interface ToastMessage {
  id: number;
  text: string;
  tone: 'info' | 'success' | 'error';
}

const INITIAL_CONFIRM_STATE: ConfirmDialogState = {
  isOpen: false,
  title: '',
  description: '',
  confirmLabel: 'Confirm',
  onConfirm: () => {},
};

export default function App() {
  const [applications, setApplications] = useState<JobApplication[]>(() => loadApplications());
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());

  const [activeView, setActiveView] = useState<PrimaryView>('pipeline');
  const [searchQuery, setSearchQuery] = useState('');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [workModeFilter, setWorkModeFilter] = useState<'all' | WorkMode>('all');
  const [stageFilter, setStageFilter] = useState<'all' | ApplicationStage>('all');
  const [sortBy, setSortBy] = useState<SortOption>('urgency');
  const [showRejectedColumn, setShowRejectedColumn] = useState(false);

  // Drag-and-drop state
  const [draggedAppId, setDraggedAppId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<ApplicationStage | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<JobApplication | null>(null);
  const [modalInitialStage, setModalInitialStage] = useState<ApplicationStage>('Applied');
  const [focusInterviewForm, setFocusInterviewForm] = useState(false);

  // Google Auth & Calendar state (in-memory token only)
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [needsAuth, setNeedsAuth] = useState<boolean>(true);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEventItem[]>([]);
  const [isLoadingGoogleEvents, setIsLoadingGoogleEvents] = useState<boolean>(false);
  const [syncingKey, setSyncingKey] = useState<string | null>(null);

  // Confirmation modal & toast notifications
  const [confirmState, setConfirmState] = useState<ConfirmDialogState>(INITIAL_CONFIRM_STATE);
  const [isConfirmBusy, setIsConfirmBusy] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = useCallback((text: string, tone: ToastMessage['tone'] = 'info') => {
    const id = Date.now();
    setToast({ id, text, tone });
    window.setTimeout(() => {
      setToast((prev) => (prev?.id === id ? null : prev));
    }, 4000);
  }, []);

  // Sync dark mode class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.darkMode);
    saveSettings(settings);
  }, [settings]);

  // Persist applications to localStorage whenever updated
  useEffect(() => {
    saveApplications(applications);
  }, [applications]);

  const fetchGoogleEvents = useCallback(
    async (tokenOverride?: string) => {
      const token = tokenOverride || getAccessToken();
      if (!token) {
        setNeedsAuth(true);
        return;
      }
      setIsLoadingGoogleEvents(true);
      try {
        const now = new Date();
        const timeMin = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
        const timeMax = new Date(now.getFullYear(), now.getMonth() + 3, 0).toISOString();
        const items = await listCalendarEvents(token, timeMin, timeMax);
        setGoogleEvents(items);
      } catch (err) {
        if (err instanceof CalendarApiError && err.status === 401) {
          clearCachedAccessToken();
          setNeedsAuth(true);
          showToast('Google session expired. Please sign in again to refresh Calendar.', 'error');
        } else {
          showToast(
            err instanceof Error ? err.message : 'Unable to fetch Google Calendar events.',
            'error'
          );
        }
      } finally {
        setIsLoadingGoogleEvents(false);
      }
    },
    [showToast]
  );

  // Initialize Firebase Auth listener on mount
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setNeedsAuth(false);
        fetchGoogleEvents(token);
      },
      (user) => {
        setGoogleUser(user);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, [fetchGoogleEvents]);

  const handleGoogleSignIn = async (): Promise<string | null> => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      setGoogleUser(result.user);
      setNeedsAuth(false);
      showToast(`Connected Google Calendar for ${result.user.email}`, 'success');
      await fetchGoogleEvents(result.accessToken);
      return result.accessToken;
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Google sign-in was cancelled or failed.',
        'error'
      );
      return null;
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogout = async () => {
    await logoutGoogle();
    setGoogleUser(null);
    setNeedsAuth(true);
    setGoogleEvents([]);
    showToast('Disconnected Google Calendar.', 'info');
  };

  const ensureAccessToken = async (): Promise<string | null> => {
    const existing = getAccessToken();
    if (existing) return existing;
    showToast('Sign in with Google to sync with Google Calendar.', 'info');
    return await handleGoogleSignIn();
  };

  // Derived metrics & filters
  const idleApplications = useMemo(
    () => applications.filter((app) => isApplicationIdle(app, settings.idleThresholdDays)),
    [applications, settings.idleThresholdDays]
  );

  const upcomingInterviews = useMemo(
    () => getUpcomingInterviews(applications),
    [applications]
  );

  const filterCounts = useMemo(() => {
    let dueToday = 0;
    let overdue = 0;
    for (const app of applications) {
      const status = getApplicationDueStatus(app).status;
      if (status === 'due_today') dueToday++;
      if (status === 'overdue') overdue++;
    }
    return {
      all: applications.length,
      due_today: dueToday,
      overdue,
      idle: idleApplications.length,
      interviews: applications.filter((a) => (a.interviews || []).length > 0).length,
    };
  }, [applications, idleApplications]);

  const rejectedCount = useMemo(
    () => applications.filter((a) => a.stage === 'Rejected').length,
    [applications]
  );

  const filteredApplications = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = applications.filter((app) => {
      if (q) {
        const hay = `${app.company} ${app.role} ${app.location} ${app.resumeVersion || ''} ${
          app.roundNotes || ''
        } ${app.notes || ''} ${app.jobDescription || ''} ${
          app.aiInsights?.skills?.join(' ') || ''
        }`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (workModeFilter !== 'all' && app.workMode !== workModeFilter) {
        return false;
      }
      if (stageFilter !== 'all' && app.stage !== stageFilter) {
        return false;
      }
      if (quickFilter === 'due_today') {
        return getApplicationDueStatus(app).status === 'due_today';
      }
      if (quickFilter === 'overdue') {
        return getApplicationDueStatus(app).status === 'overdue';
      }
      if (quickFilter === 'idle') {
        return isApplicationIdle(app, settings.idleThresholdDays);
      }
      if (quickFilter === 'interviews') {
        return (app.interviews || []).length > 0;
      }
      return true;
    });

    const urgencyRank = (app: JobApplication) => {
      const s = getApplicationDueStatus(app).status;
      if (s === 'overdue') return 0;
      if (s === 'due_today') return 1;
      if (s === 'upcoming') return 2;
      return 3;
    };

    return list.slice().sort((a, b) => {
      if (sortBy === 'company') {
        return a.company.localeCompare(b.company);
      }
      if (sortBy === 'recent') {
        return b.updatedAt.localeCompare(a.updatedAt);
      }
      if (sortBy === 'followup') {
        const fa = a.followUpDate || '9999-12-31';
        const fb = b.followUpDate || '9999-12-31';
        return fa.localeCompare(fb);
      }
      // urgency
      const rankDiff = urgencyRank(a) - urgencyRank(b);
      if (rankDiff !== 0) return rankDiff;
      const fa = a.followUpDate || '9999-12-31';
      const fb = b.followUpDate || '9999-12-31';
      return fa.localeCompare(fb);
    });
  }, [
    applications,
    searchQuery,
    workModeFilter,
    stageFilter,
    quickFilter,
    sortBy,
    settings.idleThresholdDays,
  ]);

  // Application CRUD handlers
  const handleSaveApplication = (saved: JobApplication) => {
    setApplications((prev) => {
      const exists = prev.some((a) => a.id === saved.id);
      if (exists) {
        return prev.map((a) => (a.id === saved.id ? saved : a));
      }
      return [saved, ...prev];
    });
    setModalOpen(false);
    setEditingApp(null);
    showToast(`Saved ${saved.company} — ${saved.role}`, 'success');
  };

  const handleStageChange = (appId: string, newStage: ApplicationStage) => {
    const today = getLocalDateString();
    setApplications((prev) =>
      prev.map((app) =>
        app.id === appId
          ? {
              ...app,
              stage: newStage,
              lastActivityDate: today,
              dismissedIdleAt: undefined,
              updatedAt: new Date().toISOString(),
            }
          : app
      )
    );
  };

  const handleMarkFollowedUp = (appId: string) => {
    const today = getLocalDateString();
    const nextFollowUp = getLocalDateString(new Date(), 5);
    setApplications((prev) =>
      prev.map((app) =>
        app.id === appId
          ? {
              ...app,
              lastActivityDate: today,
              followUpDate: nextFollowUp,
              dismissedIdleAt: undefined,
              updatedAt: new Date().toISOString(),
            }
          : app
      )
    );
    showToast('Logged follow-up today and scheduled next check-in in 5 days.', 'success');
  };

  const handleDismissIdleAlert = (appId: string) => {
    const today = getLocalDateString();
    setApplications((prev) =>
      prev.map((app) =>
        app.id === appId ? { ...app, dismissedIdleAt: today } : app
      )
    );
  };

  const handleUpdateJobAiData = (
    appId: string,
    updates: {
      jobDescription?: string;
      aiInsights?: JobAiInsights;
      roundNotes?: string;
    }
  ) => {
    setApplications((prev) =>
      prev.map((app) =>
        app.id === appId
          ? {
              ...app,
              ...updates,
              updatedAt: new Date().toISOString(),
            }
          : app
      )
    );
    if (updates.aiInsights) {
      showToast('Extracted skills, 3 interview questions, and follow-up note.', 'success');
    }
  };

  const handleDeleteApplication = (app: JobApplication) => {
    setConfirmState({
      isOpen: true,
      title: `Delete ${app.company} application?`,
      description: `This removes "${app.role}" at ${app.company} from your OnlyJobs localStorage pipeline.`,
      confirmLabel: 'Delete Application',
      variant: 'danger',
      onConfirm: () => {
        setApplications((prev) => prev.filter((item) => item.id !== app.id));
        setConfirmState(INITIAL_CONFIRM_STATE);
        setModalOpen(false);
        setEditingApp(null);
        showToast(`Deleted ${app.company} application.`, 'info');
      },
    });
  };

  const handleResetDemo = () => {
    setConfirmState({
      isOpen: true,
      title: 'Reset to sample OnlyJobs data?',
      description:
        'This will replace your current localStorage applications with the default OnlyJobs sample pipeline.',
      confirmLabel: 'Reset Data',
      variant: 'danger',
      onConfirm: () => {
        const fresh = resetToDemoApplications();
        setApplications(fresh);
        setConfirmState(INITIAL_CONFIRM_STATE);
        showToast('Restored default sample applications.', 'info');
      },
    });
  };

  // Google Calendar Sync Handlers (with mandatory confirmation for updates & deletes)
  const executeCalendarMutation = async (
    key: string,
    fn: (token: string) => Promise<void>
  ) => {
    const token = await ensureAccessToken();
    if (!token) return;
    setSyncingKey(key);
    try {
      await fn(token);
      await fetchGoogleEvents(token);
    } catch (err) {
      if (err instanceof CalendarApiError && err.status === 401) {
        clearCachedAccessToken();
        setNeedsAuth(true);
        showToast('Google Calendar session expired. Please sign in again.', 'error');
      } else {
        showToast(
          err instanceof Error ? err.message : 'Google Calendar sync failed.',
          'error'
        );
      }
    } finally {
      setSyncingKey(null);
    }
  };

  const handleSyncInterview = (app: JobApplication, interview: InterviewEvent) => {
    const payload = buildInterviewEventPayload(app, interview);

    if (interview.googleCalendarEventId) {
      // Mutating existing Google Calendar event -> mandatory user confirmation!
      setConfirmState({
        isOpen: true,
        title: 'Update Google Calendar event?',
        description: `This will overwrite the existing Google Calendar event for "${interview.title}" at ${app.company}.`,
        details: [`${payload.summary}`, `Date: ${interview.date} at ${interview.startTime}`],
        confirmLabel: 'Update Event',
        variant: 'primary',
        onConfirm: async () => {
          setIsConfirmBusy(true);
          try {
            await executeCalendarMutation(interview.id, async (token) => {
              const updated = await updateCalendarEvent(
                token,
                interview.googleCalendarEventId!,
                payload
              );
              setApplications((prev) =>
                prev.map((a) =>
                  a.id === app.id
                    ? {
                        ...a,
                        interviews: a.interviews.map((iv) =>
                          iv.id === interview.id
                            ? {
                                ...iv,
                                googleCalendarEventId: updated.id,
                                googleCalendarHtmlLink: updated.htmlLink,
                              }
                            : iv
                        ),
                      }
                    : a
                )
              );
              showToast(`Updated "${interview.title}" on Google Calendar.`, 'success');
            });
          } finally {
            setIsConfirmBusy(false);
            setConfirmState(INITIAL_CONFIRM_STATE);
          }
        },
      });
      return;
    }

    // Creating a new Google Calendar event
    executeCalendarMutation(interview.id, async (token) => {
      const created = await createCalendarEvent(token, payload);
      setApplications((prev) =>
        prev.map((a) =>
          a.id === app.id
            ? {
                ...a,
                interviews: a.interviews.map((iv) =>
                  iv.id === interview.id
                    ? {
                        ...iv,
                        googleCalendarEventId: created.id,
                        googleCalendarHtmlLink: created.htmlLink,
                      }
                    : iv
                ),
              }
            : a
        )
      );
      showToast(`Added "${interview.title}" to Google Calendar.`, 'success');
    });
  };

  const handleRemoveInterviewFromCalendar = (
    app: JobApplication,
    interview: InterviewEvent
  ) => {
    if (!interview.googleCalendarEventId) return;
    setConfirmState({
      isOpen: true,
      title: 'Delete interview from Google Calendar?',
      description: `This will permanently delete the Google Calendar event "${app.company} — ${interview.title}" from your primary calendar.`,
      details: [`${interview.date} at ${interview.startTime}`],
      confirmLabel: 'Delete from Calendar',
      variant: 'danger',
      onConfirm: async () => {
        setIsConfirmBusy(true);
        try {
          await executeCalendarMutation(interview.id, async (token) => {
            await deleteCalendarEvent(token, interview.googleCalendarEventId!);
            setApplications((prev) =>
              prev.map((a) =>
                a.id === app.id
                  ? {
                      ...a,
                      interviews: a.interviews.map((iv) =>
                        iv.id === interview.id
                          ? {
                              ...iv,
                              googleCalendarEventId: undefined,
                              googleCalendarHtmlLink: undefined,
                            }
                          : iv
                      ),
                    }
                  : a
              )
            );
            showToast('Removed interview event from Google Calendar.', 'info');
          });
        } finally {
          setIsConfirmBusy(false);
          setConfirmState(INITIAL_CONFIRM_STATE);
        }
      },
    });
  };

  const handleSyncFollowUp = (app: JobApplication) => {
    if (!app.followUpDate) return;
    const payload = buildFollowUpEventPayload(app);

    if (app.followUpGoogleEventId) {
      setConfirmState({
        isOpen: true,
        title: 'Update follow-up on Google Calendar?',
        description: `This will update your existing Google Calendar reminder for ${app.company}.`,
        details: [`${payload.summary}`, `Follow-up date: ${app.followUpDate}`],
        confirmLabel: 'Update Event',
        variant: 'primary',
        onConfirm: async () => {
          setIsConfirmBusy(true);
          try {
            await executeCalendarMutation(`followup:${app.id}`, async (token) => {
              const updated = await updateCalendarEvent(
                token,
                app.followUpGoogleEventId!,
                payload
              );
              setApplications((prev) =>
                prev.map((a) =>
                  a.id === app.id
                    ? {
                        ...a,
                        followUpGoogleEventId: updated.id,
                        followUpGoogleHtmlLink: updated.htmlLink,
                      }
                    : a
                )
              );
              showToast(`Updated follow-up for ${app.company} on Google Calendar.`, 'success');
            });
          } finally {
            setIsConfirmBusy(false);
            setConfirmState(INITIAL_CONFIRM_STATE);
          }
        },
      });
      return;
    }

    executeCalendarMutation(`followup:${app.id}`, async (token) => {
      const created = await createCalendarEvent(token, payload);
      setApplications((prev) =>
        prev.map((a) =>
          a.id === app.id
            ? {
                ...a,
                followUpGoogleEventId: created.id,
                followUpGoogleHtmlLink: created.htmlLink,
              }
            : a
        )
      );
      showToast(`Added follow-up for ${app.company} to Google Calendar.`, 'success');
    });
  };

  const handleRemoveFollowUpFromCalendar = (app: JobApplication) => {
    if (!app.followUpGoogleEventId) return;
    setConfirmState({
      isOpen: true,
      title: 'Delete follow-up from Google Calendar?',
      description: `This will permanently delete the follow-up reminder for ${app.company} from your Google Calendar.`,
      confirmLabel: 'Delete from Calendar',
      variant: 'danger',
      onConfirm: async () => {
        setIsConfirmBusy(true);
        try {
          await executeCalendarMutation(`followup:${app.id}`, async (token) => {
            await deleteCalendarEvent(token, app.followUpGoogleEventId!);
            setApplications((prev) =>
              prev.map((a) =>
                a.id === app.id
                  ? {
                      ...a,
                      followUpGoogleEventId: undefined,
                      followUpGoogleHtmlLink: undefined,
                    }
                  : a
              )
            );
            showToast('Removed follow-up from Google Calendar.', 'info');
          });
        } finally {
          setIsConfirmBusy(false);
          setConfirmState(INITIAL_CONFIRM_STATE);
        }
      },
    });
  };

  const handleSyncDeadline = (app: JobApplication) => {
    if (!app.deadlineDate) return;
    const payload = buildDeadlineEventPayload(app);

    if (app.deadlineGoogleEventId) {
      setConfirmState({
        isOpen: true,
        title: 'Update deadline on Google Calendar?',
        description: `This will update the existing deadline event for ${app.company} on your Google Calendar.`,
        details: [`${payload.summary}`, `Deadline: ${app.deadlineDate}`],
        confirmLabel: 'Update Event',
        variant: 'primary',
        onConfirm: async () => {
          setIsConfirmBusy(true);
          try {
            await executeCalendarMutation(`deadline:${app.id}`, async (token) => {
              const updated = await updateCalendarEvent(
                token,
                app.deadlineGoogleEventId!,
                payload
              );
              setApplications((prev) =>
                prev.map((a) =>
                  a.id === app.id
                    ? {
                        ...a,
                        deadlineGoogleEventId: updated.id,
                        deadlineGoogleHtmlLink: updated.htmlLink,
                      }
                    : a
                )
              );
              showToast(`Updated deadline for ${app.company} on Google Calendar.`, 'success');
            });
          } finally {
            setIsConfirmBusy(false);
            setConfirmState(INITIAL_CONFIRM_STATE);
          }
        },
      });
      return;
    }

    executeCalendarMutation(`deadline:${app.id}`, async (token) => {
      const created = await createCalendarEvent(token, payload);
      setApplications((prev) =>
        prev.map((a) =>
          a.id === app.id
            ? {
                ...a,
                deadlineGoogleEventId: created.id,
                deadlineGoogleHtmlLink: created.htmlLink,
              }
            : a
        )
      );
      showToast(`Added deadline for ${app.company} to Google Calendar.`, 'success');
    });
  };

  const handleRemoveDeadlineFromCalendar = (app: JobApplication) => {
    if (!app.deadlineGoogleEventId) return;
    setConfirmState({
      isOpen: true,
      title: 'Delete deadline from Google Calendar?',
      description: `This will permanently delete the deadline event for ${app.company} from your Google Calendar.`,
      confirmLabel: 'Delete from Calendar',
      variant: 'danger',
      onConfirm: async () => {
        setIsConfirmBusy(true);
        try {
          await executeCalendarMutation(`deadline:${app.id}`, async (token) => {
            await deleteCalendarEvent(token, app.deadlineGoogleEventId!);
            setApplications((prev) =>
              prev.map((a) =>
                a.id === app.id
                  ? {
                      ...a,
                      deadlineGoogleEventId: undefined,
                      deadlineGoogleHtmlLink: undefined,
                    }
                  : a
              )
            );
            showToast('Removed deadline from Google Calendar.', 'info');
          });
        } finally {
          setIsConfirmBusy(false);
          setConfirmState(INITIAL_CONFIRM_STATE);
        }
      },
    });
  };

  const handleDeleteGoogleEvent = (ev: GoogleCalendarEventItem) => {
    setConfirmState({
      isOpen: true,
      title: 'Delete event from Google Calendar?',
      description: `Are you sure you want to delete "${ev.summary || 'Untitled event'}" from your Google Calendar? This action cannot be undone.`,
      confirmLabel: 'Delete Event',
      variant: 'danger',
      onConfirm: async () => {
        setIsConfirmBusy(true);
        try {
          await executeCalendarMutation(`gcal:${ev.id}`, async (token) => {
            await deleteCalendarEvent(token, ev.id);
            showToast('Deleted event from Google Calendar.', 'info');
          });
        } finally {
          setIsConfirmBusy(false);
          setConfirmState(INITIAL_CONFIRM_STATE);
        }
      },
    });
  };

  const handleSyncAllToGoogle = () => {
    const itemsToSync: Array<{
      label: string;
      run: (token: string) => Promise<void>;
    }> = [];

    for (const app of applications) {
      if (app.stage === 'Rejected') continue;
      for (const iv of app.interviews || []) {
        if (!iv.googleCalendarEventId) {
          itemsToSync.push({
            label: `Interview: ${app.company} — ${iv.title} (${iv.date})`,
            run: async (token) => {
              const created = await createCalendarEvent(
                token,
                buildInterviewEventPayload(app, iv)
              );
              setApplications((prev) =>
                prev.map((a) =>
                  a.id === app.id
                    ? {
                        ...a,
                        interviews: a.interviews.map((item) =>
                          item.id === iv.id
                            ? {
                                ...item,
                                googleCalendarEventId: created.id,
                                googleCalendarHtmlLink: created.htmlLink,
                              }
                            : item
                        ),
                      }
                    : a
                )
              );
            },
          });
        }
      }
      if (app.followUpDate && !app.followUpGoogleEventId) {
        itemsToSync.push({
          label: `Follow-up: ${app.company} (${app.followUpDate})`,
          run: async (token) => {
            const created = await createCalendarEvent(token, buildFollowUpEventPayload(app));
            setApplications((prev) =>
              prev.map((a) =>
                a.id === app.id
                  ? {
                      ...a,
                      followUpGoogleEventId: created.id,
                      followUpGoogleHtmlLink: created.htmlLink,
                    }
                  : a
              )
            );
          },
        });
      }
      if (app.deadlineDate && !app.deadlineGoogleEventId) {
        itemsToSync.push({
          label: `Deadline: ${app.company} (${app.deadlineDate})`,
          run: async (token) => {
            const created = await createCalendarEvent(token, buildDeadlineEventPayload(app));
            setApplications((prev) =>
              prev.map((a) =>
                a.id === app.id
                  ? {
                      ...a,
                      deadlineGoogleEventId: created.id,
                      deadlineGoogleHtmlLink: created.htmlLink,
                    }
                  : a
              )
            );
          },
        });
      }
    }

    if (itemsToSync.length === 0) {
      showToast('All interviews, follow-ups, and deadlines are already synced.', 'info');
      return;
    }

    setConfirmState({
      isOpen: true,
      title: `Sync ${itemsToSync.length} event${itemsToSync.length === 1 ? '' : 's'} to Google Calendar?`,
      description:
        'OnlyJobs will create these events on your primary Google Calendar with reminders.',
      details: itemsToSync.map((i) => i.label),
      confirmLabel: `Sync ${itemsToSync.length} Event${itemsToSync.length === 1 ? '' : 's'}`,
      variant: 'primary',
      onConfirm: async () => {
        setIsConfirmBusy(true);
        try {
          await executeCalendarMutation('bulk', async (token) => {
            for (const item of itemsToSync) {
              await item.run(token);
            }
            showToast(
              `Synced ${itemsToSync.length} event${itemsToSync.length === 1 ? '' : 's'} to Google Calendar.`,
              'success'
            );
          });
        } finally {
          setIsConfirmBusy(false);
          setConfirmState(INITIAL_CONFIRM_STATE);
        }
      },
    });
  };

  // Sync active editingApp reference when applications update
  const activeEditingApp = useMemo(() => {
    if (!editingApp) return null;
    return applications.find((a) => a.id === editingApp.id) || editingApp;
  }, [applications, editingApp]);

  const openCreateModal = (withInterview = false, stage: ApplicationStage = 'Applied') => {
    setEditingApp(null);
    setModalInitialStage(stage);
    setFocusInterviewForm(withInterview);
    setModalOpen(true);
  };

  const openEditModal = (app: JobApplication, withInterview = false) => {
    setEditingApp(app);
    setModalInitialStage(app.stage);
    setFocusInterviewForm(withInterview);
    setModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Top Bar Contract: Exactly 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-8 px-6 py-3.5">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveView('pipeline')}
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 dark:text-slate-100"
          >
            OnlyJobs
          </button>

          {/* Zone 2: Concise single-line nav links */}
          <nav className="flex items-center gap-6 overflow-x-auto text-sm font-medium">
            {(
              [
                { id: 'pipeline', label: 'Pipeline' },
                { id: 'applications', label: 'Applications' },
                { id: 'calendar', label: 'Calendar' },
                { id: 'analytics', label: 'Analytics' },
              ] as const
            ).map((tab) => {
              const isActive = activeView === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveView(tab.id)}
                  className={`border-b-2 py-1 transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'border-blue-600 text-slate-900 dark:border-blue-400 dark:text-slate-100'
                      : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary CTA */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => openCreateModal(false)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" />
              Add Application
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="mx-auto max-w-[1440px] space-y-5 px-6 py-6">
        {/* Workspace Toolbar (Google Calendar Connection, Filters, Search, Preferences) */}
        <section
          aria-label="Workspace Controls"
          className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search company, role, resume, notes..."
                aria-label="Search applications"
                className="w-56 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none sm:w-64 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:bg-slate-900"
              />
            </div>

            {/* Segmented Quick Filters */}
            <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-950">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'due_today', label: 'Due Today' },
                  { id: 'overdue', label: 'Overdue' },
                  { id: 'idle', label: 'Idle' },
                  { id: 'interviews', label: 'Interviews' },
                ] as const
              ).map((f) => {
                const active = quickFilter === f.id;
                const count = filterCounts[f.id];
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setQuickFilter(f.id)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-slate-100'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                    }`}
                  >
                    {f.label}{' '}
                    <span className="font-mono text-[11px] opacity-75 tabular-nums">
                      ({count})
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Stage, Work Mode & Sort Filters */}
            <select
              aria-label="Filter by stage"
              value={stageFilter}
              onChange={(e) =>
                setStageFilter(e.target.value as 'all' | ApplicationStage)
              }
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">All Columns</option>
              {APPLICATION_STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by work mode"
              value={workModeFilter}
              onChange={(e) =>
                setWorkModeFilter(e.target.value as 'all' | WorkMode)
              }
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">All Modes</option>
              <option value="Remote">Remote</option>
              <option value="Hybrid">Hybrid</option>
              <option value="Onsite">Onsite</option>
            </select>

            <select
              aria-label="Sort applications"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="urgency">Sort: Urgency</option>
              <option value="followup">Sort: Follow-up Date</option>
              <option value="recent">Sort: Recently Updated</option>
              <option value="company">Sort: Company A–Z</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {activeView === 'pipeline' && rejectedCount > 0 && (
              <button
                type="button"
                onClick={() => setShowRejectedColumn((prev) => !prev)}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  showRejectedColumn
                    ? 'border-slate-300 bg-slate-100 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
                }`}
              >
                {showRejectedColumn ? 'Hide' : 'Show'} Rejected ({rejectedCount})
              </button>
            )}

            {/* Idle Threshold Selector */}
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
              <span className="whitespace-nowrap">Idle after</span>
              <select
                aria-label="Idle alert threshold in days"
                value={settings.idleThresholdDays}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    idleThresholdDays: Number(e.target.value),
                  }))
                }
                className="rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value={5}>5d</option>
                <option value={7}>7d</option>
                <option value={10}>10d</option>
                <option value={14}>14d</option>
              </select>
            </label>

            {/* Google Calendar Auth / Status */}
            {needsAuth ? (
              <GoogleSignInButton
                onClick={handleGoogleSignIn}
                disabled={isLoggingIn}
                label={isLoggingIn ? 'Signing in...' : 'Sign in with Google'}
              />
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800">
                <CalendarCheck2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="max-w-[160px] truncate text-xs font-medium text-slate-700 dark:text-slate-200">
                  {googleUser?.email || 'Google Calendar'}
                </span>
                <button
                  type="button"
                  onClick={handleSyncAllToGoogle}
                  disabled={syncingKey === 'bulk'}
                  className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 whitespace-nowrap shrink-0 dark:text-blue-400 dark:hover:bg-blue-950/40"
                >
                  <UploadCloud className="h-3.5 w-3.5" />
                  Sync All
                </button>
                <button
                  type="button"
                  onClick={handleGoogleLogout}
                  title="Sign out of Google Calendar"
                  aria-label="Sign out of Google Calendar"
                  className="rounded p-1 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Theme & Reset Controls */}
            <button
              type="button"
              onClick={() =>
                setSettings((prev) => ({ ...prev, darkMode: !prev.darkMode }))
              }
              title={settings.darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label="Toggle color theme"
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {settings.darkMode ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>

            <button
              type="button"
              onClick={handleResetDemo}
              title="Reset sample applications"
              aria-label="Reset sample applications"
              className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </section>

        {/* Upcoming Interviews Summary Strip */}
        {activeView !== 'calendar' && (
          <UpcomingInterviewsStrip
            items={upcomingInterviews}
            isGoogleConnected={!needsAuth}
            syncingId={syncingKey}
            onSelectApplication={(app) => openEditModal(app, false)}
            onSyncInterview={handleSyncInterview}
            onOpenCalendarTab={() => setActiveView('calendar')}
            onScheduleInterviewClick={() => {
              if (applications.length > 0) {
                openEditModal(applications[0], true);
              } else {
                openCreateModal(true);
              }
            }}
          />
        )}

        {/* Idle Application Alerts */}
        {activeView !== 'calendar' && activeView !== 'analytics' && (
          <IdleAlertsBanner
            idleApplications={idleApplications}
            thresholdDays={settings.idleThresholdDays}
            onMarkFollowedUp={handleMarkFollowedUp}
            onOpenApplication={(app) => openEditModal(app, false)}
            onDismissAlert={handleDismissIdleAlert}
          />
        )}

        {/* Active View Content */}
        {activeView === 'pipeline' && (
          <section aria-label="Pipeline Board">
            <div
              className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${
                showRejectedColumn ? 'xl:grid-cols-5' : 'xl:grid-cols-4'
              }`}
            >
              {(showRejectedColumn ? APPLICATION_STAGES : PIPELINE_COLUMNS).map((stage) => {
                const stageApps = filteredApplications.filter((a) => a.stage === stage);
                const isDropTarget = dragOverStage === stage;

                return (
                  <div
                    key={stage}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragOverStage !== stage) {
                        setDragOverStage(stage);
                      }
                    }}
                    onDragLeave={() => {
                      if (dragOverStage === stage) {
                        setDragOverStage(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const droppedId = e.dataTransfer.getData('text/plain') || draggedAppId;
                      setDragOverStage(null);
                      setDraggedAppId(null);
                      if (droppedId) {
                        const targetApp = applications.find((a) => a.id === droppedId);
                        if (targetApp && targetApp.stage !== stage) {
                          handleStageChange(droppedId, stage);
                          showToast(`Moved ${targetApp.company} to ${stage}.`, 'info');
                        }
                      }
                    }}
                    className={`flex min-w-0 flex-col rounded-xl border p-3 transition-colors ${
                      isDropTarget
                        ? 'border-blue-400 bg-blue-50/50 dark:border-blue-600 dark:bg-blue-950/30'
                        : 'border-slate-200 bg-slate-100/70 dark:border-slate-800 dark:bg-slate-900/50'
                    }`}
                  >
                    <div className="mb-3 flex items-center justify-between gap-2 px-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {stage}
                        </h3>
                        <span className="font-mono text-xs font-semibold text-slate-500 tabular-nums dark:text-slate-400">
                          {stageApps.length}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => openCreateModal(false, stage)}
                        title={`Add role to ${stage}`}
                        aria-label={`Add role to ${stage}`}
                        className="rounded-md p-1 text-slate-500 hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="flex flex-1 flex-col gap-3">
                      {stageApps.length === 0 ? (
                        <div className="flex min-h-[140px] flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-200 px-3 py-8 text-center dark:border-slate-800">
                          <p className="text-xs text-slate-400 dark:text-slate-500">
                            No {stage.toLowerCase()} roles
                          </p>
                          <button
                            type="button"
                            onClick={() => openCreateModal(false, stage)}
                            className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                          >
                            + Add to {stage}
                          </button>
                        </div>
                      ) : (
                        stageApps.map((app) => (
                          <ApplicationCard
                            key={app.id}
                            application={app}
                            idleThresholdDays={settings.idleThresholdDays}
                            syncingKey={syncingKey}
                            onSelect={(selected) => openEditModal(selected, false)}
                            onStageChange={handleStageChange}
                            onMarkFollowedUp={handleMarkFollowedUp}
                            onSyncFollowUp={handleSyncFollowUp}
                            onUpdateJobAiData={handleUpdateJobAiData}
                            onDragStart={(id) => setDraggedAppId(id)}
                          />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {activeView === 'applications' && (
          <ApplicationsTable
            applications={filteredApplications}
            idleThresholdDays={settings.idleThresholdDays}
            syncingKey={syncingKey}
            onSelect={(selected) => openEditModal(selected, false)}
            onStageChange={handleStageChange}
            onMarkFollowedUp={handleMarkFollowedUp}
            onSyncFollowUp={handleSyncFollowUp}
          />
        )}

        {activeView === 'calendar' && (
          <CalendarView
            applications={applications}
            googleEvents={googleEvents}
            isGoogleConnected={!needsAuth}
            isLoadingGoogleEvents={isLoadingGoogleEvents}
            syncingKey={syncingKey}
            onGoogleSignIn={handleGoogleSignIn}
            onRefreshGoogleEvents={() => fetchGoogleEvents()}
            onSyncAllToGoogle={handleSyncAllToGoogle}
            onSyncInterview={handleSyncInterview}
            onSyncFollowUp={handleSyncFollowUp}
            onSyncDeadline={handleSyncDeadline}
            onDeleteGoogleEvent={handleDeleteGoogleEvent}
            onSelectApplication={(app) => openEditModal(app, false)}
          />
        )}

        {activeView === 'analytics' && (
          <AnalyticsView
            applications={applications}
            idleThresholdDays={settings.idleThresholdDays}
          />
        )}
      </main>

      {/* Add / Edit Application Modal */}
      <ApplicationModal
        isOpen={modalOpen}
        application={activeEditingApp}
        initialStage={modalInitialStage}
        initialFocusInterview={focusInterviewForm}
        isGoogleConnected={!needsAuth}
        syncingKey={syncingKey}
        onClose={() => {
          setModalOpen(false);
          setEditingApp(null);
        }}
        onSave={handleSaveApplication}
        onDelete={handleDeleteApplication}
        onSyncInterview={handleSyncInterview}
        onRemoveInterviewFromCalendar={handleRemoveInterviewFromCalendar}
        onSyncFollowUp={handleSyncFollowUp}
        onRemoveFollowUpFromCalendar={handleRemoveFollowUpFromCalendar}
        onSyncDeadline={handleSyncDeadline}
        onRemoveDeadlineFromCalendar={handleRemoveDeadlineFromCalendar}
      />

      {/* Explicit Confirmation Dialog for Mutating / Destructive Operations */}
      <ConfirmDialog
        state={confirmState}
        isLoading={isConfirmBusy}
        onCancel={() => {
          if (!isConfirmBusy) {
            setConfirmState(INITIAL_CONFIRM_STATE);
          }
        }}
      />

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-5 right-5 z-50 max-w-sm rounded-lg border px-4 py-3 text-xs font-medium shadow-lg ${
            toast.tone === 'error'
              ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200'
              : toast.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
              : 'border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}
