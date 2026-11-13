import {
  addLocalDays,
  btn,
  clearEl,
  h,
  startOfLocalDay,
  type LearningPack,
  type StateStore,
} from '@word-castle/core';
import type { WordMeta } from '../pack/fry/first100.js';
import { getRoomName } from '../theme-castle/wings.js';
import type { SessionSummaryData } from './play.js';

export function renderSummaryScreen(
  root: HTMLElement,
  opts: {
    summary: SessionSummaryData;
    store: StateStore;
    pack: LearningPack;
    onHome: () => void;
    onMyCastle: () => void;
  },
): void {
  clearEl(root);
  const { summary, store, pack, onHome, onMyCastle } = opts;
  const state = store.getState();

  const tomorrowStart = startOfLocalDay(addLocalDays(Date.now(), 1));
  const tomorrowWords = pack.items
    .filter((it) => {
      const st = state.items[it.id];
      return st && st.box >= 1 && startOfLocalDay(st.due) <= tomorrowStart;
    })
    .slice(0, 6)
    .map((it) => (it.meta as unknown as WordMeta).word);

  const statCard = (value: string | number, label: string) =>
    h(
      'div',
      { className: 'wc-card', style: { textAlign: 'center', flex: '1 1 160px' } },
      h('div', { style: { fontSize: '2.5rem', fontWeight: '800', color: 'var(--wc-primary)' } }, String(value)),
      h('div', { className: 'wc-muted' }, label),
    );

  root.appendChild(
    h(
      'div',
      { style: { maxWidth: '720px', margin: '1.5rem auto' } },
      h('h1', { className: 'wc-castle-title', style: { textAlign: 'center', marginBottom: '1.25rem' } }, 'The castle grew!'),
      h(
        'div',
        { className: 'wc-row-actions', style: { marginBottom: '1.25rem' } },
        statCard(summary.record.trials, 'Words practiced'),
        statCard(summary.record.correctCount, 'Got right'),
        statCard(summary.stonesGrew, 'Stones that grew'),
        statCard(summary.roomsFinished.length, 'Rooms finished'),
      ),
      summary.roomsFinished.length > 0
        ? h(
            'div',
            { className: 'wc-card', style: { marginBottom: '1rem' } },
            h('strong', null, 'Rooms completed today: '),
            summary.roomsFinished.map(getRoomName).join(', '),
          )
        : null,
      h(
        'div',
        { className: 'wc-card', style: { marginBottom: '1.5rem' } },
        h('strong', null, 'Tomorrow we’ll visit: '),
        tomorrowWords.length > 0
          ? tomorrowWords.join(', ')
          : 'New stones waiting to be quarried!',
      ),
      h(
        'div',
        { className: 'wc-row-actions', style: { justifyContent: 'center' } },
        btn('See My Castle', onMyCastle, 'secondary'),
        btn('Done for Today', onHome, 'primary', { className: 'wc-btn-hero' }),
      ),
    ),
  );
}
