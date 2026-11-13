import { listTtsVoices, speakText } from '../audio/tts.js';
import type { AudioStore } from '../storage/audioStore.js';
import { exportFullBackup, importFullBackup } from '../storage/backup.js';
import type { AppSettings, StateStore } from '../storage/store.js';
import { exportVoicePack, importVoicePack } from '../storage/voicePack.js';
import { btn, h } from './kit.js';

export interface SettingsPanelOptions {
  store: StateStore;
  audioStore: AudioStore;
  groupsInOrder: string[];
  onMessage: (msg: string) => void;
  onRefresh: () => void;
}

function downloadBlob(bytes: Uint8Array, filename: string): void {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy.buffer], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function renderCoreSettings(opts: SettingsPanelOptions): HTMLElement {
  const { store, audioStore, groupsInOrder, onMessage, onRefresh } = opts;
  const state = store.getState();
  const s = state.settings;

  const updateSetting = <K extends keyof AppSettings>(key: K, val: AppSettings[K]) => {
    store.update((prev) => ({
      ...prev,
      settings: { ...prev.settings, [key]: val },
    }));
  };

  const nameInput = h('input', {
    type: 'text',
    className: 'wc-input',
    value: state.childName,
    attrs: { 'aria-label': 'Child name' },
    onChange: () => {
      store.update((prev) => ({ ...prev, childName: nameInput.value.trim() }));
      onMessage('Child name updated.');
    },
  });

  const minutesInput = h('input', {
    type: 'number',
    className: 'wc-input',
    min: 3,
    max: 30,
    value: String(s.sessionMinutes),
    attrs: { 'aria-label': 'Session minutes' },
    onChange: () => {
      const val = Math.max(3, Math.min(30, Number(minutesInput.value) || 10));
      updateSetting('sessionMinutes', val);
      onMessage('Session length updated.');
    },
  });

  const newPerSessionInput = h('input', {
    type: 'number',
    className: 'wc-input',
    min: 1,
    max: 10,
    value: String(s.newPerSession),
    attrs: { 'aria-label': 'New words per session' },
    onChange: () => {
      const val = Math.max(1, Math.min(10, Number(newPerSessionInput.value) || 4));
      updateSetting('newPerSession', val);
      onMessage('New words per session updated.');
    },
  });

  const pinInput = h('input', {
    type: 'text',
    className: 'wc-input',
    value: s.parentPin ?? '',
    placeholder: 'Optional PIN (leave blank for math check)',
    attrs: { 'aria-label': 'Parent PIN' },
    onChange: () => {
      const v = pinInput.value.trim();
      updateSetting('parentPin', v.length > 0 ? v : null);
      onMessage('Parent gate updated.');
    },
  });

  const toggleRow = (
    label: string,
    checked: boolean,
    onChange: (val: boolean) => void,
  ) => {
    const cb = h('input', {
      type: 'checkbox',
      checked,
      onChange: () => onChange(cb.checked),
    });
    return h('label', { className: 'wc-toggle-row' }, cb, h('span', null, label));
  };

  // TTS Voice Picker
  const voices = listTtsVoices();
  const voiceSelect = h('select', {
    className: 'wc-input',
    attrs: { 'aria-label': 'Fallback computer voice' },
    onChange: () => {
      updateSetting('ttsVoiceURI', voiceSelect.value || null);
    },
  });
  voiceSelect.appendChild(h('option', { value: '' }, 'System Default'));
  for (const v of voices) {
    const opt = h('option', { value: v.voiceURI }, `${v.name} (${v.lang})`);
    if (s.ttsVoiceURI === v.voiceURI) opt.selected = true;
    voiceSelect.appendChild(opt);
  }

  // Unlock override
  const overrideSelect = h('select', {
    className: 'wc-input',
    attrs: { 'aria-label': 'Unlock group override' },
  });
  for (const gid of groupsInOrder) {
    overrideSelect.appendChild(h('option', { value: gid }, gid));
  }

  // File input for imports
  const importFullInput = h('input', { type: 'file', attrs: { accept: '.zip' }, style: { display: 'none' } });
  const importVoiceInput = h('input', { type: 'file', attrs: { accept: '.zip' }, style: { display: 'none' } });
  let importMode: 'replace' | 'merge' = 'replace';

  importFullInput.addEventListener('change', async () => {
    const file = importFullInput.files?.[0];
    if (!file) return;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const res = await importFullBackup(bytes, store, audioStore, importMode);
      onMessage(`Imported backup (${res.audioImported} audio clips).`);
      onRefresh();
    } catch (err) {
      onMessage(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    importFullInput.value = '';
  });

  importVoiceInput.addEventListener('change', async () => {
    const file = importVoiceInput.files?.[0];
    if (!file) return;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const res = await importVoicePack(bytes, state.appId, audioStore, importMode);
      onMessage(`Imported voice pack (${res.audioImported} audio clips).`);
      onRefresh();
    } catch (err) {
      onMessage(`Voice pack import failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    importVoiceInput.value = '';
  });

  const lastBackupText = state.lastBackupAt
    ? `Last backup: ${new Date(state.lastBackupAt).toLocaleDateString()}`
    : 'No backup exported yet.';

  return h(
    'div',
    { className: 'wc-settings-grid' },
    h(
      'div',
      { className: 'wc-card' },
      h('h3', null, 'Learning & Display'),
      h('label', { className: 'wc-field' }, h('span', null, 'Child Name'), nameInput),
      h('label', { className: 'wc-field' }, h('span', null, 'Session Minutes'), minutesInput),
      h('label', { className: 'wc-field' }, h('span', null, 'New Words Per Session'), newPerSessionInput),
      h('label', { className: 'wc-field' }, h('span', null, 'Parent PIN (optional)'), pinInput),
      toggleRow('Animations enabled', s.animationsEnabled, (v) => updateSetting('animationsEnabled', v)),
      toggleRow('Sound enabled', s.soundEnabled, (v) => updateSetting('soundEnabled', v)),
      toggleRow('Extra practice modes enabled', s.extraPracticeEnabled, (v) =>
        updateSetting('extraPracticeEnabled', v),
      ),
      toggleRow('15-minute break reminder', s.breakReminderEnabled, (v) =>
        updateSetting('breakReminderEnabled', v),
      ),
      toggleRow('Show on-screen keyboard', s.showOnScreenKeyboard, (v) =>
        updateSetting('showOnScreenKeyboard', v),
      ),
    ),
    h(
      'div',
      { className: 'wc-card' },
      h('h3', null, 'Fallback Computer Voice (TTS)'),
      voiceSelect,
      h(
        'div',
        { className: 'wc-row-actions', style: { marginTop: '0.75rem' } },
        btn('Test Voice', () => {
          void speakText('Hello! Let us build the Word Castle together.', {
            voiceURI: store.getState().settings.ttsVoiceURI,
          });
        }),
      ),
      h('h3', { style: { marginTop: '1.5rem' } }, 'Group Unlock Override'),
      overrideSelect,
      h(
        'div',
        { className: 'wc-row-actions', style: { marginTop: '0.75rem' } },
        btn('Unlock Selected Group', () => {
          const gid = overrideSelect.value;
          if (!gid) return;
          store.update((prev) => ({
            ...prev,
            settings: {
              ...prev.settings,
              unlockedOverrides: Array.from(new Set([...prev.settings.unlockedOverrides, gid])),
            },
          }));
          onMessage(`Unlocked ${gid}.`);
        }),
      ),
    ),
    h(
      'div',
      { className: 'wc-card' },
      h('h3', null, 'Backup & Voice Packs'),
      h(
        'p',
        { className: 'wc-muted' },
        'Clearing browser data erases recordings and progress unless exported. Back up monthly!',
      ),
      h('p', null, lastBackupText),
      h(
        'div',
        { className: 'wc-row-actions', style: { flexWrap: 'wrap' } },
        btn(
          'Export Everything (.zip)',
          async () => {
            const bytes = await exportFullBackup(store.getState(), audioStore);
            const date = new Date().toISOString().slice(0, 10);
            downloadBlob(bytes, `word-castle-backup-${date}.zip`);
            store.update((prev) => ({ ...prev, lastBackupAt: Date.now() }));
            onMessage('Full backup exported.');
            onRefresh();
          },
          'primary',
        ),
        btn('Import Backup (Replace)', () => {
          importMode = 'replace';
          importFullInput.click();
        }),
        btn('Import Backup (Merge)', () => {
          importMode = 'merge';
          importFullInput.click();
        }),
        btn('Export Voice Pack Only', async () => {
          const st = store.getState();
          const bytes = await exportVoicePack(st.appId, st.schemaVersion, audioStore);
          const date = new Date().toISOString().slice(0, 10);
          downloadBlob(bytes, `word-castle-voices-${date}.zip`);
          onMessage('Voice pack exported.');
        }),
        btn('Import Voice Pack (Merge)', () => {
          importMode = 'merge';
          importVoiceInput.click();
        }),
      ),
      importFullInput,
      importVoiceInput,
    ),
    h(
      'div',
      { className: 'wc-card' },
      h('h3', null, 'Reset Progress'),
      h('p', { className: 'wc-muted' }, 'Resets learning progress (keeps voice recordings).'),
      btn('Reset Child Progress', () => {
        if (window.confirm('Are you sure you want to reset all learning progress?')) {
          store.reset(true);
          onMessage('Progress reset.');
          onRefresh();
        }
      }),
    ),
  );
}
