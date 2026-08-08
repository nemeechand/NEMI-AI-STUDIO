import { createContext } from 'react';

export interface ProjectContextValue {
  projectPath: string | null;
  // The `projects` table's UUID (distinct from `projectPath`) — needed to
  // scope AI conversations via `ai_conversations.project_id`'s foreign
  // key (Sprint 10). Null whenever no project is open, or if recording
  // the open with the backend failed (recent-projects tracking has
  // always been "best effort", not a correctness requirement — see
  // ProjectProvider's openAndRecord()) — AI conversations then fall back
  // to the global (project_id IS NULL) scope.
  projectId: string | null;
  openProject: (path: string, description?: string) => Promise<void>;
  closeProject: () => void;
}

export const ProjectContext = createContext<ProjectContextValue | null>(null);
