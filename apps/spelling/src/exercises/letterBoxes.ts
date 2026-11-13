import { h } from '@word-castle/core';
import type { SoundUnit } from '../pack/fry/first100.js';

export type SpellingErrorTag =
  | 'omission'
  | 'addition'
  | 'substitution'
  | 'transposition'
  | 'vowel'
  | 'doubling'
  | 'silentE'
  | 'other';

export function matchSpelling(attempt: string, target: string): boolean {
  return attempt.trim().toLowerCase() === target.trim().toLowerCase();
}

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'y']);

export function classifySpellingError(attemptRaw: string, targetRaw: string): SpellingErrorTag {
  const attempt = attemptRaw.trim().toLowerCase();
  const target = targetRaw.trim().toLowerCase();

  if (!attempt || attempt === target) return 'other';

  // Silent-e: target ends in 'e' and attempt omitted it, or vice versa
  if (
    (target.endsWith('e') && attempt === target.slice(0, -1)) ||
    (attempt.endsWith('e') && target === attempt.slice(0, -1))
  ) {
    return 'silentE';
  }

  // Transposition: same length, exactly one adjacent swap
  if (attempt.length === target.length) {
    const diffs: number[] = [];
    for (let i = 0; i < target.length; i++) {
      if (attempt[i] !== target[i]) diffs.push(i);
    }
    if (
      diffs.length === 2 &&
      diffs[1] === diffs[0]! + 1 &&
      attempt[diffs[0]!] === target[diffs[1]!] &&
      attempt[diffs[1]!] === target[diffs[0]!]
    ) {
      return 'transposition';
    }
    if (diffs.length === 1) {
      const idx = diffs[0]!;
      if (VOWELS.has(target[idx]!) && VOWELS.has(attempt[idx]!)) {
        return 'vowel';
      }
      return 'substitution';
    }
  }

  // Doubling: difference of 1 char where the extra/missing char is adjacent to an identical char
  if (Math.abs(attempt.length - target.length) === 1) {
    const [longer, shorter] =
      attempt.length > target.length ? [attempt, target] : [target, attempt];
    for (let i = 0; i < longer.length; i++) {
      const without = longer.slice(0, i) + longer.slice(i + 1);
      if (without === shorter) {
        const ch = longer[i]!;
        if (longer[i - 1] === ch || longer[i + 1] === ch) {
          return 'doubling';
        }
        return attempt.length < target.length ? 'omission' : 'addition';
      }
    }
  }

  // General vowel check if lengths match and most diffs are vowels
  if (attempt.length === target.length) {
    let allVowels = true;
    for (let i = 0; i < target.length; i++) {
      if (attempt[i] !== target[i] && (!VOWELS.has(target[i]!) || !VOWELS.has(attempt[i]!))) {
        allVowels = false;
        break;
      }
    }
    if (allVowels) return 'vowel';
  }

  if (attempt.length < target.length) return 'omission';
  if (attempt.length > target.length) return 'addition';
  return 'other';
}

export function renderLetterBoxes(
  typed: string,
  targetWord: string,
  opts: {
    showBoxes: boolean;
    sounds?: SoundUnit[];
    firstLetterHint?: boolean;
  },
): HTMLElement {
  const { showBoxes, sounds, firstLetterHint } = opts;

  if (!showBoxes) {
    // Free-form large letter display without revealing length
    const display = typed || (firstLetterHint ? targetWord[0] ?? '' : '');
    const boxes = display.split('').map((ch, idx) =>
      h(
        'span',
        {
          className: `wc-letter-tile ${!typed && idx === 0 && firstLetterHint ? 'wc-letter-hint' : ''}`,
        },
        ch,
      ),
    );
    if (boxes.length === 0) {
      boxes.push(h('span', { className: 'wc-letter-placeholder' }, 'Type the word…'));
    }
    return h('div', { className: 'wc-letter-strip' }, ...boxes);
  }

  // Elkonin-style boxes: group by grapheme when sounds exist, else 1 char per box
  const graphemes =
    sounds && sounds.length > 0 && sounds.map((s) => s.g).join('').toLowerCase() === targetWord.toLowerCase()
      ? sounds.map((s) => s.g)
      : targetWord.split('');

  let cursor = 0;
  const tiles = graphemes.map((g, idx) => {
    const slice = typed.slice(cursor, cursor + g.length);
    cursor += g.length;
    const isHint = !slice && idx === 0 && firstLetterHint;
    const text = slice || (isHint ? g[0] ?? '' : '');
    return h(
      'span',
      {
        className: `wc-letter-box ${g.length > 1 ? 'wc-letter-box-wide' : ''} ${isHint ? 'wc-letter-hint' : ''}`,
        style: { minWidth: `${Math.max(54, g.length * 42)}px` },
      },
      text,
    );
  });

  return h('div', { className: 'wc-letter-strip' }, ...tiles);
}
