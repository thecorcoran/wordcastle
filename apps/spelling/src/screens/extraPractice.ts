import {
  btn,
  clearEl,
  h,
  type AudioPlayer,
  type LearningPack,
  type StateStore,
} from '@word-castle/core';
import { runCorrectionFlow } from '../exercises/correction.js';
import { generateScribeSentences, renderSentenceScribe } from '../exercises/sentenceScribe.js';
import type { WordMeta } from '../pack/fry/first100.js';

export function renderExtraPracticeScreen(
  root: HTMLElement,
  opts: {
    store: StateStore;
    pack: LearningPack;
    player: AudioPlayer;
    announce: (msg: string) => void;
    onCastleTour: () => void;
    onBack: () => void;
  },
): void {
  const { store, pack, player, announce, onCastleTour, onBack } = opts;

  const renderMenu = () => {
    clearEl(root);
    const state = store.getState();

    const troubleItems = pack.items
      .filter((it) => {
        const st = state.items[it.id];
        return st && st.attempts >= 1 && st.correct < st.attempts;
      })
      .sort((a, b) => {
        const stA = state.items[a.id]!;
        const stB = state.items[b.id]!;
        return stA.correct / stA.attempts - stB.correct / stB.attempts;
      })
      .slice(0, 5);

    const masteredCount = pack.items.filter((it) => (state.items[it.id]?.box ?? 0) >= 3).length;
    const scribeSentences = masteredCount >= 8 ? generateScribeSentences(pack.items, state.items) : [];

    root.appendChild(
      h(
        'div',
        { style: { maxWidth: '640px', margin: '1rem auto' } },
        h(
          'div',
          { className: 'wc-row-actions', style: { marginBottom: '1rem' } },
          btn('← Home', onBack, 'secondary'),
          h('h1', { className: 'wc-castle-title' }, 'More Ways to Practice'),
        ),
        h(
          'div',
          { className: 'wc-card', style: { marginBottom: '1rem' } },
          h('h3', { style: { marginTop: '0' } }, '1. Fix-It Practice'),
          h('p', { className: 'wc-muted' }, 'Practice up to 5 tricky words with copy-cover-compare (no change to your schedule).'),
          btn(
            troubleItems.length > 0 ? `Practice ${troubleItems.length} tricky words` : 'No tricky words right now',
            async () => {
              for (const item of troubleItems) {
                for (let round = 0; round < 2; round++) {
                  const meta = item.meta as unknown as WordMeta;
                  await runCorrectionFlow(
                    item,
                    { itemId: item.id, correct: false, independent: false, latencyMs: null },
                    {
                      root,
                      itemState: state.items[item.id] ?? null,
                      playAudio: (id, kind, tts) => player.play(id, kind, tts ?? meta.word),
                      hasAudio: (id, kind) => player.hasRecording(id, kind),
                      announce,
                    },
                  );
                }
              }
              renderMenu();
            },
            'primary',
            { disabled: troubleItems.length === 0 },
          ),
        ),
        h(
          'div',
          { className: 'wc-card', style: { marginBottom: '1rem' } },
          h('h3', { style: { marginTop: '0' } }, '2. Sentence Scribe'),
          h(
            'p',
            { className: 'wc-muted' },
            masteredCount >= 8
              ? 'Listen and write whole sentences made from words you know!'
              : `Unlock Sentence Scribe once you have 8 words in Box 3+ (currently ${masteredCount}).`,
          ),
          btn(
            'Start Sentence Scribe',
            () => {
              renderSentenceScribe(
                root,
                scribeSentences,
                player,
                (scored) => {
                  // Half-weight update on incorrect words: mark lastWrong without harsh demotion
                  store.update((prev) => {
                    const nextItems = { ...prev.items };
                    for (const s of scored) {
                      if (!s.correct && nextItems[s.itemId]) {
                        nextItems[s.itemId] = {
                          ...nextItems[s.itemId]!,
                          lastWrong: Date.now(),
                          due: Date.now(),
                        };
                      }
                    }
                    return { ...prev, items: nextItems };
                  });
                },
                renderMenu,
              );
            },
            'primary',
            { disabled: scribeSentences.length === 0 },
          ),
        ),
        h(
          'div',
          { className: 'wc-card' },
          h('h3', { style: { marginTop: '0' } }, '3. Castle Tour'),
          h('p', { className: 'wc-muted' }, 'Walk through your castle rooms and tap any stone to hear its word.'),
          btn('Visit My Castle', onCastleTour, 'secondary'),
        ),
      ),
    );
  };

  renderMenu();
}
