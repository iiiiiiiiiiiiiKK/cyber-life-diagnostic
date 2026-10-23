import { useMemo, useState } from 'react';
import type { DiagnosticResult } from '../lib/scoring';
import { DISCLAIMER_LIST, DISCLAIMER_SHORT, SITE_NAME } from '../data/site';
import { TEMPLATES, type TemplateId } from '../data/templates';
import { modeLabel, toMarkdown, toPlainText } from '../lib/share';
import { copyText } from '../lib/image';
import ShareModal from '../components/ShareModal';

interface ResultPageProps {
  result: DiagnosticResult;
  template: TemplateId;
  onTemplateChange: (t: TemplateId) => void;
  onRescan: () => void;
  onRandomAgain: () => void;
  onSwitchMode: () => void;
  onHome: () => void;
  onStartQuiz: () => void;
  onStartCustom: () => void;
}

export default function ResultPage(props: ResultPageProps) {
  const {
    result,
    template,
    onTemplateChange,
    onRescan,
    onRandomAgain,
    onSwitchMode,
    onHome,
    onStartQuiz,
    onStartCustom,
  } = props;
  const [shareOpen, setShareOpen] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'plain' | 'md' | 'fail'>('idle');
  const [showAll, setShowAll] = useState(false);

  const dateText = useMemo(() => {
    const d = new Date(result.generatedAt);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, [result.generatedAt]);

  const handleCopy = async (asMarkdown: boolean) => {
    const ok = await copyText(asMarkdown ? toMarkdown(result) : toPlainText(result));
    setCopyState(ok ? (asMarkdown ? 'md' : 'plain') : 'fail');
    if (ok) {
      window.setTimeout(() => setCopyState('idle'), 2400);
    }
  };

  const copyLabel = (asMarkdown: boolean): string => {
    if (copyState === 'fail') return '复制失败，请手动选择';
    if (copyState === 'plain' && !asMarkdown) return '已复制纯文本 ✓';
    if (copyState === 'md' && asMarkdown) return '已复制 Markdown ✓';
    return asMarkdown ? '复制为 Markdown' : '复制结果文本';
  };

  return (
    <main className={`page result template-${template}`}>
      {/* 报头 */}
      <header className="report-head">
        <div className="report-brand">
          <span className="brand-mark">CLD</span>
          <div>
            <p className="report-site">{SITE_NAME}</p>
            <p className="report-meta">
              {result.serial} · {modeLabel(result.mode)} · {dateText}
            </p>
          </div>
        </div>
        <div className="report-head-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShareOpen(true)} data-testid="open-share">
            生成分享图
          </button>
          <button type="button" className="btn btn-sm" onClick={onRescan} data-testid="rescan">
            重新扫描
          </button>
        </div>
      </header>

      {/* 结果主卡 */}
      <section className="panel report-hero" aria-labelledby="result-name">
        <p className="report-eyebrow">人生系统诊断报告 / DIAGNOSTIC REPORT</p>
        <h1 className="report-name" id="result-name" data-testid="result-name">
          {result.archetype.name}
        </h1>
        <p className="report-code">{result.archetype.code}</p>
        <p className="report-subtitle">{result.archetype.subtitle}</p>

        <div className="hero-figures">
          <div className="figure">
            <span className="figure-num" data-testid="health-score">
              {result.healthScore}
            </span>
            <span className="figure-label">综合健康度</span>
          </div>
          <div className="figure figure-text">
            <span className="figure-status">{result.statusLine}</span>
            <span className="figure-label">系统状态</span>
          </div>
          <div className="figure figure-text">
            <span className="figure-status">
              {result.anomalies.length > 0 ? `${result.anomalies.length} 项异常` : '无异常'}
            </span>
            <span className="figure-label">异常项目</span>
          </div>
        </div>

        <p className="report-desc">{result.archetype.description}</p>

        <div className="report-tags">
          {result.tags.map((t) => (
            <span className="tag" key={t}>
              #{t}
            </span>
          ))}
        </div>
      </section>

      {/* 读数 */}
      <section className="panel" aria-labelledby="readings-title">
        <h2 className="panel-title" id="readings-title">
          模拟检测分数<span className="panel-title-en">SIMULATED READINGS</span>
        </h2>
        <p className="panel-note">{result.simRule}</p>
        <ul className="reading-list">
          {result.readings.map((r) => (
            <li className={`reading level-${r.level}`} key={r.key}>
              <div className="reading-head">
                <span className="reading-name">
                  {r.name}
                  <span className="reading-code">{r.code}</span>
                </span>
                <span className="reading-value">
                  {r.value}
                  {r.unit}
                  <em>{r.tierLabel}</em>
                </span>
              </div>
              <div className="reading-track">
                <span className={`reading-fill level-${r.level}`} style={{ width: `${Math.max(2, r.value)}%` }} />
              </div>
              <p className="reading-comment">{r.comment}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* 异常项目 + 日志 */}
      <div className="report-two-col">
        <section className="panel" aria-labelledby="anomaly-title">
          <h2 className="panel-title" id="anomaly-title">
            异常项目<span className="panel-title-en">ANOMALIES</span>
          </h2>
          {result.anomalies.length === 0 ? (
            <p className="panel-note">本次模拟未产生异常项目（这在本系统里算稀有事件，值得截图）。</p>
          ) : (
            <ul className="anomaly-list">
              {result.anomalies.map((a) => (
                <li key={a.key}>
                  <span className="anomaly-name">{a.name}</span>
                  <span className="anomaly-val">
                    {a.value}
                    {a.unit} · {a.tierLabel}
                  </span>
                  <span className="anomaly-note">{a.blurb}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="panel-foot">异常项目只影响本页文案，不会触发任何系统动作。</p>
        </section>

        <section className="panel" aria-labelledby="log-title">
          <h2 className="panel-title" id="log-title">
            趣味日志<span className="panel-title-en">FUN LOG</span>
          </h2>
          <div className="result-log">
            {result.logs.map((l, i) => (
              <p key={`${l.text}-${i}`} className={`log-line log-${l.kind}`}>
                {l.text}
              </p>
            ))}
          </div>
        </section>
      </div>

      {/* 结论与建议 */}
      <section className="panel verdict" aria-labelledby="verdict-title">
        <h2 className="panel-title" id="verdict-title">
          最终结论<span className="panel-title-en">VERDICT</span>
        </h2>
        <p className="verdict-text" data-testid="verdict">
          「{result.archetype.verdict}」
        </p>
        <h3 className="advice-title">三条轻松的行动建议</h3>
        <ol className="advice-list">
          {result.archetype.advice.map((a, i) => (
            <li key={a}>
              <span className="advice-num">{String(i + 1).padStart(2, '0')}</span>
              <span>{a}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* 操作区 */}
      <section className="panel actions-panel" aria-labelledby="actions-title">
        <h2 className="panel-title" id="actions-title">
          下一步<span className="panel-title-en">ACTIONS</span>
        </h2>
        <div className="action-grid">
          <button type="button" className="btn btn-primary" onClick={() => setShareOpen(true)}>
            生成分享图（1:1 / 3:4）
          </button>
          <button type="button" className="btn" onClick={() => handleCopy(false)} data-testid="copy-text">
            {copyLabel(false)}
          </button>
          <button type="button" className="btn" onClick={() => handleCopy(true)} data-testid="copy-markdown">
            {copyLabel(true)}
          </button>
          <button type="button" className="btn" onClick={onRescan} data-testid="rescan-2">
            用同样输入重新扫描
          </button>
          <button type="button" className="btn" onClick={onRandomAgain} data-testid="random-again">
            换一个随机结果
          </button>
          <button type="button" className="btn" onClick={onSwitchMode} data-testid="switch-mode">
            切换诊断模式
          </button>
          <button type="button" className="btn" onClick={onStartQuiz}>
            去做 8 道习惯题
          </button>
          <button type="button" className="btn" onClick={onStartCustom}>
            手动调参数
          </button>
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            回到首页
          </button>
        </div>
        <p className="panel-foot">
          「用同样输入重新扫描」会得到完全相同的结果（评分是确定性的），可用来自查规则；「换一个随机结果」才会换种子。
        </p>
      </section>

      {/* 模板切换 */}
      <section className="panel" aria-labelledby="template-title">
        <h2 className="panel-title" id="template-title">
          报告风格<span className="panel-title-en">TEMPLATE</span>
        </h2>
        <div className="template-row">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`template-btn${template === t.id ? ' template-btn-on' : ''}`}
              onClick={() => onTemplateChange(t.id)}
              data-testid={`template-${t.id}`}
              aria-pressed={template === t.id}
            >
              <span className="template-swatch" aria-hidden="true">
                <i style={{ background: t.swatch[0] }} />
                <i style={{ background: t.swatch[1] }} />
                <i style={{ background: t.swatch[2] }} />
              </span>
              <b>{t.name}</b>
              <span>{t.hint}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 免责声明 */}
      <section className="panel disclaimer" aria-labelledby="disclaimer-title">
        <h2 className="panel-title" id="disclaimer-title">
          必须说清楚的三件事<span className="panel-title-en">DISCLAIMER</span>
        </h2>
        <ul className="disclaimer-list">
          {DISCLAIMER_LIST.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAll((v) => !v)}>
          {showAll ? '收起完整说明' : '展开完整说明'}
        </button>
        {showAll ? (
          <div className="disclaimer-more">
            <p>
              检测模块（注意力内存 / 拖延缓存 / 社交进程 / 钱包电量 / 睡眠服务 / 自我怀疑模块 / 明日计划队列 /
              现实连接状态）全部为本项目的虚构命名，不存在对应的真实系统接口；本项目也从未调用
              <code>navigator.getBattery</code>、<code>navigator.mediaDevices</code>、<code>navigator.geolocation</code>
              等能力。
            </p>
            <p>
              报告中的分数、告警与日志遵循 <b>「输入 → 固定公式 → 输出」</b> 的确定性规则；相同输入必得相同结果。
              你可以用「重新扫描」按钮自行验证。
            </p>
            <p>{DISCLAIMER_SHORT}。请勿把本页内容当作任何形式的专业诊断依据。</p>
          </div>
        ) : null}
      </section>

      {shareOpen ? <ShareModal result={result} template={template} onClose={() => setShareOpen(false)} /> : null}
    </main>
  );
}
