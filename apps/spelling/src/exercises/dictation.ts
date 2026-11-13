import {
  btn,
  clearEl,
  DEFAULT_SCHEDULER_CONFIG,
  focusElement,
  h,
  renderOnScreenKeyboard,
  type Exercise,
  type ExerciseContext,
  type Item,
  type TrialResult,
} from '@word-castle/core';
import type { WordMeta } from '../pack/fry/first100.js';
import { runCorrectionFlow } from './correction.js';
import { classifySpellingError, matchSpelling, renderLetterBoxes } from './letterBoxes.js';
import { runTeachCard } from './teachCard.js';

export async function runDictationTrial(
  item: Item,
  ctx: ExerciseContext,
  options: { allowHints?: boolean } = {},
): Promise<TrialResult> {
  const allowHints = options.allowHints ?? true;
  const meta = item.meta as unknown as WordMeta;
  const isBox0Or1 = !ctx.itemState || ctx.itemState.box <= 1;
  let showBoxes = Boolean(ctx.forceScaffold || isBox0Or1);
  let firstLetterHint = false;
  let usedHint = false;
  let replayCount = 0;

  let typed = '';
  const startTime = Date.now();
  let lastInputTime = startTime;
  let idlePaused = false;

  return new Promise((resolve) => {
    clearEl(ctx.root);

    const idleBanner = h('p', {
      className: 'wc-idle-banner',
      attrs: { 'aria-live': 'polite' },
    });

    const peekWordBanner = h('div', { className: 'wc-peek-word' });

    const boxesWrap = h('div');
    const updateBoxes = () => {
      clearEl(boxesWrap);
      boxesWrap.appendChild(
        renderLetterBoxes(typed, meta.word, {
          showBoxes,
          sounds: meta.sounds,
          firstLetterHint,
        }),
      );
    };
    updateBoxes();

    const markActivity = () => {
      lastInputTime = Date.now();
      if (idleBanner.textContent) {
        idleBanner.textContent = '';
        ctx.onIdleResume?.();
      }
    };

    const idleTimer = setInterval(() => {
      if (!idlePaused && Date.now() - lastInputTime >= DEFAULT_SCHEDULER_CONFIG.idlePauseMs) {
        idlePaused = true;
        idleBanner.textContent = 'Take your time! Ready whenever you are.';
        ctx.onIdlePause?.();
      }
    }, 1000);

    const input = h('input', {
      type: 'text',
      className: 'wc-input wc-spelling-input',
      autocomplete: 'off',
      autocorrect: 'off',
      autocapitalize: 'off',
      spellcheck: false,
      placeholder: 'Type the word…',
      attrs: { 'aria-label': 'Spell the word you heard' },
      onInput: () => {
        markActivity();
        typed = input.value;
        updateBoxes();
      },
      onKeyDown: (e) => {
        markActivity();
        if (e.key === 'Enter') {
          submit();
        }
      },
    });

    const submit = () => {
      if (!typed.trim()) return;
      clearInterval(idleTimer);
      const correct = matchSpelling(typed, meta.word);
      const independent = !usedHint && replayCount <= 2;
      const latencyMs = idlePaused ? null : Date.now() - startTime;
      const detail = correct
        ? undefined
        : {
            attempt: typed.trim(),
            tag: classifySpellingError(typed, meta.word),
          };
      if (correct) {
        ctx.announce('Correct!');
      }
      resolve({
        itemId: item.id,
        correct,
        independent,
        latencyMs,
        detail,
      });
    };

    const audioRow = h(
      'div',
      { className: 'wc-row-actions', style: { justifyContent: 'center' } },
      btn('Hear the word again', () => {
        markActivity();
        replayCount++;
        void ctx.playAudio(item.id, 'word', meta.ttsText ?? meta.word);
      }),
      btn('Hear the sentence again', () => {
        markActivity();
        replayCount++;
        void ctx.playAudio(item.id, 'sentence', meta.sentence);
      }),
      btn('Say it slowly', () => {
        markActivity();
        replayCount++;
        void ctx.playAudio(item.id, 'slow', meta.ttsText ?? meta.word);
      }),
    );

    const hintRow = allowHints
      ? h(
          'div',
          { className: 'wc-row-actions', style: { justifyContent: 'center' } },
          btn(
            'Hint: First letter',
            () => {
              markActivity();
              usedHint = true;
              firstLetterHint = true;
              updateBoxes();
              focusElement(input);
            },
            'ghost',
          ),
          btn(
            'Hint: Letter boxes',
            () => {
              markActivity();
              usedHint = true;
              showBoxes = true;
              updateBoxes();
              focusElement(input);
            },
            'ghost',
          ),
          btn(
            'Hint: Peek 3s',
            () => {
              markActivity();
              usedHint = true;
              peekWordBanner.textContent = meta.word;
              setTimeout(() => {
                peekWordBanner.textContent = '';
                focusElement(input);
              }, 3000);
            },
            'ghost',
          ),
        )
      : null;

    const osk = ctx.showOnScreenKeyboard
      ? renderOnScreenKeyboard({
          onChar: (ch) => {
            markActivity();
            typed += ch;
            input.value = typed;
            updateBoxes();
          },
          onBackspace: () => {
            markActivity();
            typed = typed.slice(0, -1);
            input.value = typed;
            updateBoxes();
          },
          onEnter: submit,
        })
      : null;

    const card = h(
      'div',
      { className: 'wc-card wc-dictation-card' },
      audioRow,
      idleBanner,
      peekWordBanner,
      boxesWrap,
      input,
      h(
        'div',
        { className: 'wc-row-actions', style: { justifyContent: 'center', marginTop: '1rem' } },
        btn('Check', submit, 'primary', { className: 'wc-btn-hero' }),
      ),
      hintRow,
      osk,
    );

    ctx.root.appendChild(card);
    focusElement(input);

    // §7.5: If homophones exist, play sentence first to disambiguate; else word -> sentence -> word
    void (async () => {
      if (meta.homophones && meta.homophones.length > 0) {
        await ctx.playAudio(item.id, 'sentence', meta.sentence);
        await ctx.playAudio(item.id, 'word', meta.ttsText ?? meta.word);
      } else {
        await ctx.playAudio(item.id, 'word', meta.ttsText ?? meta.word);
        await ctx.playAudio(item.id, 'sentence', meta.sentence);
        await ctx.playAudio(item.id, 'word', meta.ttsText ?? meta.word);
      }
    })();
  });
}

export const spellingExercise: Exercise = {
  present: (item, ctx) => runDictationTrial(item, ctx, { allowHints: true }),
  teach: (item, ctx) => runTeachCard(item, ctx),
  correct: (item, trial, ctx) => runCorrectionFlow(item, trial, ctx),
};
