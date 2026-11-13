import { describe, expect, it } from 'vitest';
import { trimAndNormalizeSamples } from './recorder.js';

describe('audio recorder trimAndNormalizeSamples', () => {
  it('trims leading/trailing silence, normalizes peak to -3 dB, and adds 80ms padding', () => {
    const sampleRate = 1000; // 1 sample = 1 ms for easy math
    const input = new Float32Array(500);
    // Silence from 0..99, signal from 100..299 (peak 0.2), silence from 300..499
    for (let i = 100; i < 300; i++) {
      input[i] = i % 2 === 0 ? 0.2 : -0.1;
    }

    const out = trimAndNormalizeSamples(input, sampleRate);
    // 80ms pad + 200 samples + 80ms pad = 360 samples
    expect(out.length).toBe(360);

    // Leading and trailing padding are zero
    expect(out[0]).toBe(0);
    expect(out[79]).toBe(0);
    expect(out[280]).toBe(0);
    expect(out[359]).toBe(0);

    // Peak normalized to ~ -3 dB (0.7079)
    let peak = 0;
    for (let i = 0; i < out.length; i++) {
      peak = Math.max(peak, Math.abs(out[i]!));
    }
    expect(peak).toBeCloseTo(Math.pow(10, -3 / 20), 3);
  });

  it('returns empty array for all-silence input', () => {
    const input = new Float32Array(200);
    const out = trimAndNormalizeSamples(input, 1000);
    expect(out.length).toBe(0);
  });
});
