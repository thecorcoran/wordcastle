import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import type { AudioKind, AudioStore, StoredAudio } from './audioStore.js';
import type { AppSettings, AppState, StateStore } from './store.js';

export interface BackupManifest {
  format: 'word-castle-backup' | 'word-castle-voice-pack';
  schemaVersion: number;
  appId: string;
  exportedAt: number;
  counts: {
    items: number;
    sessions: number;
    audioClips: number;
  };
}

export interface AudioEntryMeta {
  file: string;
  itemId: string;
  kind: AudioKind;
  mimeType: string;
  durationSec: number;
  recordedAt: number;
}

function extFromMime(mime: string): string {
  if (mime.includes('mp4')) return '.m4a';
  if (mime.includes('ogg')) return '.ogg';
  if (mime.includes('wav')) return '.wav';
  return '.webm';
}

async function blobToUint8Array(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') {
    return new Uint8Array(await blob.arrayBuffer());
  }
  if (typeof FileReader !== 'undefined') {
    const buf = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
      reader.readAsArrayBuffer(blob);
    });
    return new Uint8Array(buf);
  }
  return new Uint8Array(await new Response(blob).arrayBuffer());
}

export async function packAudioFiles(
  audioClips: StoredAudio[],
): Promise<{ files: Record<string, Uint8Array>; index: AudioEntryMeta[] }> {
  const files: Record<string, Uint8Array> = {};
  const index: AudioEntryMeta[] = [];

  for (const clip of audioClips) {
    const safeId = encodeURIComponent(clip.itemId);
    const ext = extFromMime(clip.mimeType);
    const filename = `audio/${safeId}__${clip.kind}${ext}`;
    const buf = await blobToUint8Array(clip.blob);
    files[filename] = buf;
    index.push({
      file: filename,
      itemId: clip.itemId,
      kind: clip.kind,
      mimeType: clip.mimeType,
      durationSec: clip.durationSec,
      recordedAt: clip.recordedAt,
    });
  }

  files['audio/index.json'] = strToU8(JSON.stringify(index, null, 2));
  return { files, index };
}

export async function unpackAudioFiles(
  unzipped: Record<string, Uint8Array>,
  audioStore: AudioStore,
  mode: 'replace' | 'merge',
): Promise<number> {
  const indexBytes = unzipped['audio/index.json'];
  if (!indexBytes) return 0;

  const index = JSON.parse(strFromU8(indexBytes)) as AudioEntryMeta[];
  if (mode === 'replace') {
    await audioStore.clearAll();
  }

  let imported = 0;
  for (const entry of index) {
    const data = unzipped[entry.file];
    if (!data) continue;
    if (mode === 'merge') {
      const existing = await audioStore.get(entry.itemId, entry.kind);
      if (existing) continue;
    }
    const copy = new Uint8Array(data.byteLength);
    copy.set(data);
    const blob = new Blob([copy.buffer], { type: entry.mimeType });
    await audioStore.put(entry.itemId, entry.kind, blob, entry.durationSec, entry.recordedAt);
    imported++;
  }
  return imported;
}

export async function exportFullBackup(
  state: AppState,
  audioStore: AudioStore,
): Promise<Uint8Array> {
  const clips = await audioStore.getAll();
  const { files: audioFiles } = await packAudioFiles(clips);

  const manifest: BackupManifest = {
    format: 'word-castle-backup',
    schemaVersion: state.schemaVersion,
    appId: state.appId,
    exportedAt: Date.now(),
    counts: {
      items: Object.keys(state.items).length,
      sessions: state.history.length,
      audioClips: clips.length,
    },
  };

  const progressPayload = {
    childName: state.childName,
    onboardingDone: state.onboardingDone,
    items: state.items,
    activeSession: state.activeSession,
    history: state.history,
    streakDays: state.streakDays,
    lastPracticedDate: state.lastPracticedDate,
    dailyMinutes: state.dailyMinutes,
    customData: state.customData,
  };

  const zipFiles: Record<string, Uint8Array> = {
    'manifest.json': strToU8(JSON.stringify(manifest, null, 2)),
    'progress.json': strToU8(JSON.stringify(progressPayload, null, 2)),
    'settings.json': strToU8(JSON.stringify(state.settings, null, 2)),
    ...audioFiles,
  };

  return zipSync(zipFiles, { level: 6 });
}

export interface ImportResult {
  manifest: BackupManifest;
  audioImported: number;
}

export async function importFullBackup(
  zipBytes: Uint8Array,
  store: StateStore,
  audioStore: AudioStore,
  mode: 'replace' | 'merge',
): Promise<ImportResult> {
  const unzipped = unzipSync(zipBytes);
  const manifestBytes = unzipped['manifest.json'];
  if (!manifestBytes) {
    throw new Error('Invalid backup: missing manifest.json');
  }
  const manifest = JSON.parse(strFromU8(manifestBytes)) as BackupManifest;
  if (manifest.format !== 'word-castle-backup') {
    throw new Error(`Invalid backup format: ${manifest.format}`);
  }
  if (manifest.appId !== store.getState().appId) {
    throw new Error(`Backup is for app "${manifest.appId}", expected "${store.getState().appId}"`);
  }

  const progressBytes = unzipped['progress.json'];
  const settingsBytes = unzipped['settings.json'];
  if (!progressBytes || !settingsBytes) {
    throw new Error('Invalid backup: missing progress.json or settings.json');
  }

  const progress = JSON.parse(strFromU8(progressBytes)) as Partial<AppState>;
  const settings = JSON.parse(strFromU8(settingsBytes)) as AppSettings;

  store.update((prev) => {
    if (mode === 'replace') {
      return {
        ...prev,
        childName: progress.childName ?? prev.childName,
        onboardingDone: progress.onboardingDone ?? prev.onboardingDone,
        items: progress.items ?? {},
        activeSession: progress.activeSession ?? null,
        history: progress.history ?? [],
        streakDays: progress.streakDays ?? 0,
        lastPracticedDate: progress.lastPracticedDate ?? null,
        dailyMinutes: progress.dailyMinutes ?? { date: '', minutes: 0 },
        customData: progress.customData ?? {},
        settings: { ...prev.settings, ...settings },
        lastBackupAt: manifest.exportedAt,
      };
    }

    // Merge mode: keep higher box / more attempts, union history by id
    const mergedItems = { ...prev.items };
    for (const [id, incoming] of Object.entries(progress.items ?? {})) {
      const existing = mergedItems[id];
      if (!existing || incoming.attempts > existing.attempts || incoming.box > existing.box) {
        mergedItems[id] = incoming;
      }
    }

    const existingIds = new Set(prev.history.map((h) => h.id));
    const mergedHistory = [
      ...prev.history,
      ...(progress.history ?? []).filter((h) => !existingIds.has(h.id)),
    ].sort((a, b) => a.startedAt - b.startedAt);

    return {
      ...prev,
      items: mergedItems,
      history: mergedHistory,
      customData: { ...prev.customData, ...(progress.customData ?? {}) },
      lastBackupAt: manifest.exportedAt,
    };
  });

  const audioImported = await unpackAudioFiles(unzipped, audioStore, mode);
  return { manifest, audioImported };
}
