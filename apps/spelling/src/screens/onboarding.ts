import {
  applyPlacementResults,
  btn,
  clearEl,
  createPlacementState,
  focusElement,
  getCurrentPlacementItem,
  h,
  recordPlacementAnswer,
  type AudioPlayer,
  type LearningPack,
  type StateStore,
} from '@word-castle/core';
import { runDictationTrial } from '../exercises/dictation.js';
import type { WordMeta } from '../pack/fry/first100.js';

export function renderOnboardingScreen(
  root: HTMLElement,
  opts: {
    store: StateStore;
    pack: LearningPack;
    player: AudioPlayer;
    announce: (msg: string) => void;
    onComplete: () => void;
  },
): void {
  const { store, pack, player, announce, onComplete } = opts;
  let childName = store.getState().childName || '';

  const showNameStep = () => {
    clearEl(root);
    const input = h('input', {
      type: 'text',
      className: 'wc-input',
      value: childName,
      placeholder: 'Enter name…',
      attrs: { 'aria-label': 'Child name' },
      onKeyDown: (e) => {
        if (e.key === 'Enter') next();
      },
    });

    const next = () => {
      player.unlockAudio();
      childName = input.value.trim() || 'Builder';
      store.update((prev) => ({ ...prev, childName }));
      showVoiceExplainer();
    };

    root.appendChild(
      h(
        'div',
        { className: 'wc-card', style: { maxWidth: '560px', margin: '2rem auto' } },
        h('h1', { className: 'wc-castle-title' }, 'Welcome to Word Castle'),
        h('p', null, 'Let’s set up your castle. What is your name?'),
        input,
        h(
          'div',
          { className: 'wc-row-actions', style: { marginTop: '1.25rem', justifyContent: 'flex-end' } },
          btn('Next →', next, 'primary', { className: 'wc-btn-hero' }),
        ),
      ),
    );
    focusElement(input);
  };

  const showVoiceExplainer = () => {
    clearEl(root);
    root.appendChild(
      h(
        'div',
        { className: 'wc-card', style: { maxWidth: '580px', margin: '2rem auto' } },
        h('h2', null, `Nice to meet you, ${childName}!`),
        h(
          'p',
          null,
          'Word Castle will read words aloud using a friendly computer voice. Later, a grown-up can record their own voice in the Parent Area.',
        ),
        h(
          'div',
          { className: 'wc-row-actions', style: { marginTop: '1.5rem', justifyContent: 'space-between' } },
          btn('Skip placement', () => finishOnboarding(0), 'ghost'),
          btn('Find my starting spot →', startPlacement, 'primary', { className: 'wc-btn-hero' }),
        ),
      ),
    );
  };

  const finishOnboarding = (placedCount: number) => {
    clearEl(root);
    store.update((prev) => ({ ...prev, onboardingDone: true }));
    const msg =
      placedCount > 0
        ? `Your castle already has ${placedCount} stones!`
        : 'Your castle foundation is ready!';

    root.appendChild(
      h(
        'div',
        { className: 'wc-card', style: { maxWidth: '560px', margin: '2rem auto', textAlign: 'center' } },
        h('h2', null, msg),
        h('p', { className: 'wc-muted' }, 'Everything stays right here on your device.'),
        btn('Go to my castle →', onComplete, 'primary', { className: 'wc-btn-hero' }),
      ),
    );
  };

  const startPlacement = async () => {
    let placement = createPlacementState(pack, 25);

    while (!placement.finished) {
      const item = getCurrentPlacementItem(placement);
      if (!item) break;

      clearEl(root);
      const header = h(
        'div',
        { className: 'wc-row-actions', style: { justifyContent: 'space-between', marginBottom: '1rem' } },
        h('span', { className: 'wc-muted' }, `Quick check • Question ${placement.questionsAsked + 1}`),
        btn(
          'Skip check',
          () => {
            placement = recordPlacementAnswer(placement, 'skipped');
            const { states, placedCount } = applyPlacementResults(
              pack,
              store.getState().items,
              placement,
              Date.now(),
            );
            store.update((prev) => ({ ...prev, items: states }));
            finishOnboarding(placedCount);
          },
          'ghost',
        ),
      );
      const trialRoot = h('div');
      root.appendChild(header);
      root.appendChild(trialRoot);

      const trial = await runDictationTrial(
        item,
        {
          root: trialRoot,
          itemState: null,
          forceScaffold: false,
          showOnScreenKeyboard: store.getState().settings.showOnScreenKeyboard,
          playAudio: (id, kind, tts) =>
            player.play(id, kind, tts ?? (item.meta as unknown as WordMeta).word),
          hasAudio: (id, kind) => player.hasRecording(id, kind),
          announce,
        },
        { allowHints: false },
      );

      if (placement.finished) return;
      placement = recordPlacementAnswer(placement, trial);
    }

    const { states, placedCount } = applyPlacementResults(
      pack,
      store.getState().items,
      placement,
      Date.now(),
    );
    store.update((prev) => ({ ...prev, items: states }));
    finishOnboarding(placedCount);
  };

  showNameStep();
}
