import { describe, expect, it } from 'vitest';
import { validateFryPack } from '../../scripts/validate-pack.js';
import { FRY_BASE_ITEMS, createSpellingPack } from './pack.js';

describe('Fry 1000 pack', () => {
  it('passes all validation checks (1000 unique words, sentences, sounds, heartIndexes)', () => {
    const errors = validateFryPack();
    expect(errors).toEqual([]);
    expect(FRY_BASE_ITEMS).toHaveLength(1000);
  });

  it('detects homophone conflicts between to/too/two and there/their', () => {
    const pack = createSpellingPack({
      present: async () => ({ itemId: '', correct: true, independent: true, latencyMs: 100 }),
      teach: async () => {},
      correct: async () => {},
    });
    const toItem = pack.items.find((i) => i.meta.word === 'to')!;
    const twoItem = pack.items.find((i) => i.meta.word === 'two')!;
    const catItem = pack.items.find((i) => i.meta.word === 'the')!;

    expect(pack.areConflicting?.(toItem, twoItem)).toBe(true);
    expect(pack.areConflicting?.(toItem, catItem)).toBe(false);
  });
});
