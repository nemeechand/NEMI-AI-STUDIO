import { ThemeProvider } from './theme/ThemeProvider';
import { ProjectProvider } from './project/ProjectProvider';
import { WorkspaceProvider } from './workspace/WorkspaceProvider';
import { AppShell } from './components/layout/AppShell';

function App() {
  return (
    <ThemeProvider>
      <ProjectProvider>
        <WorkspaceProvider>
          <AppShell />
        </WorkspaceProvider>
      </ProjectProvider>
    </ThemeProvider>
  );
}

export default App;
