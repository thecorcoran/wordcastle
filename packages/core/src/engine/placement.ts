import { addLocalDays, createInitialItemState } from './scheduler.js';
import type { Item, ItemStateMap, LearningPack, TrialResult } from './types.js';

export interface PlacementGroupResult {
  groupId: string;
  sampledIds: string[];
  independentCorrect: number;
  totalAsked: number;
}

export interface PlacementState {
  groupsInOrder: string[];
  groupSamples: Record<string, Item[]>;
  currentGroupIndex: number;
  currentItemIndex: number;
  questionsAsked: number;
  maxQuestions: number;
  consecutiveLowGroups: number;
  finished: boolean;
  results: Array<{ itemId: string; outcome: 'independent' | 'assisted' | 'wrong' | 'skipped' }>;
  groupStats: Record<string, { independentCorrect: number; asked: number }>;
}

export function createPlacementState(
  pack: LearningPack,
  maxQuestions = 25,
): PlacementState {
  const sampled = pack.placementSampler(pack.items);
  const groupSamples: Record<string, Item[]> = {};
  for (const gid of pack.unlockPolicy.groupsInOrder) {
    groupSamples[gid] = [];
  }
  for (const item of sampled) {
    const list = groupSamples[item.groupId];
    if (list) {
      list.push(item);
    } else {
      groupSamples[item.groupId] = [item];
    }
  }

  // Filter to groups that actually have samples
  const groupsInOrder = pack.unlockPolicy.groupsInOrder.filter(
    (gid) => (groupSamples[gid]?.length ?? 0) > 0,
  );

  return {
    groupsInOrder,
    groupSamples,
    currentGroupIndex: 0,
    currentItemIndex: 0,
    questionsAsked: 0,
    maxQuestions,
    consecutiveLowGroups: 0,
    finished: groupsInOrder.length === 0,
    results: [],
    groupStats: {},
  };
}

export function getCurrentPlacementItem(state: PlacementState): Item | null {
  if (state.finished) return null;
  const gid = state.groupsInOrder[state.currentGroupIndex];
  if (!gid) return null;
  const items = state.groupSamples[gid] ?? [];
  return items[state.currentItemIndex] ?? null;
}

export function recordPlacementAnswer(
  state: PlacementState,
  trial: Pick<TrialResult, 'itemId' | 'correct' | 'independent'> | 'skipped',
): PlacementState {
  if (state.finished) return state;

  const gid = state.groupsInOrder[state.currentGroupIndex];
  if (!gid) return { ...state, finished: true };

  const samples = state.groupSamples[gid] ?? [];
  const currentItem = samples[state.currentItemIndex];
  if (!currentItem) return { ...state, finished: true };

  const outcome: 'independent' | 'assisted' | 'wrong' | 'skipped' =
    trial === 'skipped'
      ? 'skipped'
      : trial.correct && trial.independent
        ? 'independent'
        : trial.correct
          ? 'assisted'
          : 'wrong';

  const prevStat = state.groupStats[gid] ?? { independentCorrect: 0, asked: 0 };
  const updatedStat = {
    independentCorrect: prevStat.independentCorrect + (outcome === 'independent' ? 1 : 0),
    asked: prevStat.asked + 1,
  };

  const nextResults = [...state.results, { itemId: currentItem.id, outcome }];
  const nextGroupStats = { ...state.groupStats, [gid]: updatedStat };
  const questionsAsked = state.questionsAsked + 1;

  if (trial === 'skipped') {
    return {
      ...state,
      questionsAsked,
      results: nextResults,
      groupStats: nextGroupStats,
      finished: true,
    };
  }

  // Check if we reached maxQuestions
  if (questionsAsked >= state.maxQuestions) {
    return {
      ...state,
      questionsAsked,
      results: nextResults,
      groupStats: nextGroupStats,
      finished: true,
    };
  }

  // More items in current group?
  if (state.currentItemIndex + 1 < samples.length) {
    return {
      ...state,
      questionsAsked,
      currentItemIndex: state.currentItemIndex + 1,
      results: nextResults,
      groupStats: nextGroupStats,
    };
  }

  // End of current group: evaluate >= 2 of 3 independent
  const passedGroup = updatedStat.independentCorrect >= 2;
  const consecutiveLowGroups = passedGroup ? 0 : state.consecutiveLowGroups + 1;

  if (consecutiveLowGroups >= 2 || state.currentGroupIndex + 1 >= state.groupsInOrder.length) {
    return {
      ...state,
      questionsAsked,
      consecutiveLowGroups,
      results: nextResults,
      groupStats: nextGroupStats,
      finished: true,
    };
  }

  return {
    ...state,
    questionsAsked,
    currentGroupIndex: state.currentGroupIndex + 1,
    currentItemIndex: 0,
    consecutiveLowGroups,
    results: nextResults,
    groupStats: nextGroupStats,
  };
}

export function applyPlacementResults(
  pack: LearningPack,
  prevStates: ItemStateMap,
  placement: PlacementState,
  now: number,
): { states: ItemStateMap; placedCount: number } {
  const states: ItemStateMap = { ...prevStates };
  const nextDay = addLocalDays(now, 1);
  let placedCount = 0;

  for (const r of placement.results) {
    if (r.outcome === 'independent') {
      const st = createInitialItemState(now, 3, true);
      st.due = addLocalDays(now, 3);
      st.lastSeen = now;
      st.attempts = 1;
      st.correct = 1;
      states[r.itemId] = st;
      placedCount++;
    } else if (r.outcome === 'assisted') {
      const st = createInitialItemState(now, 2, true);
      st.due = nextDay;
      st.lastSeen = now;
      st.attempts = 1;
      st.correct = 1;
      states[r.itemId] = st;
      placedCount++;
    }
    // wrong / skipped -> untouched
  }

  // Groups where she scored >= 80% are marked known-ish: remaining items start in box 2
  for (const [gid, stat] of Object.entries(placement.groupStats)) {
    if (stat.asked > 0 && stat.independentCorrect / stat.asked >= 0.8) {
      for (const item of pack.items) {
        if (item.groupId === gid && !states[item.id]) {
          const st = createInitialItemState(now, 2, true);
          st.due = nextDay;
          states[item.id] = st;
          placedCount++;
        }
      }
    }
  }

  return { states, placedCount };
}
