/**
 * 规则层：把「用户输入」确定性地映射成「检测读数 → 结果类型 → 报告内容」。
 *
 * 三条约束（也是本项目可信度所在）：
 * 1. 所有读数都由这里的公式算出，不读取任何真实设备或隐私数据；
 * 2. 相同输入永远得到相同输出（随机模式也由显式种子决定）；
 * 3. 评分与动画完全分离：本文件不涉及任何计时器或 DOM。
 */
import {
  MODULE_MAP,
  SCAN_MODULES,
  healthBand,
  healthOf,
  tierOf,
  type ModuleKey,
  type TierLevel,
} from '../data/modules';
import { ARCHETYPES, type Archetype } from '../data/archetypes';
import { QUESTIONS } from '../data/questions';
import { SIM_RULE_TEXT } from '../data/site';

export type Mode = 'random' | 'quiz' | 'custom';

/** questionId → optionId */
export type AnswerMap = Record<string, string>;

/** 自定义模式：每个模块的「健康设定」（0–100，越大越健康） */
export type CustomHealth = Record<ModuleKey, number>;

export type LogKind = 'sys' | 'ok' | 'warn' | 'err' | 'info' | 'dim';

export interface LogEntry {
  kind: LogKind;
  text: string;
  /** 归属模块（用于报告里的模块日志） */
  module?: ModuleKey;
}

export interface ModuleReading {
  key: ModuleKey;
  code: string;
  name: string;
  metric: string;
  unit: string;
  /** 对外显示的读数（0–100，越大越"满"） */
  value: number;
  /** 越大越健康（invert 模块为 100 - value） */
  health: number;
  invert: boolean;
  tierLabel: string;
  level: TierLevel;
  bandLabel: string;
  blurb: string;
  /** 该模块的一句话趣味评语（由档位与健康度确定性生成） */
  comment: string;
}

export interface DiagnosticResult {
  mode: Mode;
  /** CLD-2026-XXXX */
  serial: string;
  seed: number;
  /** 生成时间（ISO），仅用于展示，不参与评分 */
  generatedAt: string;
  archetype: Archetype;
  readings: ModuleReading[];
  /** 综合健康度 0–100（按模块权重加权） */
  healthScore: number;
  /** 系统状态短语 */
  statusLine: string;
  /** 异常项目（健康度偏低的模块） */
  anomalies: ModuleReading[];
  logs: LogEntry[];
  tags: string[];
  /** 数据来源说明（告诉用户这些数字怎么来的） */
  simRule: string;
}

/* ------------------------------------------------------------------ */
/* 基础工具                                                            */
/* ------------------------------------------------------------------ */

export function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

/** 确定性 32 位字符串哈希（FNV-1a 变体） */
export function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** 确定性伪随机数生成器（mulberry32） */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function emptyHealth(base = 50): CustomHealth {
  return SCAN_MODULES.reduce((acc, m) => {
    acc[m.key] = base;
    return acc;
  }, {} as CustomHealth);
}

/* ------------------------------------------------------------------ */
/* 1. 三种模式 → 各模块健康度                                          */
/* ------------------------------------------------------------------ */

/** 随机模式：唯一输入是一个显式种子，读数由种子在固定区间内取值 */
export function randomHealth(seed: number): CustomHealth {
  const rand = mulberry32(seed);
  const health = emptyHealth();
  for (const m of SCAN_MODULES) {
    // 每模块两次采样取均值，让分布更接近真实「中间多两端少」
    const a = rand();
    const b = rand();
    const t = (a + b) / 2;
    health[m.key] = Math.round(clamp(10 + t * 82, 8, 92));
  }
  return health;
}

/** 问答模式：基准 50，按所选选项累加（选项里的 effects 就是健康度增量） */
export function quizHealth(answers: AnswerMap): CustomHealth {
  const health = emptyHealth(50);
  for (const q of QUESTIONS) {
    const optionId = answers[q.id];
    if (!optionId) continue;
    const option = q.options.find((o) => o.id === optionId);
    if (!option) continue;
    for (const [key, delta] of Object.entries(option.effects)) {
      health[key as ModuleKey] += delta as number;
    }
  }
  for (const m of SCAN_MODULES) {
    health[m.key] = Math.round(clamp(health[m.key], 8, 94));
  }
  return health;
}

/** 自定义模式：用户拖到哪就是哪，只做取整与范围保护 */
export function customHealth(values: Partial<CustomHealth>): CustomHealth {
  const health = emptyHealth(60);
  for (const m of SCAN_MODULES) {
    const raw = values[m.key];
    health[m.key] = Math.round(clamp(typeof raw === 'number' && Number.isFinite(raw) ? raw : 60, 4, 96));
  }
  return health;
}

/** 健康度 → 对外显示的读数（invert 模块反过来） */
export function valueFromHealth(module_key: ModuleKey, health: number): number {
  const m = MODULE_MAP[module_key];
  return m.invert ? clamp(100 - health) : clamp(health);
}

/* ------------------------------------------------------------------ */
/* 2. 读数 → 结果类型                                                  */
/* ------------------------------------------------------------------ */

function rulePass(value: number, op: '>=' | '<=' | '>', target: number): boolean {
  if (op === '>=') return value >= target;
  if (op === '<=') return value <= target;
  return value > target;
}

/** 按数组顺序匹配，第一个全部满足的类型胜出；最后一个无条件兜底 */
export function pickArchetype(values: Record<ModuleKey, number>): Archetype {
  for (const a of ARCHETYPES) {
    if (a.rules.every((r) => rulePass(values[r.module], r.op, r.value))) return a;
  }
  return ARCHETYPES[ARCHETYPES.length - 1];
}

/* ------------------------------------------------------------------ */
/* 3. 读数 → 报告内容                                                  */
/* ------------------------------------------------------------------ */

/**
 * 一句话评语库：按健康度分 5 档，每档多条。
 * 用「模块 + 读数」做确定性选词，保证同一结果每次刷新文案一致，
 * 同时避免 8 个模块都显示同一句。
 */
const COMMENT_BANDS: { min: number; texts: string[] }[] = [
  {
    min: 84,
    texts: [
      '读数漂亮得像刚重装过系统。',
      '这一项稳定得有点可疑，建议截图存档。',
      '系统在此处毫无怨言，甚至有点得意。',
    ],
  },
  {
    min: 68,
    texts: ['基本够用，偶尔需要清一下缓存。', '运行平稳，风扇偶尔哼两句。', '没有告警，只有一点点小脾气。'],
  },
  {
    min: 52,
    texts: ['还能跑，但风扇已经有点响了。', '处于「勉强可以」的区间，属于当代常态。', '不算故障，只是需要偶尔哄一下。'],
  },
  {
    min: 36,
    texts: ['建议减少并发，或者假装没看见。', '这一项已经在排队等重启了。', '系统在硬撑，撑得还算体面。'],
  },
  {
    min: 0,
    texts: ['这一项已经在冒烟了，但它还在坚持工作。', '告警灯常亮，但没有人来按。', '已进入省电模式，勉强保留核心功能。'],
  },
];

export function commentFor(moduleKey: string, health: number, value: number): string {
  const band = COMMENT_BANDS.find((b) => health >= b.min) ?? COMMENT_BANDS[COMMENT_BANDS.length - 1];
  const idx = hashString(`${moduleKey}:${value}`) % band.texts.length;
  return band.texts[idx];
}

export function buildReading(key: ModuleKey, value: number): ModuleReading {
  const m = MODULE_MAP[key];
  const health = healthOf(m, value);
  const tier = tierOf(m, value);
  const band = healthBand(health);
  return {
    key,
    code: m.code,
    name: m.name,
    metric: m.metric,
    unit: m.unit,
    value,
    health,
    invert: m.invert,
    tierLabel: tier.label,
    level: tier.level,
    bandLabel: band.label,
    blurb: m.blurb,
    comment: commentFor(key, health, value),
  };
}

export function healthScoreOf(readings: ModuleReading[]): number {
  let sum = 0;
  let weightSum = 0;
  for (const r of readings) {
    const w = MODULE_MAP[r.key].weight;
    sum += r.health * w;
    weightSum += w;
  }
  return Math.round(sum / (weightSum || 1));
}

export function statusLineOf(score: number): string {
  if (score >= 84) return '运行良好 · 无重大告警';
  if (score >= 70) return '基本正常 · 轻度波动';
  if (score >= 56) return '部分降级 · 建议清理缓存';
  if (score >= 42) return '多项告警 · 不影响开机';
  return '系统过载 · 建议重启（不会真的重启你）';
}

/**
 * 异常项目：只收「告警 / 异常」两档的模块（档位本身已按模块方向定义，读起来不会自相矛盾），
 * 按严重程度（健康度升序）排序，最多 4 项。
 */
export function anomaliesOf(readings: ModuleReading[]): ModuleReading[] {
  return readings
    .filter((r) => r.level === 'warn' || r.level === 'bad')
    .sort((a, b) => a.health - b.health)
    .slice(0, 4);
}

const LOG_TEMPLATES: Record<ModuleKey, string[]> = SCAN_MODULES.reduce(
  (acc, m) => {
    acc[m.key] = m.logs;
    return acc;
  },
  {} as Record<ModuleKey, string[]>,
);

function buildLogs(
  readings: ModuleReading[],
  archetype: Archetype,
  seed: number,
  mode: Mode,
): LogEntry[] {
  const rand = mulberry32(seed ^ 0x9e3779b9);
  const logs: LogEntry[] = [
    { kind: 'sys', text: `SESSION OPEN · mode=${mode} · seed=${seed.toString(16).toUpperCase()}` },
    { kind: 'dim', text: '本次扫描为娱乐模拟，未申请任何浏览器权限，未读取任何设备数据。' },
  ];

  // 挑选 3 个模块的日志（优先异常项）
  const sorted = [...readings].sort((a, b) => a.health - b.health);
  const picked = [sorted[0], sorted[1], readings[Math.floor(rand() * readings.length)]].filter(
    (r, i, arr): r is ModuleReading => Boolean(r) && arr.findIndex((x) => x?.key === r.key) === i,
  );
  for (const r of picked) {
    const pool = LOG_TEMPLATES[r.key];
    const text = pool[Math.floor(rand() * pool.length)];
    logs.push({ kind: 'info', text, module: r.key });
  }

  logs.push({
    kind: 'ok',
    text: `模块读取完成 ${readings.length}/${readings.length} · 全部为模拟数值`,
  });
  logs.push({ kind: 'warn', text: `模拟告警已归类：${anomaliesOf(readings).length} 项进入观察名单` });
  logs.push({ kind: 'sys', text: `REPORT SEALED · ${archetype.code}` });
  return logs;
}

function collectTags(readings: ModuleReading[], archetype: Archetype, answers?: AnswerMap): string[] {
  const tags: string[] = [];

  if (answers) {
    for (const q of QUESTIONS) {
      const optionId = answers[q.id];
      if (!optionId) continue;
      const option = q.options.find((o) => o.id === optionId);
      if (option?.tag) tags.push(option.tag);
    }
  }

  for (const r of readings) {
    if (r.level === 'bad') tags.push(`${r.name}告急`);
    else if (r.level === 'warn') tags.push(`${r.name}偏低`);
  }

  tags.push(...archetype.tags);

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const t of tags) {
    if (seen.has(t)) continue;
    seen.add(t);
    unique.push(t);
    if (unique.length >= 6) break;
  }
  return unique;
}

/** 把读数编码成可复现的序号：同分数 → 同编号 */
function serialOf(readings: ModuleReading[], seed: number): string {
  const key = readings.map((r) => r.value).join('|');
  const n = hashString(`${key}#${seed}`);
  const block = (n % 0x10000).toString(16).toUpperCase().padStart(4, '0');
  const year = new Date().getFullYear();
  return `CLD-${year}-${block}`;
}

/* ------------------------------------------------------------------ */
/* 4. 对外主入口                                                       */
/* ------------------------------------------------------------------ */

export interface ComputeInput {
  mode: Mode;
  answers?: AnswerMap;
  custom?: Partial<CustomHealth>;
  /** 随机模式的种子；不传则用当前时间戳（只在 random 模式生效） */
  seed?: number;
  /** 用于展示的时间戳，测试时可固定 */
  now?: number;
}

export function computeResult(input: ComputeInput): DiagnosticResult {
  const { mode } = input;
  let health: CustomHealth;
  let seed: number;

  if (mode === 'quiz') {
    const answers = input.answers ?? {};
    health = quizHealth(answers);
    seed = hashString(
      QUESTIONS.map((q) => `${q.id}:${answers[q.id] ?? '-'}`).join('|'),
    );
  } else if (mode === 'custom') {
    health = customHealth(input.custom ?? {});
    seed = hashString(SCAN_MODULES.map((m) => `${m.key}:${health[m.key]}`).join('|'));
  } else {
    seed = input.seed ?? (input.now ?? Date.now()) % 0xffffffff;
    health = randomHealth(seed);
  }

  const values = SCAN_MODULES.reduce((acc, m) => {
    acc[m.key] = valueFromHealth(m.key, health[m.key]);
    return acc;
  }, {} as Record<ModuleKey, number>);

  const readings = SCAN_MODULES.map((m) => buildReading(m.key, values[m.key]));
  const archetype = pickArchetype(values);
  const healthScore = healthScoreOf(readings);

  return {
    mode,
    serial: serialOf(readings, seed),
    seed,
    generatedAt: new Date(input.now ?? Date.now()).toISOString(),
    archetype,
    readings,
    healthScore,
    statusLine: statusLineOf(healthScore),
    anomalies: anomaliesOf(readings),
    logs: buildLogs(readings, archetype, seed, mode),
    tags: collectTags(readings, archetype, input.answers),
    simRule: SIM_RULE_TEXT[mode],
  };
}

/** 只取展示用读数（测试与分享图都用这个顺序） */
export function readingsToValues(readings: ModuleReading[]): Record<ModuleKey, number> {
  return readings.reduce((acc, r) => {
    acc[r.key] = r.value;
    return acc;
  }, {} as Record<ModuleKey, number>);
}
