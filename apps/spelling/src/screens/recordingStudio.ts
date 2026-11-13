import {
  btn,
  clearEl,
  getUnlockedGroups,
  h,
  VoiceRecorder,
  type AudioKind,
  type AudioPlayer,
  type AudioStore,
  type LearningPack,
  type RecordedClip,
  type StateStore,
} from '@word-castle/core';
import type { WordMeta } from '../pack/fry/first100.js';

export function renderRecordingStudio(
  root: HTMLElement,
  opts: {
    store: StateStore;
    pack: LearningPack;
    audioStore: AudioStore;
    player: AudioPlayer;
  },
): void {
  const { store, pack, audioStore, player } = opts;
  const recorder = new VoiceRecorder();
  let micReady = false;
  let micError: string | null = null;
  let currentIndex = 0;
  let recordedKeys = new Set<string>();
  let meterRaf = 0;

  // Order items so unlocked groups come first
  const unlocked = getUnlockedGroups(pack, store.getState().items, store.getState().settings.unlockedOverrides);
  const orderedItems = [
    ...pack.items.filter((i) => unlocked.has(i.groupId)),
    ...pack.items.filter((i) => !unlocked.has(i.groupId)),
  ];

  const refreshKeys = async () => {
    const keys = await audioStore.listKeys();
    recordedKeys = new Set(keys);
  };

  const renderSlot = (
    itemId: string,
    kind: AudioKind,
    label: string,
    optional = false,
  ): HTMLElement => {
    const isSaved = recordedKeys.has(`${itemId}:${kind}`);
    const statusEl = h('span', { className: 'wc-muted' }, isSaved ? '✓ Recorded' : optional ? 'Optional' : 'Not recorded');
    const meterFill = h('div', { className: 'wc-meter-fill' });
    const meter = h('div', { className: 'wc-meter-bar' }, meterFill);
    const slotActions = h('div', { className: 'wc-row-actions' });

    let pendingClip: RecordedClip | null = null;
    let isRecording = false;

    const updateButtons = () => {
      clearEl(slotActions);
      if (!isRecording) {
        slotActions.appendChild(
          btn(
            isSaved ? 'Re-record' : 'Record',
            () => {
              pendingClip = null;
              isRecording = true;
              recorder.start();
              const tick = () => {
                if (!isRecording) return;
                meterFill.style.width = `${Math.round(recorder.getLevel() * 100)}%`;
                meterRaf = requestAnimationFrame(tick);
              };
              meterRaf = requestAnimationFrame(tick);
              updateButtons();
            },
            'primary',
            { disabled: !micReady },
          ),
        );
      } else {
        slotActions.appendChild(
          btn(
            'Stop',
            async () => {
              isRecording = false;
              cancelAnimationFrame(meterRaf);
              meterFill.style.width = '0%';
              pendingClip = await recorder.stop();
              statusEl.textContent = `Ready (${pendingClip.durationSec.toFixed(1)}s)`;
              updateButtons();
            },
            'calm',
          ),
        );
      }

      if (pendingClip) {
        slotActions.appendChild(
          btn('Play back', () => {
            if (pendingClip) void player.playBlob(pendingClip.blob);
          }),
        );
        slotActions.appendChild(
          btn(
            'Keep',
            async () => {
              if (!pendingClip) return;
              await audioStore.put(itemId, kind, pendingClip.blob, pendingClip.durationSec);
              pendingClip = null;
              await refreshKeys();
              render();
            },
            'primary',
          ),
        );
      } else if (isSaved) {
        slotActions.appendChild(
          btn('Play saved', () => void player.play(itemId, kind)),
        );
        slotActions.appendChild(
          btn(
            'Delete',
            async () => {
              await audioStore.delete(itemId, kind);
              await refreshKeys();
              render();
            },
            'ghost',
          ),
        );
      }
    };

    updateButtons();

    return h(
      'div',
      { className: 'wc-card', style: { marginBottom: '0.75rem' } },
      h(
        'div',
        { className: 'wc-row-actions', style: { justifyContent: 'space-between' } },
        h('strong', null, label),
        statusEl,
      ),
      meter,
      slotActions,
    );
  };

  const render = () => {
    clearEl(root);
    const item = orderedItems[currentIndex] ?? orderedItems[0]!;
    const meta = item.meta as unknown as WordMeta;

    // Wing 1 coverage counter
    const wing1Items = pack.items.filter((i) => i.superGroupId === 'fry-wing-01');
    const wing1Recorded = wing1Items.filter((i) => recordedKeys.has(`${i.id}:word`)).length;

    const micCard = !micReady
      ? h(
          'div',
          { className: 'wc-card', style: { marginBottom: '1rem', borderColor: 'var(--wc-gold)' } },
          h('h3', { style: { marginTop: '0' } }, 'Microphone Setup'),
          h(
            'p',
            null,
            'Record words in your own voice so your child hears you during practice. Audio stays 100% on this device.',
          ),
          micError ? h('p', { className: 'wc-calm-feedback' }, `Microphone unavailable: ${micError}`) : null,
          btn(
            'Allow Microphone',
            async () => {
              const res = await recorder.requestMic();
              if (res.ok) {
                micReady = true;
                micError = null;
              } else {
                micError = res.reason;
              }
              render();
            },
            'primary',
          ),
        )
      : null;

    const navRow = h(
      'div',
      { className: 'wc-row-actions', style: { justifyContent: 'space-between', marginBottom: '1rem' } },
      h('span', { className: 'wc-muted' }, `${wing1Recorded} of ${wing1Items.length} recorded (Wing 1)`),
      h(
        'div',
        { className: 'wc-row-actions' },
        btn('← Prev', () => {
          currentIndex = Math.max(0, currentIndex - 1);
          render();
        }),
        btn(
          'Next unrecorded →',
          () => {
            const nextIdx = orderedItems.findIndex(
              (it, idx) => idx > currentIndex && !recordedKeys.has(`${it.id}:word`),
            );
            currentIndex = nextIdx !== -1 ? nextIdx : (currentIndex + 1) % orderedItems.length;
            render();
          },
          'secondary',
        ),
        btn('Next →', () => {
          currentIndex = (currentIndex + 1) % orderedItems.length;
          render();
        }),
      ),
    );

    const promptCard = h(
      'div',
      { className: 'wc-card', style: { textAlign: 'center', marginBottom: '1rem' } },
      h('div', { className: 'wc-muted' }, `Word #${item.order + 1} (${item.groupId})`),
      h('div', { className: 'wc-word-display' }, meta.word),
      h('p', { style: { fontSize: '1.35rem', margin: '0' } }, meta.sentence),
    );

    root.appendChild(
      h(
        'div',
        null,
        micCard,
        navRow,
        promptCard,
        renderSlot(item.id, 'word', '1. Word'),
        renderSlot(item.id, 'sentence', '2. Sentence'),
        renderSlot(item.id, 'slow', '3. Slow word', true),
      ),
    );
  };

  void refreshKeys().then(render);
}
