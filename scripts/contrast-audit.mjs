/**
 * 对比度审计：量出每段文字与背景的真实对比度（WCAG 2.1）。
 *
 * 规则：
 *   正文（<18.66px 常规 / <24px 粗体）→ 需 ≥ 4.5
 *   大字（≥18.66px 粗体 或 ≥24px）    → 需 ≥ 3.0
 *
 * 输出所有不达标项，供修色时逐条核对。
 * 用法：node scripts/contrast-audit.mjs [--verbose]
 */
import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { serveStatic } from './serve.mjs';

const VERBOSE = process.argv.includes('--verbose');
const OUT = join(process.cwd(), '.contrast-out');
mkdirSync(OUT, { recursive: true });

const DIST = join(process.cwd(), 'dist');
if (!existsSync(join(DIST, 'index.html'))) throw new Error('请先 npm run build');

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => existsSync(p));

const server = await serveStatic(DIST);

/** 页面内执行：对每个可见文本节点所在元素算对比度 */
const COLLECT = `(() => {
  const parse = (c) => {
    const m = c.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const p = m[1].split(',').map((x) => parseFloat(x));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = ({ r, g, b }) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); const hi = Math.max(l1, l2), lo = Math.min(l1, l2); return (hi + 0.05) / (lo + 0.05); };
  const over = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });

  /** 向上找第一个不透明背景（含 rgba 合成） */
  const bgOf = (el) => {
    let cur = el;
    const stack = [];
    while (cur && cur !== document.documentElement) {
      const s = getComputedStyle(cur);
      const c = parse(s.backgroundColor);
      const img = s.backgroundImage;
      if (c && c.a > 0.001) stack.push(c);
      if (img && img !== 'none' && /gradient/.test(img)) {
        const stops = [...img.matchAll(/rgba?\\([^)]+\\)/g)].map((m) => parse(m[0])).filter(Boolean);
        if (stops.length) {
          const opaque = stops.find((x) => x.a > 0.9) || stops[0];
          stack.push(opaque);
        }
      }
      if (c && c.a > 0.999) break;
      cur = cur.parentElement;
    }
    let base = { r: 4, g: 7, b: 10, a: 1 };
    for (let i = stack.length - 1; i >= 0; i -= 1) base = over(stack[i], base);
    return base;
  };

  const out = [];
  const seen = new Set();
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('.share-card') === null && el.closest('[data-audit-skip]')) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    let hasText = false;
    for (const n of el.childNodes) {
      if (n.nodeType === 3 && n.nodeValue && n.nodeValue.trim()) hasText = true;
    }
    if (!hasText) continue;
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none' || parseFloat(s.opacity) < 0.1) continue;
    const fgRaw = parse(s.color);
    if (!fgRaw) continue;
    const bg = bgOf(el);
    const fg = fgRaw.a < 1 ? over(fgRaw, bg) : fgRaw;
    const cr = ratio(fg, bg);
    const size = parseFloat(s.fontSize);
    const bold = parseInt(s.fontWeight, 10) >= 700;
    const large = size >= 24 || (bold && size >= 18.66);
    const need = large ? 3 : 4.5;
    const key = el.className + '|' + s.color + '|' + Math.round(size);
    if (cr < need && !seen.has(key)) {
      seen.add(key);
      out.push({
        cls: String(el.className).slice(0, 44),
        tag: el.tagName,
        text: (el.textContent || '').trim().slice(0, 22),
        size: +size.toFixed(1),
        bold,
        fg: s.color,
        bg: 'rgb(' + Math.round(bg.r) + ',' + Math.round(bg.g) + ',' + Math.round(bg.b) + ')',
        ratio: +cr.toFixed(2),
        need,
      });
    }
  }
  return out;
})()`;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

/**
 * 布局级检查（对比度查不出来的问题）：
 *   A. 中文标题与英文副标签不得重叠（上一版两者首尾相接，读起来像一整串）
 *   B. 带文字的整行不得被亮色背景铺满（会让文字彻底看不见）
 */
const LAYOUT_CHECK = `(() => {
  const problems = [];

  // A. 面板标题内的中英文重叠检测（必须同时满足「横向相接」和「同一行」才算重叠）
  for (const title of document.querySelectorAll('.panel-title')) {
    const en = title.querySelector('.panel-title-en');
    if (!en) continue;
    const textNodes = [];
    for (const n of title.childNodes) {
      if (n.nodeType === 3 && n.nodeValue && n.nodeValue.trim()) textNodes.push(n);
    }
    const enRect = en.getBoundingClientRect();
    for (const n of textNodes) {
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) {
        const horizOverlap = r.right > enRect.left - 2 && r.left < enRect.right + 2;
        const vertOverlap = r.bottom > enRect.top + 1 && r.top < enRect.bottom - 1;
        if (horizOverlap && vertOverlap) {
          problems.push({ kind: 'title-overlap', text: (title.textContent || '').trim().slice(0, 30) });
        }
      }
    }
  }

  // B. 档位色（level-*）只能作为**填充条**的 background。
  //    旧版把 .level-warn 直接挂在整行 <li> 上，于是琥珀铺满整行、文字对比度掉到 1.0。
  //    判定：带 level-* 类、不是 *-fill、但计算出的背景色不透明 → 就是那个 bug 复现了。
  for (const el of document.querySelectorAll('[class*="level-"]')) {
    const cls = String(el.className);
    if (/(sc-)?(reading|module-bar|progress)-fill/.test(cls)) continue;
    const s = getComputedStyle(el);
    const m = s.backgroundColor.match(/rgba?\\(([^)]+)\\)/);
    if (!m) continue;
    const p = m[1].split(',').map(Number);
    const a = p.length > 3 ? p[3] : 1;
    if (a > 0.05) {
      problems.push({
        kind: 'level-bg-on-row',
        cls: cls.slice(0, 34),
        bg: s.backgroundColor,
        text: (el.textContent || '').trim().slice(0, 20),
      });
    }
  }

  // C. 填充条里不应有文字（有文字就会被彩色条压住）
  for (const el of document.querySelectorAll('.reading-fill, .module-bar-fill, .sc-reading-fill')) {
    const text = (el.textContent || '').trim();
    if (text) problems.push({ kind: 'text-inside-fill', cls: String(el.className).slice(0, 30), text: text.slice(0, 20) });
  }

  return problems;
})()`;

const report = {};

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1000 });

  const runFor = async (label, prepare) => {
    await page.goto(server.url, { waitUntil: 'networkidle0' });
    await prepare();
    await new Promise((r) => setTimeout(r, 350));
    const bad = await page.evaluate(COLLECT);
    const layoutBad = await page.evaluate(LAYOUT_CHECK);
    report[label] = bad;
    report[`${label}/layout`] = layoutBad;
    return { bad, layoutBad };
  };

  const goResult = async () => {
    await page.click('[data-testid="start-random"]');
    await page.waitForSelector('[data-testid="scan-skip"]');
    await page.click('[data-testid="scan-skip"]');
    await page.waitForFunction(() => document.querySelector('[data-testid="rescan"]'), { timeout: 15000 });
  };

  const pages = [
    ['首页', async () => {}],
    ['问答页', async () => {
      await page.click('[data-testid="start-quiz"]');
      await page.waitForSelector('.option');
    }],
    ['自定义页', async () => {
      await page.click('[data-testid="start-custom"]');
      await page.waitForSelector('[data-testid="custom-submit"]');
    }],
    ['扫描页', async () => {
      await page.click('[data-testid="start-random"]');
      await page.waitForSelector('[data-testid="scan-skip"]');
      await new Promise((r) => setTimeout(r, 900));
    }],
    ['结果页/经典终端', async () => {
      await goResult();
    }],
    ['结果页/机密档案', async () => {
      await goResult();
      await page.click('[data-testid="template-dossier"]');
    }],
    ['结果页/霓虹广播', async () => {
      await goResult();
      await page.click('[data-testid="template-neon"]');
    }],
    ['分享面板', async () => {
      await goResult();
      await page.click('[data-testid="open-share"]');
      await page.waitForSelector('[data-testid="download-png"]');
    }],
  ];

  let total = 0;
  for (const [label, prepare] of pages) {
    const { bad, layoutBad } = await runFor(label, prepare);
    total += bad.length + layoutBad.length;
    console.log(`\n### ${label} — ${bad.length + layoutBad.length} 处不达标`);
    for (const b of bad) {
      console.log(
        `  [对比度 ${b.ratio.toFixed(2)}/${b.need}]  ${b.size}px${b.bold ? ' bold' : ''}  ${b.fg} on ${b.bg}  .${b.cls}  「${b.text}」`,
      );
    }
    for (const b of layoutBad) {
      console.log(`  [布局 ${b.kind}]  ${b.cls ?? ''}  ${b.bg ?? ''}  「${b.text}」`);
    }
    if (VERBOSE) console.log(JSON.stringify({ bad, layoutBad }, null, 1));
  }

  /* ---------- 移动端（390×844）同样要达标 ---------- */
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const mobilePages = [
    ['移动端/首页', async () => {}],
    ['移动端/问答页', async () => {
      await page.click('[data-testid="start-quiz"]');
      await page.waitForSelector('.option');
    }],
    ['移动端/结果页', async () => {
      await goResult();
    }],
    ['移动端/机密档案', async () => {
      await goResult();
      await page.click('[data-testid="template-dossier"]');
    }],
    ['移动端/分享面板', async () => {
      await goResult();
      await page.click('[data-testid="open-share"]');
      await page.waitForSelector('[data-testid="download-png"]');
    }],
  ];
  for (const [label, prepare] of mobilePages) {
    const { bad, layoutBad } = await runFor(label, prepare);
    total += bad.length + layoutBad.length;
    console.log(`\n### ${label} — ${bad.length + layoutBad.length} 处不达标`);
    for (const b of bad) {
      console.log(
        `  [对比度 ${b.ratio.toFixed(2)}/${b.need}]  ${b.size}px  ${b.fg} on ${b.bg}  .${b.cls}  「${b.text}」`,
      );
    }
    for (const b of layoutBad) {
      console.log(`  [布局 ${b.kind}]  ${b.cls ?? ''}  「${b.text}」`);
    }
  }
  await page.setViewport({ width: 1280, height: 1000 });

  /* ---------- 自检：故意埋两个缺陷，确认审计脚本不是「永远通过」 ---------- */
  await page.goto(server.url, { waitUntil: 'networkidle0' });
  await goResult();
  const selfCheck = await page.evaluate((check) => {
    // 缺陷 1：还原旧版 bug —— 整行 <li> 带 level-warn 且被档位色铺满背景
    const li = document.querySelector('.reading');
    li.classList.add('level-warn');
    li.style.background = '#ffcf6b';
    // 缺陷 2：把低对比度文字塞进面板标题
    const title = document.querySelector('.panel-title');
    const bad = document.createElement('span');
    bad.className = 'planted-low-contrast';
    bad.textContent = 'PLANTED';
    bad.style.color = '#3a4a46';
    bad.style.background = '#08131a';
    title.appendChild(bad);
    return eval(check);
  }, LAYOUT_CHECK);
  const selfCheckContrast = await page.evaluate(COLLECT);
  const plantedRow = selfCheck.some((p) => p.kind === 'level-bg-on-row');
  const plantedText = selfCheckContrast.some((p) => p.cls.includes('planted-low-contrast'));
  console.log(`\n### 审计自检`);
  console.log(`  埋入「整行档位色」→ 检出：${plantedRow ? '是 ✅' : '否 ❌'}`);
  console.log(`  埋入「低对比度文字」→ 检出：${plantedText ? '是 ✅' : '否 ❌'}`);
  if (!plantedRow) total += 1;
  if (!plantedText) total += 1;

  writeFileSync(join(OUT, 'contrast.json'), JSON.stringify(report, null, 2), 'utf8');
  console.log(`\n=== 合计 ${total} 处不达标（对比度 + 布局）===`);
  if (total > 0) process.exitCode = 1;
} finally {
  await browser.close();
  await server.close();
}
