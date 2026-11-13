import {
  btn,
  clearEl,
  computeProgressView,
  h,
  isStandaloneMode,
  renderProgressBar,
  toLocalDateString,
  type AudioPlayer,
  type LearningPack,
  type StateStore,
  type Theme,
} from '@word-castle/core';

export interface HomeScreenHandlers {
  onStartSession: () => void;
  onMyCastle: () => void;
  onExtraPractice: () => void;
  onParentArea: () => void;
  canInstall: boolean;
  onInstall: () => void;
}

export function renderHomeScreen(
  root: HTMLElement,
  opts: {
    store: StateStore;
    pack: LearningPack;
    theme: Theme;
    player: AudioPlayer;
    handlers: HomeScreenHandlers;
  },
): void {
  clearEl(root);
  const { store, pack, theme, player, handlers } = opts;
  const state = store.getState();
  const now = Date.now();
  const today = toLocalDateString(now);

  const view = computeProgressView(
    pack,
    state.items,
    now,
    state.history,
    state.streakDays,
    state.settings.unlockedOverrides,
  );

  const active = state.activeSession;
  const doneToday = state.lastPracticedDate === today && !active;
  const hasActiveMidSession = Boolean(active && !active.completed && active.index > 0);

  const primaryLabel = doneToday
    ? 'Castle built for today ✓'
    : hasActiveMidSession
      ? 'Keep going'
      : 'Build the castle';

  const primaryBtn = btn(
    primaryLabel,
    () => {
      player.unlockAudio();
      handlers.onStartSession();
    },
    'primary',
    { className: 'wc-btn-hero', disabled: doneToday },
  );

  const topBar = h(
    'header',
    { className: 'wc-row-actions', style: { justifyContent: 'space-between', marginBottom: '1.25rem' } },
    h(
      'div',
      null,
      h('h1', { className: 'wc-castle-title' }, `Hello, ${state.childName || 'Builder'}!`),
      state.streakDays > 0
        ? h('span', { className: 'wc-streak-pill' }, `🏰 ${state.streakDays} ${state.streakDays === 1 ? 'day' : 'days'} in a row`)
        : null,
    ),
    h(
      'div',
      { className: 'wc-row-actions' },
      handlers.canInstall && !isStandaloneMode()
        ? btn('Install App', handlers.onInstall, 'secondary')
        : null,
      btn('⚙ Parents', handlers.onParentArea, 'ghost', {
        attrs: { 'aria-label': 'Parent Area' },
      }),
    ),
  );

  const todayCompletedTrials = active
    ? active.index
    : doneToday
      ? state.history[state.history.length - 1]?.trials ?? 1
      : 0;
  const todayTotalTrials = active
    ? active.queue.length
    : doneToday
      ? todayCompletedTrials
      : 1;

  const progressSection = h(
    'div',
    { style: { margin: '1rem 0' } },
    renderProgressBar(
      todayCompletedTrials,
      todayTotalTrials,
      doneToday
        ? 'Today’s session complete!'
        : hasActiveMidSession
          ? `${todayCompletedTrials} of ${todayTotalTrials} words done`
          : 'Ready for today’s session',
    ),
  );

  const previewBox = h('div', { style: { margin: '1rem 0' } });
  theme.renderHomePreview(previewBox, view);

  const mainCard = h(
    'div',
    { className: 'wc-card', style: { textAlign: 'center', marginBottom: '1.25rem' } },
    previewBox,
    progressSection,
    h(
      'div',
      { className: 'wc-row-actions', style: { justifyContent: 'center', marginTop: '1.25rem' } },
      primaryBtn,
    ),
  );

  const secondaryRow = h(
    'div',
    { className: 'wc-row-actions', style: { justifyContent: 'center' } },
    btn('My Castle', handlers.onMyCastle, 'secondary'),
    state.settings.extraPracticeEnabled
      ? btn('More ways to practice', handlers.onExtraPractice, 'secondary')
      : null,
  );

  root.appendChild(topBar);
  root.appendChild(mainCard);
  root.appendChild(secondaryRow);
}
