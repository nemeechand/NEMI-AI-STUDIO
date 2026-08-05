import { ThemeProvider } from './theme/ThemeProvider';
import { ProjectProvider } from './project/ProjectProvider';
import { AppShell } from './components/layout/AppShell';

function App() {
  return (
    <ThemeProvider>
      <ProjectProvider>
        <AppShell />
      </ProjectProvider>
    </ThemeProvider>
  );
}

export default App;
