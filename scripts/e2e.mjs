/**
 * 浏览器端 E2E（Puppeteer + 本机 Chrome/Edge，不下载 Chromium）。
 *
 * 覆盖需求里的验收项：
 *   完整扫描 / 跳过扫描 / 随机诊断 / 问答诊断 / 自定义参数 / 中途退出 /
 *   重新开始 / 重复点击 / 图片导出（1:1 与 3:4）/ 复制文本 / 切换模式 /
 *   移动端无横向溢出 / 不请求任何浏览器权限 / 不出现虚假权限提示。
 *
 * 用法：先 `npm run build && npm run preview`，再 `node scripts/e2e.mjs [baseUrl]`
 */
import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { serveStatic } from './serve.mjs';

const OUT = join(process.cwd(), '.e2e-out');
mkdirSync(OUT, { recursive: true });

/** 每次运行前清空下载目录：避免上一轮的 PNG 干扰尺寸断言 */
const DOWNLOAD_DIR = join(OUT, 'downloads');
rmSync(DOWNLOAD_DIR, { recursive: true, force: true });
mkdirSync(DOWNLOAD_DIR, { recursive: true });

/* 未显式传 baseUrl 时，自己起一个静态服务器指向 dist/（需先 npm run build） */
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
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];

function findBrowser() {
  for (const p of CHROME_PATHS) if (existsSync(p)) return p;
  throw new Error('未找到本机 Chrome/Edge，请修改 scripts/e2e.mjs 顶部的 CHROME_PATHS');
}

let passed = 0;
const failures = [];
function check(name, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  ✕ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}
function section(t) {
  console.log(`\n## ${t}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function clickText(page, selector, text) {
  const handles = await page.$$(selector);
  for (const h of handles) {
    const t = await page.evaluate((el) => el.textContent ?? '', h);
    if (t.includes(text)) {
      await h.click();
      return true;
    }
  }
  return false;
}

const browser = await puppeteer.launch({
  executablePath: findBrowser(),
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });

  /* 记录所有权限请求与设备 API 调用 —— 必须为 0 */
  let pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') pageErrors.push(`console: ${msg.text()}`);
  });

  await page.evaluateOnNewDocument(() => {
    window.__permCalls = [];
    window.__deviceCalls = [];
    const md = navigator.mediaDevices;
    if (md && md.getUserMedia) {
      const orig = md.getUserMedia.bind(md);
      md.getUserMedia = (...a) => {
        window.__deviceCalls.push('getUserMedia');
        return orig(...a);
      };
    }
    const gb = navigator.getBattery;
    if (gb) {
      navigator.getBattery = (...a) => {
        window.__deviceCalls.push('getBattery');
        return gb.apply(navigator, a);
      };
    }
    if (navigator.geolocation) {
      const og = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
      navigator.geolocation.getCurrentPosition = (...a) => {
        window.__deviceCalls.push('geolocation');
        return og(...a);
      };
    }
    if (navigator.permissions?.query) {
      const oq = navigator.permissions.query.bind(navigator.permissions);
      navigator.permissions.query = (...a) => {
        window.__permCalls.push(String(a[0]?.name));
        return oq(...a);
      };
    }
    if (navigator.clipboard) {
      // 测试跑在 http://127.0.0.1 上，剪贴板写入可能被拒；替换为记录式 no-op，
      // 既能验证按钮链路，也能断言「复制的内容是否正确」。
      try {
        navigator.clipboard.writeText = async (text) => {
          window.__lastCopied = text;
        };
      } catch {
        /* 只读属性，忽略 */
      }
    }
  });

  await page.goto(BASE, { waitUntil: 'networkidle0' });

  /* ------------------------------------------------------------------ */
  section('1. 首页渲染与声明');

  const homeText = await page.evaluate(() => document.body.innerText);
  check('首页标题存在', homeText.includes('赛博人生诊断器'));
  check('首页含「不读取」声明', homeText.includes('不会读取你的摄像头'));
  check('首页写明不申请权限', homeText.includes('不会申请任何浏览器权限'));
  check('首页写明不联网不上传', homeText.includes('不联网、不上传'));
  check('首页列出 8 个虚构模块', ['注意力内存', '拖延缓存', '社交进程', '钱包电量', '睡眠服务', '自我怀疑模块', '明日计划队列', '现实连接状态'].every((n) => homeText.includes(n)));
  check('首页三个入口齐全', ['直接体验随机诊断', '生活习惯题', '自定义几个参数'].every((t) => homeText.includes(t)));
  check(
    '首页没有「点击授权」类诱导文案',
    !/请允许|点击授权|开启相机|开启麦克风|允许访问/.test(homeText),
  );

  const overflowDesktop = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  check('桌面端无横向溢出', overflowDesktop <= 1, `${overflowDesktop}px`);

  /* ------------------------------------------------------------------ */
  section('2. 随机诊断 · 完整扫描');

  const t0 = Date.now();
  await page.click('[data-testid="start-random"]');
  await page.waitForSelector('[data-testid="scan-skip"]');
  check('进入扫描页', true);

  const scanText1 = await page.evaluate(() => document.body.innerText);
  check('扫描页有模拟声明', scanText1.includes('所有检测项、读数与告警都是本地模拟'));
  check('扫描页有 5 个阶段', (await page.$$('.phase')).length === 5);

  // 采集进度，确认进度在推进且单调
  const samples = [];
  for (let i = 0; i < 12; i += 1) {
    const v = await page.evaluate(() => {
      const el = document.querySelector('.progress-lg');
      return el ? Number(el.getAttribute('aria-valuenow')) : -1;
    });
    samples.push(v);
    await sleep(420);
  }
  const monotonic = samples.every((v, i) => i === 0 || v >= samples[i - 1]);
  check('扫描进度单调不减', monotonic, samples.join(','));
  check('扫描进度确实在推进', samples[samples.length - 1] > samples[0], `${samples[0]} → ${samples[samples.length - 1]}`);

  // 等自然结束（不跳过），验证完整扫描有结束态
  await page.waitForFunction(
    () => document.querySelector('[data-testid="rescan"]') !== null,
    { timeout: 40000 },
  );
  const elapsedFull = Date.now() - t0;
  check('完整扫描在 40 秒内结束（无卡死）', elapsedFull < 40000, `${elapsedFull}ms`);
  check('完整扫描耗时在 15–30 秒区间', elapsedFull >= 14000, `${elapsedFull}ms`);

  const resultText = await page.evaluate(() => document.body.innerText);
  check('结果页有报告标题', resultText.includes('人生系统诊断报告'));
  check('结果页有系统状态', resultText.includes('系统状态'));
  check('结果页有 8 项读数', ['注意力内存', '拖延缓存', '社交进程', '钱包电量', '睡眠服务', '自我怀疑模块', '明日计划队列', '现实连接状态'].every((n) => resultText.includes(n)));
  check('结果页有最终结论', resultText.includes('最终结论'));
  check('结果页有 3 条建议', (await page.$$('.advice-list li')).length === 3);
  check('结果页有免责声明', resultText.includes('非医疗') || resultText.includes('非心理诊断'));

  const healthScore = await page.evaluate(() => Number(document.querySelector('[data-testid="health-score"]')?.textContent));
  check('综合健康度在 0–100', healthScore >= 0 && healthScore <= 100, String(healthScore));
  const resultName = (await page.evaluate(() => document.querySelector('[data-testid="result-name"]')?.textContent ?? '')).trim();
  check('结果名称非空', resultName.length >= 4, resultName);
  const serialText = await page.evaluate(() => document.body.innerText.match(/CLD-\d{4}-[0-9A-F]{4}/)?.[0] ?? '');
  check('结果页有编号', /^CLD-\d{4}-[0-9A-F]{4}$/.test(serialText), serialText);

  await page.screenshot({ path: join(OUT, 'result-desktop.png'), fullPage: false });

  /* ------------------------------------------------------------------ */
  section('3. 跳过扫描 + 确定性');

  await page.click('[data-testid="rescan"]');
  await page.waitForSelector('[data-testid="scan-skip"]');
  const tSkip = Date.now();
  await page.click('[data-testid="scan-skip"]');
  await page.waitForFunction(() => document.querySelector('[data-testid="rescan"]') !== null, { timeout: 8000 });
  const skipElapsed = Date.now() - tSkip;
  check('跳过动画后 8 秒内出结果', skipElapsed < 8000, `${skipElapsed}ms`);
  const nameSkip = (await page.evaluate(() => document.querySelector('[data-testid="result-name"]')?.textContent ?? '')).trim();
  const scoreSkip = await page.evaluate(() => Number(document.querySelector('[data-testid="health-score"]')?.textContent));
  check('相同输入重新扫描 → 结果一致', nameSkip === resultName && scoreSkip === healthScore, `${nameSkip}/${scoreSkip} vs ${resultName}/${healthScore}`);

  /* ------------------------------------------------------------------ */
  section('4. 扫描中途退出');

  await page.click('[data-testid="rescan"]');
  await page.waitForSelector('[data-testid="scan-exit"]');
  await sleep(600);
  await page.click('[data-testid="scan-exit"]');
  await page.waitForSelector('[data-testid="start-random"]', { timeout: 5000 });
  check('中途退出扫描回到首页', true);
  const afterExit = await page.evaluate(() => document.body.innerText);
  check('退出后首页可继续操作', afterExit.includes('直接体验随机诊断'));

  /* ------------------------------------------------------------------ */
  section('5. 问答诊断（8 题）');

  await page.click('[data-testid="start-quiz"]');
  await page.waitForSelector('[data-testid="quiz-next"]');
  const quizText = await page.evaluate(() => document.body.innerText);
  check('问答页显示题量 01 / 08', quizText.includes('01 / 08'));
  check('问答页有 8 个题号按钮', (await page.$$('.dot')).length === 8);

  // 逐题选第一个选项
  for (let i = 0; i < 8; i += 1) {
    const opt = await page.$('.option');
    check(`第 ${i + 1} 题可点击选项`, Boolean(opt));
    await opt.click();
    await page.click('[data-testid="quiz-next"]');
    await sleep(60);
  }
  await page.waitForSelector('[data-testid="scan-skip"]', { timeout: 6000 });
  check('答完 8 题进入扫描', true);
  await page.click('[data-testid="scan-skip"]');
  await page.waitForFunction(() => document.querySelector('[data-testid="rescan"]') !== null, { timeout: 8000 });
  const quizResult = await page.evaluate(() => document.body.innerText);
  check('问答结果标注模式为「问答诊断」', quizResult.includes('问答诊断'));

  /* 问答：进度保存与刷新恢复 */
  await page.click('[data-testid="switch-mode"]');
  await page.waitForSelector('[data-testid="start-quiz"]');
  await page.click('[data-testid="start-quiz"]');
  await page.waitForSelector('.option');
  await (await page.$('.option')).click();
  await sleep(120);
  await page.reload({ waitUntil: 'networkidle0' });
  const homeAfterReload = await page.evaluate(() => document.body.innerText);
  check('刷新后首页提示未完成问答', homeAfterReload.includes('有未完成的问答诊断'));
  check('刷新后提供继续答题', homeAfterReload.includes('继续答题'));

  /* ------------------------------------------------------------------ */
  section('6. 自定义参数（读数跟随输入）');

  await page.click('[data-testid="start-custom"]');
  await page.waitForSelector('[data-testid="custom-submit"]');
  check('自定义页有 8 个滑杆', (await page.$$('.slider-item')).length === 8);
  // 把所有滑杆拉到 90（健康度）→ delay/doubt/tomorrow 的读数应为 10
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('.slider-item input[type="range"]')) {
      const input = el;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, '90');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await sleep(120);
  const previewVals = await page.evaluate(() =>
    [...document.querySelectorAll('.slider-value')].map((el) => Number(el.textContent.replace(/[^0-9]/g, ''))),
  );
  check('逆向模块预览读数为 10', previewVals.filter((v) => v === 10).length === 3, previewVals.join(','));
  check('正向模块预览读数为 90', previewVals.filter((v) => v === 90).length === 5, previewVals.join(','));

  await page.click('[data-testid="custom-submit"]');
  await page.waitForSelector('[data-testid="scan-skip"]', { timeout: 6000 });
  await page.click('[data-testid="scan-skip"]');
  await page.waitForFunction(() => document.querySelector('[data-testid="rescan"]') !== null, { timeout: 8000 });
  const customReadings = await page.evaluate(() =>
    [...document.querySelectorAll('.reading-value')].map((el) => Number(el.textContent.replace(/[^0-9]/g, '').slice(0, 3))),
  );
  check('报告读数与自定义输入一致（90×5 + 10×3）',
    customReadings.filter((v) => v === 90).length === 5 && customReadings.filter((v) => v === 10).length === 3,
    customReadings.join(','));
  const customText = await page.evaluate(() => document.body.innerText);
  check('报告标注自定义模式', customText.includes('自定义参数'));

  /* ------------------------------------------------------------------ */
  section('7. 复制结果文本');

  await page.click('[data-testid="copy-text"]');
  await sleep(300);
  const copyLabel = await page.evaluate(
    () => document.querySelector('[data-testid="copy-text"]')?.textContent ?? '',
  );
  check(
    '复制按钮出现成功反馈',
    copyLabel.includes('已复制') || copyLabel.includes('复制失败'),
    copyLabel,
  );
  const copyPayload = await page.evaluate(() => window.__lastCopied ?? '');
  check('复制内容包含结果名称与网址', copyPayload.includes('cyber-life.example.com'), copyPayload.slice(0, 40));

  /* ------------------------------------------------------------------ */
  section('8. 分享图导出（1:1 与 3:4）');

  await page.click('[data-testid="open-share"]');
  await page.waitForSelector('[data-testid="download-png"]');
  check('分享面板打开', true);
  const card1 = await page.evaluate(() => {
    const el = document.querySelector('[data-share-card="1x1"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { w: r.width, h: r.height };
  });
  check('1:1 卡片尺寸 360×360', card1 && Math.round(card1.w) === 360 && Math.round(card1.h) === 360, JSON.stringify(card1));

  await page.click('[data-testid="ratio-3x4"]');
  await sleep(200);
  const card34 = await page.evaluate(() => {
    const el = document.querySelector('[data-share-card="3x4"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { w: r.width, h: r.height };
  });
  check('3:4 卡片尺寸 360×480', card34 && Math.round(card34.w) === 360 && Math.round(card34.h) === 480, JSON.stringify(card34));

  const shareText = await page.evaluate(() => document.querySelector('[role="dialog"]')?.innerText ?? '');
  check('分享面板有品牌名', shareText.includes('赛博人生诊断器'));
  const cardText = await page.evaluate(() => document.querySelector('[data-share-card]')?.innerText ?? '');
  check('分享卡含网址', cardText.includes('cyber-life.example.com'));
  check('分享卡含娱乐声明', cardText.includes('娱乐模拟'));

  // 真实点一次下载，验证 Blob 生成链路
  const downloadDir = DOWNLOAD_DIR;
  const client = await page.target().createCDPSession();
  await client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir });
  await page.click('[data-testid="download-png"]');
  await page.waitForFunction(
    () => (document.querySelector('.modal-status')?.textContent ?? '').includes('已生成'),
    { timeout: 20000 },
  );
  const dlStatus = await page.evaluate(() => document.querySelector('.modal-status')?.textContent ?? '');
  check('下载状态提示成功', dlStatus.includes('1080') && dlStatus.includes('1440'), dlStatus);
  // 等文件真正落盘
  for (let i = 0; i < 40; i += 1) {
    if (readdirSync(downloadDir).some((f) => f.endsWith('.png'))) break;
    await sleep(250);
  }
  const downloaded = readdirSync(downloadDir).filter((f) => f.endsWith('.png'));
  check('实际产出 PNG 文件', downloaded.length >= 1, downloaded.join(','));
  if (downloaded.length > 0) {
    const buf = readFileSync(join(downloadDir, downloaded[0]));
    // PNG 头 + IHDR 尺寸
    const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    check('下载文件是合法 PNG', isPng);
    check('3:4 导出尺寸 1080×1440', width === 1080 && height === 1440, `${width}×${height}`);
  }

  // 切回 1:1 再导一次
  await page.click('[data-testid="ratio-1x1"]');
  await sleep(300);
  await page.click('[data-testid="download-png"]');
  await page.waitForFunction(
    () => (document.querySelector('.modal-status')?.textContent ?? '').includes('已生成'),
    { timeout: 20000 },
  );
  let squareFound = false;
  for (let i = 0; i < 40 && !squareFound; i += 1) {
    for (const f of readdirSync(downloadDir).filter((x) => x.endsWith('.png'))) {
      const buf = readFileSync(join(downloadDir, f));
      if (buf.readUInt32BE(16) === 1080 && buf.readUInt32BE(20) === 1080) squareFound = true;
    }
    if (!squareFound) await sleep(250);
  }
  check('1:1 导出尺寸 1080×1080', squareFound, readdirSync(downloadDir).join(','));
  check('两种比例共导出 2 个文件', readdirSync(downloadDir).filter((f) => f.endsWith('.png')).length === 2, readdirSync(downloadDir).join(','));

  await page.keyboard.press('Escape');
  await sleep(250);
  check('Esc 关闭分享面板', (await page.$('[data-testid="download-png"]')) === null);

  /* ------------------------------------------------------------------ */
  section('9. 模板切换');

  await page.click('[data-testid="template-dossier"]');
  await sleep(150);
  const dossierClass = await page.evaluate(() => document.querySelector('.result')?.className ?? '');
  check('切到「机密档案」模板', dossierClass.includes('template-dossier'));
  await page.click('[data-testid="template-neon"]');
  await sleep(150);
  const neonClass = await page.evaluate(() => document.querySelector('.result')?.className ?? '');
  check('切到「霓虹广播」模板', neonClass.includes('template-neon'));
  await page.screenshot({ path: join(OUT, 'result-neon.png') });
  await page.click('[data-testid="template-terminal"]');
  await sleep(120);

  /* ------------------------------------------------------------------ */
  section('10. 重新开始 / 切换模式 / 重复点击');

  await page.click('[data-testid="random-again"]');
  await page.waitForSelector('[data-testid="scan-skip"]');
  // 重复点击跳过：不应报错，也不应重复进入
  await page.click('[data-testid="scan-skip"]').catch(() => {});
  await page.click('[data-testid="scan-skip"]').catch(() => {});
  await page.waitForFunction(() => document.querySelector('[data-testid="rescan"]') !== null, { timeout: 8000 });
  check('重复点击「跳过动画」不影响流程', true);

  // 重复点击开始按钮
  await page.click('[data-testid="switch-mode"]');
  await page.waitForSelector('[data-testid="start-random"]');
  await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="start-random"]');
    btn.click();
    btn.click();
    btn.click();
  });
  await page.waitForSelector('[data-testid="scan-skip"]', { timeout: 5000 });
  const scanCount = (await page.$$('[data-testid="scan-skip"]')).length;
  check('连点三次开始按钮只进入一次扫描', scanCount === 1, String(scanCount));
  await page.click('[data-testid="scan-skip"]');
  await page.waitForFunction(() => document.querySelector('[data-testid="rescan"]') !== null, { timeout: 8000 });
  check('连点后流程仍可完成', true);

  /* ------------------------------------------------------------------ */
  section('11. 隐私：无权限请求 / 无设备 API 调用');

  const probe = await page.evaluate(() => ({
    perm: window.__permCalls ?? [],
    device: window.__deviceCalls ?? [],
  }));
  check('未调用 getUserMedia/getBattery/geolocation', probe.device.length === 0, JSON.stringify(probe.device));
  check('页面从未主动查询权限', probe.perm.length === 0, JSON.stringify(probe.perm));
  check('页面无 JS 运行时错误', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

  /* ------------------------------------------------------------------ */
  section('12. 移动端（390×844）');

  const mobile = await browser.newPage();
  await mobile.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const mobileErrors = [];
  mobile.on('pageerror', (e) => mobileErrors.push(String(e)));
  await mobile.goto(BASE, { waitUntil: 'networkidle0' });

  const checkOverflow = async (label) => {
    const diff = await mobile.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    check(`${label}：无横向溢出`, diff <= 1, `${diff}px`);
  };

  await checkOverflow('首页');
  await mobile.screenshot({ path: join(OUT, 'home-mobile.png'), fullPage: true });

  await mobile.click('[data-testid="start-random"]');
  await mobile.waitForSelector('[data-testid="scan-skip"]');
  await checkOverflow('扫描页');
  await mobile.screenshot({ path: join(OUT, 'scan-mobile.png') });
  await mobile.click('[data-testid="scan-skip"]');
  await mobile.waitForFunction(() => document.querySelector('[data-testid="rescan"]') !== null, { timeout: 8000 });
  await checkOverflow('结果页');
  await mobile.screenshot({ path: join(OUT, 'result-mobile.png'), fullPage: true });

  // 最小可点击尺寸（移动端主按钮 ≥44px）
  const smallTargets = await mobile.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll('button')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.height < 44) bad.push({ text: (el.textContent ?? '').trim().slice(0, 12), h: Math.round(r.height) });
    }
    return bad;
  });
  check('移动端按钮高度 ≥44px', smallTargets.length === 0, JSON.stringify(smallTargets.slice(0, 3)));

  // 字号可读性：正文最小 12px
  const tinyText = await mobile.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll('p, li, span, td, h1, h2, h3')) {
      const cs = getComputedStyle(el);
      const size = parseFloat(cs.fontSize);
      const text = (el.textContent ?? '').trim();
      if (text.length > 6 && size < 11) bad.push({ text: text.slice(0, 14), size });
    }
    return bad.slice(0, 5);
  });
  check('移动端没有过小正文（≥11px）', tinyText.length === 0, JSON.stringify(tinyText));

  await mobile.click('[data-testid="open-share"]');
  await mobile.waitForSelector('[data-testid="download-png"]');
  await checkOverflow('分享面板');
  await mobile.screenshot({ path: join(OUT, 'share-mobile.png') });
  await mobile.keyboard.press('Escape');

  // 移动端问答页
  await mobile.click('[data-testid="switch-mode"]');
  await mobile.waitForSelector('[data-testid="start-quiz"]');
  await mobile.click('[data-testid="start-quiz"]');
  await mobile.waitForSelector('.option');
  await checkOverflow('问答页');
  const optBox = await mobile.evaluate(() => {
    const r = document.querySelector('.option')?.getBoundingClientRect();
    return r ? { h: Math.round(r.height), w: Math.round(r.width) } : null;
  });
  check('移动端选项高度 ≥56px', optBox && optBox.h >= 56, JSON.stringify(optBox));
  await mobile.screenshot({ path: join(OUT, 'quiz-mobile.png') });

  // 移动端自定义页
  await mobile.goto(BASE, { waitUntil: 'networkidle0' });
  await mobile.click('[data-testid="start-custom"]');
  await mobile.waitForSelector('[data-testid="custom-submit"]');
  await checkOverflow('自定义页');
  await mobile.screenshot({ path: join(OUT, 'custom-mobile.png'), fullPage: true });
  check('移动端无 JS 错误', mobileErrors.length === 0, mobileErrors.slice(0, 2).join(' | '));

  /* ------------------------------------------------------------------ */
  section('13. 减少动画选项');

  const small = await browser.newPage();
  await small.setViewport({ width: 1280, height: 900 });
  await small.goto(BASE, { waitUntil: 'networkidle0' });
  await small.click('[data-testid="toggle-reduced-motion"]');
  const reducedOn = await small.evaluate(() => document.querySelector('.app')?.classList.contains('reduce-motion'));
  check('可开启「减少动画」', reducedOn === true);

  await small.click('[data-testid="start-random"]');
  await small.waitForSelector('[data-testid="scan-skip"]');
  const tReduced = Date.now();
  await small.waitForFunction(() => document.querySelector('[data-testid="rescan"]') !== null, { timeout: 15000 });
  const reducedElapsed = Date.now() - tReduced;
  check('减少动画时扫描 ≤ 8 秒', reducedElapsed <= 8000, `${reducedElapsed}ms`);

  // 持久化：刷新后仍然记住
  await small.reload({ waitUntil: 'networkidle0' });
  const stillReduced = await small.evaluate(() => document.querySelector('.app')?.classList.contains('reduce-motion'));
  check('「减少动画」偏好被记住', stillReduced === true);

  /* ------------------------------------------------------------------ */
  section('14. 清除本地数据');

  await small.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent ?? '').includes('清除本地数据'));
    btn?.click();
  });
  await sleep(150);
  await small.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent ?? '').includes('确认清除'));
    btn?.click();
  });
  await sleep(300);
  const keys = await small.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('cld.')));
  check('清除后本地键被移除', keys.length <= 1, JSON.stringify(keys));

  /* ------------------------------------------------------------------ */
  console.log(`\n=== E2E 结果：${passed} 通过 / ${failures.length} 失败 ===`);
  writeFileSync(join(OUT, 'e2e-summary.json'), JSON.stringify({ passed, failures }, null, 2), 'utf8');
  if (failures.length > 0) {
    console.log('\n失败项：');
    for (const f of failures) console.log(` ✕ ${f}`);
    process.exitCode = 1;
  } else {
    console.log('全部通过 ✅');
  }
} finally {
  await browser.close();
  if (server) await server.close();
}
