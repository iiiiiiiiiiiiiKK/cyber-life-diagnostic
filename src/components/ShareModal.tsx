import { useCallback, useEffect, useRef, useState } from 'react';
import ShareCard, { SHARE_DIMENSIONS, type ShareRatio } from './ShareCard';
import type { DiagnosticResult } from '../lib/scoring';
import {
  canShareFiles,
  captureWithRetry,
  copyBlobImage,
  copyText,
  downloadBlob,
  isMobileViewport,
  safeFilename,
  shareFile,
} from '../lib/image';
import { shareCaption, toPlainText } from '../lib/share';
import type { TemplateId } from '../data/templates';

interface ShareModalProps {
  result: DiagnosticResult;
  onClose: () => void;
  /** 分享卡跟随报告风格 */
  template?: TemplateId;
}

type Status = { kind: 'idle' } | { kind: 'busy'; text: string } | { kind: 'ok'; text: string } | { kind: 'err'; text: string };

export default function ShareModal({ result, onClose, template = 'terminal' }: ShareModalProps) {
  const [ratio, setRatio] = useState<ShareRatio>('1x1');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const mobile = isMobileViewport();

  /* 打开时锁定背景滚动 + 焦点移到关闭按钮；Esc 关闭 */
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const dims = SHARE_DIMENSIONS[ratio];

  const withBusy = useCallback(async (text: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setStatus({ kind: 'busy', text });
    try {
      await fn();
    } catch (error) {
      setStatus({ kind: 'err', text: error instanceof Error ? error.message : '操作失败，请重试。' });
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const handleDownload = () =>
    withBusy('正在渲染 PNG…', async () => {
      const blob = await captureWithRetry(cardRef, {
        pixelRatio: dims.scale,
        backgroundColor: template === 'dossier' ? '#f3ecd9' : '#04070a',
      });
      downloadBlob(blob, safeFilename(result.archetype.name, ratio));
      setStatus({ kind: 'ok', text: `已生成 ${dims.width * dims.scale}×${dims.height * dims.scale} PNG。` });
    });

  const handleCopyImage = () =>
    withBusy('正在复制图片…', async () => {
      const blob = await captureWithRetry(cardRef, { pixelRatio: dims.scale });
      const ok = await copyBlobImage(blob);
      if (ok) {
        setStatus({ kind: 'ok', text: '图片已复制到剪贴板。' });
      } else {
        const textOk = await copyText(toPlainText(result));
        setStatus(
          textOk
            ? { kind: 'ok', text: '当前浏览器不支持复制图片，已改为复制文字。' }
            : { kind: 'err', text: '复制失败，请改用「下载 PNG」。' },
        );
      }
    });

  const handleCopyText = () =>
    withBusy('正在复制文本…', async () => {
      const ok = await copyText(toPlainText(result));
      setStatus(ok ? { kind: 'ok', text: '结果文本已复制。' } : { kind: 'err', text: '复制失败，请手动选择文本。' });
    });

  const handleShare = () =>
    withBusy('正在调用系统分享…', async () => {
      const blob = await captureWithRetry(cardRef, { pixelRatio: dims.scale });
      const file = new File([blob], safeFilename(result.archetype.name, ratio), { type: 'image/png' });
      if (!canShareFiles(file)) {
        downloadBlob(blob, file.name);
        setStatus({ kind: 'ok', text: '此环境不支持系统分享，已改为下载 PNG。' });
        return;
      }
      const outcome = await shareFile(file, shareCaption(result), `${result.archetype.name} · 赛博人生诊断器`);
      setStatus({
        kind: 'ok',
        text: outcome === 'shared' ? '已打开系统分享。' : '已取消分享。',
      });
    });

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="share-title">
        <header className="modal-head">
          <h2 id="share-title">生成分享图</h2>
          <button ref={closeRef} type="button" className="modal-close" onClick={onClose} aria-label="关闭分享面板">
            ✕
          </button>
        </header>

        <div className="modal-ratio" role="group" aria-label="图片比例">
          <button
            type="button"
            className={`ratio-btn${ratio === '1x1' ? ' ratio-btn-on' : ''}`}
            onClick={() => setRatio('1x1')}
            data-testid="ratio-1x1"
          >
            1:1<span>1080 × 1080</span>
          </button>
          <button
            type="button"
            className={`ratio-btn${ratio === '3x4' ? ' ratio-btn-on' : ''}`}
            onClick={() => setRatio('3x4')}
            data-testid="ratio-3x4"
          >
            3:4<span>1080 × 1440</span>
          </button>
        </div>

        <div className="modal-preview">
          <div className="preview-scaler" style={{ width: dims.width, height: dims.height }}>
            <ShareCard ref={cardRef} result={result} ratio={ratio} template={template} />
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-primary" onClick={handleDownload} disabled={busy} data-testid="download-png">
            下载 PNG
          </button>
          <button type="button" className="btn" onClick={handleCopyImage} disabled={busy}>
            复制图片
          </button>
          <button type="button" className="btn" onClick={handleCopyText} disabled={busy}>
            复制结果文本
          </button>
          {mobile ? (
            <button type="button" className="btn" onClick={handleShare} disabled={busy}>
              系统分享
            </button>
          ) : null}
        </div>

        <p className={`modal-status status-${status.kind}`} aria-live="polite">
          {status.kind === 'idle'
            ? '分享图包含品牌与网址，标注「娱乐模拟 · 非诊断」。导出失败时会提示替代方案。'
            : status.text}
        </p>
      </div>
    </div>
  );
}
