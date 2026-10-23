import type { ModuleKey } from './modules';

/**
 * 生活习惯问卷（8 题）。
 *
 * 规则约定：每个选项的 `effects` 直接给出「健康度增量」（+ 表示更健康，- 表示更糟）。
 * 健康度 = 该模块的「可用程度」，与模块是否 invert 无关；
 * 最终读数由 scoring.ts 统一换算（invert 模块会取 100 - health）。
 * 这样题目作者只需要想「这个回答让哪一项更健康」，不用关心正反向。
 */

export interface QuizOption {
  id: string;
  label: string;
  effects: Partial<Record<ModuleKey, number>>;
  /** 选项自带的趣味标签，会进报告的标签区 */
  tag?: string;
}

export interface QuizQuestion {
  id: string;
  topic: string;
  prompt: string;
  hint?: string;
  options: QuizOption[];
}

export const QUESTION_SET_VERSION = 3;

export const QUESTIONS: QuizQuestion[] = [
  {
    id: 'q1',
    topic: '注意力',
    prompt: '打开电脑准备干正事，第一件事通常是——',
    options: [
      {
        id: 'q1a',
        label: '直接开工，标签页不超过 3 个',
        effects: { attention: 14, delay: 6, reality: 3 },
        tag: '标签页洁癖',
      },
      {
        id: 'q1b',
        label: '先清一遍消息，然后才开工',
        effects: { attention: 2, social: 6, delay: -4 },
        tag: '消息优先',
      },
      {
        id: 'q1c',
        label: '顺手点开一个视频，「就五分钟」',
        effects: { attention: -14, delay: -8, sleep: -3 },
        tag: '五分钟陷阱',
      },
      {
        id: 'q1d',
        label: '先整理桌面，整理完发现已经到饭点了',
        effects: { attention: -8, delay: -12, tomorrow: -5 },
        tag: '整理型拖延',
      },
    ],
  },
  {
    id: 'q2',
    topic: '拖延',
    prompt: '一件三天后到期的事，你大概什么时候动手？',
    hint: '这里的「动手」包含打开文件并盯着它看。',
    options: [
      {
        id: 'q2a',
        label: '当天就做完，剩下的时间用来怀疑做得对不对',
        effects: { delay: 15, doubt: -6, attention: 4 },
        tag: '提前焦虑型',
      },
      {
        id: 'q2b',
        label: '前两天慢慢推进，最后一天收尾',
        effects: { delay: 8, attention: 2 },
        tag: '匀速推进',
      },
      {
        id: 'q2c',
        label: '最后一天晚上，边骂自己边完成',
        effects: { delay: -10, sleep: -8, doubt: -4 },
        tag: '极限冲刺',
      },
      {
        id: 'q2d',
        label: '先列一个很详细的计划，然后计划就没再打开过',
        effects: { delay: -13, tomorrow: -10, attention: -3 },
        tag: '计划收藏家',
      },
    ],
  },
  {
    id: 'q3',
    topic: '社交',
    prompt: '手机弹出一条「在吗」，你的第一反应是——',
    options: [
      {
        id: 'q3a',
        label: '马上回，顺便问对方什么事',
        effects: { social: 13, doubt: 4 },
        tag: '秒回体质',
      },
      {
        id: 'q3b',
        label: '看到了，想好措辞再回，结果过了两小时',
        effects: { social: -6, doubt: -6, delay: -3 },
        tag: '措辞困难户',
      },
      {
        id: 'q3c',
        label: '先装作没看到，等自己有空了再回',
        effects: { social: -12, doubt: -3 },
        tag: '延迟已读',
      },
      {
        id: 'q3d',
        label: '回一个表情包，语义模糊但礼貌',
        effects: { social: 3, doubt: 2, delay: -2 },
        tag: '表情包外交',
      },
    ],
  },
  {
    id: 'q4',
    topic: '消费',
    prompt: '看到购物车里躺了两周的东西，你会——',
    options: [
      {
        id: 'q4a',
        label: '删掉，发现自己其实不需要',
        effects: { wallet: 14, doubt: 3, reality: 4 },
        tag: '冷静派',
      },
      {
        id: 'q4b',
        label: '等一个大促，然后在大促里买更多',
        effects: { wallet: -8, delay: -5, tomorrow: -3 },
        tag: '凑单选手',
      },
      {
        id: 'q4c',
        label: '深夜下单，第二天早上有点后悔',
        effects: { wallet: -13, sleep: -5, doubt: -5 },
        tag: '深夜购物车',
      },
      {
        id: 'q4d',
        label: '买之前先做三页对比表格',
        effects: { wallet: 3, attention: -4, delay: -4 },
        tag: '比价工程师',
      },
    ],
  },
  {
    id: 'q5',
    topic: '睡眠',
    prompt: '工作日的最后一小时，通常长这样：',
    options: [
      {
        id: 'q5a',
        label: '洗漱躺平，手机放远一点',
        effects: { sleep: 14, attention: 5, reality: 4 },
        tag: '准点关机',
      },
      {
        id: 'q5b',
        label: '刷一会儿手机，「再看一集」',
        effects: { sleep: -6, attention: -4, delay: -4 },
        tag: '一集党',
      },
      {
        id: 'q5c',
        label: '补白天没干完的活，越干越精神',
        effects: { sleep: -12, delay: 6, attention: 2 },
        tag: '夜间工作者',
      },
      {
        id: 'q5d',
        label: '一边躺着一边复盘今天说错的每句话',
        effects: { sleep: -9, doubt: -14, social: -2 },
        tag: '夜间复盘者',
      },
    ],
  },
  {
    id: 'q6',
    topic: '自我怀疑',
    prompt: '发出一条消息之后，你通常会——',
    options: [
      {
        id: 'q6a',
        label: '发完就放下，等对方回就好',
        effects: { doubt: 13, social: 5 },
        tag: '已读不回免疫',
      },
      {
        id: 'q6b',
        label: '回头读一遍，确认没有错别字',
        effects: { doubt: 2, attention: -2 },
        tag: '复读检查员',
      },
      {
        id: 'q6c',
        label: '反复琢磨语气会不会太冲，想补一句「哈哈哈」',
        effects: { doubt: -11, social: -3 },
        tag: '语气敏感',
      },
      {
        id: 'q6d',
        label: '过十分钟没回就开始想「是不是我说错了什么」',
        effects: { doubt: -15, sleep: -5, social: -4 },
        tag: '内心弹幕',
      },
    ],
  },
  {
    id: 'q7',
    topic: '计划',
    prompt: '关于「明天开始」，你的真实情况是——',
    options: [
      {
        id: 'q7a',
        label: '今天已经开始了，明天只是继续',
        effects: { tomorrow: 14, delay: 9, attention: 4 },
        tag: '已在路上',
      },
      {
        id: 'q7b',
        label: '计划排到下周了，但至少写过',
        effects: { tomorrow: -4, delay: -5 },
        tag: '计划排队中',
      },
      {
        id: 'q7c',
        label: '每年「明天开始」的次数比天数多',
        effects: { tomorrow: -13, delay: -9, doubt: -4 },
        tag: '明日复明日',
      },
      {
        id: 'q7d',
        label: '不计划了，随缘做完就好',
        effects: { tomorrow: 4, doubt: 3, delay: -3 },
        tag: '随缘执行',
      },
    ],
  },
  {
    id: 'q8',
    topic: '现实',
    prompt: '上一个让你抬起头的瞬间是——',
    options: [
      {
        id: 'q8a',
        label: '今天出门了，还顺便看了下天气',
        effects: { reality: 15, sleep: 4, attention: 3 },
        tag: '线下签到',
      },
      {
        id: 'q8b',
        label: '点了外卖，开门时和骑手说了谢谢',
        effects: { reality: 5, social: 3, wallet: -3 },
        tag: '门口社交',
      },
      {
        id: 'q8c',
        label: '开窗看了一眼，原来外面下雨了',
        effects: { reality: -4, attention: -3 },
        tag: '天气盲区',
      },
      {
        id: 'q8d',
        label: '想不起来，最近都在屏幕里',
        effects: { reality: -14, sleep: -3, doubt: -3 },
        tag: '现实离线',
      },
    ],
  },
];

/** 快速作答（随机诊断用）：每个模块都能被覆盖到 */
export const QUESTION_COUNT = QUESTIONS.length;
