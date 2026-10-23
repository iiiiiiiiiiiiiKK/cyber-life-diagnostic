/**
 * localStorage 封装。
 *
 * 原则：
 * - 只在能安全访问时才可用（隐私模式 / 禁用存储时静默降级，功能不受影响）；
 * - 读取一律做形状校验与版本校验，坏数据直接丢弃，不让页面崩；
 * - 只存「用户自己的选择」与「上次结果」，不存任何真实设备信息。
 */
import type { AnswerMap, CustomHealth, Mode } from './scoring';
import { QUESTION_SET_VERSION } from '../data/questions';

const NS = 'cld.v1';
export const KEY_PROGRESS = `${NS}.progress`;
export const KEY_LAST = `${NS}.last`;
export const KEY_PREFS = `${NS}.prefs`;

export interface SavedProgress {
  version: number;
  mode: Mode;
  answers: AnswerMap;
  custom: Partial<CustomHealth> | null;
  /** 已答到的题号（0-based） */
  cursor: number;
  savedAt: number;
}

export interface SavedLast {
  version: number;
  mode: Mode;
  answers: AnswerMap | null;
  custom: Partial<CustomHealth> | null;
  seed: number | null;
  savedAt: number;
}

export interface Prefs {
  version: number;
  reducedMotion: boolean;
  template: string;
}

export function storageAvailable(): boolean {
  try {
    const probe = `${NS}.probe`;
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function isMode(value: unknown): value is Mode {
  return value === 'random' || value === 'quiz' || value === 'custom';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function loadProgress(): SavedProgress | null {
  const data = readJson<unknown>(KEY_PROGRESS);
  if (!isPlainObject(data)) return null;
  if (data.version !== QUESTION_SET_VERSION) return null;
  if (!isMode(data.mode)) return null;
  const answers = isPlainObject(data.answers) ? (data.answers as AnswerMap) : {};
  const cleanAnswers: AnswerMap = {};
  for (const [k, v] of Object.entries(answers)) {
    if (typeof v === 'string') cleanAnswers[k] = v;
  }
  const cursor = typeof data.cursor === 'number' && Number.isFinite(data.cursor) ? Math.max(0, Math.floor(data.cursor)) : 0;
  return {
    version: QUESTION_SET_VERSION,
    mode: data.mode,
    answers: cleanAnswers,
    custom: isPlainObject(data.custom) ? (data.custom as Partial<CustomHealth>) : null,
    cursor,
    savedAt: typeof data.savedAt === 'number' ? data.savedAt : 0,
  };
}

export function saveProgress(progress: Omit<SavedProgress, 'version' | 'savedAt'>): boolean {
  return writeJson(KEY_PROGRESS, { ...progress, version: QUESTION_SET_VERSION, savedAt: Date.now() });
}

export function clearProgress(): void {
  try {
    window.localStorage.removeItem(KEY_PROGRESS);
  } catch {
    /* 忽略：存储不可用时本来就是空的 */
  }
}

export function loadLast(): SavedLast | null {
  const data = readJson<unknown>(KEY_LAST);
  if (!isPlainObject(data)) return null;
  if (!isMode(data.mode)) return null;
  return {
    version: typeof data.version === 'number' ? data.version : 0,
    mode: data.mode,
    answers: isPlainObject(data.answers) ? (data.answers as AnswerMap) : null,
    custom: isPlainObject(data.custom) ? (data.custom as Partial<CustomHealth>) : null,
    seed: typeof data.seed === 'number' && Number.isFinite(data.seed) ? data.seed : null,
    savedAt: typeof data.savedAt === 'number' ? data.savedAt : 0,
  };
}

export function saveLast(last: Omit<SavedLast, 'savedAt'>): boolean {
  return writeJson(KEY_LAST, { ...last, savedAt: Date.now() });
}

export function clearLast(): void {
  try {
    window.localStorage.removeItem(KEY_LAST);
  } catch {
    /* 忽略 */
  }
}

export function loadPrefs(): Prefs {
  const fallback: Prefs = { version: 1, reducedMotion: false, template: 'terminal' };
  const data = readJson<unknown>(KEY_PREFS);
  if (!isPlainObject(data)) return fallback;
  return {
    version: 1,
    reducedMotion: data.reducedMotion === true,
    template: typeof data.template === 'string' ? data.template : 'terminal',
  };
}

export function savePrefs(prefs: Omit<Prefs, 'version'>): boolean {
  return writeJson(KEY_PREFS, { ...prefs, version: 1 });
}

/** 页脚「清除本地数据」：三个键一起抹掉 */
export function clearAll(): void {
  clearProgress();
  clearLast();
  try {
    window.localStorage.removeItem(KEY_PREFS);
  } catch {
    /* 忽略 */
  }
}
