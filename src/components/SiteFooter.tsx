import { useState } from 'react';
import { DISCLAIMER_SHORT, SITE_NAME, SITE_URL_LABEL, SITE_VERSION } from '../data/site';
import { clearAll } from '../lib/storage';

interface SiteFooterProps {
  onCleared?: () => void;
}

/** 页脚：品牌、版本、隐私与免责声明、清除本地数据 */
export default function SiteFooter({ onCleared }: SiteFooterProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <footer className="site-footer">
      <div className="footer-row">
        <span className="footer-brand">{SITE_NAME}</span>
        <span className="footer-dim">{SITE_VERSION}</span>
        <span className="footer-dim">{SITE_URL_LABEL}</span>
      </div>
      <p className="footer-note">
        本页是纯前端娱乐模拟：不申请任何浏览器权限，不读取摄像头、麦克风、剪贴板、文件或浏览记录，不联网、不上传。
      </p>
      <p className="footer-note footer-warn">{DISCLAIMER_SHORT} · 所有读数由本地规则生成，不具有任何真实检测意义。</p>
      <div className="footer-row">
        {confirming ? (
          <>
            <span className="footer-dim">确认清除本地保存的进度与上次报告？</span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                clearAll();
                setConfirming(false);
                onCleared?.();
              }}
            >
              确认清除
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirming(false)}>
              取消
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirming(true)}>
            清除本地数据
          </button>
        )}
      </div>
    </footer>
  );
}
