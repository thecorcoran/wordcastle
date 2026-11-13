import {
  btn,
  clearEl,
  focusElement,
  h,
  type AudioPlayer,
  type Item,
  type ItemStateMap,
} from '@word-castle/core';
import type { WordMeta } from '../pack/fry/first100.js';
import { matchSpelling } from './letterBoxes.js';

export interface ScribeSentence {
  text: string;
  wordIds: string[];
}

const SENTENCE_TEMPLATES: string[][] = [
  ['I', 'see', 'the', 'water'],
  ['she', 'said', 'you', 'can', 'go'],
  ['he', 'was', 'in', 'the', 'water'],
  ['we', 'will', 'make', 'it', 'now'],
  ['they', 'were', 'with', 'him'],
  ['look', 'at', 'that', 'long', 'day'],
  ['come', 'and', 'sit', 'by', 'me'],
  ['you', 'have', 'my', 'word'],
  ['all', 'people', 'like', 'good', 'time'],
  ['she', 'had', 'two', 'more'],
];

/**
 * Generates short sentences composed ONLY of words currently in box >= 3.
 */
export function generateScribeSentences(
  items: Item[],
  states: ItemStateMap,
  customSentences: string[] = [],
): ScribeSentence[] {
  const knownByWord = new Map<string, Item>();
  for (const it of items) {
    const st = states[it.id];
    if (st && st.box >= 3) {
      const w = (it.meta as unknown as WordMeta).word.toLowerCase();
      knownByWord.set(w, it);
    }
  }

  const results: ScribeSentence[] = [];

  for (const custom of customSentences) {
    const words = custom
      .trim()
      .split(/\s+/)
      .map((w) => w.replace(/[^a-zA-Z']/g, '').toLowerCase())
      .filter(Boolean);
    if (words.length >= 2 && words.every((w) => knownByWord.has(w))) {
      results.push({
        text: custom.trim(),
        wordIds: words.map((w) => knownByWord.get(w)!.id),
      });
    }
  }

  for (const tpl of SENTENCE_TEMPLATES) {
    if (tpl.every((w) => knownByWord.has(w.toLowerCase()))) {
      const text = tpl.join(' ') + '.';
      results.push({
        text: text.charAt(0).toUpperCase() + text.slice(1),
        wordIds: tpl.map((w) => knownByWord.get(w.toLowerCase())!.id),
      });
    }
  }

  // Fallback: pair any 3-4 known words if no template matched
  if (results.length === 0 && knownByWord.size >= 8) {
    const pool = Array.from(knownByWord.entries()).slice(0, 4);
    results.push({
      text: pool.map(([w]) => w).join(' '),
      wordIds: pool.map(([, it]) => it.id),
    });
  }

  return results;
}

export function renderSentenceScribe(
  root: HTMLElement,
  sentences: ScribeSentence[],
  player: AudioPlayer,
  onScoreWords: (results: Array<{ itemId: string; correct: boolean }>) => void,
  onDone: () => void,
): void {
  let idx = 0;

  const renderCurrent = () => {
    clearEl(root);
    const current = sentences[idx];
    if (!current) {
      root.appendChild(
        h(
          'div',
          { className: 'wc-card' },
          h('h2', null, 'Sentence Scribe Complete!'),
          h('p', null, 'Great job writing whole sentences.'),
          btn('Back', onDone, 'primary'),
        ),
      );
      return;
    }

    const input = h('input', {
      type: 'text',
      className: 'wc-input',
      autocomplete: 'off',
      autocorrect: 'off',
      autocapitalize: 'off',
      spellcheck: false,
      placeholder: 'Type the whole sentence…',
      attrs: { 'aria-label': 'Type the sentence you hear' },
    });

    const feedback = h('div', { style: { marginTop: '0.75rem' } });

    const speak = () => {
      void player.play(`scribe-${idx}`, 'sentence', current.text);
    };

    const check = () => {
      const targetWords = current.text
        .replace(/[.!?]/g, '')
        .trim()
        .split(/\s+/);
      const attemptWords = input.value
        .replace(/[.!?]/g, '')
        .trim()
        .split(/\s+/);

      const scored = current.wordIds.map((itemId, i) => ({
        itemId,
        correct: matchSpelling(attemptWords[i] ?? '', targetWords[i] ?? ''),
      }));
      onScoreWords(scored);

      const allRight = scored.every((s) => s.correct);
      clearEl(feedback);
      feedback.appendChild(
        h(
          'p',
          { className: allRight ? '' : 'wc-calm-feedback' },
          allRight
            ? 'Every word matched!'
            : `Target: "${current.text}"`,
        ),
      );
      feedback.appendChild(
        btn(
          'Next sentence',
          () => {
            idx++;
            renderCurrent();
          },
          'primary',
        ),
      );
    };

    root.appendChild(
      h(
        'div',
        { className: 'wc-card' },
        h('h2', null, `Sentence Scribe (${idx + 1} of ${sentences.length})`),
        h('p', { className: 'wc-muted' }, 'Listen and type the whole sentence.'),
        h(
          'div',
          { className: 'wc-row-actions', style: { marginBottom: '1rem' } },
          btn('Hear sentence', speak),
          btn('Exit', onDone, 'ghost'),
        ),
        input,
        h('div', { className: 'wc-row-actions', style: { marginTop: '1rem' } }, btn('Check', check, 'primary')),
        feedback,
      ),
    );
    focusElement(input);
    speak();
  };

  renderCurrent();
}
