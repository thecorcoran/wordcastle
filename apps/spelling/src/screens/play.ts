import {
  applySuccessGuard,
  applyTrialResult,
  btn,
  clearEl,
  createActiveSession,
  createSeededRng,
  diffLocalDays,
  h,
  renderProgressBar,
  scheduleIncorrectReasks,
  scheduleNotIndependentRetry,
  toLocalDateString,
  type ActiveSession,
  type AudioPlayer,
  type ExerciseContext,
  type LearningPack,
  type SessionRecord,
  type StateStore,
  type Theme,
} from '@word-castle/core';
import type { WordMeta } from '../pack/fry/first100.js';

export interface SessionSummaryData {
  record: SessionRecord;
  stonesGrew: number;
  roomsFinished: string[];
}

export async function runPlayScreen(
  root: HTMLElement,
  opts: {
    store: StateStore;
    pack: LearningPack;
    theme: Theme;
    player: AudioPlayer;
    announce: (msg: string) => void;
    onExit: () => void;
    onComplete: (summary: SessionSummaryData) => void;
  },
): Promise<void> {
  const { store, pack, theme, player, announce, onExit, onComplete } = opts;
  const now = Date.now();
  const rng = createSeededRng(now);
  const state = store.getState();

  let session: ActiveSession =
    state.activeSession && !state.activeSession.completed
      ? state.activeSession
      : createActiveSession(pack, state.items, {
          now,
          rng,
          sessionMinutes: state.settings.sessionMinutes,
          newPerSession: state.settings.newPerSession,
          history: state.history,
          unlockedOverrides: state.settings.unlockedOverrides,
        });

  store.update((prev) => ({ ...prev, activeSession: session }));

  const itemMap = new Map(pack.items.map((it) => [it.id, it]));
  let exited = false;
  let stonesGrew = 0;
  let breakDismissed = false;
  const sessionStartWall = Date.now();

  const completedGroupsBefore = new Set(
    pack.unlockPolicy.groupsInOrder.filter((gid) => {
      const inG = pack.items.filter((i) => i.groupId === gid);
      return inG.length > 0 && inG.every((i) => (state.items[i.id]?.box ?? 0) >= 3);
    }),
  );

  while (!exited && session.index < session.queue.length) {
    const entry = session.queue[session.index]!;
    const item = itemMap.get(entry.itemId);
    if (!item) {
      session.index++;
      continue;
    }

    clearEl(root);

    // 15-minute daily break reminder
    const today = toLocalDateString(Date.now());
    const storedDaily = store.getState().dailyMinutes;
    const prevMinutes = storedDaily.date === today ? storedDaily.minutes : 0;
    const elapsedMin = (Date.now() - sessionStartWall) / 60_000;
    const showBreak =
      store.getState().settings.breakReminderEnabled &&
      !breakDismissed &&
      prevMinutes + elapsedMin >= 15;

    const topBar = h(
      'div',
      { className: 'wc-row-actions', style: { justifyContent: 'space-between', marginBottom: '1rem' } },
      h(
        'div',
        { style: { flex: '1' } },
        renderProgressBar(
          session.index,
          session.queue.length,
          `${session.index + 1} of ${session.queue.length}`,
        ),
      ),
      btn(
        'Save and exit',
        () => {
          exited = true;
          player.stop();
          store.update((prev) => ({ ...prev, activeSession: session }));
          onExit();
        },
        'ghost',
      ),
    );

    const breakBanner = showBreak
      ? h(
          'div',
          {
            className: 'wc-card',
            style: { marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
          },
          h('span', null, 'You have been building for 15 minutes — a short break is always great!'),
          btn('Keep going', () => {
            breakDismissed = true;
            breakBanner?.remove();
          }, 'ghost'),
        )
      : null;

    const exerciseRoot = h('div');
    root.appendChild(topBar);
    if (breakBanner) root.appendChild(breakBanner);
    root.appendChild(exerciseRoot);

    const currentItemState = store.getState().items[item.id] ?? null;
    const ctx: ExerciseContext = {
      root: exerciseRoot,
      itemState: currentItemState,
      forceScaffold: entry.forceScaffold || entry.kind === 'new',
      showOnScreenKeyboard: store.getState().settings.showOnScreenKeyboard,
      playAudio: (id, kind, tts) =>
        player.play(id, kind, tts ?? (item.meta as unknown as WordMeta).word),
      hasAudio: (id, kind) => player.hasRecording(id, kind),
      announce,
    };

    // Teach new item if not yet taught
    if (entry.kind === 'new' && (!currentItemState || !currentItemState.taught)) {
      await pack.exercise.teach(item, ctx);
      if (exited) return;
      if (!session.newIntroduced.includes(item.id)) {
        session.newIntroduced.push(item.id);
      }
      // Mark taught immediately
      store.update((prev) => ({
        ...prev,
        items: {
          ...prev.items,
          [item.id]: prev.items[item.id]
            ? { ...prev.items[item.id]!, taught: true }
            : {
                box: 0,
                attempts: 0,
                correct: 0,
                independentCorrectDays: [],
                recent: [],
                lastSeen: 0,
                due: Date.now(),
                lastWrong: 0,
                taught: true,
              },
        },
      }));
    }

    const trial = await pack.exercise.present(item, ctx);
    if (exited) return;

    const prevBox = store.getState().items[item.id]?.box ?? 0;
    const isReask = (session.reaskCounts[item.id] ?? 0) > 0;
    const updatedItemState = applyTrialResult(store.getState().items[item.id] ?? null, trial, {
      now: Date.now(),
      rng,
      speedPolicy: pack.speedPolicy,
      isReaskInSession: isReask,
    });

    if (updatedItemState.box > prevBox) {
      stonesGrew++;
      if (store.getState().settings.animationsEnabled) {
        theme.onItemAdvance(item, prevBox, updatedItemState.box, exerciseRoot);
      }
    }

    session.results.push(trial);
    session.recentCorrectness.push(trial.correct);
    if (trial.latencyMs !== null) {
      session.activeMs += trial.latencyMs;
    }

    if (trial.correct) {
      if (!session.correctInSession.includes(item.id)) {
        session.correctInSession.push(item.id);
      }
      if (!trial.independent) {
        session.queue = scheduleNotIndependentRetry(session.queue, session.index, item.id);
      }
    } else {
      session.reaskCounts[item.id] = (session.reaskCounts[item.id] ?? 0) + 1;
      await pack.exercise.correct(item, trial, ctx);
      if (exited) return;
      session.queue = scheduleIncorrectReasks(session.queue, session.index, item.id);
    }

    // Apply success guard
    session = applySuccessGuard(session, pack, store.getState().items, rng);

    // Update cooldown items at the end with items gotten right in session
    if (session.correctInSession.length >= 2) {
      const len = session.queue.length;
      if (len >= 2 && session.queue[len - 1]?.kind === 'cooldown' && session.queue[len - 2]?.kind === 'cooldown') {
        session.queue[len - 2] = { itemId: session.correctInSession[0]!, kind: 'cooldown' };
        session.queue[len - 1] = { itemId: session.correctInSession[1]!, kind: 'cooldown' };
      }
    }

    session.index++;

    store.update((prev) => ({
      ...prev,
      items: { ...prev.items, [item.id]: updatedItemState },
      activeSession: session,
    }));
  }

  if (exited) return;

  // Session complete!
  const endNow = Date.now();
  const todayStr = toLocalDateString(endNow);
  const errors: Array<{ itemId: string; tag: string }> = [];
  for (const r of session.results) {
    if (!r.correct && typeof r.detail === 'object' && r.detail !== null && 'tag' in r.detail) {
      errors.push({ itemId: r.itemId, tag: String((r.detail as { tag: unknown }).tag) });
    }
  }

  const record: SessionRecord = {
    id: session.id,
    date: todayStr,
    startedAt: session.startedAt,
    endedAt: endNow,
    durationMs: Math.max(1000, endNow - session.startedAt),
    trials: session.results.length,
    correctCount: session.results.filter((r) => r.correct).length,
    newWords: session.newIntroduced,
    errors,
  };

  const finalState = store.getState();
  const roomsFinished: string[] = [];
  for (const gid of pack.unlockPolicy.groupsInOrder) {
    if (completedGroupsBefore.has(gid)) continue;
    const inG = pack.items.filter((i) => i.groupId === gid);
    if (inG.length > 0 && inG.every((i) => (finalState.items[i.id]?.box ?? 0) >= 3)) {
      roomsFinished.push(gid);
    }
  }

  // Update streak
  let nextStreak = finalState.streakDays;
  if (!finalState.lastPracticedDate) {
    nextStreak = 1;
  } else if (finalState.lastPracticedDate !== todayStr) {
    const prevTs = new Date(finalState.lastPracticedDate + 'T12:00:00').getTime();
    const diff = diffLocalDays(prevTs, endNow);
    nextStreak = diff === 1 ? finalState.streakDays + 1 : 1;
  }

  const sessionMin = Math.round(record.durationMs / 60_000);
  const prevDailyMin = finalState.dailyMinutes.date === todayStr ? finalState.dailyMinutes.minutes : 0;

  store.update((prev) => ({
    ...prev,
    activeSession: null,
    history: [...prev.history, record],
    streakDays: nextStreak,
    lastPracticedDate: todayStr,
    dailyMinutes: { date: todayStr, minutes: prevDailyMin + Math.max(1, sessionMin) },
  }));

  onComplete({ record, stonesGrew, roomsFinished });
}
