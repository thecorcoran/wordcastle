export type BoxLevel = 0 | 1 | 2 | 3 | 4 | 5;

export interface Item {
  id: string;
  groupId: string;
  superGroupId: string;
  order: number;
  meta: Record<string, unknown>;
}

export interface TrialSummary {
  ts: number;
  correct: boolean;
  independent: boolean;
  latencyMs: number | null;
}

export interface ItemState {
  box: BoxLevel;
  attempts: number;
  correct: number;
  independentCorrectDays: string[];
  recent: TrialSummary[];
  lastSeen: number;
  due: number;
  lastWrong: number;
  taught: boolean;
}

export interface TrialResult {
  itemId: string;
  correct: boolean;
  independent: boolean;
  latencyMs: number | null;
  detail?: unknown;
}

export interface ExerciseContext {
  root: HTMLElement;
  itemState: ItemState | null;
  forceScaffold?: boolean;
  showOnScreenKeyboard?: boolean;
  playAudio: (itemId: string, kind: 'word' | 'sentence' | 'slow', ttsText?: string) => Promise<void>;
  hasAudio: (itemId: string, kind: 'word' | 'sentence' | 'slow') => Promise<boolean>;
  announce: (message: string) => void;
  onIdlePause?: () => void;
  onIdleResume?: () => void;
}

export interface Exercise {
  present(item: Item, ctx: ExerciseContext): Promise<TrialResult>;
  teach(item: Item, ctx: ExerciseContext): Promise<void>;
  correct(item: Item, trial: TrialResult, ctx: ExerciseContext): Promise<void>;
}

export type SpeedPolicy =
  | { kind: 'none' }
  | { kind: 'threshold'; baseMs: number; perUnitMs: number };

export interface UnlockPolicy {
  groupsInOrder: string[];
  threshold: number;
}

export interface LearningPack {
  id: string;
  title: string;
  items: Item[];
  unlockPolicy: UnlockPolicy;
  speedPolicy: SpeedPolicy;
  newPerSessionDefault: number;
  sessionMinutesDefault: number;
  exercise: Exercise;
  placementSampler(items: Item[]): Item[];
  /** Optional subject-specific conflict check (e.g. homophones) to avoid introducing together */
  areConflicting?(a: Item, b: Item): boolean;
}

export interface GroupProgress {
  groupId: string;
  superGroupId: string;
  total: number;
  byBox: Record<BoxLevel | 'unseen', number>;
  dueCount: number;
  unlocked: boolean;
  completed: boolean;
}

export interface SuperGroupProgress {
  superGroupId: string;
  total: number;
  byBox: Record<BoxLevel | 'unseen', number>;
  completed: boolean;
  unlocked: boolean;
}

export interface ItemProgressEntry {
  item: Item;
  state: ItemState | null;
  isDue: boolean;
}

export interface SessionRecord {
  id: string;
  date: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  trials: number;
  correctCount: number;
  newWords: string[];
  errors: Array<{ itemId: string; tag: string }>;
}

export interface ProgressView {
  totalItems: number;
  masteredCount: number;
  inProgressCount: number;
  unseenCount: number;
  dueCount: number;
  streakDays: number;
  groups: GroupProgress[];
  superGroups: SuperGroupProgress[];
  items: ItemProgressEntry[];
  history: SessionRecord[];
}

export interface ProgressHandlers {
  onSelectItem?: (item: Item) => void;
  onPracticeItem?: (item: Item) => void;
  onSelectGroup?: (groupId: string) => void;
  onSelectSuperGroup?: (superGroupId: string) => void;
}

export interface Theme {
  id: string;
  renderHomePreview(root: HTMLElement, view: ProgressView): void;
  renderProgress(root: HTMLElement, view: ProgressView, handlers: ProgressHandlers): void;
  onItemAdvance(item: Item, from: number, to: number, root: HTMLElement): void;
}

export interface SchedulerConfig {
  intervalsDays: Record<2 | 3 | 4 | 5, number>;
  jitterFraction: number;
  masteryDaysRequired: number;
  overdueGraceMultiplier: number;
  idlePauseMs: number;
}

export type QueueEntryKind =
  | 'warmup'
  | 'due'
  | 'new'
  | 'rehearsal'
  | 'fill'
  | 'correction'
  | 'retry'
  | 'cooldown';

export interface QueueEntry {
  itemId: string;
  kind: QueueEntryKind;
  forceScaffold?: boolean;
}

export interface ActiveSession {
  id: string;
  date: string;
  startedAt: number;
  queue: QueueEntry[];
  index: number;
  results: TrialResult[];
  newIntroduced: string[];
  correctInSession: string[];
  recentCorrectness: boolean[];
  activeMs: number;
  completed: boolean;
  /** Tracks how many times an item was re-asked in this session */
  reaskCounts: Record<string, number>;
}

export type Rng = () => number;

export type ItemStateMap = Record<string, ItemState>;
