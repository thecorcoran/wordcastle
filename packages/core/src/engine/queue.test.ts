import { describe, expect, it } from 'vitest';
import {
  applySuccessGuard,
  buildIncrementalRehearsalSequence,
  buildSessionQueue,
  createActiveSession,
} from './queue.js';
import { createInitialItemState, createSeededRng } from './scheduler.js';
import type { Item, ItemStateMap, LearningPack } from './types.js';

function makeTestPack(count = 40): LearningPack {
  const items: Item[] = [];
  for (let i = 0; i < count; i++) {
    const groupIdx = Math.floor(i / 10) + 1;
    items.push({
      id: `item-${i}`,
      groupId: `g-${groupIdx}`,
      superGroupId: 'sg-1',
      order: i,
      meta: { word: `word${i}` },
    });
  }
  return {
    id: 'test-pack',
    title: 'Test',
    items,
    unlockPolicy: { groupsInOrder: ['g-1', 'g-2', 'g-3', 'g-4'], threshold: 0.8 },
    speedPolicy: { kind: 'none' },
    newPerSessionDefault: 4,
    sessionMinutesDefault: 10,
    exercise: {
      present: async () => ({ itemId: '', correct: true, independent: true, latencyMs: 100 }),
      teach: async () => {},
      correct: async () => {},
    },
    placementSampler: (all) => all.slice(0, 3),
    areConflicting: (a, b) => a.id === 'item-0' && b.id === 'item-1',
  };
}

const NOW = new Date(2026, 5, 10, 10, 0, 0).getTime();

describe('queue', () => {
  it('is deterministic with seeded RNG and separates conflicting items', () => {
    const pack = makeTestPack(40);
    const states: ItemStateMap = {};
    const q1 = buildSessionQueue(pack, states, { now: NOW, rng: createSeededRng(123) });
    const q2 = buildSessionQueue(pack, states, { now: NOW, rng: createSeededRng(123) });
    expect(q1).toEqual(q2);

    const newIds = q1.filter((e) => e.kind === 'new').map((e) => e.itemId);
    expect(newIds).toContain('item-0');
    expect(newIds).not.toContain('item-1'); // conflicting with item-0
  });

  it('includes warmup, cooldown, and avoids same item within 3 positions when alternatives exist', () => {
    const pack = makeTestPack(40);
    const states: ItemStateMap = {};
    // Make items 0..9 known (box 4), items 10..15 due (box 2)
    for (let i = 0; i < 10; i++) {
      const st = createInitialItemState(NOW - 10 * 86400000, 4, true);
      st.due = NOW + 5 * 86400000;
      states[`item-${i}`] = st;
    }
    for (let i = 10; i < 16; i++) {
      const st = createInitialItemState(NOW - 5 * 86400000, 2, true);
      st.due = NOW - 86400000;
      states[`item-${i}`] = st;
    }

    const q = buildSessionQueue(pack, states, { now: NOW, rng: createSeededRng(7) });
    expect(q.slice(0, 2).every((e) => e.kind === 'warmup')).toBe(true);
    expect(q.slice(-2).every((e) => e.kind === 'cooldown')).toBe(true);

    // Check body spacing (between warmup and cooldown)
    const body = q.slice(2, -2);
    for (let i = 0; i < body.length; i++) {
      for (let j = i + 1; j <= i + 3 && j < body.length; j++) {
        if (body[i]!.kind !== 'correction' && body[j]!.kind !== 'correction') {
          expect(body[i]!.itemId).not.toBe(body[j]!.itemId);
        }
      }
    }
  });

  it('blocks new items when overdue backlog > 15', () => {
    const pack = makeTestPack(40);
    const states: ItemStateMap = {};
    for (let i = 0; i < 16; i++) {
      const st = createInitialItemState(NOW - 5 * 86400000, 3, true);
      st.due = NOW - 86400000;
      states[`item-${i}`] = st;
    }
    const q = buildSessionQueue(pack, states, { now: NOW, rng: createSeededRng(5) });
    expect(q.some((e) => e.kind === 'new')).toBe(false);
  });

  it('generates incremental rehearsal pattern [new, known, new, known, known, new, known x3, new]', () => {
    const seq = buildIncrementalRehearsalSequence('new-1', ['k1', 'k2', 'k3', 'k4'], createSeededRng(1));
    expect(seq.map((s) => (s.itemId === 'new-1' ? 'N' : 'K'))).toEqual([
      'N',
      'K',
      'N',
      'K',
      'K',
      'N',
      'K',
      'K',
      'K',
      'N',
    ]);
  });

  it('triggers success guard when last 8 trials < 70% accuracy', () => {
    const pack = makeTestPack(30);
    const states: ItemStateMap = {};
    for (let i = 0; i < 5; i++) {
      states[`item-${i}`] = createInitialItemState(NOW, 4, true);
    }
    const session = createActiveSession(pack, states, { now: NOW, rng: createSeededRng(2) });
    session.recentCorrectness = [true, false, false, true, false, true, false, false]; // 3/8 = 37.5%
    const guarded = applySuccessGuard(session, pack, states, createSeededRng(2));
    // Inserted 2 warmup items right after current index
    expect(guarded.queue[session.index + 1]?.kind).toBe('warmup');
    expect(guarded.queue[session.index + 2]?.kind).toBe('warmup');
    // No un-introduced 'new' items remain
    expect(guarded.queue.slice(session.index + 1).some((e) => e.kind === 'new')).toBe(false);
  });
});
