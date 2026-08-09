/**
 * Static project facts surfaced on the Dashboard.
 * Source of truth is docs/PROJECT_MEMORY.md.
 *
 * Sprint 15.6: the sprint-by-sprint progress list previously here
 * (`SPRINT_HISTORY`) was a hand-maintained snapshot that had gone
 * stale — a production-stabilization audit found it still stopped at
 * "Sprint 3" while the project was actually 15+ sprints further along,
 * misleading every user who opened the Dashboard. Rather than keep a
 * second, easily-forgotten copy of sprint status in sync by hand, that
 * widget was replaced with SystemHealthCard.tsx, a real, live summary
 * reusing the same `GET /health/full` data source as the Live
 * Dashboard's Health Center section — team/tech-stack facts below
 * don't have this staleness problem (they don't change every sprint),
 * so they're unaffected.
 */

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
