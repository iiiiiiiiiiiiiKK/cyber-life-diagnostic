import { useEffect, useMemo, useState } from 'react';
import { PRIVACY_POINTS, SITE_NAME, SITE_NAME_EN, SITE_TAGLINE, AUTHOR_HANDLE, AUTHOR_X_URL, AUTHOR_X_GLYPH } from '../data/site';
import { SCAN_MODULES } from '../data/modules';
import { QUESTIONS } from '../data/questions';
import { CUSTOM_PARAMS } from '../data/custom';
import type { SavedLast, SavedProgress } from '../lib/storage';
import { modeLabel } from '../lib/share';

interface HomePageProps {
  reducedMotion: boolean;
  onToggleReducedMotion: () => void;
  storageOk: boolean;
  savedProgress: SavedProgress | null;
  savedLast: SavedLast | null;
  onRandom: () => void;
  onQuiz: () => void;
  onCustom: () => void;
  onResumeQuiz: (progress: SavedProgress) => void;
  onDiscardProgress: () => void;
  onRestoreLast: () => void;
  onDismissLast: () => void;
}

const TAGLINE = '本终端只模拟，不读取';

export default function HomePage(props: HomePageProps) {
  const {
    reducedMotion,
    onToggleReducedMotion,
    storageOk,
    savedProgress,
    savedLast,
    onRandom,
    onQuiz,
    onCustom,
    onResumeQuiz,
    onDiscardProgress,
    onRestoreLast,
    onDismissLast,
  } = props;

  const [typed, setTyped] = useState(reducedMotion ? TAGLINE.length : 0);
  const moduleList = useMemo(() => SCAN_MODULES.map((m) => m.name).join(' / '), []);

  /* 打字机：尊重 reducedMotion，直接显示全文 */
  useEffect(() => {
    if (reducedMotion) {
      setTyped(TAGLINE.length);
      return;
    }
    setTyped(0);
    let i = 0;
    const timer = window.setInterval(() => {
      i += 1;
      setTyped(i);
      if (i >= TAGLINE.length) window.clearInterval(timer);
    }, 90);
    return () => window.clearInterval(timer);
  }, [reducedMotion]);

  const answeredCount = savedProgress ? Object.keys(savedProgress.answers).length : 0;

  return (
    <main className="page home">
      <header className="home-head">
        <div className="brand-line">
          <span className="brand-mark">CLD</span>
          <span className="brand-en">{SITE_NAME_EN}</span>
          <span className="brand-ver">SIM-ONLY / v1.0</span>
          <a
            className="author-x"
            href={AUTHOR_X_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`作者 ${AUTHOR_HANDLE}`}
            title={`作者 ${AUTHOR_HANDLE}`}
          >
            <span className="author-x-glyph" aria-hidden="true">
              {AUTHOR_X_GLYPH}
            </span>
          </a>
        </div>
        <h1 className="home-title">
          {SITE_NAME}
          <span className="home-title-sub">把人生当成一台机器，扫一遍</span>
        </h1>
        <p className="home-tagline" aria-label={TAGLINE}>
          <span className="prompt">&gt;</span> {TAGLINE.slice(0, typed)}
          {typed < TAGLINE.length ? <span className="caret" aria-hidden="true" /> : null}
        </p>
        <p className="home-desc">{SITE_TAGLINE}。15–25 秒的模拟扫描，然后给你一份可以发朋友圈的诊断报告。</p>
      </header>

      {/* 隐私声明：必须显眼 */}
      <section className="panel privacy" aria-labelledby="privacy-title">
        <h2 className="panel-title" id="privacy-title">
          模拟声明<span className="panel-title-en">SIMULATION NOTICE</span>
        </h2>
        <ul className="privacy-list">
          {PRIVACY_POINTS.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <p className="privacy-foot">
          检测项名称（如「拖延缓存」「社交进程」）全部是虚构设定，不代表任何真实系统指标；页面内没有任何
          <code>getUserMedia</code> / <code>getBattery</code> / 文件读取调用，也不会弹出系统权限请求。
        </p>
      </section>

      {/* 三种入口 */}
      <section className="entry-grid" aria-label="选择诊断方式">
        <article className="entry entry-primary">
          <div className="entry-tag">推荐 · 约 20 秒</div>
          <h3>直接体验随机诊断</h3>
          <p>不回答问题，直接进入模拟扫描。读数由本次会话的随机种子生成，二十秒后就能看到结果。</p>
          <button type="button" className="btn btn-primary btn-block" onClick={onRandom} data-testid="start-random">
            启动模拟扫描
          </button>
        </article>

        <article className="entry">
          <div className="entry-tag">约 1 分钟</div>
          <h3>回答 {QUESTIONS.length} 道生活习惯题</h3>
          <p>每题 4 个选项，题目只和习惯有关，不需要任何身份信息，也不会联网发送。</p>
          <button type="button" className="btn btn-block" onClick={onQuiz} data-testid="start-quiz">
            进入问答诊断
          </button>
        </article>

        <article className="entry">
          <div className="entry-tag">可调参数</div>
          <h3>自定义几个参数</h3>
          <p>
            拖动 {CUSTOM_PARAMS.length} 个滑杆设定「人生配置」，读数完全按你拖到的位置换算，适合做对照组测试。
          </p>
          <button type="button" className="btn btn-block" onClick={onCustom} data-testid="start-custom">
            打开参数面板
          </button>
        </article>
      </section>

      {/* 恢复入口 */}
      {(savedProgress && answeredCount > 0) || savedLast ? (
        <section className="panel resume" aria-labelledby="resume-title">
          <h2 className="panel-title" id="resume-title">
            上次未结束<span className="panel-title-en">RESTORE</span>
          </h2>
          {savedProgress && answeredCount > 0 ? (
            <div className="resume-row">
              <span>
                有未完成的问答诊断：已答 {answeredCount}/{QUESTIONS.length} 题（仅保存在本机浏览器）。
              </span>
              <div className="resume-actions">
                <button type="button" className="btn btn-sm" onClick={() => onResumeQuiz(savedProgress)}>
                  继续答题
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={onDiscardProgress}>
                  放弃并重来
                </button>
              </div>
            </div>
          ) : null}
          {savedLast ? (
            <div className="resume-row">
              <span>上次的报告还留着（{modeLabel(savedLast.mode)}），可以直接打开。</span>
              <div className="resume-actions">
                <button type="button" className="btn btn-sm" onClick={onRestoreLast} data-testid="restore-last">
                  查看上次报告
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={onDismissLast}>
                  不再提示
                </button>
              </div>
            </div>
          ) : null}
          {!storageOk ? (
            <p className="resume-warn">当前浏览器禁用了本地存储，因此无法保存进度（不影响本次诊断）。</p>
          ) : null}
        </section>
      ) : null}

      {/* 检测项预览 */}
      <section className="panel modules-preview" aria-labelledby="modules-title">
        <h2 className="panel-title" id="modules-title">
          将要模拟的检测项<span className="panel-title-en">8 MODULES</span>
        </h2>
        <p className="modules-line">{moduleList}</p>
        <div className="modules-chips">
          {SCAN_MODULES.map((m) => (
            <span className="chip" key={m.key}>
              <b>{m.code}</b>
              {m.name}
            </span>
          ))}
        </div>
      </section>

      {/* 动画偏好 */}
      <section className="panel pref" aria-labelledby="pref-title">
        <h2 className="panel-title" id="pref-title">
          体验选项<span className="panel-title-en">ACCESSIBILITY</span>
        </h2>
        <label className="switch-row">
          <input
            type="checkbox"
            checked={reducedMotion}
            onChange={onToggleReducedMotion}
            data-testid="toggle-reduced-motion"
          />
          <span className="switch-label">
            减少动画（关闭打字机、故障闪烁与扫描动效，扫描流程压缩到约 4 秒）
          </span>
        </label>
        <p className="pref-note">
          扫描过程中随时可以点「跳过动画」直接看结果，也可以「退出扫描」回到首页，不会有任何卡死等待。
        </p>
      </section>
    </main>
  );
}
