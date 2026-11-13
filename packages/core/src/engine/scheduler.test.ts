import { describe, expect, it } from 'vitest';
import {
  addLocalDays,
  applyJitterDays,
  applyTrialResult,
  createInitialItemState,
  createSeededRng,
  diffLocalDays,
  toLocalDateString,
} from './scheduler.js';
import type { SpeedPolicy } from './types.js';

const DAY_MS = 86_400_000;
const BASE_TS = new Date(2026, 5, 10, 10, 0, 0).getTime(); // June 10, 2026 10:00 local

describe('scheduler', () => {
  it('handles incorrect transitions for all boxes', () => {
    const rng = createSeededRng(1);
    for (const startBox of [0, 1, 2, 3, 4, 5] as const) {
      const st = createInitialItemState(BASE_TS, startBox, true);
      const next = applyTrialResult(
        st,
        { itemId: 'w1', correct: false, independent: true, latencyMs: 1200 },
        { now: BASE_TS, rng },
      );
      if (startBox <= 1) expect(next.box).toBe(0);
      else if (startBox === 2) expect(next.box).toBe(1);
      else expect(next.box).toBe(2);
      expect(next.lastWrong).toBe(BASE_TS);
      expect(next.due).toBe(BASE_TS);
    }
  });

  it('promotes on correct independent trial and respects 3-day mastery rule', () => {
    const rng = createSeededRng(42);
    let st = createInitialItemState(BASE_TS, 0, true);

    // Day 1: box 0 -> 1
    st = applyTrialResult(
      st,
      { itemId: 'w1', correct: true, independent: true, latencyMs: 1000 },
      { now: BASE_TS, rng },
    );
    expect(st.box).toBe(1);
    expect(st.independentCorrectDays).toHaveLength(1);

    // Day 2: box 1 -> 2
    const day2 = BASE_TS + DAY_MS;
    st = applyTrialResult(
      st,
      { itemId: 'w1', correct: true, independent: true, latencyMs: 1000 },
      { now: day2, rng },
    );
    expect(st.box).toBe(2);
    expect(st.independentCorrectDays).toHaveLength(2);

    // Same day 2: box 2 -> 3 -> 4, still only 2 unique days
    st = applyTrialResult(
      st,
      { itemId: 'w1', correct: true, independent: true, latencyMs: 1000 },
      { now: day2 + 1000, rng },
    );
    expect(st.box).toBe(3);

    st = applyTrialResult(
      st,
      { itemId: 'w1', correct: true, independent: true, latencyMs: 1000 },
      { now: day2 + 2000, rng },
    );
    expect(st.box).toBe(4);
    expect(st.independentCorrectDays).toHaveLength(2);

    // Still on day 2: trying to promote from 4 -> 5 is capped at 4!
    st = applyTrialResult(
      st,
      { itemId: 'w1', correct: true, independent: true, latencyMs: 1000 },
      { now: day2 + 3000, rng },
    );
    expect(st.box).toBe(4);

    // Day 3: now has 3 different local days, promotes to box 5!
    const day3 = BASE_TS + 2 * DAY_MS;
    st = applyTrialResult(
      st,
      { itemId: 'w1', correct: true, independent: true, latencyMs: 1000 },
      { now: day3, rng },
    );
    expect(st.box).toBe(5);
    expect(st.independentCorrectDays).toHaveLength(3);
  });

  it('does not promote re-asks in the same session beyond box 1', () => {
    const rng = createSeededRng(7);
    const st = createInitialItemState(BASE_TS, 1, true);
    const next = applyTrialResult(
      st,
      { itemId: 'w1', correct: true, independent: true, latencyMs: 1000 },
      { now: BASE_TS, rng, isReaskInSession: true },
    );
    expect(next.box).toBe(1);
  });

  it('does not promote when correct but not independent', () => {
    const rng = createSeededRng(7);
    const st = createInitialItemState(BASE_TS, 3, true);
    const next = applyTrialResult(
      st,
      { itemId: 'w1', correct: true, independent: false, latencyMs: 1000 },
      { now: BASE_TS, rng },
    );
    expect(next.box).toBe(3);
    expect(diffLocalDays(BASE_TS, next.due)).toBe(1);
  });

  it('respects speedPolicy threshold using median of last 3 trials and ignores idle null', () => {
    const rng = createSeededRng(9);
    const speedPolicy: SpeedPolicy = { kind: 'threshold', baseMs: 1000, perUnitMs: 500 }; // limit = 1500ms
    let st = createInitialItemState(BASE_TS, 2, true);

    // Slow trial -> treated as not independent -> stays box 2
    st = applyTrialResult(
      st,
      { itemId: 'm1', correct: true, independent: true, latencyMs: 3000 },
      { now: BASE_TS, rng, speedPolicy, unitCount: 1 },
    );
    expect(st.box).toBe(2);

    // Fast trial -> median of [3000, 1000] = 2000 > 1500 -> still not fast enough
    st = applyTrialResult(
      st,
      { itemId: 'm1', correct: true, independent: true, latencyMs: 1000 },
      { now: BASE_TS + DAY_MS, rng, speedPolicy, unitCount: 1 },
    );
    expect(st.box).toBe(2);

    // Another fast trial -> median of [3000, 1000, 900] = 1000 <= 1500 -> promotes!
    st = applyTrialResult(
      st,
      { itemId: 'm1', correct: true, independent: true, latencyMs: 900 },
      { now: BASE_TS + 2 * DAY_MS, rng, speedPolicy, unitCount: 1 },
    );
    expect(st.box).toBe(3);

    // Idle-paused (latencyMs: null) does not penalize
    const paused = applyTrialResult(
      st,
      { itemId: 'm1', correct: true, independent: true, latencyMs: null },
      { now: BASE_TS + 5 * DAY_MS, rng, speedPolicy, unitCount: 1 },
    );
    expect(paused.box).toBe(4);
  });

  it('applies overdue grace: promotes box >= 2, never demotes', () => {
    const rng = createSeededRng(11);
    // Box 3 has interval 3 days; overdue by 10 days (> 2 * 3)
    const st3 = createInitialItemState(BASE_TS, 3, true);
    st3.due = BASE_TS;
    const next3 = applyTrialResult(
      st3,
      { itemId: 'w1', correct: true, independent: true, latencyMs: 1000 },
      { now: BASE_TS + 10 * DAY_MS, rng },
    );
    expect(next3.box).toBe(4);

    // Box 1 overdue by 10 days: never demoted, promote only if box >= 2
    const st1 = createInitialItemState(BASE_TS, 1, true);
    st1.due = BASE_TS;
    const next1 = applyTrialResult(
      st1,
      { itemId: 'w2', correct: true, independent: true, latencyMs: 1000 },
      { now: BASE_TS + 10 * DAY_MS, rng },
    );
    expect(next1.box).toBe(1);
  });

  it('handles backward system clock and midnight rollover safely', () => {
    const rng = createSeededRng(3);
    const lateNight = new Date(2026, 5, 10, 23, 55, 0).getTime();
    const afterMidnight = new Date(2026, 5, 11, 0, 5, 0).getTime();
    expect(diffLocalDays(lateNight, afterMidnight)).toBe(1);
    expect(diffLocalDays(afterMidnight, lateNight)).toBe(0);

    const st = createInitialItemState(afterMidnight, 2, true);
    st.lastSeen = afterMidnight;
    const next = applyTrialResult(
      st,
      { itemId: 'w1', correct: true, independent: true, latencyMs: 1000 },
      { now: lateNight, rng },
    );
    expect(next.lastSeen).toBe(afterMidnight);
    expect(toLocalDateString(next.lastSeen)).toBe('2026-06-11');
  });

  it('keeps jitter within ±10% and minimum 1 day', () => {
    const rng = createSeededRng(99);
    for (let i = 0; i < 100; i++) {
      const d21 = applyJitterDays(21, rng, 0.1);
      expect(d21).toBeGreaterThanOrEqual(19);
      expect(d21).toBeLessThanOrEqual(23);

      const d1 = applyJitterDays(1, rng, 0.1);
      expect(d1).toBe(1);
    }
    const nextDay = addLocalDays(BASE_TS, 3);
    expect(diffLocalDays(BASE_TS, nextDay)).toBe(3);
  });
});
