/**
 * Static project facts surfaced on the Dashboard.
 * Source of truth is docs/PROJECT_MEMORY.md — keep this file in sync
 * with it whenever a sprint completes.
 */

export type SprintStatus = 'completed' | 'current' | 'pending';

export interface SprintSummary {
  id: string;
  name: string;
  status: SprintStatus;
  summary: string;
}

export const SPRINT_HISTORY: SprintSummary[] = [
  {
    id: 'sprint-1',
    name: 'Sprint 1',
    status: 'completed',
    summary: 'Electron + React + TypeScript + Vite bootstrap',
  },
  {
    id: 'sprint-1b',
    name: 'Sprint 1B',
    status: 'completed',
    summary: 'Python backend foundation (Ruff, Mypy, pytest)',
  },
  {
    id: 'sprint-2',
    name: 'Sprint 2',
    status: 'completed',
    summary: 'Desktop application shell (VS Code style layout, theme manager)',
  },
  {
    id: 'sprint-3',
    name: 'Sprint 3',
    status: 'current',
    summary: 'Architecture, database, and agent finalization + Dashboard',
  },
];

export interface TeamMember {
  role: string;
  name: string;
}

export const AI_TEAM: TeamMember[] = [
  { role: 'Founder', name: 'Nemee Chand Khichar' },
  { role: 'Chief Technology Officer', name: 'ChatGPT' },
  { role: 'Lead Software Engineer', name: 'Claude Code' },
];

export const FUTURE_AI_MEMBERS: string[] = ['Gemini', 'DeepSeek', 'Qwen', 'Llama', 'OpenAI API'];

export interface TechCategory {
  category: string;
  items: string[];
}

export const TECH_STACK: TechCategory[] = [
  { category: 'Desktop', items: ['Electron'] },
  { category: 'Frontend', items: ['React', 'TypeScript', 'Tailwind CSS'] },
  { category: 'Backend', items: ['Python'] },
  { category: 'Database', items: ['SQLite'] },
  { category: 'Version Control', items: ['Git', 'GitHub'] },
];
