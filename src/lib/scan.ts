/**
 * 扫描流程编排（纯数据 + 纯函数）。
 *
 * 关键设计：
 * - 扫描计划由「结果」推导出来，视觉上看起来在检测，实际上读数是先算好的；
 * - 计划是有限步列表，每一步都有明确的 duration 与结束状态，因此不可能无限等待；
 * - 动画代码只负责按 elapsed 时间片推进，不参与评分，也不改写结果；
 * - 跳过（skip）只是把 elapsed 推到末尾，结果完全一致。
 */
import { SCAN_MODULES, type ModuleKey } from '../data/modules';
import type { DiagnosticResult } from './scoring';

export type StepKind = 'boot' | 'load' | 'scan' | 'check' | 'alert' | 'finish';

export interface ScanStep {
  id: string;
  kind: StepKind;
  /** 主状态行文案 */
  label: string;
  /** 副状态行文案（可空） */
  detail?: string;
  /** 正常速度下的持续时间（ms） */
  duration: number;
  module?: ModuleKey;
  /** 进入该步骤时追加到日志的行 */
  logs: string[];
  /** 该步骤结束时想要显示的模块读数（仅 scan/check 步骤有） */
  reveal?: { module: ModuleKey; value: number };
}

export interface ScanPlan {
  steps: ScanStep[];
  /** 正常速度总时长 */
  total: number;
}

export interface ScanSpeedOptions {
  /** 减少动画：整体加速并把时长压到很短 */
  reducedMotion?: boolean;
}

const SCALE_REDUCED = 0.22;
const SCALE_NORMAL = 1;

function ms(base: number, scale: number): number {
  return Math.max(80, Math.round(base * scale));
}

/**
 * 构建扫描计划。
 * 正常速度总时长约 19–20 秒（落在需求的 15–25 秒区间）。
 */
export function buildScanPlan(result: DiagnosticResult, options: ScanSpeedOptions = {}): ScanPlan {
  const scale = options.reducedMotion ? SCALE_REDUCED : SCALE_NORMAL;
  const steps: ScanStep[] = [];

  steps.push({
    id: 'boot',
    kind: 'boot',
    label: '系统启动 · 挂载模拟环境',
    detail: 'SIMULATION ONLY / 不申请任何浏览器权限',
    duration: ms(1700, scale),
    logs: [
      '> cyber-life-diagnostic v1.0 (simulation shell)',
      '> 声明：本次扫描为娱乐模拟，不读取设备、摄像头、麦克风、文件或浏览记录',
      '> 未请求权限：camera=denied-by-design, microphone=denied-by-design, filesystem=denied-by-design',
      '> 模拟内核已加载，开始挂载检测模块…',
    ],
  });

  const moduleNames = SCAN_MODULES.map((m) => m.code).join(' · ');
  steps.push({
    id: 'load',
    kind: 'load',
    label: '加载虚构检测模块',
    detail: `${SCAN_MODULES.length} 个模块：${moduleNames}`,
    duration: ms(1500, scale),
    logs: [
      `> 挂载 ${SCAN_MODULES.length} 个虚构模块：${SCAN_MODULES.map((m) => m.name).join('、')}`,
      '> 说明：模块名称与接口名均为本项目的虚构设定，不对应任何真实系统 API',
      '> 模块校验通过，准备逐项读取（模拟）',
    ],
  });

  SCAN_MODULES.forEach((m, index) => {
    const reading = result.readings.find((r) => r.key === m.key);
    const value = reading?.value ?? 50;
    steps.push({
      id: `scan-${m.key}`,
      kind: 'scan',
      label: `[${String(index + 1).padStart(2, '0')}/${SCAN_MODULES.length}] 读取 ${m.name}`,
      detail: m.checks[0],
      duration: ms(820, scale),
      module: m.key,
      logs: [`> ${m.code}: 开始读取 ${m.metric}（模拟）`],
      reveal: { module: m.key, value },
    });
    steps.push({
      id: `check-${m.key}`,
      kind: 'check',
      label: `[${String(index + 1).padStart(2, '0')}/${SCAN_MODULES.length}] 校验 ${m.name}`,
      detail: m.checks[1] ?? m.blurb,
      duration: ms(320, scale),
      module: m.key,
      logs: [],
    });
  });

  const anomalyNames = result.anomalies.map((a) => `${a.name} ${a.value}%`).join('、');
  steps.push({
    id: 'alert',
    kind: 'alert',
    label:
      result.anomalies.length > 0
        ? `检测到 ${result.anomalies.length} 项异常项目（模拟）`
        : '未检测到异常项目（模拟结果）',
    detail:
      result.anomalies.length > 0
        ? anomalyNames
        : '所有模块读数均在模拟安全区内，这在本系统中属于稀有事件',
    duration: ms(2600, scale),
    logs:
      result.anomalies.length > 0
        ? [
            `! SIM-ALERT: ${anomalyNames}`,
            '! 以上告警由本地模拟规则生成，不代表任何真实状况，也不会触发任何系统动作',
            '> 正在归档异常项目…（仅写入本页内存）',
          ]
        : ['> 全部模块读数处于模拟安全区', '> 系统没有检测到需要处理的项目，正在归档…'],
  });

  steps.push({
    id: 'finish',
    kind: 'finish',
    label: '生成人生系统诊断报告',
    detail: `${result.archetype.name} · ${result.serial}`,
    duration: ms(1900, scale),
    logs: [
      '> 汇总 8 项模拟读数 → 匹配结果类型',
      `> 结果类型命中：${result.archetype.code}`,
      `> 报告已封存：${result.serial}`,
      '> 数据来源：本地规则生成的模拟数值，未上传任何内容',
    ],
  });

  const total = steps.reduce((sum, s) => sum + s.duration, 0);
  return { steps, total };
}

/** 时间 → 当前步骤索引与步骤内进度（0–1） */
export function stepAt(plan: ScanPlan, elapsed: number): { index: number; local: number; done: boolean } {
  let acc = 0;
  for (let i = 0; i < plan.steps.length; i += 1) {
    const step = plan.steps[i];
    if (elapsed < acc + step.duration) {
      return { index: i, local: (elapsed - acc) / step.duration, done: false };
    }
    acc += step.duration;
  }
  return { index: plan.steps.length - 1, local: 1, done: true };
}

/** 已展示到日志区的行（截断到当前步骤） */
export function visibleLogs(plan: ScanPlan, index: number): ScanStep[] {
  return plan.steps.slice(0, Math.min(index + 1, plan.steps.length));
}

/** 当前进度（0–1），按已完成的步骤数 + 步骤内进度计算 */
export function progressAt(plan: ScanPlan, elapsed: number): number {
  if (plan.total <= 0) return 1;
  return Math.min(1, Math.max(0, elapsed / plan.total));
}

/** 扫描阶段划分（用于 UI 上的阶段条） */
export const SCAN_PHASES: { id: string; title: string; hint: string }[] = [
  { id: 'boot', title: '01 系统启动', hint: '挂载模拟环境' },
  { id: 'load', title: '02 加载模块', hint: '8 个虚构模块' },
  { id: 'scan', title: '03 逐项读取', hint: '模拟扫描中' },
  { id: 'alert', title: '04 异常归类', hint: '仅为表演' },
  { id: 'finish', title: '05 生成报告', hint: '封存结果' },
];

export function phaseIndexOfStep(step: ScanStep): number {
  switch (step.kind) {
    case 'boot':
      return 0;
    case 'load':
      return 1;
    case 'scan':
    case 'check':
      return 2;
    case 'alert':
      return 3;
    case 'finish':
    default:
      return 4;
  }
}
