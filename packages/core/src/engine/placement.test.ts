import { describe, expect, it } from 'vitest';
import {
  applyPlacementResults,
  createPlacementState,
  getCurrentPlacementItem,
  recordPlacementAnswer,
} from './placement.js';
import type { Item, LearningPack } from './types.js';

function makePlacementPack(numGroups = 10): LearningPack {
  const items: Item[] = [];
  const groupsInOrder: string[] = [];
  for (let g = 1; g <= numGroups; g++) {
    const gid = `g-${g}`;
    groupsInOrder.push(gid);
    for (let k = 0; k < 5; k++) {
      items.push({
        id: `${gid}-${k}`,
        groupId: gid,
        superGroupId: 'sg-1',
        order: (g - 1) * 5 + k,
        meta: {},
      });
    }
  }
  return {
    id: 'place-test',
    title: 'Place Test',
    items,
    unlockPolicy: { groupsInOrder, threshold: 0.8 },
    speedPolicy: { kind: 'none' },
    newPerSessionDefault: 4,
    sessionMinutesDefault: 10,
    exercise: {
      present: async () => ({ itemId: '', correct: true, independent: true, latencyMs: 100 }),
      teach: async () => {},
      correct: async () => {},
    },
    placementSampler: (all) => {
      const sampled: Item[] = [];
      for (const gid of groupsInOrder) {
        sampled.push(...all.filter((it) => it.groupId === gid).slice(0, 3));
      }
      return sampled;
    },
  };
}

const NOW = new Date(2026, 5, 10, 10, 0, 0).getTime();

describe('placement', () => {
  it('stops after two consecutive groups scoring < 2 of 3 and sets boxes correctly', () => {
    const pack = makePlacementPack(5);
    let p = createPlacementState(pack, 25);

    // Group 1: 3/3 independent -> known-ish (remaining items box 2, sampled box 3)
    for (let i = 0; i < 3; i++) {
      const item = getCurrentPlacementItem(p)!;
      p = recordPlacementAnswer(p, { itemId: item.id, correct: true, independent: true });
    }
    expect(p.finished).toBe(false);
    expect(p.currentGroupIndex).toBe(1);

    // Group 2: 1/3 independent (1 independent, 1 assisted, 1 wrong) -> consecutiveLow = 1
    let item = getCurrentPlacementItem(p)!;
    p = recordPlacementAnswer(p, { itemId: item.id, correct: true, independent: true });
    item = getCurrentPlacementItem(p)!;
    p = recordPlacementAnswer(p, { itemId: item.id, correct: true, independent: false });
    item = getCurrentPlacementItem(p)!;
    p = recordPlacementAnswer(p, { itemId: item.id, correct: false, independent: false });
    expect(p.finished).toBe(false);
    expect(p.consecutiveLowGroups).toBe(1);

    // Group 3: 0/3 -> consecutiveLow = 2 -> stops!
    for (let i = 0; i < 3; i++) {
      const it3 = getCurrentPlacementItem(p)!;
      p = recordPlacementAnswer(p, { itemId: it3.id, correct: false, independent: false });
    }
    expect(p.finished).toBe(true);

    const { states, placedCount } = applyPlacementResults(pack, {}, p, NOW);
    // Group 1 had 3 sampled (box 3) + 2 remaining (box 2) = 5
    // Group 2 had 1 independent (box 3) + 1 assisted (box 2) = 2
    expect(placedCount).toBe(7);
    expect(states['g-1-0']?.box).toBe(3);
    expect(states['g-1-4']?.box).toBe(2); // remaining item in known-ish group
    expect(states['g-2-0']?.box).toBe(3);
    expect(states['g-2-1']?.box).toBe(2);
    expect(states['g-2-2']).toBeUndefined(); // wrong -> untouched
  });

  it('stops immediately on skip and caps at maxQuestions', () => {
    const pack = makePlacementPack(10);
    let p = createPlacementState(pack, 25);
    p = recordPlacementAnswer(p, 'skipped');
    expect(p.finished).toBe(true);
    expect(getCurrentPlacementItem(p)).toBeNull();
  });
});
