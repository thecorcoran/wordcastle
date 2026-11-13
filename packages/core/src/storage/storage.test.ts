// @vitest-environment node
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { AudioStore } from './audioStore.js';
import { exportFullBackup, importFullBackup } from './backup.js';
import { runMigrations } from './migrations.js';
import { createInitialItemState } from '../engine/scheduler.js';
import { CURRENT_SCHEMA_VERSION, StateStore, type StorageLike } from './store.js';
import { exportVoicePack, importVoicePack } from './voicePack.js';

function createMemoryStorage(): StorageLike & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

describe('storage', () => {
  it('runs sequential migrations', () => {
    const v1 = { schemaVersion: 1, name: 'Ada' };
    const result = runMigrations(
      v1,
      {
        2: (s) => ({ ...s, addedInV2: true, schemaVersion: 2 }),
        3: (s) => ({ ...s, addedInV3: 42, schemaVersion: 3 }),
      },
      3,
    );
    expect(result).toEqual({
      schemaVersion: 3,
      name: 'Ada',
      addedInV2: true,
      addedInV3: 42,
    });
  });

  it('recovers corrupted state into recovery key and starts fresh', () => {
    const storage = createMemoryStorage();
    storage.setItem('test-app:state', '{not valid json!!!');
    const store = new StateStore('test-app', storage);
    expect(store.getState().appId).toBe('test-app');
    expect(store.getState().items).toEqual({});

    const recoveryKeys = Object.keys(storage.data).filter((k) =>
      k.startsWith('test-app:state:recovery:'),
    );
    expect(recoveryKeys).toHaveLength(1);
    expect(storage.data[recoveryKeys[0]!]).toBe('{not valid json!!!');
  });

  it('round-trips full backup including audio blobs and voice pack only', async () => {
    const storage1 = createMemoryStorage();
    const store1 = new StateStore('word-castle', storage1);
    const now = Date.now();
    store1.update((s) => ({
      ...s,
      childName: 'Maya',
      onboardingDone: true,
      items: { 'fry:0001:the': createInitialItemState(now, 3, true) },
      streakDays: 5,
    }));

    const audio1 = new AudioStore('test-audio-db-1');
    const sampleBytes = new Uint8Array([1, 2, 3, 4, 5, 6]);
    const blob = new Blob([sampleBytes], { type: 'audio/webm' });
    await audio1.put('fry:0001:the', 'word', blob, 0.8, now);

    const zipBytes = await exportFullBackup(store1.getState(), audio1);

    // Import into fresh store & audio DB
    const storage2 = createMemoryStorage();
    const store2 = new StateStore('word-castle', storage2);
    const audio2 = new AudioStore('test-audio-db-2');

    const res = await importFullBackup(zipBytes, store2, audio2, 'replace');
    expect(res.audioImported).toBe(1);
    expect(store2.getState().childName).toBe('Maya');
    expect(store2.getState().items['fry:0001:the']?.box).toBe(3);

    const restoredClip = await audio2.get('fry:0001:the', 'word');
    expect(restoredClip).not.toBeNull();
    expect(restoredClip!.durationSec).toBe(0.8);
    const restoredBytes =
      typeof restoredClip!.blob.arrayBuffer === 'function'
        ? new Uint8Array(await restoredClip!.blob.arrayBuffer())
        : await new Promise<Uint8Array>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(restoredClip!.blob);
          });
    expect(restoredBytes).toEqual(sampleBytes);

    // Voice pack only export/import (no child progress)
    const vpBytes = await exportVoicePack('word-castle', CURRENT_SCHEMA_VERSION, audio1);
    const audio3 = new AudioStore('test-audio-db-3');
    const vpRes = await importVoicePack(vpBytes, 'word-castle', audio3, 'replace');
    expect(vpRes.audioImported).toBe(1);
    const vpClip = await audio3.get('fry:0001:the', 'word');
    expect(vpClip).not.toBeNull();
  });
});
