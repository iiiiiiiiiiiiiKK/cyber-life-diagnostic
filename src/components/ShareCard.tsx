import { forwardRef } from 'react';
import type { DiagnosticResult } from '../lib/scoring';
import { SITE_NAME, SITE_NAME_EN, SITE_URL_LABEL } from '../data/site';
import type { TemplateId } from '../data/templates';
import { modeLabel } from '../lib/share';

export type ShareRatio = '1x1' | '3x4';

export const SHARE_DIMENSIONS: Record<ShareRatio, { width: number; height: number; scale: number }> = {
  '1x1': { width: 360, height: 360, scale: 3 }, // 导出 1080 × 1080
  '3x4': { width: 360, height: 480, scale: 3 }, // 导出 1080 × 1440
};

/** 标题字号随名称长度自适应：卡片宽度固定，长名字必须缩字号，否则会被裁切 */
function titleFontSize(name: string, tall: boolean): number {
  const length = [...name].length;
  const max = tall ? 26 : 23;
  if (length <= 6) return max;
  if (length <= 8) return max - 2;
  if (length <= 10) return max - 4;
  if (length <= 12) return max - 6;
  if (length <= 15) return max - 8;
  return tall ? 15 : 14;
}

function quoteFontSize(text: string): number {
  const length = [...text].length;
  if (length <= 16) return 11;
  if (length <= 22) return 10.5;
  if (length <= 28) return 10;
  return 9.5;
}

interface ShareCardProps {
  result: DiagnosticResult;
  ratio: ShareRatio;
  template: TemplateId;
}

/**
 * 分享卡：固定 CSS 尺寸（360 宽），导出时按 pixelRatio=3 放大到 1080 宽。
 * 不依赖 Canvas 绘制文字，中文由浏览器字体渲染，因此不存在中文缺字/乱码问题。
 */
const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(function ShareCard(
  { result, ratio, template },
  ref,
) {
  const isTall = ratio === '3x4';
  const readings = result.readings.slice(0, isTall ? 8 : 5);
  const tags = result.tags.slice(0, isTall ? 4 : 3);
  const name = result.archetype.name;
  const titleSize = titleFontSize(name, isTall);

  return (
    <div
      ref={ref}
      className={`share-card ratio-${ratio} sc-template-${template}`}
      style={{ width: SHARE_DIMENSIONS[ratio].width, height: SHARE_DIMENSIONS[ratio].height }}
      data-share-card={ratio}
    >
      <div className="sc-inner">
        <div className="sc-brand">
          <span className="sc-logo">CLD</span>
          <span className="sc-brand-text">
            <b>{SITE_NAME}</b>
            <i>{SITE_NAME_EN}</i>
          </span>
          <span className="sc-mode">{modeLabel(result.mode)}</span>
        </div>

        <div className="sc-main">
          <p className="sc-eyebrow">人生系统诊断 / {result.serial}</p>
          <h3 className="sc-title" style={{ fontSize: titleSize }}>
            {name}
          </h3>
          <p className="sc-sub">{result.archetype.subtitle}</p>

          <div className="sc-score">
            <span className="sc-score-num">{result.healthScore}</span>
            <span className="sc-score-label">
              综合健康度<em>/ 100</em>
            </span>
            <span className="sc-score-status">{result.statusLine}</span>
          </div>

          <div className="sc-readings">
            {readings.map((r) => (
              <div className="sc-reading" key={r.key}>
                <span className="sc-reading-name">{r.name}</span>
                <span className="sc-reading-track">
                  <span
                    className={`sc-reading-fill level-${r.level}`}
                    style={{ width: `${Math.max(2, Math.min(100, r.value))}%` }}
                  />
                </span>
                <span className="sc-reading-val">{r.value}</span>
              </div>
            ))}
          </div>

          {isTall ? (
            <>
              <p className="sc-verdict" style={{ fontSize: quoteFontSize(result.archetype.verdict) }}>
                「{result.archetype.verdict}」
              </p>
              <div className="sc-advice">
                {result.archetype.advice.slice(0, 2).map((line, i) => (
                  <div className="sc-advice-item" key={line}>
                    <span className="sc-advice-num">{`0${i + 1}`}</span>
                    <span>{line}</span>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          <div className="sc-tags">
            {tags.map((t) => (
              <span className="sc-tag" key={t}>
                #{t}
              </span>
            ))}
          </div>
        </div>

        <div className="sc-foot">
          <span className="sc-url">{SITE_URL_LABEL}</span>
          <span className="sc-disc">娱乐模拟 · 非诊断</span>
        </div>
      </div>
    </div>
  );
});

export default ShareCard;
