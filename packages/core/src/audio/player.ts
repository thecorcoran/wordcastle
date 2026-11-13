import type { AudioKind, AudioStore } from '../storage/audioStore.js';
import { speakText, stopSpeaking } from './tts.js';

export interface PlayerSettings {
  soundEnabled: boolean;
  ttsVoiceURI: string | null;
}

export class AudioPlayer {
  private currentAudio: HTMLAudioElement | null = null;
  private audioCtx: AudioContext | null = null;

  constructor(
    private readonly audioStore: AudioStore,
    private readonly getSettings: () => PlayerSettings,
  ) {}

  unlockAudio(): void {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx && !this.audioCtx) {
        this.audioCtx = new Ctx();
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        void this.audioCtx.resume();
      }
    } catch {
      // ignore
    }
  }

  stop(): void {
    stopSpeaking();
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch {
        // ignore
      }
      this.currentAudio = null;
    }
  }

  async hasRecording(itemId: string, kind: AudioKind): Promise<boolean> {
    const rec = await this.audioStore.get(itemId, kind);
    return rec !== null;
  }

  async playBlob(blob: Blob): Promise<void> {
    this.stop();
    const url = URL.createObjectURL(blob);
    return new Promise((resolve) => {
      const audio = new Audio(url);
      this.currentAudio = audio;
      const cleanup = () => {
        URL.revokeObjectURL(url);
        if (this.currentAudio === audio) {
          this.currentAudio = null;
        }
        resolve();
      };
      audio.onended = cleanup;
      audio.onerror = cleanup;
      audio.play().catch(cleanup);
    });
  }

  async play(itemId: string, kind: AudioKind, ttsFallbackText?: string): Promise<void> {
    const settings = this.getSettings();
    if (!settings.soundEnabled) return;

    const stored = await this.audioStore.get(itemId, kind);
    if (stored) {
      await this.playBlob(stored.blob);
      return;
    }

    if (ttsFallbackText) {
      const rate = kind === 'slow' ? 0.6 : 0.95;
      await speakText(ttsFallbackText, {
        voiceURI: settings.ttsVoiceURI,
        rate,
      });
    }
  }
}
