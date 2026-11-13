import '../../../packages/core/src/theme/tokens.css';
import './theme-castle/styles.css';
import {
  AudioPlayer,
  AudioStore,
  LiveAnnouncer,
  requestPersistentStorage,
  setupInstallPrompt,
  StateStore,
} from '@word-castle/core';
import { spellingExercise } from './exercises/dictation.js';
import { createSpellingPack, type CustomWordStoreData } from './pack/pack.js';
import { renderExtraPracticeScreen } from './screens/extraPractice.js';
import { renderHomeScreen } from './screens/home.js';
import { renderMyCastleScreen } from './screens/myCastle.js';
import { renderOnboardingScreen } from './screens/onboarding.js';
import { renderParentArea } from './screens/parent/parentArea.js';
import { runPlayScreen, type SessionSummaryData } from './screens/play.js';
import { renderSummaryScreen } from './screens/summary.js';
import { createCastleTheme } from './theme-castle/castle.js';

function boot(): void {
  const root = document.getElementById('app');
  if (!root) return;

  void requestPersistentStorage();

  const store = new StateStore('word-castle');
  const audioStore = new AudioStore('word-castle-audio');
  const player = new AudioPlayer(audioStore, () => ({
    soundEnabled: store.getState().settings.soundEnabled,
    ttsVoiceURI: store.getState().settings.ttsVoiceURI,
  }));
  const announcer = new LiveAnnouncer(document.body);
  const theme = createCastleTheme();

  let pack = createSpellingPack(
    spellingExercise,
    store.getState().customData.spelling as CustomWordStoreData | undefined,
  );

  const rebuildPack = () => {
    pack = createSpellingPack(
      spellingExercise,
      store.getState().customData.spelling as CustomWordStoreData | undefined,
    );
  };

  let canInstall = false;
  const { triggerInstall } = setupInstallPrompt((available) => {
    canInstall = available;
  });

  const goHome = () => {
    if (!store.getState().onboardingDone) {
      renderOnboardingScreen(root, {
        store,
        pack,
        player,
        announce: (m) => announcer.announce(m),
        onComplete: goHome,
      });
      return;
    }

    renderHomeScreen(root, {
      store,
      pack,
      theme,
      player,
      handlers: {
        onStartSession: () => {
          void runPlayScreen(root, {
            store,
            pack,
            theme,
            player,
            announce: (m) => announcer.announce(m),
            onExit: goHome,
            onComplete: (summary: SessionSummaryData) => {
              renderSummaryScreen(root, {
                summary,
                store,
                pack,
                onHome: goHome,
                onMyCastle: goMyCastle,
              });
            },
          });
        },
        onMyCastle: goMyCastle,
        onExtraPractice: () => {
          renderExtraPracticeScreen(root, {
            store,
            pack,
            player,
            announce: (m) => announcer.announce(m),
            onCastleTour: goMyCastle,
            onBack: goHome,
          });
        },
        onParentArea: () => {
          renderParentArea(root, {
            store,
            pack,
            audioStore,
            player,
            onPackChanged: rebuildPack,
            onBack: goHome,
          });
        },
        canInstall,
        onInstall: () => void triggerInstall(),
      },
    });
  };

  const goMyCastle = () => {
    renderMyCastleScreen(root, {
      store,
      pack,
      theme,
      player,
      announce: (m) => announcer.announce(m),
      onBack: goHome,
    });
  };

  goHome();
}

boot();
