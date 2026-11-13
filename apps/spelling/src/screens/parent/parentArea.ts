import {
  btn,
  clearEl,
  computeProgressView,
  diffLocalDays,
  h,
  renderCoreSettings,
  renderParentGate,
  toLocalDateString,
  type AudioPlayer,
  type AudioStore,
  type LearningPack,
  type StateStore,
} from '@word-castle/core';
import type { WordMeta } from '../../pack/fry/first100.js';
import { renderRecordingStudio } from '../recordingStudio.js';
import { renderWordEditor } from './wordEditor.js';

type ParentTab = 'overview' | 'words' | 'sessions' | 'studio' | 'editor' | 'settings';

export function renderParentArea(
  root: HTMLElement,
  opts: {
    store: StateStore;
    pack: LearningPack;
    audioStore: AudioStore;
    player: AudioPlayer;
    onPackChanged: () => void;
    onBack: () => void;
  },
): void {
  const { store, pack, audioStore, player, onPackChanged, onBack } = opts;
  let activeTab: ParentTab = 'overview';
  let statusMessage = '';

  const showGate = () => {
    renderParentGate(root, store.getState().settings.parentPin, renderDashboard, onBack);
  };

  const renderDashboard = async () => {
    clearEl(root);
    const state = store.getState();
    const now = Date.now();
    const view = computeProgressView(
      pack,
      state.items,
      now,
      state.history,
      state.streakDays,
      state.settings.unlockedOverrides,
    );

    const audioKeys = new Set(await audioStore.listKeys());
    const recordedWordCount = pack.items.filter((i) => audioKeys.has(`${i.id}:word`)).length;

    const header = h(
      'div',
      { className: 'wc-row-actions', style: { justifyContent: 'space-between', marginBottom: '1rem' } },
      h('h1', { className: 'wc-castle-title' }, 'Parent Area'),
      btn('← Back to Child View', onBack, 'secondary'),
    );

    const tabs: Array<{ id: ParentTab; label: string }> = [
      { id: 'overview', label: 'Overview' },
      { id: 'words', label: 'Words' },
      { id: 'sessions', label: 'Sessions' },
      { id: 'studio', label: 'Recording Studio' },
      { id: 'editor', label: 'Word Editor' },
      { id: 'settings', label: 'Settings' },
    ];

    const tabBar = h(
      'div',
      { className: 'wc-row-actions', style: { marginBottom: '1rem' } },
      ...tabs.map((t) =>
        btn(
          t.label,
          () => {
            activeTab = t.id;
            statusMessage = '';
            void renderDashboard();
          },
          activeTab === t.id ? 'primary' : 'secondary',
          { style: { minHeight: '46px', fontSize: '1.05rem', padding: '0.45rem 1rem' } },
        ),
      ),
    );

    const msgEl = statusMessage
      ? h('p', { className: 'wc-card', style: { borderColor: 'var(--wc-primary)', marginBottom: '1rem' } }, statusMessage)
      : null;

    const content = h('div');

    if (activeTab === 'overview') {
      const boxCounts = { unseen: 0, 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      for (const it of view.items) {
        if (!it.state) boxCounts.unseen++;
        else boxCounts[it.state.box]++;
      }

      const minutesThisWeek = state.history
        .filter((s) => diffLocalDays(s.startedAt, now) <= 7)
        .reduce((sum, s) => sum + Math.round(s.durationMs / 60_000), 0);

      const practicedDaysSet = new Set(
        state.history
          .filter((s) => diffLocalDays(s.startedAt, now) <= 14)
          .map((s) => s.date),
      );

      // Words needing attention (lowest accuracy with >= 2 attempts)
      const attention = view.items
        .filter((e) => e.state && e.state.attempts >= 2)
        .map((e) => ({
          word: (e.item.meta as unknown as WordMeta).word,
          acc: e.state!.correct / e.state!.attempts,
          attempts: e.state!.attempts,
        }))
        .sort((a, b) => a.acc - b.acc)
        .slice(0, 8);

      // Most common error types
      const errorCounts: Record<string, number> = {};
      for (const s of state.history) {
        for (const err of s.errors) {
          errorCounts[err.tag] = (errorCounts[err.tag] ?? 0) + 1;
        }
      }
      const topErrors = Object.entries(errorCounts).sort((a, b) => b[1] - a[1]);

      const pctRecorded = Math.round((recordedWordCount / Math.max(1, pack.items.length)) * 100);

      content.appendChild(
        h(
          'div',
          { className: 'wc-settings-grid' },
          h(
            'div',
            { className: 'wc-card' },
            h('h3', { style: { marginTop: '0' } }, 'Summary'),
            h('p', null, `Words mastered (Box 5): ${view.masteredCount} / ${view.totalItems}`),
            h('p', null, `In progress: ${view.inProgressCount} • Unseen: ${view.unseenCount}`),
            h('p', null, `Minutes this week: ${minutesThisWeek}`),
            h('p', null, `Days practiced (last 14 days): ${practicedDaysSet.size}`),
            h('p', null, `Voice recorded: ${recordedWordCount}/${pack.items.length} (${pctRecorded}%)`),
            h(
              'p',
              { className: 'wc-muted' },
              state.lastBackupAt
                ? `Last backup: ${toLocalDateString(state.lastBackupAt)}`
                : 'Last backup: Never (export in Settings)',
            ),
          ),
          h(
            'div',
            { className: 'wc-card' },
            h('h3', { style: { marginTop: '0' } }, 'Words by Box'),
            h('p', null, `Box 5 (Crowned): ${boxCounts[5]}`),
            h('p', null, `Box 4 (Polished): ${boxCounts[4]}`),
            h('p', null, `Box 3 (Mortared): ${boxCounts[3]}`),
            h('p', null, `Box 2 (Laid): ${boxCounts[2]}`),
            h('p', null, `Box 1 (Chiseled): ${boxCounts[1]}`),
            h('p', null, `Box 0 (Quarried): ${boxCounts[0]}`),
          ),
          h(
            'div',
            { className: 'wc-card' },
            h('h3', { style: { marginTop: '0' } }, 'Words Needing Attention'),
            attention.length === 0
              ? h('p', { className: 'wc-muted' }, 'No trouble words yet.')
              : h(
                  'ul',
                  null,
                  ...attention.map((a) =>
                    h('li', null, `${a.word} — ${Math.round(a.acc * 100)}% (${a.attempts} tries)`),
                  ),
                ),
            h('h3', null, 'Most Common Error Types'),
            topErrors.length === 0
              ? h('p', { className: 'wc-muted' }, 'No errors recorded yet.')
              : h('ul', null, ...topErrors.map(([tag, cnt]) => h('li', null, `${tag}: ${cnt}`))),
          ),
        ),
      );
    } else if (activeTab === 'words') {
      let sortBy: 'order' | 'box' | 'acc' = 'order';
      const tableWrap = h('div', { className: 'wc-card wc-table-wrap' });

      const renderTable = () => {
        clearEl(tableWrap);
        const rows = [...view.items]
          .sort((a, b) => {
            if (sortBy === 'box') return (b.state?.box ?? -1) - (a.state?.box ?? -1);
            if (sortBy === 'acc') {
              const accA = a.state && a.state.attempts > 0 ? a.state.correct / a.state.attempts : 2;
              const accB = b.state && b.state.attempts > 0 ? b.state.correct / b.state.attempts : 2;
              return accA - accB;
            }
            return a.item.order - b.item.order;
          })
          .slice(0, 150);

        tableWrap.appendChild(
          h(
            'div',
            { className: 'wc-row-actions', style: { marginBottom: '0.75rem' } },
            h('span', { className: 'wc-muted' }, 'Sort by:'),
            btn('Order', () => { sortBy = 'order'; renderTable(); }, 'ghost'),
            btn('Box', () => { sortBy = 'box'; renderTable(); }, 'ghost'),
            btn('Lowest Accuracy', () => { sortBy = 'acc'; renderTable(); }, 'ghost'),
          ),
        );

        const tbody = h(
          'tbody',
          null,
          ...rows.map((e) => {
            const word = (e.item.meta as unknown as WordMeta).word;
            const st = e.state;
            const acc = st && st.attempts > 0 ? `${Math.round((st.correct / st.attempts) * 100)}%` : '—';
            const rec = audioKeys.has(`${e.item.id}:word`) ? '✓' : '';
            return h(
              'tr',
              null,
              h('td', null, word),
              h('td', null, e.item.groupId),
              h('td', null, st ? String(st.box) : 'unseen'),
              h('td', null, acc),
              h('td', null, st ? String(st.attempts) : '0'),
              h('td', null, st?.lastSeen ? toLocalDateString(st.lastSeen) : '—'),
              h('td', null, st ? toLocalDateString(st.due) : '—'),
              h('td', null, rec),
            );
          }),
        );

        tableWrap.appendChild(
          h(
            'table',
            { className: 'wc-table' },
            h(
              'thead',
              null,
              h(
                'tr',
                null,
                h('th', null, 'Word'),
                h('th', null, 'Set'),
                h('th', null, 'Box'),
                h('th', null, 'Acc'),
                h('th', null, 'Tries'),
                h('th', null, 'Last Seen'),
                h('th', null, 'Due'),
                h('th', null, 'Rec'),
              ),
            ),
            tbody,
          ),
        );
      };

      renderTable();
      content.appendChild(tableWrap);
    } else if (activeTab === 'sessions') {
      const list = [...state.history].reverse();
      content.appendChild(
        h(
          'div',
          { className: 'wc-card wc-table-wrap' },
          list.length === 0
            ? h('p', { className: 'wc-muted' }, 'No completed sessions yet.')
            : h(
                'table',
                { className: 'wc-table' },
                h(
                  'thead',
                  null,
                  h(
                    'tr',
                    null,
                    h('th', null, 'Date'),
                    h('th', null, 'Minutes'),
                    h('th', null, 'Trials'),
                    h('th', null, 'Accuracy'),
                    h('th', null, 'New Words'),
                    h('th', null, 'Errors'),
                  ),
                ),
                h(
                  'tbody',
                  null,
                  ...list.map((s) =>
                    h(
                      'tr',
                      null,
                      h('td', null, s.date),
                      h('td', null, String(Math.max(1, Math.round(s.durationMs / 60_000)))),
                      h('td', null, String(s.trials)),
                      h('td', null, s.trials > 0 ? `${Math.round((s.correctCount / s.trials) * 100)}%` : '—'),
                      h('td', null, String(s.newWords.length)),
                      h('td', null, String(s.errors.length)),
                    ),
                  ),
                ),
              ),
        ),
      );
    } else if (activeTab === 'studio') {
      renderRecordingStudio(content, { store, pack, audioStore, player });
    } else if (activeTab === 'editor') {
      renderWordEditor(content, {
        store,
        pack,
        onPackChanged,
        onMessage: (m) => {
          statusMessage = m;
          void renderDashboard();
        },
      });
    } else if (activeTab === 'settings') {
      content.appendChild(
        renderCoreSettings({
          store,
          audioStore,
          groupsInOrder: pack.unlockPolicy.groupsInOrder,
          onMessage: (m) => {
            statusMessage = m;
            void renderDashboard();
          },
          onRefresh: () => void renderDashboard(),
        }),
      );
    }

    root.appendChild(header);
    root.appendChild(tabBar);
    if (msgEl) root.appendChild(msgEl);
    root.appendChild(content);
  };

  showGate();
}
