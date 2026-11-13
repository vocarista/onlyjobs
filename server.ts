import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const GEMINI_MODEL = 'gemini-3.5-flash-lite';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Check your Settings > Secrets panel.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface AnalyzeJdBody {
  jobDescription?: string;
  company?: string;
  role?: string;
  stage?: string;
  contactName?: string;
  roundNotes?: string;
}

interface AnalyzeJdOutput {
  skills: string[];
  interviewQuestions: string[];
  followUpDraft: string;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.post('/api/analyze-jd', async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as AnalyzeJdBody;
      const jobDescription =
        typeof body.jobDescription === 'string' ? body.jobDescription.trim() : '';

      if (jobDescription.length < 20) {
        res.status(400).json({
          error: 'Please paste a job description (at least 20 characters) before analyzing.',
        });
        return;
      }

      const company = typeof body.company === 'string' ? body.company.trim() : '';
      const role = typeof body.role === 'string' ? body.role.trim() : '';
      const stage = typeof body.stage === 'string' ? body.stage.trim() : '';
      const contactName =
        typeof body.contactName === 'string' ? body.contactName.trim() : '';
      const roundNotes =
        typeof body.roundNotes === 'string' ? body.roundNotes.trim() : '';

      const ai = getGeminiClient();

      const promptParts = [
        company ? `Company: ${company}` : null,
        role ? `Role: ${role}` : null,
        stage ? `Current Pipeline Stage: ${stage}` : null,
        contactName ? `Recruiter / Contact Name: ${contactName}` : null,
        roundNotes ? `Existing Round Notes: ${roundNotes}` : null,
        '',
        'Job Description:',
        jobDescription.slice(0, 15000),
      ]
        .filter((line): line is string => line !== null)
        .join('\n');

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: promptParts,
        config: {
          systemInstruction:
            'You are a sharp technical career coach helping a candidate prepare for a job application. ' +
            'From the provided job description and application context: ' +
            '1) Extract 5 to 8 concise key required skills (short skill names like "TypeScript", "React", "Distributed Systems", "PostgreSQL"). ' +
            '2) Generate exactly 3 tailored interview questions grounded specifically in this role, company, and job description. ' +
            '3) Draft a concise, natural recruiter follow-up note (3-4 sentences max, plain text, no subject line or placeholders like [Your Name] unless helpful—keep it immediately sendable and address the contact name if provided).',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              skills: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '5 to 8 concise key required skills extracted from the job description.',
              },
              interviewQuestions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Exactly 3 tailored interview questions based on the job description.',
              },
              followUpDraft: {
                type: Type.STRING,
                description: 'A concise, ready-to-send recruiter follow-up note (3-4 sentences).',
              },
            },
            required: ['skills', 'interviewQuestions', 'followUpDraft'],
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        res.status(502).json({
          error: 'Gemini returned an empty response. Please try again.',
        });
        return;
      }

      let parsed: Partial<AnalyzeJdOutput>;
      try {
        parsed = JSON.parse(rawText) as Partial<AnalyzeJdOutput>;
      } catch {
        res.status(502).json({
          error: 'Failed to parse structured AI output from Gemini. Please try again.',
        });
        return;
      }

      const skills = Array.isArray(parsed.skills)
        ? parsed.skills
            .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
            .map((s) => s.trim())
            .slice(0, 10)
        : [];

      const interviewQuestions = Array.isArray(parsed.interviewQuestions)
        ? parsed.interviewQuestions
            .filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
            .map((q) => q.trim())
            .slice(0, 3)
        : [];

      const followUpDraft =
        typeof parsed.followUpDraft === 'string' ? parsed.followUpDraft.trim() : '';

      res.json({
        skills,
        interviewQuestions,
        followUpDraft,
        analyzedAt: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unexpected server error while analyzing job description.';
      const status =
        typeof (err as { status?: number })?.status === 'number'
          ? (err as { status: number }).status
          : 500;

      if (status === 400 || status === 403) {
        res.status(status).json({
          error: `Gemini API key error (${status}). Please verify your API key in Settings > Secrets. ${message}`,
        });
        return;
      }
      if (status === 429) {
        res.status(429).json({
          error: 'Gemini API rate limit or quota exceeded. Please wait a moment or check Settings > Secrets.',
        });
        return;
      }
      if (status === 404) {
        res.status(404).json({
          error: `Gemini model "${GEMINI_MODEL}" was not found or is unavailable: ${message}`,
        });
        return;
      }

      res.status(status >= 400 && status < 600 ? status : 500).json({
        error: message,
      });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`OnlyJobs server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start OnlyJobs server:', err);
  process.exit(1);
});
