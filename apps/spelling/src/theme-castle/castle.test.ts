import { describe, expect, it } from 'vitest';
import { computeProgressView, createInitialItemState } from '@word-castle/core';
import { createSpellingPack } from '../pack/pack.js';
import { createCastleTheme } from './castle.js';

const NOW = new Date(2026, 5, 10, 10, 0, 0).getTime();

describe('castle theme', () => {
  it('renders empty, partial, and full ProgressView states without throwing', () => {
    const pack = createSpellingPack({
      present: async () => ({ itemId: '', correct: true, independent: true, latencyMs: 100 }),
      teach: async () => {},
      correct: async () => {},
    });
    const theme = createCastleTheme();
    const previewRoot = document.createElement('div');
    const fullRoot = document.createElement('div');

    // Empty
    const emptyView = computeProgressView(pack, {}, NOW, [], 0);
    expect(() => theme.renderHomePreview(previewRoot, emptyView)).not.toThrow();
    expect(() => theme.renderProgress(fullRoot, emptyView, {})).not.toThrow();

    // Partial
    const partialStates = {
      [pack.items[0]!.id]: createInitialItemState(NOW, 3, true),
      [pack.items[1]!.id]: createInitialItemState(NOW, 5, true),
    };
    const partialView = computeProgressView(pack, partialStates, NOW, [], 3);
    expect(() => theme.renderHomePreview(previewRoot, partialView)).not.toThrow();
    expect(() => theme.renderProgress(fullRoot, partialView, {})).not.toThrow();

    // Full
    const fullStates: Record<string, ReturnType<typeof createInitialItemState>> = {};
    for (const item of pack.items) {
      fullStates[item.id] = createInitialItemState(NOW, 5, true);
    }
    const fullView = computeProgressView(pack, fullStates, NOW, [], 30);
    expect(() => theme.renderHomePreview(previewRoot, fullView)).not.toThrow();
    expect(() => theme.renderProgress(fullRoot, fullView, {})).not.toThrow();
    expect(fullView.masteredCount).toBe(1000);
  });
});
