import type { ModuleKey } from './modules';

/**
 * 自定义模式的滑杆定义。
 * 滑杆值 = 「健康度」（0–100，越大越轻松），与模块是否 invert 无关；
 * 例如「拖延缓存」拖到 20，表示缓存占用很低，即很健康。
 */

export interface CustomParam {
  key: ModuleKey;
  /** 滑杆左端（低）文案 */
  low: string;
  /** 滑杆右端（高）文案 */
  high: string;
  /** 这条参数在报告里显示成什么读数 */
  reading: string;
  default: number;
}

export const CUSTOM_PARAMS: CustomParam[] = [
  { key: 'attention', low: '一片空白', high: '全神贯注', reading: '注意力可用内存', default: 62 },
  { key: 'delay', low: '缓存溢出', high: '干净清爽', reading: '拖延缓存占用（反向）', default: 48 },
  { key: 'social', low: '接口失联', high: '秒回在线', reading: '社交接口响应度', default: 58 },
  { key: 'wallet', low: '强制关机', high: '电量满格', reading: '钱包剩余电量', default: 55 },
  { key: 'sleep', low: '服务离线', high: '稳定在线', reading: '睡眠服务在线率', default: 60 },
  { key: 'doubt', low: '占用过高', high: '已休眠', reading: '自我怀疑进程占用（反向）', default: 52 },
  { key: 'tomorrow', low: '队列溢出', high: '队列为空', reading: '明日计划队列占用（反向）', default: 50 },
  { key: 'reality', low: '离线漫游', high: '连接良好', reading: '现实世界连接质量', default: 57 },
];

export interface CustomPreset {
  id: string;
  name: string;
  hint: string;
  values: Partial<Record<ModuleKey, number>>;
}

export const CUSTOM_PRESETS: CustomPreset[] = [
  {
    id: 'slack',
    name: '摸鱼套餐',
    hint: '注意力有余、缓存爆满、明日计划堆积',
    values: { attention: 74, delay: 26, social: 48, wallet: 52, sleep: 46, doubt: 40, tomorrow: 28, reality: 52 },
  },
  {
    id: 'sprint',
    name: '冲刺套餐',
    hint: '产出很高、睡眠与自我怀疑一起告急',
    values: { attention: 68, delay: 70, social: 40, wallet: 62, sleep: 22, doubt: 24, tomorrow: 66, reality: 36 },
  },
  {
    id: 'wellness',
    name: '养生套餐',
    hint: '作息正常、现实连接良好、队列通畅',
    values: { attention: 82, delay: 78, social: 74, wallet: 72, sleep: 80, doubt: 76, tomorrow: 70, reality: 78 },
  },
  {
    id: 'idle',
    name: '待机套餐',
    hint: '所有项都在中间偏下，典型的缓冲期',
    values: { attention: 46, delay: 44, social: 42, wallet: 45, sleep: 43, doubt: 40, tomorrow: 45, reality: 41 },
  },
];

export const DEFAULT_CUSTOM: Record<ModuleKey, number> = CUSTOM_PARAMS.reduce(
  (acc, p) => {
    acc[p.key] = p.default;
    return acc;
  },
  {} as Record<ModuleKey, number>,
);
