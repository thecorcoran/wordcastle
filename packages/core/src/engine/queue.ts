import { diffLocalDays, getIntervalDaysForBox, startOfLocalDay, toLocalDateString } from './scheduler.js';
import type {
  ActiveSession,
  Item,
  ItemStateMap,
  LearningPack,
  QueueEntry,
  Rng,
  SessionRecord,
} from './types.js';
import { getUnlockedGroups, isItemDue } from './unlock.js';

export interface BuildQueueOptions {
  now: number;
  rng: Rng;
  sessionMinutes?: number;
  newPerSession?: number;
  history?: SessionRecord[];
  unlockedOverrides?: string[];
  maxBox0To2ForNew?: number;
  maxOverdueForNew?: number;
}

export function computePaceEstimate(history: SessionRecord[], defaultPace = 5): number {
  if (history.length < 3) return defaultPace;
  const recent = history.slice(-5);
  let totalTrials = 0;
  let totalMinutes = 0;
  for (const s of recent) {
    if (s.durationMs > 10_000 && s.trials > 0) {
      totalTrials += s.trials;
      totalMinutes += s.durationMs / 60_000;
    }
  }
  if (totalMinutes <= 0) return defaultPace;
  const pace = Math.round(totalTrials / totalMinutes);
  return Math.max(2, Math.min(10, pace));
}

function shuffle<T>(arr: T[], rng: Rng): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = tmp;
  }
  return copy;
}

export function buildIncrementalRehearsalSequence(
  newItemId: string,
  knownItemIds: string[],
  rng: Rng,
): QueueEntry[] {
  if (knownItemIds.length === 0) {
    return [{ itemId: newItemId, kind: 'new', forceScaffold: true }];
  }
  const pickKnown = (idx: number): string => {
    const pool = shuffle(knownItemIds, rng);
    return pool[idx % pool.length]!;
  };

  // [new] -> [known] -> [new] -> [known, known] -> [new] -> [known x3] -> [new]
  return [
    { itemId: newItemId, kind: 'new', forceScaffold: true },
    { itemId: pickKnown(0), kind: 'rehearsal' },
    { itemId: newItemId, kind: 'rehearsal', forceScaffold: true },
    { itemId: pickKnown(1), kind: 'rehearsal' },
    { itemId: pickKnown(2), kind: 'rehearsal' },
    { itemId: newItemId, kind: 'rehearsal' },
    { itemId: pickKnown(3), kind: 'rehearsal' },
    { itemId: pickKnown(4), kind: 'rehearsal' },
    { itemId: pickKnown(5), kind: 'rehearsal' },
    { itemId: newItemId, kind: 'rehearsal' },
  ];
}

/**
 * Interleave queue entries so no item appears within `minGap` (3) positions of itself
 * (except corrections) and consecutive items from the same group are avoided where alternatives exist.
 */
export function interleaveQueue(
  entries: QueueEntry[],
  itemMap: Map<string, Item>,
  minGap = 3,
): QueueEntry[] {
  const remaining = [...entries];
  const result: QueueEntry[] = [];

  while (remaining.length > 0) {
    const lastEntry = result[result.length - 1];
    const lastGroup = lastEntry ? itemMap.get(lastEntry.itemId)?.groupId : undefined;

    const isItemAllowed = (idx: number): boolean => {
      const candidate = remaining[idx]!;
      for (let back = 1; back <= minGap; back++) {
        const prev = result[result.length - back];
        if (prev && prev.itemId === candidate.itemId) {
          return false;
        }
      }
      return true;
    };

    // Prefer: passes minGap AND different groupId
    let chosenIdx = remaining.findIndex((e, idx) => {
      if (!isItemAllowed(idx)) return false;
      const grp = itemMap.get(e.itemId)?.groupId;
      return lastGroup === undefined || grp !== lastGroup;
    });

    // Fallback 1: passes minGap (even if same groupId)
    if (chosenIdx === -1) {
      chosenIdx = remaining.findIndex((_, idx) => isItemAllowed(idx));
    }

    // Fallback 2: different groupId
    if (chosenIdx === -1 && lastGroup !== undefined) {
      chosenIdx = remaining.findIndex((e) => itemMap.get(e.itemId)?.groupId !== lastGroup);
    }

    // Fallback 3: take first available
    if (chosenIdx === -1) {
      chosenIdx = 0;
    }

    const [picked] = remaining.splice(chosenIdx, 1);
    if (picked) {
      result.push(picked);
    }
  }

  return result;
}

export function buildSessionQueue(
  pack: LearningPack,
  states: ItemStateMap,
  opts: BuildQueueOptions,
): QueueEntry[] {
  const {
    now,
    rng,
    sessionMinutes = pack.sessionMinutesDefault,
    newPerSession = pack.newPerSessionDefault,
    history = [],
    unlockedOverrides = [],
    maxBox0To2ForNew = 12,
    maxOverdueForNew = 15,
  } = opts;

  const pace = computePaceEstimate(history, 5);
  const targetLength = Math.max(6, Math.round(sessionMinutes * pace));
  const itemMap = new Map<string, Item>(pack.items.map((it) => [it.id, it]));
  const unlocked = getUnlockedGroups(pack, states, unlockedOverrides);

  const todayStart = startOfLocalDay(now);

  // Categorize existing items
  const box4Plus: Item[] = [];
  const box3Plus: Item[] = [];
  const dueItems: Array<{ item: Item; overdueRatio: number }> = [];
  let box0To2Count = 0;

  for (const item of pack.items) {
    const st = states[item.id];
    if (!st) continue;
    if (st.box <= 2) {
      box0To2Count++;
    }
    if (st.box >= 3) {
      box3Plus.push(item);
    }
    if (st.box >= 4) {
      box4Plus.push(item);
    }
    if (st.box >= 1 && isItemDue(st, now)) {
      const intervalDays = getIntervalDaysForBox(st.box);
      const overdueDays = Math.max(0, diffLocalDays(st.due, now));
      dueItems.push({ item, overdueRatio: overdueDays / intervalDays });
    }
  }

  dueItems.sort((a, b) => b.overdueRatio - a.overdueRatio);

  const usedInMain = new Set<string>();

  // 1. Warm-up: 2 items from box >= 4 (fallback to box >= 3 if not enough box >= 4)
  const warmupPool = shuffle(box4Plus.length >= 2 ? box4Plus : box3Plus, rng);
  const warmup: QueueEntry[] = warmupPool.slice(0, 2).map((it) => {
    usedInMain.add(it.id);
    return { itemId: it.id, kind: 'warmup' };
  });

  // 2. Due review: capped at 60% of target length
  const dueCap = Math.floor(targetLength * 0.6);
  const dueEntries: QueueEntry[] = [];
  for (const d of dueItems) {
    if (dueEntries.length >= dueCap) break;
    if (usedInMain.has(d.item.id)) continue;
    usedInMain.add(d.item.id);
    dueEntries.push({ itemId: d.item.id, kind: 'due' });
  }

  // 3. New items: up to newPerSession from unlocked groups, in order
  const newItems: Item[] = [];
  const canIntroduceNew =
    box0To2Count <= maxBox0To2ForNew && dueItems.length <= maxOverdueForNew && newPerSession > 0;

  if (canIntroduceNew) {
    const sortedItems = [...pack.items].sort((a, b) => a.order - b.order);
    for (const item of sortedItems) {
      if (newItems.length >= newPerSession) break;
      if (!unlocked.has(item.groupId)) continue;
      const st = states[item.id];
      if (st && st.taught) continue;

      // Check subject-specific conflicts (e.g., homophones)
      if (pack.areConflicting) {
        const conflicts = newItems.some((chosen) => pack.areConflicting!(chosen, item));
        if (conflicts) continue;
      }

      newItems.push(item);
    }
  }

  // 4. Incremental rehearsal for new items
  const knownIds = box3Plus.map((it) => it.id);
  const rehearsalEntries: QueueEntry[] = [];
  for (const newItem of newItems) {
    const seq = buildIncrementalRehearsalSequence(newItem.id, knownIds, rng);
    rehearsalEntries.push(...seq);
  }

  // Combine due + rehearsal and interleave
  const bodyRaw: QueueEntry[] = [...dueEntries, ...rehearsalEntries];

  // 8. Fill if too few items
  const currentTotal = warmup.length + bodyRaw.length;
  if (currentTotal < targetLength) {
    const needed = targetLength - currentTotal;
    const fill1To3 = shuffle(
      pack.items.filter((it) => {
        const st = states[it.id];
        return (
          st &&
          st.box >= 1 &&
          st.box <= 3 &&
          !usedInMain.has(it.id) &&
          startOfLocalDay(st.lastSeen) < todayStart
        );
      }),
      rng,
    );
    for (const it of fill1To3) {
      if (bodyRaw.length + warmup.length >= targetLength) break;
      usedInMain.add(it.id);
      bodyRaw.push({ itemId: it.id, kind: 'fill' });
    }

    if (bodyRaw.length + warmup.length < targetLength && needed > 0) {
      const fill4To5 = shuffle(
        pack.items.filter((it) => {
          const st = states[it.id];
          return (
            st &&
            st.box >= 4 &&
            !usedInMain.has(it.id) &&
            diffLocalDays(st.lastSeen, now) >= 7
          );
        }),
        rng,
      );
      for (const it of fill4To5) {
        if (bodyRaw.length + warmup.length >= targetLength) break;
        usedInMain.add(it.id);
        bodyRaw.push({ itemId: it.id, kind: 'fill' });
      }
    }
  }

  const interleavedBody = interleaveQueue(bodyRaw, itemMap, 3);

  // 7. Cool-down placeholder: 2 easy items from box >= 3 (will be replaced/updated with items gotten right in session)
  const cooldownPool = shuffle(box3Plus, rng);
  const cooldown: QueueEntry[] = cooldownPool.slice(0, 2).map((it) => ({
    itemId: it.id,
    kind: 'cooldown',
  }));

  return [...warmup, ...interleavedBody, ...cooldown];
}

export function createActiveSession(
  pack: LearningPack,
  states: ItemStateMap,
  opts: BuildQueueOptions,
): ActiveSession {
  const queue = buildSessionQueue(pack, states, opts);
  return {
    id: `session-${opts.now}-${Math.floor(opts.rng() * 10000)}`,
    date: toLocalDateString(opts.now),
    startedAt: opts.now,
    queue,
    index: 0,
    results: [],
    newIntroduced: [],
    correctInSession: [],
    recentCorrectness: [],
    activeMs: 0,
    completed: false,
    reaskCounts: {},
  };
}

/**
 * §4.2.1: After an incorrect trial, re-ask after 2–3 items, again after 5–7 items,
 * and once at the end of the session (before cooldown).
 */
export function scheduleIncorrectReasks(
  queue: QueueEntry[],
  currentIndex: number,
  itemId: string,
): QueueEntry[] {
  const next = [...queue];
  const insertAt = (offset: number, entry: QueueEntry) => {
    const pos = Math.min(next.length, currentIndex + 1 + offset);
    next.splice(pos, 0, entry);
  };

  insertAt(3, { itemId, kind: 'correction', forceScaffold: true });
  insertAt(7, { itemId, kind: 'correction', forceScaffold: false });

  // Before cooldown items at the end
  let endPos = next.length;
  while (endPos > currentIndex + 1 && next[endPos - 1]?.kind === 'cooldown') {
    endPos--;
  }
  next.splice(endPos, 0, { itemId, kind: 'correction', forceScaffold: false });
  return next;
}

/**
 * §4.2.3: After a correct-but-not-independent trial, retry once after 6–8 items.
 */
export function scheduleNotIndependentRetry(
  queue: QueueEntry[],
  currentIndex: number,
  itemId: string,
): QueueEntry[] {
  const next = [...queue];
  const pos = Math.min(next.length, currentIndex + 1 + 7);
  next.splice(pos, 0, { itemId, kind: 'retry' });
  return next;
}

/**
 * §4.3.6: Success guard: if accuracy over the last 8 trials < 70%,
 * insert two easy known items and stop introducing new items this session.
 */
export function applySuccessGuard(
  session: ActiveSession,
  pack: LearningPack,
  states: ItemStateMap,
  rng: Rng,
): ActiveSession {
  const last8 = session.recentCorrectness.slice(-8);
  if (last8.length < 8) return session;
  const correctCount = last8.filter(Boolean).length;
  if (correctCount / 8 >= 0.7) return session;

  // Remove un-introduced 'new' items and their 'rehearsal' entries
  const introducedSet = new Set(session.newIntroduced);
  const filteredTail = session.queue.slice(session.index + 1).filter((entry) => {
    if (entry.kind === 'new' && !introducedSet.has(entry.itemId)) return false;
    if (entry.kind === 'rehearsal' && !introducedSet.has(entry.itemId)) {
      const st = states[entry.itemId];
      if (!st || !st.taught) return false;
    }
    return true;
  });

  const easyItems = shuffle(
    pack.items.filter((it) => {
      const st = states[it.id];
      return st && st.box >= 3;
    }),
    rng,
  ).slice(0, 2);

  const easyEntries: QueueEntry[] = easyItems.map((it) => ({
    itemId: it.id,
    kind: 'warmup',
  }));

  return {
    ...session,
    queue: [
      ...session.queue.slice(0, session.index + 1),
      ...easyEntries,
      ...filteredTail,
    ],
  };
}
