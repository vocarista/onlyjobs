import { ApplicationStage, JobAiInsights } from '../types/job';

export interface AnalyzeJobDescriptionInput {
  jobDescription: string;
  company: string;
  role: string;
  stage: ApplicationStage;
  contactName?: string;
  roundNotes?: string;
}

export async function analyzeJobDescription(
  input: AnalyzeJobDescriptionInput
): Promise<JobAiInsights> {
  const response = await fetch('/api/analyze-jd', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const data = (await response.json().catch(() => ({}))) as Partial<JobAiInsights> & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  return {
    skills: Array.isArray(data.skills) ? data.skills : [],
    interviewQuestions: Array.isArray(data.interviewQuestions) ? data.interviewQuestions : [],
    followUpDraft: typeof data.followUpDraft === 'string' ? data.followUpDraft : '',
    analyzedAt:
      typeof data.analyzedAt === 'string' ? data.analyzedAt : new Date().toISOString(),
  };
}
