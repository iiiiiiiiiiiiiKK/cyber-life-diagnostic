/**
 * 极简静态服务器（测试脚本自用，零依赖）。
 *
 * 目的：让 `npm run test:e2e` / `test:layout` / `test:share` 可以独立运行，
 * 不需要手动先开 `npm run preview` 或 `npm run dev`。
 * 仅用于本机 127.0.0.1 上的自动化测试，不属于产品代码、不会打包进产物。
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

/**
 * @param {string} rootDir 站点根目录
 * @param {{ port?: number }} [opts]
 * @returns {Promise<{ url: string, port: number, close: () => Promise<void> }>}
 */
export async function serveStatic(rootDir, opts = {}) {
  const root = resolve(rootDir);
  const server = createServer((req, res) => {
    const rawPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
    const rel = normalize(rawPath).replace(/^([/\\])+/, '');
    let filePath = join(root, rel);
    // 防目录穿越
    if (!resolve(filePath).startsWith(root + sep) && resolve(filePath) !== root) {
      res.writeHead(403).end('forbidden');
      return;
    }
    if (existsSync(filePath) && statSync(filePath).isDirectory()) {
      filePath = join(filePath, 'index.html');
    }
    if (!existsSync(filePath)) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('not found');
      return;
    }
    res.writeHead(200, {
      'content-type': MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    createReadStream(filePath).pipe(res);
  });

  await new Promise((done, fail) => {
    server.once('error', fail);
    server.listen(opts.port ?? 0, '127.0.0.1', done);
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return {
    url: `http://127.0.0.1:${port}/`,
    port,
    close: () =>
      new Promise((done) => {
        server.closeAllConnections?.();
        server.close(() => done());
      }),
  };
}
