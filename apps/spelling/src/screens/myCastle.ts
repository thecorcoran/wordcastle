import {
  applyTrialResult,
  btn,
  clearEl,
  computeProgressView,
  createSeededRng,
  h,
  type AudioPlayer,
  type Item,
  type LearningPack,
  type StateStore,
  type Theme,
} from '@word-castle/core';
import { runDictationTrial } from '../exercises/dictation.js';
import type { WordMeta } from '../pack/fry/first100.js';
import { getStoneStageLabel } from '../theme-castle/stones.js';

export function renderMyCastleScreen(
  root: HTMLElement,
  opts: {
    store: StateStore;
    pack: LearningPack;
    theme: Theme;
    player: AudioPlayer;
    announce: (msg: string) => void;
    onBack: () => void;
  },
): void {
  const { store, pack, theme, player, announce, onBack } = opts;

  const renderMain = () => {
    clearEl(root);
    const state = store.getState();
    const view = computeProgressView(
      pack,
      state.items,
      Date.now(),
      state.history,
      state.streakDays,
      state.settings.unlockedOverrides,
    );

    const header = h(
      'div',
      { className: 'wc-row-actions', style: { justifyContent: 'space-between', marginBottom: '1rem' } },
      btn('← Home', onBack, 'secondary'),
      h('h1', { className: 'wc-castle-title' }, 'My Castle'),
      h('span', { className: 'wc-muted' }, `${view.masteredCount} crowned`),
    );

    const themeRoot = h('div');
    const modalRoot = h('div');

    theme.renderProgress(themeRoot, view, {
      onSelectItem: (item) => showStoneCard(item, modalRoot),
    });

    root.appendChild(header);
    root.appendChild(modalRoot);
    root.appendChild(themeRoot);
  };

  const showStoneCard = (item: Item, modalRoot: HTMLElement) => {
    clearEl(modalRoot);
    const meta = item.meta as unknown as WordMeta;
    const st = store.getState().items[item.id] ?? null;
    const stage = st ? getStoneStageLabel(st.box) : 'Plan (unseen)';

    const card = h(
      'div',
      { className: 'wc-card', style: { marginBottom: '1rem', borderColor: 'var(--wc-gold)' } },
      h(
        'div',
        { className: 'wc-row-actions', style: { justifyContent: 'space-between' } },
        h('h2', { style: { margin: '0' } }, st ? meta.word : 'Mystery Stone'),
        btn('Close', () => clearEl(modalRoot), 'ghost'),
      ),
      h('p', { className: 'wc-muted' }, `Stage: ${stage}${st ? ` • Practiced ${st.attempts} times` : ''}`),
      st ? h('p', null, meta.sentence) : null,
      h(
        'div',
        { className: 'wc-row-actions' },
        btn('Play word', () => void player.play(item.id, 'word', meta.ttsText ?? meta.word)),
        btn('Play sentence', () => void player.play(item.id, 'sentence', meta.sentence)),
        btn(
          'Practice this one',
          async () => {
            clearEl(root);
            const trialRoot = h('div');
            root.appendChild(btn('← Back to Castle', renderMain, 'ghost'));
            root.appendChild(trialRoot);
            const trial = await runDictationTrial(item, {
              root: trialRoot,
              itemState: st,
              forceScaffold: false,
              showOnScreenKeyboard: store.getState().settings.showOnScreenKeyboard,
              playAudio: (id, kind, tts) => player.play(id, kind, tts ?? meta.word),
              hasAudio: (id, kind) => player.hasRecording(id, kind),
              announce,
            });
            const nextSt = applyTrialResult(st, trial, {
              now: Date.now(),
              rng: createSeededRng(Date.now()),
            });
            store.update((prev) => ({
              ...prev,
              items: { ...prev.items, [item.id]: nextSt },
            }));
            renderMain();
          },
          'primary',
        ),
      ),
    );
    modalRoot.appendChild(card);
  };

  renderMain();
}
