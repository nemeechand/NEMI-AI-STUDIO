import { ThemeProvider } from './theme/ThemeProvider';
import { ProjectProvider } from './project/ProjectProvider';
import { WorkspaceProvider } from './workspace/WorkspaceProvider';
import { AiProvider } from './ai/AiProvider';
import { AgentsProvider } from './agents/AgentsProvider';
import { WorkflowsProvider } from './workflows/WorkflowsProvider';
import { IntelligenceProvider } from './intelligence/IntelligenceProvider';
import { AppShell } from './components/layout/AppShell';

function App() {
  return (
    <ThemeProvider>
      <ProjectProvider>
        <WorkspaceProvider>
          <AiProvider>
            <AgentsProvider>
              <WorkflowsProvider>
                <IntelligenceProvider>
                  <AppShell />
                </IntelligenceProvider>
              </WorkflowsProvider>
            </AgentsProvider>
          </AiProvider>
        </WorkspaceProvider>
      </ProjectProvider>
    </ThemeProvider>
  );
}

export default App;
