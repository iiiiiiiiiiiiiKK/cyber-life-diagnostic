import { toBlob, toPng } from 'html-to-image';
import type { RefObject } from 'react';

export interface ExportOptions {
  pixelRatio?: number;
  backgroundColor?: string;
}

/**
 * DOM → PNG Blob。
 * 用 html-to-image（SVG foreignObject）复用真实排版，中文由浏览器自身字体渲染，
 * 不依赖任何需要打补丁的 Canvas 字体方案。
 */
export async function nodeToBlob(node: HTMLElement, options: ExportOptions = {}): Promise<Blob> {
  await waitForFonts();
  const base = {
    pixelRatio: options.pixelRatio ?? 3,
    backgroundColor: options.backgroundColor ?? '#04070a',
    cacheBust: true,
    skipFonts: false,
  };
  let blob: Blob | null = null;
  try {
    blob = await toBlob(node, base);
  } catch {
    blob = null;
  }
  if (!blob) {
    blob = await toBlob(node, { ...base, pixelRatio: Math.min(2, base.pixelRatio) });
  }
  if (!blob) throw new Error('图片渲染失败，请重试或改用「复制文本」。');
  return blob;
}

export async function nodeToDataUrl(node: HTMLElement, options: ExportOptions = {}): Promise<string> {
  await waitForFonts();
  const base = {
    pixelRatio: options.pixelRatio ?? 3,
    backgroundColor: options.backgroundColor ?? '#04070a',
    cacheBust: true,
  };
  try {
    return await toPng(node, base);
  } catch {
    return await toPng(node, { ...base, pixelRatio: Math.min(2, base.pixelRatio) });
  }
}

async function waitForFonts(): Promise<void> {
  try {
    if (document.fonts?.ready) {
      await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);
    }
  } catch {
    /* 字体 API 不可用时直接继续 */
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const touch = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  return /Android|iPhone|iPad|iPod|Mobile|HarmonyOS/i.test(ua) || touch;
}

export function canShareFiles(file: File): boolean {
  try {
    return (
      typeof navigator !== 'undefined' &&
      typeof navigator.canShare === 'function' &&
      typeof navigator.share === 'function' &&
      navigator.canShare({ files: [file] })
    );
  } catch {
    return false;
  }
}

export async function shareFile(file: File, text: string, title: string): Promise<'shared' | 'aborted'> {
  try {
    await navigator.share({ files: [file], text, title });
    return 'shared';
  } catch (error) {
    if (error instanceof DOMException && (error.name === 'AbortError' || error.name === 'NotAllowedError')) {
      return 'aborted';
    }
    throw error;
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 走降级方案 */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export async function copyBlobImage(blob: Blob): Promise<boolean> {
  try {
    const ClipboardItemCtor = window.ClipboardItem;
    if (!navigator.clipboard?.write || !ClipboardItemCtor) return false;
    const item = new ClipboardItemCtor({ [blob.type || 'image/png']: blob });
    await navigator.clipboard.write([item]);
    return true;
  } catch {
    return false;
  }
}

export function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export async function captureWithRetry(
  ref: RefObject<HTMLElement | null>,
  options: ExportOptions,
): Promise<Blob> {
  const node = ref.current;
  if (!node) throw new Error('分享图尚未准备好，请稍后重试。');
  await nextFrame();
  return nodeToBlob(node, options);
}

export function safeFilename(resultName: string, ratio: string): string {
  const clean = resultName.replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 24);
  return `cyber-life-${clean}-${ratio}.png`;
}
