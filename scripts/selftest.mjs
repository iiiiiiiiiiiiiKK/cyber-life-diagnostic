/**
 * 规则层自测（不依赖浏览器）。
 * 用 esbuild 把 TS 源码打成临时 ESM，然后在 Node 里直接断言。
 *
 * 运行：node scripts/selftest.mjs
 */
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const tmp = join(process.cwd(), '.selftest-tmp');
mkdirSync(tmp, { recursive: true });
const outfile = join(tmp, 'bundle.mjs');

await build({
  entryPoints: ['src/lib/testable.ts'],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2020',
  outfile,
  logLevel: 'error',
});

const mod = await import(pathToFileURL(outfile).href);
const {
  QUESTIONS,
  ARCHETYPES,
  SCAN_MODULES,
  MODULE_MAP,
  computeResult,
  quizHealth,
  randomHealth,
  customHealth,
  valueFromHealth,
  pickArchetype,
  healthScoreOf,
  statusLineOf,
  anomaliesOf,
  buildScanPlan,
  stepAt,
  progressAt,
  toPlainText,
  toMarkdown,
  SCAN_PHASES,
  CUSTOM_PARAMS,
  CUSTOM_PRESETS,
  TEMPLATES,
  mulberry32,
  tierOf,
  healthOf,
} = mod;

let passed = 0;
const failures = [];
function check(name, condition, detail) {
  if (condition) passed += 1;
  else failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
}
function section(title) {
  console.log(`\n## ${title}`);
}

/* ------------------------------------------------------------------ */
section('1. 题库结构');

check('题量为 5~8 道', QUESTIONS.length >= 5 && QUESTIONS.length <= 8, `实际 ${QUESTIONS.length}`);

const qIds = new Set();
let dupQ = null;
for (const q of QUESTIONS) {
  if (qIds.has(q.id)) dupQ = q.id;
  qIds.add(q.id);
  check(`${q.id} 选项 3~5 个`, q.options.length >= 3 && q.options.length <= 5, `实际 ${q.options.length}`);
  const optIds = new Set();
  for (const o of q.options) {
    if (optIds.has(o.id)) dupQ = o.id;
    optIds.add(o.id);
    check(`${o.id} 影响至少一个模块`, Object.keys(o.effects).length > 0);
    for (const [k, v] of Object.entries(o.effects)) {
      check(`${o.id} 模块 ${k} 合法`, Boolean(MODULE_MAP[k]));
      check(`${o.id} 增量范围合理`, Math.abs(v) <= 20, `实际 ${v}`);
    }
  }
}
check('题目与选项 id 全局唯一', dupQ === null, dupQ);
check('覆盖 6 个以上主题', new Set(QUESTIONS.map((q) => q.topic)).size >= 6);

/* ------------------------------------------------------------------ */
section('2. 模块定义');

check('模块数量为 8', SCAN_MODULES.length === 8, `实际 ${SCAN_MODULES.length}`);
for (const m of SCAN_MODULES) {
  check(`${m.key} 权重合法`, m.weight > 0 && m.weight <= 0.5, `实际 ${m.weight}`);
  check(`${m.key} 档位从高到低`, m.tiers.every((t, i, arr) => i === 0 || arr[i - 1].min > t.min));
  check(`${m.key} 最低档位覆盖 0`, m.tiers[m.tiers.length - 1].min === 0);
  check(`${m.key} 至少 3 条检查项`, m.checks.length >= 3);
  check(`${m.key} 有日志素材`, m.logs.length >= 2);
}
const weightSum = SCAN_MODULES.reduce((s, m) => s + m.weight, 0);
check('权重总和为 1', Math.abs(weightSum - 1) < 1e-9, `实际 ${weightSum}`);

/* 档位函数边界 */
for (const m of SCAN_MODULES) {
  check(`${m.key} 100 → 第一档`, tierOf(m, 100) === m.tiers[0]);
  check(`${m.key} 0 → 最后一档`, tierOf(m, 0) === m.tiers[m.tiers.length - 1]);
  check(`${m.key} health 反向正确`, healthOf(m, 30) === (m.invert ? 70 : 30));
}

/* ------------------------------------------------------------------ */
section('3. 结果类型');

check('至少 12 种结果', ARCHETYPES.length >= 12, `实际 ${ARCHETYPES.length}`);
const aIds = new Set();
for (const a of ARCHETYPES) {
  check(`${a.id} id 唯一`, !aIds.has(a.id));
  aIds.add(a.id);
  check(`${a.id} 有名称/副标题/状态`, Boolean(a.name && a.subtitle && a.status));
  check(`${a.id} 描述不少于 30 字`, a.description.length >= 30, `实际 ${a.description.length}`);
  check(`${a.id} 结论非空`, a.verdict.length >= 8);
  check(`${a.id} 恰好 3 条建议`, a.advice.length === 3);
  check(`${a.id} 建议都非空`, a.advice.every((t) => t.length >= 8));
  check(`${a.id} 至少有 1 个标签`, a.tags.length >= 1);
  for (const r of a.rules) {
    check(`${a.id} 规则模块合法`, Boolean(MODULE_MAP[r.module]), r.module);
    check(`${a.id} 规则阈值合法`, r.value >= 0 && r.value <= 100, String(r.value));
  }
}
check('最后一个类型无条件兜底', ARCHETYPES[ARCHETYPES.length - 1].rules.length === 0);

/* ------------------------------------------------------------------ */
section('4. 评分确定性');

/* 4.1 同输入 → 同输出 */
const fixedAnswers = Object.fromEntries(QUESTIONS.map((q) => [q.id, q.options[0].id]));
const r1 = computeResult({ mode: 'quiz', answers: fixedAnswers, now: 1700000000000 });
const r2 = computeResult({ mode: 'quiz', answers: fixedAnswers, now: 1700000000000 });
check('问答模式确定性（读数一致）', JSON.stringify(r1.readings) === JSON.stringify(r2.readings));
check('问答模式确定性（编号一致）', r1.serial === r2.serial, `${r1.serial} vs ${r2.serial}`);
check('问答模式确定性（类型一致）', r1.archetype.id === r2.archetype.id);

const rr1 = computeResult({ mode: 'random', seed: 12345 });
const rr2 = computeResult({ mode: 'random', seed: 12345 });
check('随机模式同种子一致', JSON.stringify(rr1.readings) === JSON.stringify(rr2.readings));

const rr3 = computeResult({ mode: 'random', seed: 54321 });
check(
  '随机模式不同种子通常不同',
  JSON.stringify(rr3.readings) !== JSON.stringify(rr1.readings),
);

/* 4.2 随机模式读数范围 */
const rand = mulberry32(2024);
let minV = 101;
let maxV = -1;
for (let i = 0; i < 500; i += 1) {
  const seed = Math.floor(rand() * 0xffffffff);
  const res = computeResult({ mode: 'random', seed });
  for (const reading of res.readings) {
    minV = Math.min(minV, reading.value);
    maxV = Math.max(maxV, reading.value);
    check('随机读数在 0~100', reading.value >= 0 && reading.value <= 100, String(reading.value));
  }
}
check('随机读数有足够分布宽度', maxV - minV >= 40, `区间 ${minV}–${maxV}`);

/* 4.3 自定义模式：读数跟随参数 */
const customIn = { attention: 96, delay: 4, social: 50, wallet: 50, sleep: 50, doubt: 50, tomorrow: 50, reality: 50 };
const rc = computeResult({ mode: 'custom', custom: customIn });
const valOf = (res, key) => res.readings.find((x) => x.key === key).value;
check('自定义 attention=96 → 读数 96', valOf(rc, 'attention') === 96, String(valOf(rc, 'attention')));
check('自定义 delay=4（反向）→ 读数 96', valOf(rc, 'delay') === 96, String(valOf(rc, 'delay')));
check('invert 模块读数取反', valueFromHealth('delay', 30) === 70);

/* 4.4 问答与选择相关 */
const worstAnswers = Object.fromEntries(
  QUESTIONS.map((q) => {
    const best = [...q.options].sort((a, b) => sumEffects(b) - sumEffects(a))[0];
    return [q.id, best.id];
  }),
);
const bestAnswers = Object.fromEntries(
  QUESTIONS.map((q) => {
    const worst = [...q.options].sort((a, b) => sumEffects(a) - sumEffects(b))[0];
    return [q.id, worst.id];
  }),
);
function sumEffects(o) {
  return Object.values(o.effects).reduce((s, v) => s + v, 0);
}
const goodRes = computeResult({ mode: 'quiz', answers: worstAnswers });
const badRes = computeResult({ mode: 'quiz', answers: bestAnswers });
check(
  '选择更健康的选项 → 综合健康度更高',
  goodRes.healthScore > badRes.healthScore,
  `${goodRes.healthScore} vs ${badRes.healthScore}`,
);
check('两种极端答案得到不同类型', goodRes.archetype.id !== badRes.archetype.id, `${goodRes.archetype.id} / ${badRes.archetype.id}`);

/* 4.5 16 种类型全部可达（用随机采样 + 定向构造） */
const reached = new Map();
for (let i = 0; i < 4000; i += 1) {
  const seed = Math.floor(rand() * 0xffffffff);
  const res = computeResult({ mode: 'random', seed });
  reached.set(res.archetype.id, (reached.get(res.archetype.id) ?? 0) + 1);
}
for (const preset of CUSTOM_PRESETS) {
  const res = computeResult({ mode: 'custom', custom: preset.values });
  reached.set(res.archetype.id, (reached.get(res.archetype.id) ?? 0) + 1);
}
// 每个类型的规则阈值组合各来一次定向构造
for (const a of ARCHETYPES) {
  if (a.rules.length === 0) continue;
  const target = {};
  for (const m of SCAN_MODULES) target[m.key] = 50;
  for (const rule of a.rules) {
    // rules 使用的是「读数」；这里把读数换算成健康度再传入自定义模式
    const module = MODULE_MAP[rule.module];
    const value = rule.op === '>=' ? Math.min(100, rule.value + 6) : Math.max(0, rule.value - 6);
    target[rule.module] = module.invert ? 100 - value : value;
  }
  const res = computeResult({ mode: 'custom', custom: target });
  reached.set(res.archetype.id, (reached.get(res.archetype.id) ?? 0) + 1);
}
const unreached = ARCHETYPES.filter((a) => !reached.has(a.id)).map((a) => a.name);
check('全部 16 种类型均可达', unreached.length === 0, unreached.join(' / '));
console.log(
  '   类型覆盖：',
  [...reached.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, n]) => `${id}:${n}`)
    .join(' '),
);

/* ------------------------------------------------------------------ */
section('5. 报告结构');

const sample = computeResult({ mode: 'quiz', answers: fixedAnswers });
check('报告含编号', /^CLD-\d{4}-[0-9A-F]{4}$/.test(sample.serial), sample.serial);
check('报告含系统状态', sample.statusLine.length > 0);
check('报告含 8 项读数', sample.readings.length === 8);
check('报告含综合健康度 0~100', sample.healthScore >= 0 && sample.healthScore <= 100);
check('报告含趣味日志（≥4 条）', sample.logs.length >= 4);
check('日志首行含 SESSION OPEN', sample.logs[0].text.includes('SESSION OPEN'));
check('日志声明不读取设备', sample.logs.some((l) => l.text.includes('未申请任何浏览器权限')));
check('报告含结论', sample.archetype.verdict.length > 0);
check('报告含 3 条建议', sample.archetype.advice.length === 3);
check('报告标签 ≤6 个', sample.tags.length <= 6 && sample.tags.length > 0, String(sample.tags.length));
check('异常项 ≤4 个', sample.anomalies.length <= 4);
check(
  '异常项只包含告警/异常档位',
  sample.anomalies.every((a) => a.level === 'warn' || a.level === 'bad'),
);
check(
  '异常项按健康度升序（最差在前）',
  sample.anomalies.every((a, i, arr) => i === 0 || arr[i - 1].health <= a.health),
);

/* 健康度加权与状态文案 */
const h1 = healthScoreOf(sample.readings);
check('健康度与 computeResult 一致', h1 === sample.healthScore);
check('状态文案随分数变化', statusLineOf(90) !== statusLineOf(30));
check('anomaliesOf 排序（最差在前）', (() => {
  const list = anomaliesOf(sample.readings);
  return list.every((x, i) => i === 0 || list[i - 1].health <= x.health);
})());

/* 三种模式的数据来源说明各不相同 */
const modes = ['random', 'quiz', 'custom'].map((mode) =>
  computeResult({ mode, answers: fixedAnswers, custom: customIn, seed: 7 }),
);
check('三种模式的 simRule 文案不同', new Set(modes.map((r) => r.simRule)).size === 3);
check('三种模式都会生成标签', modes.every((r) => r.tags.length > 0));

/* ------------------------------------------------------------------ */
section('6. 文本导出');

const text = toPlainText(sample);
check('纯文本含结果名', text.includes(sample.archetype.name));
check('纯文本含编号', text.includes(sample.serial));
check('纯文本含 8 项读数', sample.readings.every((r) => text.includes(r.name)));
check('纯文本含 3 条建议', sample.archetype.advice.every((a) => text.includes(a)));
check('纯文本含免责声明', text.includes('娱乐模拟'));
check('纯文本含网址', text.includes('cyber-life.example.com'));
const md = toMarkdown(sample);
check('Markdown 含表格', md.includes('| 检测项目 | 读数 | 档位 |'));
check('Markdown 含结论', md.includes(sample.archetype.verdict));

/* ------------------------------------------------------------------ */
section('7. 扫描计划（流程规则）');

for (const reduced of [false, true]) {
  const plan = buildScanPlan(sample, { reducedMotion: reduced });
  const label = reduced ? '减少动画' : '正常速度';
  check(`${label}：步骤数量 ≥ 20`, plan.steps.length >= 20, String(plan.steps.length));
  check(`${label}：总时长在 1~25 秒之间`, plan.total > 800 && plan.total <= 25000, `${plan.total}ms`);
  check(`${label}：每步 duration > 0`, plan.steps.every((s) => s.duration > 0));
  check(`${label}：步骤 id 唯一`, new Set(plan.steps.map((s) => s.id)).size === plan.steps.length);
  check(`${label}：含 boot/load/alert/finish`, ['boot', 'load', 'alert', 'finish'].every((k) => plan.steps.some((s) => s.kind === k)));
  check(`${label}：含 8 个模块的 scan 步骤`, plan.steps.filter((s) => s.kind === 'scan').length === 8);
  check(`${label}：总时长等于各步之和`, plan.steps.reduce((s, x) => s + x.duration, 0) === plan.total);

  // 时间轴：末尾必到达 done，且进度单调不减
  const end = stepAt(plan, plan.total);
  check(`${label}：结束时 done=true`, end.done === true);
  check(`${label}：结束时停在最后一步`, end.index === plan.steps.length - 1);
  check(`${label}：超时也 done`, stepAt(plan, plan.total * 3).done === true);
  check(`${label}：进度到 1`, progressAt(plan, plan.total) === 1);
  check(`${label}：进度不为负`, progressAt(plan, -500) === 0);
  let prev = -1;
  let monotonic = true;
  for (let t = 0; t <= plan.total; t += 37) {
    const p = progressAt(plan, t);
    if (p < prev - 1e-9) monotonic = false;
    prev = p;
  }
  check(`${label}：进度单调不减`, monotonic);

  // 每个模块都会 reveal 一次，且值来自结果
  const reveals = plan.steps.filter((s) => s.reveal);
  check(`${label}：8 个模块均有 reveal`, new Set(reveals.map((r) => r.reveal.module)).size === 8);
  check(
    `${label}：reveal 值与结果读数一致`,
    reveals.every((r) => sample.readings.find((x) => x.key === r.reveal.module).value === r.reveal.value),
  );

  // 每一步都有日志或为纯展示步骤，不能出现空 label
  check(`${label}：每步都有 label`, plan.steps.every((s) => s.label.length > 0));
}
check('阶段条为 5 段', SCAN_PHASES.length === 5);
check('正常速度总时长 ≥ 15 秒', buildScanPlan(sample).total >= 15000, `${buildScanPlan(sample).total}ms`);
check('减少动画总时长 ≤ 6 秒', buildScanPlan(sample, { reducedMotion: true }).total <= 6000);

/* 跳过 = 直接到末尾，结果不变 */
const plan = buildScanPlan(sample);
const skipState = stepAt(plan, plan.total);
check('跳过动画等价于流程结束', skipState.done && progressAt(plan, plan.total) === 1);

/* ------------------------------------------------------------------ */
section('8. 文案安全（不恐吓、不伪装医疗）');

const forbidden = ['你有抑郁症', '确诊', '你患病了', '癌症', '死亡', '寿命', '手术', '会瘫痪'];
const allCopy = [
  ...ARCHETYPES.flatMap((a) => [a.name, a.subtitle, a.status, a.description, a.verdict, ...a.advice]),
  ...SCAN_MODULES.flatMap((m) => [m.name, m.metric, m.blurb, ...m.checks, ...m.logs]),
  ...QUESTIONS.flatMap((q) => [q.prompt, ...q.options.map((o) => o.label)]),
  sample.statusLine,
  ...sample.logs.map((l) => l.text),
].join('\n');
for (const word of forbidden) {
  check(`文案不含「${word}」`, !allCopy.includes(word));
}
check('免责声明含「非心理诊断」', toPlainText(sample).includes('非心理诊断'));

/* 可访问性与环境承诺：源码里不得出现真实设备 API 调用 */
check('自定义参数覆盖全部 8 个模块', CUSTOM_PARAMS.length === 8);
check('模板至少 3 种', TEMPLATES.length >= 3);

/* ------------------------------------------------------------------ */
console.log(`\n=== 自测结果：${passed} 通过 / ${failures.length} 失败 ===`);
if (failures.length > 0) {
  console.log('\n失败项：');
  for (const f of failures) console.log(` ✕ ${f}`);
  process.exitCode = 1;
} else {
  console.log('全部通过 ✅');
}
