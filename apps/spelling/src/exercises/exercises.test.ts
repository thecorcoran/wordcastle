import { describe, expect, it } from 'vitest';
import { classifySpellingError, matchSpelling } from './letterBoxes.js';

describe('spelling exercises helpers', () => {
  it('matches spelling case-insensitively and trimmed', () => {
    expect(matchSpelling('  Said ', 'said')).toBe(true);
    expect(matchSpelling('SAID', 'said')).toBe(true);
    expect(matchSpelling('sed', 'said')).toBe(false);
  });

  it('classifies spelling errors across a table of examples', () => {
    const cases: Array<[string, string, string]> = [
      ['mak', 'make', 'silentE'],
      ['siad', 'said', 'transposition'],
      ['sed', 'said', 'omission'],
      ['saidd', 'said', 'doubling'],
      ['thot', 'that', 'vowel'],
      ['bat', 'cat', 'substitution'],
      ['catt', 'cat', 'doubling'],
      ['caat', 'cat', 'doubling'],
      ['cart', 'cat', 'addition'],
    ];

    for (const [attempt, target, expected] of cases) {
      expect(classifySpellingError(attempt, target)).toBe(expected);
    }
  });
});
