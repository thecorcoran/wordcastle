import type { Item, LearningPack, Exercise } from '@word-castle/core';
import { FIRST_100_META, type WordMeta } from './fry/first100.js';
import { buildRemaining900Meta } from './fry/remaining900.js';

export interface WordItem extends Item {
  meta: WordMeta & Record<string, unknown>;
}

export interface CustomWordStoreData {
  wordEdits?: Record<string, Partial<WordMeta>>;
  customWords?: Array<{ id: string; word: string; sentence: string; sounds?: WordMeta['sounds']; heartIndexes?: number[] }>;
}

function pad3(n: number): string {
  return String(n).padStart(3, '0');
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function buildFryItems(): WordItem[] {
  const first100Set = new Set(FIRST_100_META.map((m) => m.word.toLowerCase()));
  const remaining = buildRemaining900Meta(first100Set);
  const allMeta: WordMeta[] = [...FIRST_100_META, ...remaining];

  return allMeta.map((meta, idx) => {
    const setNum = Math.floor(idx / 25) + 1;
    const wingNum = Math.floor(idx / 100) + 1;
    const slug = meta.word.toLowerCase().replace(/[^a-z0-9']/g, '');
    return {
      id: `fry:${String(idx + 1).padStart(4, '0')}:${slug}`,
      groupId: `fry-set-${pad3(setNum)}`,
      superGroupId: `fry-wing-${pad2(wingNum)}`,
      order: idx,
      meta: { ...meta },
    };
  });
}

export const FRY_BASE_ITEMS: WordItem[] = buildFryItems();

export function applyCustomWordData(
  baseItems: WordItem[],
  customData?: CustomWordStoreData,
): WordItem[] {
  const edits = customData?.wordEdits ?? {};
  const result = baseItems.map((it) => {
    const patch = edits[it.id];
    if (!patch) return it;
    return {
      ...it,
      meta: {
        ...it.meta,
        ...patch,
      },
    };
  });

  const customWords = customData?.customWords ?? [];
  customWords.forEach((cw, idx) => {
    result.push({
      id: cw.id,
      groupId: 'family-words',
      superGroupId: 'fry-wing-01',
      order: baseItems.length + idx,
      meta: {
        word: cw.word,
        sentence: cw.sentence,
        sounds: cw.sounds ?? cw.word.split('').map((c) => ({ g: c, p: c.toLowerCase() })),
        heartIndexes: cw.heartIndexes ?? [],
        ttsText: cw.word,
        needsReview: false,
      },
    });
  });

  return result;
}

export function createSpellingPack(
  exercise: Exercise,
  customData?: CustomWordStoreData,
  extraPacks: WordItem[][] = [],
): LearningPack {
  const fryWithEdits = applyCustomWordData(FRY_BASE_ITEMS, customData);
  const items: WordItem[] = [...fryWithEdits, ...extraPacks.flat()];

  const groupsInOrder: string[] = [];
  const seenGroups = new Set<string>();
  for (const it of items) {
    if (!seenGroups.has(it.groupId)) {
      seenGroups.add(it.groupId);
      groupsInOrder.push(it.groupId);
    }
  }

  return {
    id: 'word-castle-spelling',
    title: 'Word Castle',
    items,
    unlockPolicy: {
      groupsInOrder,
      threshold: 0.8,
    },
    speedPolicy: { kind: 'none' },
    newPerSessionDefault: 4,
    sessionMinutesDefault: 10,
    exercise,
    placementSampler: (allItems) => {
      const sampled: Item[] = [];
      for (const gid of groupsInOrder) {
        if (gid === 'family-words') continue;
        const inGroup = allItems.filter((it) => it.groupId === gid);
        // Sample 3 items spread across the 25-word set
        if (inGroup[0]) sampled.push(inGroup[0]);
        if (inGroup[12]) sampled.push(inGroup[12]);
        if (inGroup[24]) sampled.push(inGroup[24]);
      }
      return sampled;
    },
    areConflicting: (a, b) => {
      const metaA = a.meta as unknown as WordMeta;
      const metaB = b.meta as unknown as WordMeta;
      const wordA = metaA.word.toLowerCase();
      const wordB = metaB.word.toLowerCase();
      if (metaA.homophones?.some((h) => h.toLowerCase() === wordB)) return true;
      if (metaB.homophones?.some((h) => h.toLowerCase() === wordA)) return true;
      return false;
    },
  };
}
