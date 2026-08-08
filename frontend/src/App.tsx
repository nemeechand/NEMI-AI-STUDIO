import { ThemeProvider } from './theme/ThemeProvider';
import { ProjectProvider } from './project/ProjectProvider';
import { WorkspaceProvider } from './workspace/WorkspaceProvider';
import { AiProvider } from './ai/AiProvider';
import { AgentsProvider } from './agents/AgentsProvider';
import { AppShell } from './components/layout/AppShell';

function App() {
  return (
    <ThemeProvider>
      <ProjectProvider>
        <WorkspaceProvider>
          <AiProvider>
            <AgentsProvider>
              <AppShell />
            </AgentsProvider>
          </AiProvider>
        </WorkspaceProvider>
      </ProjectProvider>
    </ThemeProvider>
  );
}

export default App;
