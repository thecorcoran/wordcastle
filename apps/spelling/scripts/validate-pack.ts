import { FRY_BASE_ITEMS } from '../src/pack/pack.js';

export function validateFryPack(): string[] {
  const errors: string[] = [];

  if (FRY_BASE_ITEMS.length !== 1000) {
    errors.push(`Expected 1000 items, got ${FRY_BASE_ITEMS.length}`);
  }

  const seenWords = new Set<string>();
  const seenIds = new Set<string>();

  for (const item of FRY_BASE_ITEMS) {
    if (seenIds.has(item.id)) {
      errors.push(`Duplicate item id: ${item.id}`);
    }
    seenIds.add(item.id);

    const wLower = item.meta.word.toLowerCase();
    if (seenWords.has(wLower)) {
      errors.push(`Duplicate word: ${item.meta.word} (${item.id})`);
    }
    seenWords.add(wLower);

    if (!item.meta.sentence || typeof item.meta.sentence !== 'string') {
      errors.push(`Missing sentence for ${item.id}`);
    } else {
      const escaped = item.meta.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(^|[^a-zA-Z'])${escaped}([^a-zA-Z']|$)`, 'i');
      if (!regex.test(item.meta.sentence)) {
        errors.push(`Sentence for "${item.meta.word}" (${item.id}) does not contain exact word form: "${item.meta.sentence}"`);
      }
    }

    if (!Array.isArray(item.meta.sounds) || item.meta.sounds.length === 0) {
      errors.push(`Missing sounds array for ${item.id}`);
    }

    if (!Array.isArray(item.meta.heartIndexes)) {
      errors.push(`Missing heartIndexes array for ${item.id}`);
    }

    if (item.order >= 100 && item.meta.needsReview !== true) {
      errors.push(`Item ${item.id} (index ${item.order}) must be flagged needsReview: true`);
    }
  }

  return errors;
}

const proc = (
  globalThis as unknown as {
    process?: { argv?: string[]; exit?: (code: number) => void };
  }
).process;

const isCli = Boolean(proc?.argv?.[1]?.endsWith('validate-pack.ts'));

if (isCli) {
  const errs = validateFryPack();
  if (errs.length > 0) {
    console.error(`Pack validation failed with ${errs.length} error(s):`);
    for (const e of errs.slice(0, 20)) {
      console.error(`  - ${e}`);
    }
    proc?.exit?.(1);
  }
  console.log(`Pack validation passed: ${FRY_BASE_ITEMS.length} unique Fry words verified.`);
}
