import type { Item, LearningPack, ProgressView, Theme } from '@word-castle/core';

/**
 * Minimal 20-line stub proving a second subject (multiplication facts with a garden theme)
 * plugs into @word-castle/core without any engine changes.
 */
export const mathItems: Item[] = [2, 3, 4, 5].flatMap((a, ai) =>
  [2, 3, 4, 5].map((b, bi) => ({
    id: `mult:${a}x${b}`,
    groupId: `times-${a}`,
    superGroupId: 'garden-bed-1',
    order: ai * 4 + bi,
    meta: { a, b, answer: a * b },
  })),
);

export const mathPack: LearningPack = {
  id: 'example-math',
  title: 'Fact Garden (Stub)',
  items: mathItems,
  unlockPolicy: { groupsInOrder: ['times-2', 'times-3', 'times-4', 'times-5'], threshold: 0.8 },
  speedPolicy: { kind: 'threshold', baseMs: 1200, perUnitMs: 400 },
  newPerSessionDefault: 3,
  sessionMinutesDefault: 8,
  exercise: {
    present: async (item) => ({ itemId: item.id, correct: true, independent: true, latencyMs: 1100 }),
    teach: async () => {},
    correct: async () => {},
  },
  placementSampler: (items) => items.filter((_, idx) => idx % 2 === 0).slice(0, 6),
};

export const gardenThemeStub: Theme = {
  id: 'garden-stub',
  renderHomePreview(root: HTMLElement, view: ProgressView) {
    root.textContent = `Garden: ${view.masteredCount} flowers bloomed`;
  },
  renderProgress(root: HTMLElement, view: ProgressView) {
    root.textContent = `Beds: ${view.groups.length}, Mastered: ${view.masteredCount}/${view.totalItems}`;
  },
  onItemAdvance() {},
};
