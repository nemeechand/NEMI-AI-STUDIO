import { app, safeStorage } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';

// Sprint 10 — API keys are never stored in SQLite (see docs/DATABASE_SCHEMA.md's
// CONVENTIONS: "No column stores secrets... never in SQLite"). They're
// encrypted with Electron's safeStorage (Windows DPAPI / macOS Keychain /
// Linux Secret Service — OS-level, not our own crypto) and persisted only
// as an encrypted blob in the per-user userData directory, never in the
// repo, never sent anywhere except attached to the one HTTP request that
// needs it. The backend never persists a key it receives.
// Sprint 15.5: extended from 4 to 7 providers (DeepSeek/Grok/Custom are
// additional OpenAI-compatible endpoints — each still gets its own
// independently encrypted key, since they're genuinely different
// accounts/services even though they share a wire protocol backend-side).
export type ProviderId =
  'openai' | 'anthropic' | 'gemini' | 'ollama' | 'deepseek' | 'grok' | 'custom';

const CREDENTIALS_FILE = 'ai-credentials.json';

function credentialsPath(): string {
  return path.join(app.getPath('userData'), CREDENTIALS_FILE);
}

async function readStore(): Promise<Record<string, string>> {
  try {
    const raw = await fs.readFile(credentialsPath(), 'utf-8');
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

async function writeStore(store: Record<string, string>): Promise<void> {
  const target = credentialsPath();
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify(store), 'utf-8');
}

export async function setApiKey(provider: ProviderId, apiKey: string): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      'This system has no OS-level secure storage available, so API keys cannot be saved securely.',
    );
  }
  const store = await readStore();
  store[provider] = safeStorage.encryptString(apiKey).toString('base64');
  await writeStore(store);
}

export async function hasApiKey(provider: ProviderId): Promise<boolean> {
  const store = await readStore();
  return typeof store[provider] === 'string' && store[provider].length > 0;
}

export async function getApiKey(provider: ProviderId): Promise<string | null> {
  const store = await readStore();
  const encoded = store[provider];
  if (!encoded || !safeStorage.isEncryptionAvailable()) return null;
  try {
    return safeStorage.decryptString(Buffer.from(encoded, 'base64'));
  } catch {
    return null;
  }
}

export async function clearApiKey(provider: ProviderId): Promise<void> {
  const store = await readStore();
  delete store[provider];
  await writeStore(store);
}
