import type { ActiveSession, ItemStateMap, SessionRecord } from '../engine/types.js';
import { type MigrationFn, type VersionedState, runMigrations } from './migrations.js';

export const CURRENT_SCHEMA_VERSION = 1;

export interface AppSettings {
  sessionMinutes: number;
  newPerSession: number;
  animationsEnabled: boolean;
  soundEnabled: boolean;
  ttsVoiceURI: string | null;
  extraPracticeEnabled: boolean;
  breakReminderEnabled: boolean;
  showOnScreenKeyboard: boolean;
  parentPin: string | null;
  unlockedOverrides: string[];
}

export interface AppState extends VersionedState {
  schemaVersion: number;
  appId: string;
  childName: string;
  onboardingDone: boolean;
  settings: AppSettings;
  items: ItemStateMap;
  activeSession: ActiveSession | null;
  history: SessionRecord[];
  streakDays: number;
  lastPracticedDate: string | null;
  dailyMinutes: { date: string; minutes: number };
  lastBackupAt: number | null;
  customData: Record<string, unknown>;
}

export function createDefaultSettings(
  overrides: Partial<AppSettings> = {},
): AppSettings {
  return {
    sessionMinutes: 10,
    newPerSession: 4,
    animationsEnabled: true,
    soundEnabled: true,
    ttsVoiceURI: null,
    extraPracticeEnabled: true,
    breakReminderEnabled: true,
    showOnScreenKeyboard: false,
    parentPin: null,
    unlockedOverrides: [],
    ...overrides,
  };
}

export function createDefaultState(
  appId: string,
  settingsOverrides: Partial<AppSettings> = {},
): AppState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    appId,
    childName: '',
    onboardingDone: false,
    settings: createDefaultSettings(settingsOverrides),
    items: {},
    activeSession: null,
    history: [],
    streakDays: 0,
    lastPracticedDate: null,
    dailyMinutes: { date: '', minutes: 0 },
    lastBackupAt: null,
    customData: {},
  };
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class StateStore {
  private readonly key: string;
  private readonly backupKey: string;
  private readonly recoveryPrefix: string;
  private state: AppState;
  private listeners = new Set<(state: AppState) => void>();

  constructor(
    private readonly appId: string,
    private readonly storage: StorageLike = window.localStorage,
    private readonly migrations: Record<number, MigrationFn> = {},
    private readonly defaultSettings: Partial<AppSettings> = {},
  ) {
    this.key = `${appId}:state`;
    this.backupKey = `${appId}:state:backup`;
    this.recoveryPrefix = `${appId}:state:recovery:`;
    this.state = this.load();
  }

  private tryParseAndMigrate(rawStr: string): AppState | null {
    try {
      const parsed = JSON.parse(rawStr) as Record<string, unknown>;
      if (!parsed || typeof parsed !== 'object') return null;
      return runMigrations<AppState>(parsed, this.migrations, CURRENT_SCHEMA_VERSION);
    } catch {
      return null;
    }
  }

  private load(): AppState {
    try {
      const raw = this.storage.getItem(this.key);
      if (raw) {
        const migrated = this.tryParseAndMigrate(raw);
        if (migrated) return migrated;

        // Parse/migration failure: keep raw string in recovery key
        try {
          this.storage.setItem(`${this.recoveryPrefix}${Date.now()}`, raw);
        } catch {
          // ignore quota errors during recovery save
        }

        // Try rolling backup
        const backupRaw = this.storage.getItem(this.backupKey);
        if (backupRaw) {
          const fromBackup = this.tryParseAndMigrate(backupRaw);
          if (fromBackup) return fromBackup;
        }
      }
    } catch {
      // Storage unavailable or threw
    }
    return createDefaultState(this.appId, this.defaultSettings);
  }

  getState(): AppState {
    return this.state;
  }

  setState(next: AppState): void {
    this.state = next;
    try {
      const prevRaw = this.storage.getItem(this.key);
      if (prevRaw) {
        this.storage.setItem(this.backupKey, prevRaw);
      }
      this.storage.setItem(this.key, JSON.stringify(next));
    } catch {
      // ignore storage quota errors
    }
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  update(updater: (prev: AppState) => AppState): AppState {
    const next = updater(this.state);
    this.setState(next);
    return next;
  }

  reset(keepSettings = false): AppState {
    const fresh = createDefaultState(
      this.appId,
      keepSettings ? this.state.settings : this.defaultSettings,
    );
    this.setState(fresh);
    return fresh;
  }

  subscribe(listener: (state: AppState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      return await navigator.storage.persist();
    }
  } catch {
    // ignore
  }
  return false;
}
