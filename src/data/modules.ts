/**
 * 8 个虚构检测模块。
 *
 * 设计约定：
 * - `value` 是本模块对外显示的读数（0–100，越大越"满"）；
 * - `invert` 表示「数值越大越糟」（例如缓存占用、队列占用）；
 * - `health` = invert ? 100 - value : value，统一成「越大越健康」，供评分与匹配使用；
 * - `tiers` 按 value 从高到低排列，`level` 决定 UI 里的颜色（bad = 红色告警）。
 *
 * 这些名字是虚构的，不对应任何真实设备接口或系统指标。
 */

export type ModuleKey =
  | 'attention'
  | 'delay'
  | 'social'
  | 'wallet'
  | 'sleep'
  | 'doubt'
  | 'tomorrow'
  | 'reality';

export type TierLevel = 'ok' | 'note' | 'warn' | 'bad';

export interface Tier {
  /** 该档位的下限（含） */
  min: number;
  label: string;
  level: TierLevel;
}

export interface ScanModule {
  key: ModuleKey;
  /** 终端里显示的模块代号 */
  code: string;
  name: string;
  /** 读数的全称，例如「注意力可用内存」 */
  metric: string;
  unit: string;
  invert: boolean;
  /** 综合分的权重 */
  weight: number;
  /** 一句话说明这个虚构指标想调侃什么 */
  blurb: string;
  /** 扫描过程中逐条打印的检查项（全是虚构动作） */
  checks: string[];
  tiers: Tier[];
  /** 扫描日志素材 */
  logs: string[];
}

export const SCAN_MODULES: ScanModule[] = [
  {
    key: 'attention',
    code: 'ATTN',
    name: '注意力内存',
    metric: '注意力可用内存',
    unit: '%',
    invert: false,
    weight: 0.2,
    blurb: '指你在第 4 个标签页之后还能记住最初要干什么的能力。',
    checks: [
      '枚举后台常驻标签页（虚构 37 个）',
      '测量从「查个资料」到「刷了 20 分钟」的偏移量',
      '统计「我刚才想说什么」事件的发生次数',
    ],
    tiers: [
      { min: 85, label: '内存充足', level: 'ok' },
      { min: 70, label: '尚可多开', level: 'ok' },
      { min: 55, label: '频繁回收', level: 'note' },
      { min: 35, label: '持续吃紧', level: 'warn' },
      { min: 0, label: '内存不足', level: 'bad' },
    ],
    logs: [
      'ATTN: 检测到 37 个后台标签页，其中 3 个是你三小时前要找的资料。',
      'ATTN: 「我刚才想说什么」事件计数超出预期，已自动归档到「算了」。',
      'ATTN: 注意力碎片整理完成，整理后依然是碎片。',
    ],
  },
  {
    key: 'delay',
    code: 'DLY',
    name: '拖延缓存',
    metric: '拖延缓存占用',
    unit: '%',
    invert: true,
    weight: 0.16,
    blurb: '记录所有「明天一定」的承诺，占用越高，清洁工越累。',
    checks: [
      '读取待办列表的创建日期分布（最长 412 天）',
      '扫描「明天一定」语句的出现频率',
      '检测「先刷五分钟」的返回值（实际 90 分钟）',
    ],
    tiers: [
      { min: 80, label: '缓存溢出', level: 'bad' },
      { min: 65, label: '趋于饱和', level: 'warn' },
      { min: 45, label: '正常堆积', level: 'note' },
      { min: 25, label: '正在清理', level: 'ok' },
      { min: 0, label: '缓存干净', level: 'ok' },
    ],
    logs: [
      'DLY: 清理缓存 3 项，其中 2 项被你标记为「稍后处理」，已重新入队。',
      'DLY: 检测到最早的待办创建于 412 天前，内容为「整理一下待办」。',
      'DLY: 「先刷五分钟」返回 90，超出安全范围，已记录（不做处理）。',
    ],
  },
  {
    key: 'social',
    code: 'SOC',
    name: '社交进程',
    metric: '社交接口响应度',
    unit: '%',
    invert: false,
    weight: 0.13,
    blurb: '衡量「在吗」到「回复」之间的握手耗时，以及表情包替代率。',
    checks: [
      '向三位好友发起「在吗」模拟握手（全部超时）',
      '检查「改天约」承诺队列的完成度',
      '测量用表情包替代文字的转换率',
    ],
    tiers: [
      { min: 85, label: '接口顺畅', level: 'ok' },
      { min: 68, label: '轻微延迟', level: 'ok' },
      { min: 52, label: '需要重连', level: 'note' },
      { min: 34, label: '响应超时', level: 'warn' },
      { min: 0, label: '接口不稳定', level: 'bad' },
    ],
    logs: [
      'SOC: 「在吗」握手 3 次，2 次以「哈哈哈哈」结束，1 次至今未回。',
      'SOC: 表情包替代率 68%，纯文字回复被视为高风险操作。',
      'SOC: 「改天约」承诺队列已积压 11 条，最早一条来自去年春天。',
    ],
  },
  {
    key: 'wallet',
    code: 'WAL',
    name: '钱包电量',
    metric: '钱包剩余电量',
    unit: '%',
    invert: false,
    weight: 0.1,
    blurb: '工资到账后的放电曲线，以及「凑单」到底省了多少钱。',
    checks: [
      '统计购物车中的「再加一件就包邮」次数',
      '解析深夜下单时间戳（模拟，不读真实订单）',
      '复核外卖凑单的净收益（负数）',
    ],
    tiers: [
      { min: 85, label: '电量充裕', level: 'ok' },
      { min: 68, label: '正常放电', level: 'ok' },
      { min: 50, label: '开启省电', level: 'note' },
      { min: 32, label: '低电量模式', level: 'warn' },
      { min: 0, label: '强制关机', level: 'bad' },
    ],
    logs: [
      'WAL: 检测到夜间 23:47 的模拟下单，商品类目为「看起来会用一次的东西」。',
      'WAL: 凑单净收益 -18 元，节省了 12 元运费并额外支出 30 元。',
      'WAL: 钱包进入省电模式，仍保留「买杯咖啡重启人生」的保留额度。',
    ],
  },
  {
    key: 'sleep',
    code: 'SLP',
    name: '睡眠服务',
    metric: '睡眠服务在线率',
    unit: '%',
    invert: false,
    weight: 0.13,
    blurb: '凌晨一点仍在线的人类，睡眠服务会主动降级。',
    checks: [
      '检查 01:00 之后的活跃记录（模拟）',
      '计算「再看一集」的递归深度',
      '统计闹钟平均被忽略次数',
    ],
    tiers: [
      { min: 85, label: '稳定在线', level: 'ok' },
      { min: 68, label: '轻度波动', level: 'ok' },
      { min: 50, label: '频繁重启', level: 'note' },
      { min: 32, label: '服务降级', level: 'warn' },
      { min: 0, label: '服务离线', level: 'bad' },
    ],
    logs: [
      'SLP: 「再看一集」递归深度 4，栈未溢出，人快溢出了。',
      'SLP: 闹钟平均被忽略 2.7 次，第三次通常会附赠一句「就再睡五分钟」。',
      'SLP: 睡眠服务已进入降级模式，仅保留「躺着刷手机」这一项功能。',
    ],
  },
  {
    key: 'doubt',
    code: 'SELF',
    name: '自我怀疑模块',
    metric: '自我怀疑进程占用',
    unit: '%',
    invert: true,
    weight: 0.13,
    blurb: '后台反复回放三年前的尴尬片段，占用越高越费电。',
    checks: [
      '回放三年前尴尬片段（模拟，画质依旧清晰）',
      '检测「我是不是说错了」的触发阈值',
      '审计内心弹幕的重复率（82% 为旧素材）',
    ],
    tiers: [
      { min: 78, label: '占用过高', level: 'bad' },
      { min: 60, label: '持续占用', level: 'warn' },
      { min: 42, label: '偶发占用', level: 'note' },
      { min: 24, label: '轻度运行', level: 'ok' },
      { min: 0, label: '已休眠', level: 'ok' },
    ],
    logs: [
      'SELF: 已回放 2019 年的社死片段，画质依旧清晰，情绪依旧新鲜。',
      'SELF: 内心弹幕重复率 82%，建议清理旧素材但被本人驳回。',
      'SELF: 「我是不是说错了」检测触发 6 次，经核查 5 次无事发生。',
    ],
  },
  {
    key: 'tomorrow',
    code: 'TMR',
    name: '明日计划队列',
    metric: '明日计划队列占用',
    unit: '%',
    invert: true,
    weight: 0.08,
    blurb: '每个「明天开始」都会入队，但队列的消费者经常请假。',
    checks: [
      '统计列过但未执行的计划数量',
      '读取「明天开始」的计划堆积量',
      '校验 06:00 早起计划的可行性（不通过）',
    ],
    tiers: [
      { min: 78, label: '队列溢出', level: 'bad' },
      { min: 60, label: '排队中', level: 'warn' },
      { min: 42, label: '正常排队', level: 'note' },
      { min: 24, label: '队列通畅', level: 'ok' },
      { min: 0, label: '队列为空', level: 'ok' },
    ],
    logs: [
      'TMR: 队列中共 19 条「明天开始」，消费者线程今日请假。',
      'TMR: 06:00 早起计划可行性校验未通过，失败原因为「被窝引力过强」。',
      'TMR: 已为明日新增 3 条计划，其中 2 条是「整理昨天的计划」。',
    ],
  },
  {
    key: 'reality',
    code: 'RLT',
    name: '现实连接状态',
    metric: '现实世界连接质量',
    unit: '%',
    invert: false,
    weight: 0.07,
    blurb: '对线下世界做一次 ping，看看丢包率和窗外天气。',
    checks: [
      '对线下场景做 ping（模拟，目标为「楼下便利店」）',
      '检查窗外的天气是否被注意过',
      '测量连续盯屏时长',
    ],
    tiers: [
      { min: 85, label: '连接良好', level: 'ok' },
      { min: 68, label: '轻微丢包', level: 'ok' },
      { min: 50, label: '需要重连', level: 'note' },
      { min: 32, label: '弱信号', level: 'warn' },
      { min: 0, label: '离线漫游', level: 'bad' },
    ],
    logs: [
      'RLT: 对「楼下便利店」ping 4 次，丢包 2 次，剩余 2 次为外卖代劳。',
      'RLT: 窗外天气数据缺失，最后一次确认是「好像下雨了」。',
      'RLT: 连续盯屏 3 小时 12 分，视野内的绿植已全部虚拟化。',
    ],
  },
];

export const MODULE_MAP: Record<ModuleKey, ScanModule> = SCAN_MODULES.reduce(
  (acc, m) => {
    acc[m.key] = m;
    return acc;
  },
  {} as Record<ModuleKey, ScanModule>,
);

/** 取读数对应的档位（tiers 已按 min 降序排列） */
export function tierOf(module: ScanModule, value: number): Tier {
  for (const tier of module.tiers) {
    if (value >= tier.min) return tier;
  }
  return module.tiers[module.tiers.length - 1];
}

/** 统一成「越大越健康」 */
export function healthOf(module: ScanModule, value: number): number {
  return module.invert ? 100 - value : value;
}

/** 健康度 → 统一的四档描述（用于报告页的分数条） */
export function healthBand(health: number): { label: string; level: TierLevel } {
  if (health >= 82) return { label: '良好', level: 'ok' };
  if (health >= 64) return { label: '尚可', level: 'ok' };
  if (health >= 46) return { label: '偏低', level: 'note' };
  if (health >= 28) return { label: '告急', level: 'warn' };
  return { label: '异常', level: 'bad' };
}
