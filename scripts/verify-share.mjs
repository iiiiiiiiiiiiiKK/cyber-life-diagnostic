/**
 * 分享图导出校验（自包含：用 esbuild 现打包压力测试页，不需要另开 dev server）。
 *
 * 校验内容：
 * 1. 16 种结果 × 2 种比例 × 3 套模板 = 96 张卡片全部能渲染与导出；
 * 2. 导出尺寸精确为 1080×1080 / 1080×1440；
 * 3. PNG 能真正解码（不是空白 / 透明图），并统计颜色数与不透明比例；
 * 4. 卡片内每一段文字的包围盒都完整落在卡内（中文没有被裁切）；
 * 5. 每张卡都带品牌名、网址与「娱乐模拟」声明。
 *
 * 用法：npm run test:share
 */
import { build } from 'esbuild';
import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { serveStatic } from './serve.mjs';

/** 从源码里读出分享卡页脚用的网址标签，避免测试写死旧域名 */
const SITE_URL_LABEL = (() => {
  const src = readFileSync('src/data/site.ts', 'utf8');
  const m = src.match(/export const SITE_URL_LABEL\s*=\s*'([^']+)'/);
  if (!m) throw new Error('无法从 src/data/site.ts 读取 SITE_URL_LABEL');
  return m[1];
})();

const OUT = join(process.cwd(), '.share-check');
const WEB = join(OUT, 'web');
rmSync(OUT, { recursive: true, force: true });
mkdirSync(WEB, { recursive: true });

const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];
function findBrowser() {
  for (const p of CHROME_PATHS) if (existsSync(p)) return p;
  throw new Error('未找到本机 Chrome/Edge，请改 scripts/verify-share.mjs 的 CHROME_PATHS');
}

let passed = 0;
const failures = [];
function check(name, condition, detail) {
  if (condition) passed += 1;
  else failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
}

/** 极简 PNG 解码：支持 8bit 非隔行 color type 2 / 6 */
function decodePng(buf) {
  if (buf[0] !== 0x89 || buf.toString('ascii', 1, 4) !== 'PNG') throw new Error('not png');
  let pos = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) return { width, height, unsupported: true };
  const channels = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let x = 0; x < stride; x += 1) {
      const a = x >= channels ? line[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      line[x] = v & 0xff;
    }
    line.copy(out, y * stride);
    prev = line;
  }
  return { width, height, channels, pixels: out, unsupported: false };
}

function imageStats({ width, height, channels, pixels }) {
  const colors = new Set();
  let sum = 0;
  let samples = 0;
  let opaque = 0;
  for (let y = 0; y < height; y += 7) {
    for (let x = 0; x < width; x += 7) {
      const i = (y * width + x) * channels;
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const a = channels === 4 ? pixels[i + 3] : 255;
      if (a > 8) opaque += 1;
      colors.add(((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3));
      sum += (r + g + b) / 3;
      samples += 1;
    }
  }
  return { colors: colors.size, brightness: sum / samples, opaqueRatio: opaque / samples };
}

/* ---------- 1. 打包压力测试页 ---------- */
await build({
  entryPoints: ['scripts/share-stress.entry.tsx'],
  bundle: true,
  format: 'esm',
  target: 'es2020',
  jsx: 'automatic',
  outdir: WEB,
  entryNames: 'stress',
  assetNames: 'assets/[name]',
  define: { 'process.env.NODE_ENV': '"production"' },
  loader: { '.css': 'css' },
  logLevel: 'error',
});

const cssFile = readdirSync(WEB).find((f) => f.endsWith('.css'));
writeFileSync(
  join(WEB, 'index.html'),
  `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>share stress</title><link rel="icon" href="data:,">${
    cssFile ? `<link rel="stylesheet" href="./${cssFile}">` : ''
  }<style>body{background:#04070a;color:#cfe9df;font-family:monospace;margin:0;padding:12px}.cards{display:flex;flex-wrap:wrap;gap:10px}.meta{font-size:10px;color:#55706b}</style></head><body><p id="status">loading…</p><div class="cards" id="cards"></div><script type="module" src="./stress.js"></script></body></html>`,
  'utf8',
);

const server = await serveStatic(WEB);
const browser = await puppeteer.launch({
  executablePath: findBrowser(),
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  await page.goto(`${server.url}index.html`, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForFunction(() => typeof window.__exportAll === 'function', { timeout: 30000 });
  await page.waitForFunction(
    () => (document.getElementById('status')?.textContent ?? '').startsWith('ready'),
    { timeout: 30000 },
  );

  const jobs = await page.evaluate(() => window.__shareJobs);
  check('卡片总数 = 16 类型 × 2 比例 × 3 模板', jobs.length === 96, String(jobs.length));

  /* ---------- 2. DOM 几何：文字是否完整落在卡内 ---------- */
  const problems = await page.evaluate((urlNeedle) => {
    const out = [];
    for (const card of document.querySelectorAll('[data-share-card]')) {
      const label = card.closest('.card-wrap')?.querySelector('.meta')?.textContent ?? '';
      const cardRect = card.getBoundingClientRect();

      // (a) 所有元素的盒子不得越出卡片
      for (const el of card.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        if (
          r.bottom > cardRect.bottom + 0.5 ||
          r.right > cardRect.right + 0.5 ||
          r.left < cardRect.left - 0.5 ||
          r.top < cardRect.top - 0.5
        ) {
          out.push({ label, kind: 'box-out', cls: String(el.className).slice(0, 28), text: (el.textContent ?? '').slice(0, 20) });
        }
      }

      // (b) 每个文字节点的字形盒不得越出卡片（防中文被裁切）
      const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        const value = (node.nodeValue ?? '').trim();
        if (value) {
          const range = document.createRange();
          range.selectNodeContents(node);
          for (const r of range.getClientRects()) {
            if (
              r.bottom > cardRect.bottom + 0.5 ||
              r.right > cardRect.right + 0.5 ||
              r.left < cardRect.left - 0.5 ||
              r.top < cardRect.top - 0.5
            ) {
              out.push({ label, kind: 'text-out', text: value.slice(0, 24) });
              break;
            }
          }
        }
        node = walker.nextNode();
      }

      // (c) 品牌 / 网址 / 免责声明必须存在
      // 网址从源码真实值读取，避免改域名后测试写死旧值（曾因此误报 missing-url）
      const text = card.innerText ?? '';
      if (!text.includes('赛博人生诊断器')) out.push({ label, kind: 'missing-brand' });
      if (!text.includes(urlNeedle)) {
        out.push({ label, kind: 'missing-url' });
      }
      if (!text.includes('娱乐模拟')) out.push({ label, kind: 'missing-disclaimer' });
    }
    return out;
  }, SITE_URL_LABEL);
  check('96 张卡片均无裁切 / 越界 / 缺品牌', problems.length === 0, JSON.stringify(problems.slice(0, 4)));

  /* ---------- 3. 逐张导出并解码 ---------- */
  const exported = await page.evaluate(() => window.__exportAll(undefined, 3));
  const ids = Object.keys(exported);
  check('全部卡片成功导出', ids.length === 96, String(ids.length));

  let sizeOk = 0;
  let decodable = 0;
  let nonBlank = 0;
  const bad = [];
  for (const id of ids) {
    const item = exported[id];
    const buf = Buffer.from(item.dataUrl.split(',')[1], 'base64');
    const wantH = item.ratio === '3x4' ? 1440 : 1080;
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    if (w === 1080 && h === wantH) sizeOk += 1;
    else bad.push(`${id}:${w}x${h}`);
    const decoded = decodePng(buf);
    if (!decoded.unsupported && decoded.width > 0) decodable += 1;
    if (!decoded.unsupported) {
      const stats = imageStats(decoded);
      if (stats.colors > 40 && stats.opaqueRatio > 0.98) nonBlank += 1;
      else bad.push(`${id}:colors=${stats.colors},opaque=${stats.opaqueRatio.toFixed(2)}`);
    }
  }
  check('96 张导出尺寸全部正确', sizeOk === 96, `${sizeOk}/96 ${bad.slice(0, 3).join(' ')}`);
  check('96 张 PNG 全部可解码', decodable === 96, String(decodable));
  check('96 张 PNG 均非空白 / 非透明', nonBlank === 96, `${nonBlank}/96`);

  /* ---------- 4. 抽样落盘，便于人工抽查 ---------- */
  const samples = [
    'terminal-1x1-attention-outage',
    'terminal-3x4-multithread-overload',
    'dossier-1x1-balanced-human',
    'dossier-3x4-slow-reality',
    'neon-1x1-emotion-consumption',
    'neon-3x4-system-restart',
  ];
  for (const id of samples) {
    if (!exported[id]) continue;
    writeFileSync(join(OUT, `${id}.png`), Buffer.from(exported[id].dataUrl.split(',')[1], 'base64'));
  }
  check('抽样 6 张已落盘', samples.filter((id) => existsSync(join(OUT, `${id}.png`))).length === 6);

  /* ---------- 5. 标题区域实际尺寸 + 像素墨迹（中文真的画出来了） ---------- */
  const titles = await page.evaluate(() =>
    [...document.querySelectorAll('[data-share-card] .sc-title')].map((el) => {
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    }),
  );
  check(
    '所有卡片标题区域有实际尺寸（中文渲染成功）',
    titles.length === 96 && titles.every((r) => r.w > 80 && r.h > 12),
    JSON.stringify(titles.slice(0, 3)),
  );

  /** 在指定矩形内统计「非背景」像素占比，证明中文字形确实被绘制 */
  let inkOk = 0;
  const inkBad = [];
  for (const id of ids) {
    const item = exported[id];
    if (!item.rects?.title) continue;
    const buf = Buffer.from(item.dataUrl.split(',')[1], 'base64');
    const decoded = decodePng(buf);
    if (decoded.unsupported) continue;
    const scale = item.pixelRatio ?? 3;
    const rect = item.rects.title;
    const x0 = Math.max(0, Math.floor(rect.x * scale));
    const y0 = Math.max(0, Math.floor(rect.y * scale));
    const x1 = Math.min(decoded.width - 1, Math.ceil((rect.x + rect.w) * scale));
    const y1 = Math.min(decoded.height - 1, Math.ceil((rect.y + rect.h) * scale));
    let ink = 0;
    let total = 0;
    // 背景色（模板底色）作为基准
    const bg = item.template === 'dossier' ? [244, 237, 220] : item.template === 'neon' ? [18, 6, 26] : [4, 7, 10];
    for (let y = y0; y <= y1; y += 2) {
      for (let x = x0; x <= x1; x += 2) {
        const i = (y * decoded.width + x) * decoded.channels;
        const diff =
          Math.abs(decoded.pixels[i] - bg[0]) +
          Math.abs(decoded.pixels[i + 1] - bg[1]) +
          Math.abs(decoded.pixels[i + 2] - bg[2]);
        if (diff > 90) ink += 1;
        total += 1;
      }
    }
    const ratio = total > 0 ? ink / total : 0;
    // 标题区的非背景像素应占 4%–60%（太低=没画出来，太高=底色/错位）
    if (ratio > 0.04 && ratio < 0.6) inkOk += 1;
    else inkBad.push(`${id}:ink=${(ratio * 100).toFixed(1)}%`);
  }
  check('96 张标题区都检测到中文墨迹（4%–60%）', inkOk === 96, `${inkOk}/96 ${inkBad.slice(0, 3).join(' ')}`);

  check('页面无 JS 错误', errors.length === 0, errors.slice(0, 2).join(' | '));

  writeFileSync(join(OUT, 'share-check.json'), JSON.stringify({ passed, failures, cards: jobs.length }, null, 2), 'utf8');
  console.log(`\n=== 分享图校验：${passed} 通过 / ${failures.length} 失败 ===`);
  if (failures.length) {
    for (const f of failures) console.log(` ✕ ${f}`);
    process.exitCode = 1;
  } else {
    console.log('全部通过 ✅（96 张卡片：16 类型 × 2 比例 × 3 模板，均为 1080 宽）');
  }
} finally {
  await browser.close();
  await server.close();
}
