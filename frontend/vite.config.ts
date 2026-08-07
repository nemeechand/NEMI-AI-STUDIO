import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import electron from 'vite-plugin-electron/simple';
import monacoEditorEsmPlugin from 'vite-plugin-monaco-editor-esm';

// When this dev server is started from a process that is itself an Electron
// app running in "run as Node" mode (e.g. VS Code's extension host, which
// sets this for its own internal Node process), the variable is inherited
// by every child process — including the Electron instance vite-plugin-
// electron spawns below (`child_process.spawn(electronPath, argv, { ...
// process.env })`). With it set, Electron launches as plain Node instead of
// the real app: `require('electron')`/`import 'electron'` resolves to a
// path-string shim, so `app`/`ipcMain`/`BrowserWindow` are all undefined and
// the app crashes immediately on startup. Strip it before the dev server
// spawns Electron so `npm run dev` works regardless of the parent shell's
// environment.
delete process.env.ELECTRON_RUN_AS_NODE;

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Bundles Monaco's web workers locally (Sprint 9) — never from a CDN,
    // per MASTER_SPECIFICATION's Offline First requirement.
    monacoEditorEsmPlugin({
      languageWorkers: ['editorWorkerService', 'css', 'html', 'json', 'typescript'],
    }),
    electron({
      main: {
        entry: 'electron/main.ts',
      },
      preload: {
        input: path.join(__dirname, 'electron/preload.ts'),
      },
    }),
  ],
});
