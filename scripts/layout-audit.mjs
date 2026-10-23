/**
 * 布局体检：多种视口 × 全部页面，检查
 *   1) 横向溢出（scrollWidth > clientWidth）；
 *   2) 元素越出视口右边；
 *   3) 过小正文字号（< 11px）；
 *   4) 可点击目标高度（移动端 < 32px）；
 *   5) 关键内容区块是否存在。
 *
 * 用法：先 `npm run build && npm run preview`，再 `node scripts/layout-audit.mjs`
 */
import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { serveStatic } from './serve.mjs';

const OUT = join(process.cwd(), '.layout-out');
mkdirSync(OUT, { recursive: true });

/* 未显式传 baseUrl 时自起静态服务器指向 dist/（需先 npm run build） */
const DIST = join(process.cwd(), 'dist');
if (!existsSync(join(DIST, 'index.html'))) {
  throw new Error('未找到 dist/index.html，请先运行 npm run build');
}
const server = process.argv[2] ? null : await serveStatic(DIST);
const BASE = process.argv[2] || server.url;

const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];
function findBrowser() {
  for (const p of CHROME_PATHS) if (existsSync(p)) return p;
  throw new Error('未找到本机 Chrome/Edge');
}

const VIEWPORTS = [
  { name: '320x640 (最小手机)', width: 320, height: 640, mobile: true },
  { name: '390x844 (iPhone)', width: 390, height: 844, mobile: true },
  { name: '768x1024 (平板)', width: 768, height: 1024, mobile: true },
  { name: '1440x900 (桌面)', width: 1440, height: 900, mobile: false },
];

let passed = 0;
const failures = [];
function check(name, ok, detail) {
  if (ok) passed += 1;
  else failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 通用页面体检 */
async function audit(page, label) {
  const data = await page.evaluate(() => {
    const de = document.documentElement;
    const overflow = de.scrollWidth - de.clientWidth;
    const vw = de.clientWidth;

    const offscreen = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.right > vw + 1.5) {
        const cs = getComputedStyle(el);
        // 装饰层（app-bg 内的网格/光束）本身在 overflow:hidden 容器里，且 pointer-events:none，
        // 不构成真实横向溢出；这里排除它们，避免误报。
        if (cs.position === 'fixed') continue;
        if (el.closest('.app-bg') || cs.pointerEvents === 'none') continue;
        offscreen.push({
          tag: el.tagName,
          cls: String(el.className).slice(0, 32),
          right: Math.round(r.right),
          text: (el.textContent ?? '').trim().slice(0, 16),
        });
      }
    }

    const tiny = [];
    for (const el of document.querySelectorAll('p, li, span, td, em, i, small, div, h1, h2, h3, h4, button, label')) {
      if (el.children.length > 0) continue;
      // 分享卡是按 3× 导出的图片内容（7px → 实际 21px），不算界面正文
      if (el.closest('.share-card')) continue;
      const text = (el.textContent ?? '').trim();
      if (text.length < 6) continue;
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size < 11) tiny.push({ text: text.slice(0, 16), size });
    }

    const smallTargets = [];
    const minTap = window.matchMedia('(max-width: 640px)').matches ? 44 : 32;
    for (const el of document.querySelectorAll('button, a[href]')) {
      const r = el.getBoundingClientRect();
      // 允许 0.5px 的亚像素舍入误差
      if (r.width > 0 && r.height > 0 && r.height < minTap - 0.5) {
        smallTargets.push({ h: Math.round(r.height), text: (el.textContent ?? '').trim().slice(0, 14) });
      }
    }
    // 滑杆：命中区域由整条轨道提供（高度 34px），单独按按钮阈值判断会误报，这里用 30px 底线
    for (const el of document.querySelectorAll('input[type="range"]')) {
      const r = el.getBoundingClientRect();
      if (r.height < 30) smallTargets.push({ h: Math.round(r.height), text: 'range' });
    }

    return { overflow, offscreen: offscreen.slice(0, 6), tiny: tiny.slice(0, 6), smallTargets: smallTargets.slice(0, 6) };
  });

  check(`${label}：无横向溢出`, data.overflow <= 1, `${data.overflow}px`);
  check(`${label}：无元素越出视口右边`, data.offscreen.length === 0, JSON.stringify(data.offscreen.slice(0, 3)));
  check(`${label}：无过小正文（≥11px）`, data.tiny.length === 0, JSON.stringify(data.tiny.slice(0, 3)));
  check(`${label}：可点击目标达标（移动端 ≥44px）`, data.smallTargets.length === 0, JSON.stringify(data.smallTargets.slice(0, 3)));
}

const browser = await puppeteer.launch({
  executablePath: findBrowser(),
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const summary = [];

try {
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage();
    await page.setViewport({
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: vp.mobile ? 2 : 1,
      isMobile: vp.mobile,
      hasTouch: vp.mobile,
    });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    const tag = `${vp.name}`;
    await page.goto(BASE, { waitUntil: 'networkidle0' });
    await audit(page, `${tag} / 首页`);
    await page.screenshot({ path: join(OUT, `home-${vp.width}.png`), fullPage: true });

    // 扫描页
    await page.click('[data-testid="start-random"]');
    await page.waitForSelector('[data-testid="scan-skip"]');
    await sleep(500);
    await audit(page, `${tag} / 扫描页`);
    await page.screenshot({ path: join(OUT, `scan-${vp.width}.png`) });

    // 结果页
    await page.click('[data-testid="scan-skip"]');
    await page.waitForFunction(() => document.querySelector('[data-testid="rescan"]') !== null, { timeout: 10000 });
    await audit(page, `${tag} / 结果页`);
    await page.screenshot({ path: join(OUT, `result-${vp.width}.png`), fullPage: true });

    // 分享面板
    await page.click('[data-testid="share-modal-open"], [data-testid="open-share"]').catch(() => {});
    await page.waitForSelector('[data-testid="download-png"]', { timeout: 5000 });
    await audit(page, `${tag} / 分享面板`);
    await page.keyboard.press('Escape');
    await sleep(200);

    // 问答页
    await page.click('[data-testid="switch-mode"]');
    await page.waitForSelector('[data-testid="start-quiz"]');
    await page.click('[data-testid="start-quiz"]');
    await page.waitForSelector('.option');
    await audit(page, `${tag} / 问答页`);
    await page.screenshot({ path: join(OUT, `quiz-${vp.width}.png`) });

    // 自定义页
    await page.goto(BASE, { waitUntil: 'networkidle0' });
    await page.click('[data-testid="start-custom"]');
    await page.waitForSelector('[data-testid="custom-submit"]');
    await audit(page, `${tag} / 自定义页`);
    await page.screenshot({ path: join(OUT, `custom-${vp.width}.png`), fullPage: true });

    check(`${tag}：无 JS 错误`, errors.length === 0, errors.slice(0, 2).join(' | '));

    summary.push({ viewport: vp.name, errors: errors.length });
    await page.close();
  }

  writeFileSync(join(OUT, 'layout-summary.json'), JSON.stringify({ passed, failures, summary }, null, 2), 'utf8');
  console.log(`\n=== 布局体检：${passed} 通过 / ${failures.length} 失败 ===`);
  if (failures.length) {
    for (const f of failures) console.log(` ✕ ${f}`);
    process.exitCode = 1;
  } else {
    console.log(`全部通过 ✅（${VIEWPORTS.length} 视口 × 5 个页面）`);
  }
} finally {
  await browser.close();
  if (server) await server.close();
}
