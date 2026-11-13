import { startOfLocalDay } from './scheduler.js';
import type {
  BoxLevel,
  GroupProgress,
  ItemProgressEntry,
  ItemStateMap,
  LearningPack,
  ProgressView,
  SessionRecord,
  SuperGroupProgress,
} from './types.js';

export function getUnlockedGroups(
  pack: LearningPack,
  states: ItemStateMap,
  unlockedOverrides: string[] = [],
): Set<string> {
  const unlocked = new Set<string>();
  const { groupsInOrder, threshold } = pack.unlockPolicy;
  if (groupsInOrder.length === 0) return unlocked;

  const overrideSet = new Set(unlockedOverrides);
  const itemsByGroup = new Map<string, string[]>();
  for (const item of pack.items) {
    const list = itemsByGroup.get(item.groupId);
    if (list) {
      list.push(item.id);
    } else {
      itemsByGroup.set(item.groupId, [item.id]);
    }
  }

  // First group is always unlocked
  const firstGroup = groupsInOrder[0];
  if (firstGroup) {
    unlocked.add(firstGroup);
  }

  for (let i = 1; i < groupsInOrder.length; i++) {
    const prevGroupId = groupsInOrder[i - 1]!;
    const currGroupId = groupsInOrder[i]!;

    if (overrideSet.has(currGroupId)) {
      unlocked.add(currGroupId);
      continue;
    }

    if (!unlocked.has(prevGroupId)) {
      continue;
    }

    const prevItems = itemsByGroup.get(prevGroupId) ?? [];
    if (prevItems.length === 0) {
      unlocked.add(currGroupId);
      continue;
    }

    let box3PlusCount = 0;
    for (const id of prevItems) {
      const st = states[id];
      if (st && st.box >= 3) {
        box3PlusCount++;
      }
    }

    if (box3PlusCount / prevItems.length >= threshold) {
      unlocked.add(currGroupId);
    }
  }

  // Also include any overrides not in groupsInOrder (e.g. custom family words)
  for (const id of overrideSet) {
    unlocked.add(id);
  }

  return unlocked;
}

export function isItemDue(state: ItemStateMap[string] | undefined, now: number): boolean {
  if (!state) return false;
  if (state.box === 0 && !state.taught) return false;
  return startOfLocalDay(state.due) <= startOfLocalDay(now);
}

function emptyBoxCounts(): Record<BoxLevel | 'unseen', number> {
  return {
    unseen: 0,
    0: 0,
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };
}

export function computeProgressView(
  pack: LearningPack,
  states: ItemStateMap,
  now: number,
  history: SessionRecord[] = [],
  streakDays = 0,
  unlockedOverrides: string[] = [],
): ProgressView {
  const unlockedSet = getUnlockedGroups(pack, states, unlockedOverrides);

  let masteredCount = 0;
  let inProgressCount = 0;
  let unseenCount = 0;
  let dueCount = 0;

  const groupMap = new Map<
    string,
    {
      superGroupId: string;
      total: number;
      byBox: Record<BoxLevel | 'unseen', number>;
      dueCount: number;
    }
  >();

  const superGroupMap = new Map<
    string,
    {
      total: number;
      byBox: Record<BoxLevel | 'unseen', number>;
      groupIds: Set<string>;
    }
  >();

  const itemEntries: ItemProgressEntry[] = [];

  for (const item of pack.items) {
    const st = states[item.id] ?? null;
    const due = st ? isItemDue(st, now) : false;

    if (!st) {
      unseenCount++;
    } else if (st.box === 5) {
      masteredCount++;
    } else {
      inProgressCount++;
    }

    if (due) {
      dueCount++;
    }

    itemEntries.push({ item, state: st, isDue: due });

    let grp = groupMap.get(item.groupId);
    if (!grp) {
      grp = {
        superGroupId: item.superGroupId,
        total: 0,
        byBox: emptyBoxCounts(),
        dueCount: 0,
      };
      groupMap.set(item.groupId, grp);
    }
    grp.total++;
    if (!st) {
      grp.byBox.unseen++;
    } else {
      grp.byBox[st.box]++;
    }
    if (due) grp.dueCount++;

    let sgrp = superGroupMap.get(item.superGroupId);
    if (!sgrp) {
      sgrp = {
        total: 0,
        byBox: emptyBoxCounts(),
        groupIds: new Set(),
      };
      superGroupMap.set(item.superGroupId, sgrp);
    }
    sgrp.total++;
    sgrp.groupIds.add(item.groupId);
    if (!st) {
      sgrp.byBox.unseen++;
    } else {
      sgrp.byBox[st.box]++;
    }
  }

  const groups: GroupProgress[] = [];
  for (const [groupId, data] of groupMap.entries()) {
    const box3Plus = data.byBox[3] + data.byBox[4] + data.byBox[5];
    groups.push({
      groupId,
      superGroupId: data.superGroupId,
      total: data.total,
      byBox: data.byBox,
      dueCount: data.dueCount,
      unlocked: unlockedSet.has(groupId),
      completed: data.total > 0 && box3Plus === data.total,
    });
  }

  const superGroups: SuperGroupProgress[] = [];
  for (const [superGroupId, data] of superGroupMap.entries()) {
    const box3Plus = data.byBox[3] + data.byBox[4] + data.byBox[5];
    let anyUnlocked = false;
    for (const gid of data.groupIds) {
      if (unlockedSet.has(gid)) {
        anyUnlocked = true;
        break;
      }
    }
    superGroups.push({
      superGroupId,
      total: data.total,
      byBox: data.byBox,
      completed: data.total > 0 && box3Plus === data.total,
      unlocked: anyUnlocked,
    });
  }

  return {
    totalItems: pack.items.length,
    masteredCount,
    inProgressCount,
    unseenCount,
    dueCount,
    streakDays,
    groups,
    superGroups,
    items: itemEntries,
    history,
  };
}
