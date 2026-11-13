export interface TrimNormalizeOptions {
  silenceThreshold?: number;
  targetPeakDb?: number;
  paddingMs?: number;
}

/**
 * Pure function that trims leading/trailing silence, normalizes peak volume to ~-3 dB,
 * and adds 80 ms of zero padding before and after.
 */
export function trimAndNormalizeSamples(
  samples: Float32Array,
  sampleRate: number,
  opts: TrimNormalizeOptions = {},
): Float32Array {
  const threshold = opts.silenceThreshold ?? 0.015;
  const targetPeakDb = opts.targetPeakDb ?? -3;
  const paddingMs = opts.paddingMs ?? 80;

  if (samples.length === 0) {
    return new Float32Array(0);
  }

  let start = 0;
  while (start < samples.length && Math.abs(samples[start]!) <= threshold) {
    start++;
  }

  if (start >= samples.length) {
    // All silence
    return new Float32Array(0);
  }

  let end = samples.length - 1;
  while (end > start && Math.abs(samples[end]!) <= threshold) {
    end--;
  }

  const trimmedLength = end - start + 1;
  let peak = 0;
  for (let i = start; i <= end; i++) {
    const abs = Math.abs(samples[i]!);
    if (abs > peak) peak = abs;
  }

  const targetPeak = Math.pow(10, targetPeakDb / 20); // ~0.7079 for -3 dB
  const gain = peak > 0 ? targetPeak / peak : 1;

  const padSamples = Math.round((sampleRate * paddingMs) / 1000);
  const out = new Float32Array(padSamples + trimmedLength + padSamples);

  for (let i = 0; i < trimmedLength; i++) {
    const val = samples[start + i]! * gain;
    out[padSamples + i] = Math.max(-1, Math.min(1, val));
  }

  return out;
}

export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export function pickSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return '';
}

export interface RecordedClip {
  blob: Blob;
  durationSec: number;
}

export class VoiceRecorder {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: BlobPart[] = [];
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private levelData: Uint8Array | null = null;

  async requestMic(): Promise<{ ok: true } | { ok: false; reason: string }> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return { ok: false, reason: 'Microphone recording is not supported in this browser or context (requires HTTPS or localhost).' };
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        this.audioCtx = new Ctx();
        const source = this.audioCtx.createMediaStreamSource(this.stream);
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 256;
        source.connect(this.analyser);
        this.levelData = new Uint8Array(this.analyser.frequencyBinCount);
      }
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Microphone permission denied';
      return { ok: false, reason: msg };
    }
  }

  getLevel(): number {
    if (!this.analyser || !this.levelData) return 0;
    this.analyser.getByteTimeDomainData(this.levelData as Uint8Array<ArrayBuffer>);
    let maxDev = 0;
    for (let i = 0; i < this.levelData.length; i++) {
      const dev = Math.abs((this.levelData[i]! - 128) / 128);
      if (dev > maxDev) maxDev = dev;
    }
    return Math.min(1, maxDev * 2);
  }

  start(): void {
    if (!this.stream) throw new Error('Microphone not initialized');
    this.chunks = [];
    const mimeType = pickSupportedMimeType();
    this.recorder = mimeType
      ? new MediaRecorder(this.stream, { mimeType })
      : new MediaRecorder(this.stream);
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start();
  }

  async stop(): Promise<RecordedClip> {
    const rec = this.recorder;
    if (!rec) throw new Error('Recorder not started');

    const rawBlob = await new Promise<Blob>((resolve) => {
      rec.onstop = () => {
        resolve(new Blob(this.chunks, { type: rec.mimeType || 'audio/webm' }));
      };
      rec.stop();
    });

    // Attempt Web Audio trim + normalize -> WAV
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        const ctx = this.audioCtx ?? new Ctx();
        const arrayBuf = await rawBlob.arrayBuffer();
        const decoded = await ctx.decodeAudioData(arrayBuf);
        const channel = decoded.getChannelData(0);
        const cleaned = trimAndNormalizeSamples(channel, decoded.sampleRate);
        if (cleaned.length > 0) {
          const wavBlob = encodeWav(cleaned, decoded.sampleRate);
          return {
            blob: wavBlob,
            durationSec: cleaned.length / decoded.sampleRate,
          };
        }
      }
    } catch {
      // Fallback to raw blob if decoding fails
    }

    return { blob: rawBlob, durationSec: 1.0 };
  }

  dispose(): void {
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
    }
    if (this.audioCtx) {
      void this.audioCtx.close();
      this.audioCtx = null;
    }
    this.analyser = null;
    this.recorder = null;
  }
}
