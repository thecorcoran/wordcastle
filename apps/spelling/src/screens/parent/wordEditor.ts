import { btn, clearEl, h, type LearningPack, type StateStore } from '@word-castle/core';
import type { SoundUnit, WordMeta } from '../../pack/fry/first100.js';
import type { CustomWordStoreData } from '../../pack/pack.js';

export function renderWordEditor(
  root: HTMLElement,
  opts: {
    store: StateStore;
    pack: LearningPack;
    onPackChanged: () => void;
    onMessage: (msg: string) => void;
  },
): void {
  const { store, pack, onPackChanged, onMessage } = opts;
  let search = '';
  let selectedId = pack.items[0]?.id ?? '';

  const getCustomData = (): CustomWordStoreData => {
    return (store.getState().customData.spelling as CustomWordStoreData | undefined) ?? {};
  };

  const saveCustomData = (next: CustomWordStoreData) => {
    store.update((prev) => ({
      ...prev,
      customData: {
        ...prev.customData,
        spelling: next,
      },
    }));
    onPackChanged();
  };

  const render = () => {
    clearEl(root);

    const searchInput = h('input', {
      type: 'text',
      className: 'wc-input',
      value: search,
      placeholder: 'Search words…',
      attrs: { 'aria-label': 'Search words to edit' },
      onInput: () => {
        search = searchInput.value.trim().toLowerCase();
        renderList();
      },
    });

    const listEl = h('div', { className: 'wc-row-actions', style: { margin: '0.75rem 0', maxHeight: '140px', overflowY: 'auto' } });
    const editorEl = h('div');

    const renderList = () => {
      clearEl(listEl);
      const matches = pack.items
        .filter((it) => {
          const w = (it.meta as unknown as WordMeta).word.toLowerCase();
          return !search || w.includes(search);
        })
        .slice(0, 30);

      for (const it of matches) {
        const meta = it.meta as unknown as WordMeta;
        listEl.appendChild(
          btn(
            `${meta.word}${meta.needsReview ? ' *' : ''}`,
            () => {
              selectedId = it.id;
              renderEditor();
            },
            it.id === selectedId ? 'primary' : 'secondary',
            { style: { minHeight: '42px', padding: '0.35rem 0.75rem', fontSize: '1rem' } },
          ),
        );
      }
    };

    const renderEditor = () => {
      clearEl(editorEl);
      const item = pack.items.find((i) => i.id === selectedId) ?? pack.items[0];
      if (!item) return;
      const meta = item.meta as unknown as WordMeta;

      const wordIn = h('input', { type: 'text', className: 'wc-input', value: meta.word });
      const sentIn = h('input', { type: 'text', className: 'wc-input', value: meta.sentence });
      const ttsIn = h('input', { type: 'text', className: 'wc-input', value: meta.ttsText ?? meta.word });
      const soundsIn = h('input', {
        type: 'text',
        className: 'wc-input',
        value: meta.sounds.map((s) => `${s.g}:${s.p}`).join(', '),
      });
      const heartIn = h('input', {
        type: 'text',
        className: 'wc-input',
        value: meta.heartIndexes.join(', '),
        placeholder: 'e.g. 1, 2',
      });
      const reviewedCb = h('input', { type: 'checkbox', checked: !meta.needsReview });

      editorEl.appendChild(
        h(
          'div',
          { className: 'wc-card', style: { marginBottom: '1rem' } },
          h('h3', { style: { marginTop: '0' } }, `Edit "${meta.word}" (${item.groupId})`),
          h('label', { className: 'wc-field' }, h('span', null, 'Word'), wordIn),
          h('label', { className: 'wc-field' }, h('span', null, 'Sentence'), sentIn),
          h('label', { className: 'wc-field' }, h('span', null, 'TTS Pronunciation Override'), ttsIn),
          h('label', { className: 'wc-field' }, h('span', null, 'Sounds (grapheme:phoneme, comma-separated)'), soundsIn),
          h('label', { className: 'wc-field' }, h('span', null, 'Heart Indexes (0-based, comma-separated)'), heartIn),
          h('label', { className: 'wc-toggle-row' }, reviewedCb, h('span', null, 'Marked as reviewed')),
          btn(
            'Save Word Changes',
            () => {
              const parsedSounds: SoundUnit[] = soundsIn.value
                .split(',')
                .map((part) => part.trim())
                .filter(Boolean)
                .map((part) => {
                  const [g, p] = part.split(':');
                  return { g: (g ?? '').trim(), p: (p ?? g ?? '').trim() };
                })
                .filter((s) => s.g.length > 0);

              const parsedHearts = heartIn.value
                .split(',')
                .map((x) => Number(x.trim()))
                .filter((n) => !Number.isNaN(n) && n >= 0);

              const cd = getCustomData();
              const wordEdits = { ...(cd.wordEdits ?? {}) };
              wordEdits[item.id] = {
                word: wordIn.value.trim() || meta.word,
                sentence: sentIn.value.trim() || meta.sentence,
                ttsText: ttsIn.value.trim() || wordIn.value.trim(),
                sounds: parsedSounds.length > 0 ? parsedSounds : meta.sounds,
                heartIndexes: parsedHearts,
                needsReview: !reviewedCb.checked,
              };
              saveCustomData({ ...cd, wordEdits });
              onMessage(`Saved changes to "${wordIn.value.trim()}".`);
              render();
            },
            'primary',
          ),
        ),
      );
    };

    // Add custom "Family words"
    const newWordIn = h('input', { type: 'text', className: 'wc-input', placeholder: 'e.g. Grandma' });
    const newSentIn = h('input', {
      type: 'text',
      className: 'wc-input',
      placeholder: 'e.g. Grandma baked apple pie.',
    });

    const addFamilyCard = h(
      'div',
      { className: 'wc-card' },
      h('h3', { style: { marginTop: '0' } }, 'Add Family Word'),
      h('label', { className: 'wc-field' }, h('span', null, 'Word'), newWordIn),
      h('label', { className: 'wc-field' }, h('span', null, 'Sentence'), newSentIn),
      btn(
        'Add Family Word',
        () => {
          const w = newWordIn.value.trim();
          const s = newSentIn.value.trim();
          if (!w || !s) {
            onMessage('Please enter both a word and a sentence.');
            return;
          }
          const cd = getCustomData();
          const customWords = [
            ...(cd.customWords ?? []),
            { id: `family:${Date.now()}:${w.toLowerCase()}`, word: w, sentence: s },
          ];
          saveCustomData({ ...cd, customWords });
          onMessage(`Added "${w}" to Family Words.`);
          render();
        },
        'secondary',
      ),
    );

    renderList();
    renderEditor();
    root.appendChild(h('div', null, searchInput, listEl, editorEl, addFamilyCard));
  };

  render();
}
