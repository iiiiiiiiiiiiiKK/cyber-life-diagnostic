import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildScanPlan,
  phaseIndexOfStep,
  progressAt,
  stepAt,
  SCAN_PHASES,
} from '../lib/scan';
import { SCAN_MODULES } from '../data/modules';
import type { DiagnosticResult, LogKind } from '../lib/scoring';

interface ScanPageProps {
  result: DiagnosticResult;
  reducedMotion: boolean;
  onToggleReducedMotion: () => void;
  onDone: () => void;
  onExit: () => void;
}

interface LogLine {
  id: number;
  kind: LogKind;
  text: string;
}

/** 单帧最大推进时间：切回标签页时不会「瞬间跳过整段扫描」 */
const MAX_FRAME_MS = 90;

export default function ScanPage({
  result,
  reducedMotion,
  onToggleReducedMotion,
  onDone,
  onExit,
}: ScanPageProps) {
  const plan = useMemo(() => buildScanPlan(result, { reducedMotion }), [result, reducedMotion]);
  const [elapsed, setElapsed] = useState(0);
  const [finished, setFinished] = useState(false);
  const [logs, setLogs] = useState<LogLine[]>(() =>
    plan.steps[0].logs.map((text, i) => ({ id: i, kind: 'sys' as LogKind, text })),
  );
  const logId = useRef(plan.steps[0].logs.length);
  const logTail = useRef<HTMLDivElement | null>(null);
  const doneTimer = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTs = useRef<number | null>(null);
  const pushedSteps = useRef<Set<string>>(new Set(['boot']));

  const state = stepAt(plan, elapsed);
  const step = plan.steps[state.index];
  const progress = progressAt(plan, elapsed);
  const phaseIdx = phaseIndexOfStep(step);

  /* 步骤切换时追加该步骤的日志行 */
  useEffect(() => {
    if (pushedSteps.current.has(step.id)) return;
    pushedSteps.current.add(step.id);
    if (step.logs.length === 0) return;
    setLogs((prev) => {
      const next = [...prev];
      for (const text of step.logs) {
        next.push({ id: logId.current, kind: guessKind(text, step.kind), text });
        logId.current += 1;
      }
      return next.slice(-60);
    });
  }, [step]);

  /* 日志自动滚到底部 */
  useEffect(() => {
    if (logTail.current) logTail.current.scrollTop = logTail.current.scrollHeight;
  }, [logs]);

  /* 主计时循环：唯一的时间源，跳过 = 直接把 elapsed 推到末尾 */
  useEffect(() => {
    if (finished) return;
    const tick = (ts: number) => {
      const last = lastTs.current;
      lastTs.current = ts;
      const delta = last === null ? 16 : Math.min(MAX_FRAME_MS, ts - last);
      setElapsed((prev) => {
        const next = prev + delta;
        if (next >= plan.total) {
          setFinished(true);
          return plan.total;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTs.current = null;
    };
  }, [plan.total, finished]);

  /* 扫描完成后短暂停留再进报告页（给用户看清 100% 的结束态） */
  useEffect(() => {
    if (!finished) return;
    const delay = reducedMotion ? 220 : 620;
    doneTimer.current = window.setTimeout(onDone, delay);
    return () => {
      if (doneTimer.current) window.clearTimeout(doneTimer.current);
    };
  }, [finished, onDone, reducedMotion]);

  /**
   * 看门狗：即使标签页被切走导致 rAF 暂停、或任何异常让计时卡住，
   * 也在 plan.total + 8 秒后强制收尾，保证「扫描一定有结束状态」。
   */
  useEffect(() => {
    if (finished) return;
    const guard = window.setTimeout(() => {
      setElapsed(plan.total);
      setFinished(true);
    }, plan.total + 8000);
    return () => window.clearTimeout(guard);
  }, [finished, plan.total]);

  const skip = useCallback(() => {
    if (finished) return;
    setElapsed(plan.total);
    setFinished(true);
  }, [finished, plan.total]);

  /* Esc / 空格：跳过 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        skip();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [skip]);

  /* 已读到的模块读数：只显示已扫过的模块 */
  const scannedKeys = useMemo(() => {
    const keys = new Set<string>();
    for (let i = 0; i <= state.index; i += 1) {
      const s = plan.steps[i];
      if (s.reveal) keys.add(s.reveal.module);
    }
    return keys;
  }, [plan, state.index]);

  const readingOf = (key: string) => result.readings.find((r) => r.key === key);

  return (
    <main className="page scan" aria-busy={!finished}>
      <div className="scan-head">
        <div>
          <p className="scan-eyebrow">SIMULATED SCAN / 模拟扫描进行中</p>
          <h1 className={`scan-title${step.kind === 'alert' && !reducedMotion ? ' scan-title-alert' : ''}`}>
            {finished ? '扫描完成 · 正在生成报告' : `扫描中 ${Math.round(progress * 100)}%`}
          </h1>
        </div>
        <div className="scan-head-actions">
          <button type="button" className="btn btn-sm" onClick={onToggleReducedMotion} data-testid="scan-toggle-motion">
            {reducedMotion ? '开启完整动画' : '减少动画'}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={skip}
            disabled={finished}
            data-testid="scan-skip"
          >
            跳过动画
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onExit} data-testid="scan-exit">
            退出扫描
          </button>
        </div>
      </div>

      <p className="scan-notice">
        本页所有检测项、读数与告警都是本地模拟，不会读取你的设备、摄像头、麦克风、文件或浏览记录；页面没有请求任何浏览器权限。
      </p>

      {/* 阶段条 */}
      <ol className="phase-bar">
        {SCAN_PHASES.map((p, i) => (
          <li
            key={p.id}
            className={`phase${i < phaseIdx ? ' phase-done' : ''}${i === phaseIdx ? ' phase-on' : ''}`}
          >
            <span className="phase-title">{p.title}</span>
            <span className="phase-hint">{p.hint}</span>
          </li>
        ))}
      </ol>

      {/* 总进度 */}
      <div
        className="progress progress-lg"
        role="progressbar"
        aria-valuenow={Math.round(progress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="扫描总进度"
      >
        <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
      </div>
      <div className="scan-status">
        <span className="scan-status-label">{step.label}</span>
        <span className="scan-status-detail">{step.detail}</span>
      </div>

      <div className="scan-grid">
        {/* 模块读数面板 */}
        <section className="panel scan-modules" aria-label="模拟模块读数">
          <h2 className="panel-title">
            模块读数<span className="panel-title-en">SIM READINGS</span>
          </h2>
          <ul className="module-rows">
            {SCAN_MODULES.map((m) => {
              const reading = readingOf(m.key);
              const active = step.module === m.key || (step.kind === 'alert' && result.anomalies.some((a) => a.key === m.key));
              const revealed = scannedKeys.has(m.key);
              const value = revealed && reading ? reading.value : 0;
              return (
                <li
                  key={m.key}
                  className={`module-row${active ? ' module-row-active' : ''}${revealed ? ' module-row-done' : ''}`}
                >
                  <span className="module-code">{m.code}</span>
                  <span className="module-name">{m.name}</span>
                  <span className="module-bar">
                    <span
                      className={`module-bar-fill level-${reading?.level ?? 'ok'}`}
                      style={{ width: `${revealed ? value : 0}%` }}
                    />
                  </span>
                  <span className="module-val">{revealed ? `${value}${m.unit}` : '—'}</span>
                </li>
              );
            })}
          </ul>
          <p className="module-foot">
            进度 {Math.min(scannedKeys.size, SCAN_MODULES.length)}/{SCAN_MODULES.length} 项 · 读数由本地模拟规则生成
          </p>
        </section>

        {/* 终端日志 */}
        <section className="panel scan-log" aria-label="扫描日志">
          <h2 className="panel-title">
            终端日志<span className="panel-title-en">TERMINAL LOG</span>
          </h2>
          <div className="log-window" ref={logTail} aria-live="polite">
            {logs.map((line) => (
              <p key={line.id} className={`log-line log-${line.kind}`}>
                {line.text}
              </p>
            ))}
            {!finished ? <p className="log-line log-cursor">█</p> : null}
          </div>
        </section>
      </div>

      <div className="scan-foot">
        <span>提示：按 Esc 或点「跳过动画」可立即查看结果；随时可以退出，不会卡在等待状态。</span>
        {finished ? <span className="scan-done">全部步骤已完成 · 100%</span> : null}
      </div>
    </main>
  );
}

/** 根据日志文本与步骤类型推断着色 */
function guessKind(text: string, kind: string): LogKind {
  if (kind === 'alert' || text.startsWith('!')) return 'err';
  if (text.includes('denied-by-design') || text.includes('未申请')) return 'warn';
  if (text.includes('完成') || text.includes('封存') || text.includes('命中')) return 'ok';
  if (kind === 'boot') return 'sys';
  return 'info';
}
