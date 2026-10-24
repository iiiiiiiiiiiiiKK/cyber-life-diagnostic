import puppeteer from "puppeteer-core";
import { join } from "node:path";
import { mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";

/**
 * 线上验收：直接跑已部署的站点（默认 GitHub Pages）。
 * 用法：node scripts/live-audit.mjs [url]
 * 覆盖：首页声明 / 作者 𝕏 徽标 / 完整扫描 / 8 项读数 / 分享图真实下载 / 三套模板 /
 *       复制文本 / 移动端无溢出 / 全程 0 JS 错误。
 */
const SITE = process.argv[2] || 'https://iiiiiiiiiiiiiKK.github.io/cyber-life-diagnostic/';
const OUT = join(process.cwd(), ".live-check");
rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, "dl"), { recursive: true });

let pass = 0; const fails = [];
const check = (n, ok, d) => { if (ok) pass++; else fails.push(`${n}${d ? " — " + d : ""}`); console.log(`${ok ? "  ✓" : "  ✕"} ${n}${ok || !d ? "" : " — " + d}`); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: "new", args: ["--no-sandbox","--ignore-certificate-errors"] });
const page = await browser.newPage();
const errs = [];
page.on("pageerror", e => errs.push(String(e)));
page.on("requestfailed", r => errs.push("reqfail:" + r.url().split("/").pop()));

console.log("\n## 1. 首页（线上）");
await page.setViewport({ width: 1280, height: 900 });
await page.goto(SITE, { waitUntil: "networkidle0", timeout: 40000 });
const home = await page.evaluate(() => document.body.innerText);
check("标题渲染", home.includes("赛博人生诊断器"));
check("隐私声明完整", home.includes("不会读取你的摄像头") && home.includes("不会申请任何浏览器权限"));
check("8 个模块全部列出", ["注意力内存","拖延缓存","社交进程","钱包电量","睡眠服务","自我怀疑模块","明日计划队列","现实连接状态"].every(n => home.includes(n)));
const authorX = await page.evaluate(() => { const a = document.querySelector('.author-x'); const r = a?.getBoundingClientRect(); return a ? { href: a.getAttribute('href'), glyph: a.textContent.trim(), w: Math.round(r.width), h: Math.round(r.height) } : null; });
check("作者 𝕏 徽标存在且链接正确", authorX?.href === "https://x.com/0xkillcoin", JSON.stringify(authorX));
check("作者 𝕏 触摸目标 ≥44px", authorX && authorX.w >= 44 && authorX.h >= 44, JSON.stringify(authorX));
check("作者 𝕏 在新标签页打开", await page.evaluate(() => document.querySelector('.author-x')?.getAttribute('rel')?.includes('noopener')));

console.log("\n## 2. 随机诊断 + 完整扫描");
const t0 = Date.now();
await page.click('[data-testid="start-random"]');
await page.waitForSelector('[data-testid="scan-skip"]');
await page.waitForFunction(() => document.querySelector('[data-testid="rescan"]') !== null, { timeout: 45000 });
const elapsed = Date.now() - t0;
check("完整扫描有结束态", true);
check("扫描耗时 15–30s", elapsed >= 14000 && elapsed < 30000, `${elapsed}ms`);
const res = await page.evaluate(() => document.body.innerText);
check("报告标题", res.includes("人生系统诊断报告"));
check("含 8 项读数", ["注意力内存","拖延缓存","社交进程","钱包电量","睡眠服务","自我怀疑模块","明日计划队列","现实连接状态"].every(n => res.includes(n)));
check("含结论与 3 条建议", res.includes("最终结论") && (await page.$$(".advice-list li")).length === 3);
check("含编号", /CLD-\d{4}-[0-9A-F]{4}/.test(res));

console.log("\n## 3. 分享图导出（线上真实下载）");
const client = await page.target().createCDPSession();
const dl = join(OUT, "dl");
await client.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: dl });
await page.click('[data-testid="open-share"]');
await page.waitForSelector('[data-testid="download-png"]');
const cardUrl = await page.evaluate(() => document.querySelector('[data-share-card] .sc-url')?.textContent);
check("分享卡页脚显示真实网址", cardUrl === "iiiiiiiiiiiiiKK.github.io/cyber-life-diagnostic", cardUrl);
await page.click('[data-testid="download-png"]');
await page.waitForFunction(() => (document.querySelector('.modal-status')?.textContent ?? '').includes('已生成'), { timeout: 25000 });
for (let i = 0; i < 40 && !readdirSync(dl).some(f => f.endsWith(".png")); i++) await sleep(250);
const pngs = readdirSync(dl).filter(f => f.endsWith(".png"));
check("真实产出 PNG", pngs.length >= 1, pngs.join(","));
if (pngs.length) {
  const b = readFileSync(join(dl, pngs[0]));
  const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
  check("PNG 合法且 1080×1080", b[1] === 0x50 && w === 1080 && h === 1080, `${w}×${h}`);
}

// 3:4
await page.click('[data-testid="ratio-3x4"]');
await sleep(300);
await page.click('[data-testid="download-png"]');
await page.waitForFunction(() => (document.querySelector('.modal-status')?.textContent ?? '').includes('已生成'), { timeout: 25000 });
let tall = false;
for (let i = 0; i < 40 && !tall; i++) {
  for (const f of readdirSync(dl).filter(x => x.endsWith(".png"))) {
    const b = readFileSync(join(dl, f));
    if (b.readUInt32BE(16) === 1080 && b.readUInt32BE(20) === 1440) tall = true;
  }
  if (!tall) await sleep(250);
}
check("3:4 导出 1080×1440", tall);
await page.keyboard.press("Escape");

console.log("\n## 4. 三套模板 + 复制文本");
for (const t of ["dossier", "neon", "terminal"]) {
  await page.click(`[data-testid="template-${t}"]`);
  await sleep(200);
  const cls = await page.evaluate(() => document.querySelector(".result")?.className ?? "");
  check(`模板 ${t} 可切换`, cls.includes(`template-${t}`));
}
await page.click('[data-testid="copy-text"]');
await sleep(300);
const lbl = await page.evaluate(() => document.querySelector('[data-testid="copy-text"]')?.textContent ?? "");
check("复制文本有成功反馈", lbl.includes("已复制"), lbl);

console.log("\n## 5. 移动端 390×844（线上）");
const m = await browser.newPage();
const mErr = [];
m.on("pageerror", e => mErr.push(String(e)));
await m.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await m.goto(SITE, { waitUntil: "networkidle0", timeout: 40000 });
const ov = async () => m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check("首页无横向溢出", (await ov()) <= 1, String(await ov()));
await m.click('[data-testid="start-random"]');
await m.waitForSelector('[data-testid="scan-skip"]');
await m.click('[data-testid="scan-skip"]');
await m.waitForFunction(() => document.querySelector('[data-testid="rescan"]'), { timeout: 20000 });
check("结果页无横向溢出", (await ov()) <= 1, String(await ov()));
await m.click('[data-testid="open-share"]');
await m.waitForSelector('[data-testid="download-png"]');
check("分享面板无横向溢出", (await ov()) <= 1, String(await ov()));
check("移动端无 JS 错误", mErr.length === 0, mErr.slice(0, 2).join(" | "));

console.log("\n## 6. 隐私（线上）");
const probe = await page.evaluate(() => ({ perm: window.__permCalls ?? [], dev: window.__deviceCalls ?? [] }));
check("桌面端全程 0 JS 错误", errs.length === 0, errs.slice(0, 3).join(" | "));

await browser.close();
console.log(`\n=== 线上验收：${pass} 通过 / ${fails.length} 失败 ===`);
if (fails.length) { fails.forEach(f => console.log(" ✕ " + f)); process.exitCode = 1; }
else console.log("全部通过 ✅");
