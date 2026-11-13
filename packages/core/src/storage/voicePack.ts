import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import type { AudioStore } from './audioStore.js';
import {
  type BackupManifest,
  type ImportResult,
  packAudioFiles,
  unpackAudioFiles,
} from './backup.js';

export async function exportVoicePack(
  appId: string,
  schemaVersion: number,
  audioStore: AudioStore,
): Promise<Uint8Array> {
  const clips = await audioStore.getAll();
  const { files: audioFiles } = await packAudioFiles(clips);

  const manifest: BackupManifest = {
    format: 'word-castle-voice-pack',
    schemaVersion,
    appId,
    exportedAt: Date.now(),
    counts: {
      items: 0,
      sessions: 0,
      audioClips: clips.length,
    },
  };

  return zipSync(
    {
      'manifest.json': strToU8(JSON.stringify(manifest, null, 2)),
      ...audioFiles,
    },
    { level: 6 },
  );
}

export async function importVoicePack(
  zipBytes: Uint8Array,
  expectedAppId: string,
  audioStore: AudioStore,
  mode: 'replace' | 'merge',
): Promise<ImportResult> {
  const unzipped = unzipSync(zipBytes);
  const manifestBytes = unzipped['manifest.json'];
  if (!manifestBytes) {
    throw new Error('Invalid voice pack: missing manifest.json');
  }
  const manifest = JSON.parse(strFromU8(manifestBytes)) as BackupManifest;
  if (
    manifest.format !== 'word-castle-voice-pack' &&
    manifest.format !== 'word-castle-backup'
  ) {
    throw new Error(`Invalid voice pack format: ${manifest.format}`);
  }
  if (manifest.appId !== expectedAppId) {
    throw new Error(`Voice pack is for app "${manifest.appId}", expected "${expectedAppId}"`);
  }

  const audioImported = await unpackAudioFiles(unzipped, audioStore, mode);
  return { manifest, audioImported };
}
