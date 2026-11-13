import type {
  BoxLevel,
  ItemState,
  Rng,
  SchedulerConfig,
  SpeedPolicy,
  TrialResult,
  TrialSummary,
} from './types.js';

export const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  intervalsDays: {
    2: 1,
    3: 3,
    4: 7,
    5: 21,
  },
  jitterFraction: 0.1,
  masteryDaysRequired: 3,
  overdueGraceMultiplier: 2,
  idlePauseMs: 20_000,
};

export function createSeededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function toLocalDateString(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function startOfLocalDay(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function addLocalDays(ts: number, days: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days).getTime();
}

export function diffLocalDays(fromTs: number, toTs: number): number {
  if (toTs <= fromTs) {
    return 0;
  }
  const fromDay = startOfLocalDay(fromTs);
  const toDay = startOfLocalDay(toTs);
  if (toDay <= fromDay) {
    return 0;
  }
  return Math.round((toDay - fromDay) / 86_400_000);
}

export function createInitialItemState(now: number, box: BoxLevel = 0, taught = false): ItemState {
  return {
    box,
    attempts: 0,
    correct: 0,
    independentCorrectDays: [],
    recent: [],
    lastSeen: 0,
    due: now,
    lastWrong: 0,
    taught,
  };
}

export function getIntervalDaysForBox(
  box: BoxLevel,
  config: SchedulerConfig = DEFAULT_SCHEDULER_CONFIG,
): number {
  if (box <= 1) return 1;
  return config.intervalsDays[box as 2 | 3 | 4 | 5];
}

export function applyJitterDays(
  baseDays: number,
  rng: Rng,
  jitterFraction = DEFAULT_SCHEDULER_CONFIG.jitterFraction,
): number {
  const offset = (rng() * 2 - 1) * jitterFraction;
  const jittered = Math.round(baseDays * (1 + offset));
  return Math.max(1, jittered);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid] ?? null;
  }
  const left = sorted[mid - 1] ?? 0;
  const right = sorted[mid] ?? 0;
  return (left + right) / 2;
}

export function isWithinSpeedThreshold(
  recent: TrialSummary[],
  speedPolicy: SpeedPolicy,
  unitCount = 1,
): boolean {
  if (speedPolicy.kind === 'none') return true;
  const latencies = recent
    .slice(-3)
    .map((t) => t.latencyMs)
    .filter((ms): ms is number => ms !== null && ms >= 0);

  if (latencies.length === 0) {
    // Idle-paused trials do not penalize
    return true;
  }
  const med = median(latencies);
  if (med === null) return true;
  const limit = speedPolicy.baseMs + speedPolicy.perUnitMs * unitCount;
  return med <= limit;
}

export interface ScheduleUpdateOptions {
  now: number;
  rng: Rng;
  speedPolicy?: SpeedPolicy;
  unitCount?: number;
  isReaskInSession?: boolean;
  config?: SchedulerConfig;
}

export function applyTrialResult(
  prevState: ItemState | null,
  trial: TrialResult,
  opts: ScheduleUpdateOptions,
): ItemState {
  const {
    now,
    rng,
    speedPolicy = { kind: 'none' },
    unitCount = 1,
    isReaskInSession = false,
    config = DEFAULT_SCHEDULER_CONFIG,
  } = opts;

  const prev = prevState ?? createInitialItemState(now, 0, true);
  const safeNow = prev.lastSeen > 0 && now < prev.lastSeen ? prev.lastSeen : now;
  const todayStr = toLocalDateString(safeNow);

  const summary: TrialSummary = {
    ts: safeNow,
    correct: trial.correct,
    independent: trial.independent,
    latencyMs: trial.latencyMs,
  };
  const recent = [...prev.recent, summary].slice(-5);

  const independentCorrectDays =
    trial.correct && trial.independent && !prev.independentCorrectDays.includes(todayStr)
      ? [...prev.independentCorrectDays, todayStr]
      : [...prev.independentCorrectDays];

  // 1. Incorrect
  if (!trial.correct) {
    let nextBox: BoxLevel;
    if (prev.box <= 1) {
      nextBox = 0;
    } else if (prev.box === 2) {
      nextBox = 1;
    } else {
      nextBox = 2;
    }
    return {
      box: nextBox,
      attempts: prev.attempts + 1,
      correct: prev.correct,
      independentCorrectDays,
      recent,
      lastSeen: safeNow,
      due: safeNow,
      lastWrong: safeNow,
      taught: true,
    };
  }

  // Check speed threshold for independence
  const fastEnough = isWithinSpeedThreshold(recent, speedPolicy, unitCount);
  const trulyIndependent = trial.independent && fastEnough;

  // Check overdue ratio for overdue grace
  const prevIntervalDays = getIntervalDaysForBox(prev.box, config);
  const overdueDays = prev.due > 0 && safeNow > prev.due ? diffLocalDays(prev.due, safeNow) : 0;
  const isHeavilyOverdue = overdueDays > prevIntervalDays * config.overdueGraceMultiplier;

  // 2. Correct and independent
  if (trulyIndependent) {
    let targetBox: BoxLevel = prev.box;

    if (isReaskInSession) {
      // Re-asks in the same session never promote beyond box 1
      targetBox = prev.box < 1 ? 1 : prev.box === 1 ? 1 : prev.box;
    } else if (isHeavilyOverdue) {
      // Overdue grace: never demoted; promote only if box >= 2
      if (prev.box >= 2) {
        targetBox = Math.min(5, prev.box + 1) as BoxLevel;
      }
    } else {
      targetBox = Math.min(5, prev.box + 1) as BoxLevel;
    }

    // 5. Mastery (box 5) requires independent-correct trials on 3 different local days
    if (targetBox === 5 && independentCorrectDays.length < config.masteryDaysRequired) {
      targetBox = 4;
    }

    const baseDays = getIntervalDaysForBox(targetBox, config);
    const intervalDays =
      targetBox <= 1 ? 1 : applyJitterDays(baseDays, rng, config.jitterFraction);

    return {
      box: targetBox,
      attempts: prev.attempts + 1,
      correct: prev.correct + 1,
      independentCorrectDays,
      recent,
      lastSeen: safeNow,
      due: addLocalDays(safeNow, intervalDays),
      lastWrong: prev.lastWrong,
      taught: true,
    };
  }

  // 3. Correct but not independent (hint, extra replay, or too slow)
  const cappedDays = Math.min(prevIntervalDays, 1);
  return {
    box: prev.box,
    attempts: prev.attempts + 1,
    correct: prev.correct + 1,
    independentCorrectDays,
    recent,
    lastSeen: safeNow,
    due: addLocalDays(safeNow, Math.max(1, cappedDays)),
    lastWrong: prev.lastWrong,
    taught: true,
  };
}
