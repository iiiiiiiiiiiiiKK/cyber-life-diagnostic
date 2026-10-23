import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 纯静态站点：base 用相对路径，可直接部署到任意子路径 / 对象存储。
export default defineConfig({
  base: './',
  plugins: [react()],
  // 开发期忽略临时目录：编辑器/脚本写入的临时文件会触发 EBUSY 并让 dev server 崩溃
  server: {
    host: '127.0.0.1',
    port: 5178,
    strictPort: true,
    watch: { ignored: ['**/.selftest-tmp/**', '**/.*.tmpdir/**', '**/dist/**', '**/.e2e-out/**'] },
  },
  preview: { host: '127.0.0.1', port: 4180, strictPort: true },
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
  },
});
