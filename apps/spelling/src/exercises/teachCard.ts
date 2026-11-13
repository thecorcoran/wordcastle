import { btn, clearEl, h, type ExerciseContext, type Item } from '@word-castle/core';
import type { WordMeta } from '../pack/fry/first100.js';

export async function runTeachCard(item: Item, ctx: ExerciseContext): Promise<void> {
  const meta = item.meta as unknown as WordMeta;
  const sounds =
    meta.sounds && meta.sounds.length > 0
      ? meta.sounds
      : meta.word.split('').map((c) => ({ g: c, p: c.toLowerCase() }));
  const heartSet = new Set(meta.heartIndexes ?? []);

  return new Promise((resolve) => {
    clearEl(ctx.root);

    const tileEls = sounds.map((s, idx) => {
      const isHeart = heartSet.has(idx);
      const tile = h(
        'button',
        {
          type: 'button',
          className: `wc-sound-tile ${isHeart ? 'wc-sound-heart' : ''}`,
          attrs: {
            'aria-label': `Sound ${s.g}${isHeart ? ' (learn by heart)' : ''}`,
          },
          onClick: () => {
            tile.classList.add('wc-sound-lit');
            setTimeout(() => tile.classList.remove('wc-sound-lit'), 500);
          },
        },
        h('span', { className: 'wc-sound-grapheme' }, s.g),
        isHeart ? h('span', { className: 'wc-heart-badge', attrs: { 'aria-hidden': 'true' } }, '♥') : null,
      );
      return tile;
    });

    const gotItBtn = btn(
      'Got it!',
      () => {
        clearTimeout(unlockTimer);
        resolve();
      },
      'primary',
      { disabled: true, className: 'wc-btn-hero' },
    );

    const unlockTimer = setTimeout(() => {
      gotItBtn.disabled = false;
    }, 2000);

    const hearAgainBtn = btn('Hear it again', () => {
      void (async () => {
        await ctx.playAudio(item.id, 'slow', meta.ttsText ?? meta.word);
        await ctx.playAudio(item.id, 'word', meta.ttsText ?? meta.word);
        await ctx.playAudio(item.id, 'sentence', meta.sentence);
      })();
    });

    const card = h(
      'div',
      { className: 'wc-card wc-teach-card' },
      h('p', { className: 'wc-muted' }, 'New word — tap each sound to look closely:'),
      h('div', { className: 'wc-teach-tiles' }, ...tileEls),
      heartSet.size > 0
        ? h('p', { className: 'wc-heart-note' }, '♥ Gold underline = tricky part to learn by heart')
        : null,
      h('p', { className: 'wc-teach-sentence' }, meta.sentence),
      h('div', { className: 'wc-row-actions', style: { justifyContent: 'center' } }, hearAgainBtn, gotItBtn),
    );

    ctx.root.appendChild(card);

    // Auto-play: slow -> word -> sentence (skip sound-by-sound TTS unless recorded)
    void (async () => {
      await ctx.playAudio(item.id, 'slow', meta.ttsText ?? meta.word);
      await ctx.playAudio(item.id, 'word', meta.ttsText ?? meta.word);
      await ctx.playAudio(item.id, 'sentence', meta.sentence);
    })();
  });
}
