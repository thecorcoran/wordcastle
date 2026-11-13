import {
  btn,
  clearEl,
  focusElement,
  h,
  type ExerciseContext,
  type Item,
  type TrialResult,
} from '@word-castle/core';
import type { WordMeta } from '../pack/fry/first100.js';
import { matchSpelling, renderLetterBoxes } from './letterBoxes.js';

function renderAlignedComparison(target: string, attempt: string): HTMLElement {
  const len = Math.max(target.length, attempt.length);
  const targetRow = h('div', { className: 'wc-align-row' });
  const attemptRow = h('div', { className: 'wc-align-row' });

  let firstDiffFound = false;
  for (let i = 0; i < len; i++) {
    const tChar = target[i] ?? '';
    const aChar = attempt[i] ?? '';
    const differs = tChar.toLowerCase() !== aChar.toLowerCase();
    const highlight = differs && !firstDiffFound;
    if (differs) firstDiffFound = true;

    targetRow.appendChild(
      h('span', { className: `wc-align-cell ${highlight ? 'wc-align-calm' : ''}` }, tChar || '·'),
    );
    attemptRow.appendChild(
      h('span', { className: `wc-align-cell ${highlight ? 'wc-align-calm' : ''}` }, aChar || '·'),
    );
  }

  return h(
    'div',
    { className: 'wc-align-wrap' },
    h('div', { className: 'wc-align-label' }, 'Word:'),
    targetRow,
    h('div', { className: 'wc-align-label' }, 'Yours:'),
    attemptRow,
  );
}

export async function runCorrectionFlow(
  item: Item,
  trial: TrialResult,
  ctx: ExerciseContext,
): Promise<void> {
  const meta = item.meta as unknown as WordMeta;
  const attemptStr =
    typeof trial.detail === 'object' &&
    trial.detail !== null &&
    'attempt' in trial.detail &&
    typeof (trial.detail as { attempt?: unknown }).attempt === 'string'
      ? (trial.detail as { attempt: string }).attempt
      : '';

  ctx.announce("Not quite. Let's look at it together.");

  return new Promise((resolve) => {
    let failures = 0;

    const showLookPhase = () => {
      clearEl(ctx.root);
      const statusEl = h(
        'p',
        { className: 'wc-muted' },
        failures >= 2
          ? 'Type the word while you look at it:'
          : 'Look closely at the word. It will cover in 4 seconds…',
      );

      const wordDisplay = h('div', { className: 'wc-word-display' }, meta.word);

      const card = h(
        'div',
        { className: 'wc-card wc-correction-card' },
        h('h2', { className: 'wc-calm-heading' }, "Let's look at it together."),
        attemptStr ? renderAlignedComparison(meta.word, attemptStr) : null,
        wordDisplay,
        statusEl,
      );
      ctx.root.appendChild(card);

      void ctx.playAudio(item.id, 'word', meta.ttsText ?? meta.word);

      if (failures >= 2) {
        // Copy-along step after two failures
        renderWritePhase(true);
      } else {
        setTimeout(() => {
          renderWritePhase(false);
        }, 4000);
      }
    };

    const renderWritePhase = (visibleWord: boolean) => {
      clearEl(ctx.root);
      let typed = '';

      const boxesWrap = h('div');
      const updateBoxes = () => {
        clearEl(boxesWrap);
        boxesWrap.appendChild(
          renderLetterBoxes(typed, meta.word, {
            showBoxes: true,
            sounds: meta.sounds,
          }),
        );
      };
      updateBoxes();

      const feedbackEl = h('p', {
        className: 'wc-calm-feedback',
        attrs: { 'aria-live': 'polite' },
      });

      const input = h('input', {
        type: 'text',
        className: 'wc-input wc-spelling-input',
        autocomplete: 'off',
        autocorrect: 'off',
        autocapitalize: 'off',
        spellcheck: false,
        placeholder: 'Type the word here',
        attrs: { 'aria-label': 'Type the word from memory' },
        onInput: () => {
          typed = input.value;
          updateBoxes();
        },
        onKeyDown: (e) => {
          if (e.key === 'Enter') check();
        },
      });

      const check = () => {
        if (matchSpelling(typed, meta.word)) {
          ctx.announce('Nice work!');
          resolve();
        } else {
          failures++;
          feedbackEl.textContent = "Let's look again together.";
          setTimeout(showLookPhase, 900);
        }
      };

      const card = h(
        'div',
        { className: 'wc-card wc-correction-card' },
        h(
          'h2',
          { className: 'wc-calm-heading' },
          visibleWord ? 'Type it while you look:' : 'Now type it from memory:',
        ),
        visibleWord ? h('div', { className: 'wc-word-display' }, meta.word) : null,
        boxesWrap,
        input,
        feedbackEl,
        h(
          'div',
          { className: 'wc-row-actions', style: { justifyContent: 'center', marginTop: '1rem' } },
          btn('Hear word', () => void ctx.playAudio(item.id, 'word', meta.ttsText ?? meta.word)),
          btn('Check', check, 'primary'),
        ),
      );
      ctx.root.appendChild(card);
      focusElement(input);
    };

    showLookPhase();
  });
}
