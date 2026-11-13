import { describe, expect, it } from 'vitest';
import { createInitialItemState } from './scheduler.js';
import type { Item, ItemStateMap, LearningPack } from './types.js';
import { computeProgressView, getUnlockedGroups } from './unlock.js';

function makeUnlockPack(): LearningPack {
  const items: Item[] = [];
  for (let g = 1; g <= 3; g++) {
    for (let i = 0; i < 5; i++) {
      items.push({
        id: `g${g}-${i}`,
        groupId: `g${g}`,
        superGroupId: 'sg1',
        order: (g - 1) * 5 + i,
        meta: {},
      });
    }
  }
  return {
    id: 'unlock-test',
    title: 'Unlock',
    items,
    unlockPolicy: { groupsInOrder: ['g1', 'g2', 'g3'], threshold: 0.8 },
    speedPolicy: { kind: 'none' },
    newPerSessionDefault: 4,
    sessionMinutesDefault: 10,
    exercise: {
      present: async () => ({ itemId: '', correct: true, independent: true, latencyMs: 100 }),
      teach: async () => {},
      correct: async () => {},
    },
    placementSampler: (all) => all.slice(0, 3),
  };
}

const NOW = new Date(2026, 5, 10, 10, 0, 0).getTime();

describe('unlock', () => {
  it('unlocks next group at >= 80% in box >= 3 and supports parent override', () => {
    const pack = makeUnlockPack();
    const states: ItemStateMap = {};
    expect([...getUnlockedGroups(pack, states)]).toEqual(['g1']);

    // 3 of 5 = 60% -> g2 still locked
    for (let i = 0; i < 3; i++) {
      states[`g1-${i}`] = createInitialItemState(NOW, 3, true);
    }
    expect(getUnlockedGroups(pack, states).has('g2')).toBe(false);

    // 4 of 5 = 80% -> g2 unlocks!
    states['g1-3'] = createInitialItemState(NOW, 4, true);
    expect(getUnlockedGroups(pack, states).has('g2')).toBe(true);
    expect(getUnlockedGroups(pack, states).has('g3')).toBe(false);

    // Parent override unlocks g3
    expect(getUnlockedGroups(pack, states, ['g3']).has('g3')).toBe(true);
  });

  it('computes ProgressView accurately', () => {
    const pack = makeUnlockPack();
    const states: ItemStateMap = {
      'g1-0': createInitialItemState(NOW, 5, true),
      'g1-1': createInitialItemState(NOW, 3, true),
    };
    states['g1-0']!.due = NOW + 86400000;
    states['g1-1']!.due = NOW - 86400000; // due!

    const view = computeProgressView(pack, states, NOW, [], 4);
    expect(view.totalItems).toBe(15);
    expect(view.masteredCount).toBe(1);
    expect(view.inProgressCount).toBe(1);
    expect(view.unseenCount).toBe(13);
    expect(view.dueCount).toBe(1);
    expect(view.streakDays).toBe(4);
  });
});
