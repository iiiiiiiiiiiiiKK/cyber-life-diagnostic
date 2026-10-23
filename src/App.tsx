import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import HomePage from './pages/HomePage';
import QuizPage from './pages/QuizPage';
import CustomPage from './pages/CustomPage';
import ScanPage from './pages/ScanPage';
import ResultPage from './pages/ResultPage';
import SiteFooter from './components/SiteFooter';
import { computeResult, type AnswerMap, type CustomHealth, type DiagnosticResult, type Mode } from './lib/scoring';
import {
  clearLast,
  clearProgress,
  loadLast,
  loadPrefs,
  loadProgress,
  saveLast,
  savePrefs,
  saveProgress,
  storageAvailable,
  type SavedLast,
  type SavedProgress,
} from './lib/storage';
import { normalizeTemplate, type TemplateId } from './data/templates';

type Screen = 'home' | 'quiz' | 'custom' | 'scan' | 'result';

export interface Session {
  mode: Mode;
  answers: AnswerMap;
  custom: Partial<CustomHealth>;
  seed: number | null;
}

const EMPTY_SESSION: Session = { mode: 'random', answers: {}, custom: {}, seed: null };

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [session, setSession] = useState<Session>(EMPTY_SESSION);
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [savedProgress, setSavedProgress] = useState<SavedProgress | null>(null);
  const [savedLast, setSavedLast] = useState<SavedLast | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [template, setTemplate] = useState<TemplateId>('terminal');
  const [storageOk, setStorageOk] = useState(true);
  /** 每次开始扫描自增，用于在「重复点击」时重置扫描页内部计时 */
  const [scanKey, setScanKey] = useState(0);
  const topRef = useRef<HTMLDivElement | null>(null);

  /* ---------------- 初始化：读本地偏好与历史 ---------------- */
  useEffect(() => {
    const ok = storageAvailable();
    setStorageOk(ok);
    const prefs = loadPrefs();
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    setReducedMotion(prefs.reducedMotion || Boolean(media?.matches));
    setTemplate(normalizeTemplate(prefs.template));
    if (ok) {
      setSavedProgress(loadProgress());
      setSavedLast(loadLast());
    }
  }, []);

  /* ---------------- 偏好持久化 ---------------- */
  useEffect(() => {
    if (!storageOk) return;
    savePrefs({ reducedMotion, template });
  }, [reducedMotion, template, storageOk]);

  /* ---------------- 滚动到顶部（切屏时） ---------------- */
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    topRef.current?.focus?.();
  }, [screen]);

  /* ---------------- 流程控制 ---------------- */
  const goHome = useCallback(() => {
    setScreen('home');
  }, []);

  const startRandom = useCallback(() => {
    const seed = (Date.now() ^ Math.floor(Math.random() * 0xffff)) >>> 0;
    setSession({ mode: 'random', answers: {}, custom: {}, seed });
    setScanKey((k) => k + 1);
    setScreen('scan');
    clearProgress();
    setSavedProgress(null);
  }, []);

  const startQuiz = useCallback((answers: AnswerMap = {}) => {
    setSession({ mode: 'quiz', answers, custom: {}, seed: null });
    setScreen('quiz');
  }, []);

  const startCustom = useCallback((custom: Partial<CustomHealth> = {}) => {
    setSession({ mode: 'custom', answers: {}, custom, seed: null });
    setScreen('custom');
  }, []);

  /** 扫描页真正开始时计算一次结果（纯函数、确定性） */
  const activeResult = useMemo(() => {
    if (screen !== 'scan' && screen !== 'result') return null;
    if (session.mode === 'random') {
      return computeResult({ mode: 'random', seed: session.seed ?? 1 });
    }
    if (session.mode === 'quiz') {
      return computeResult({ mode: 'quiz', answers: session.answers });
    }
    return computeResult({ mode: 'custom', custom: session.custom });
  }, [screen, session]);

  useEffect(() => {
    if (!activeResult) return;
    if (screen === 'scan' || screen === 'result') {
      setResult(activeResult);
      if (storageOk) {
        saveLast({
          version: 1,
          mode: session.mode,
          answers: session.mode === 'quiz' ? session.answers : null,
          custom: session.mode === 'custom' ? session.custom : null,
          seed: session.seed,
        });
      }
    }
  }, [activeResult, screen, session, storageOk]);

  const handleScanDone = useCallback(() => {
    setScreen('result');
  }, []);

  const handleExitScan = useCallback(() => {
    setScreen('home');
  }, []);

  /** 重新扫描：同模式、同输入 → 完全一致的结果（便于验证确定性） */
  const rescanSame = useCallback(() => {
    setScanKey((k) => k + 1);
    setScreen('scan');
  }, []);

  /** 换一个随机结果 */
  const rescanNewSeed = useCallback(() => {
    const seed = (Date.now() ^ Math.floor(Math.random() * 0xffff)) >>> 0;
    setSession({ mode: 'random', answers: {}, custom: {}, seed });
    setScanKey((k) => k + 1);
    setScreen('scan');
  }, []);

  const restoreLast = useCallback(() => {
    if (!savedLast) return;
    const restored: Session = {
      mode: savedLast.mode,
      answers: savedLast.answers ?? {},
      custom: savedLast.custom ?? {},
      seed: savedLast.seed,
    };
    setSession(restored);
    const restoredResult =
      restored.mode === 'random'
        ? computeResult({ mode: 'random', seed: restored.seed ?? 1 })
        : restored.mode === 'quiz'
          ? computeResult({ mode: 'quiz', answers: restored.answers })
          : computeResult({ mode: 'custom', custom: restored.custom });
    setResult(restoredResult);
    setScreen('result');
  }, [savedLast]);

  const handleQuizProgress = useCallback(
    (answers: AnswerMap, cursor: number) => {
      setSession({ mode: 'quiz', answers, custom: {}, seed: null });
      if (!storageOk) return;
      saveProgress({ mode: 'quiz', answers, custom: null, cursor });
      setSavedProgress(loadProgress());
    },
    [storageOk],
  );

  const handleQuizSubmit = useCallback(
    (answers: AnswerMap) => {
      clearProgress();
      setSavedProgress(null);
      setSession({ mode: 'quiz', answers, custom: {}, seed: null });
      setScanKey((k) => k + 1);
      setScreen('scan');
    },
    [],
  );

  const handleCustomSubmit = useCallback((custom: Partial<CustomHealth>) => {
    setSession({ mode: 'custom', answers: {}, custom, seed: null });
    setScanKey((k) => k + 1);
    setScreen('scan');
  }, []);

  const handleSwitchMode = useCallback(() => {
    setScreen('home');
    setResult(null);
  }, []);

  const handleCleared = useCallback(() => {
    setSavedLast(null);
    setSavedProgress(null);
    setResult(null);
    setSession(EMPTY_SESSION);
    setScreen('home');
  }, []);

  const dismissSavedLast = useCallback(() => {
    clearLast();
    setSavedLast(null);
  }, []);

  return (
    <div className={`app texture-${template} ${reducedMotion ? 'reduce-motion' : ''}`}>
      <div className="app-bg" aria-hidden="true">
        <div className="app-grid" />
        <div className="app-scanline" />
        <div className="app-beam" />
      </div>

      <div ref={topRef} tabIndex={-1} className="app-main" aria-live="off">
        {screen === 'home' && (
          <HomePage
            reducedMotion={reducedMotion}
            onToggleReducedMotion={() => setReducedMotion((v) => !v)}
            storageOk={storageOk}
            savedProgress={savedProgress}
            savedLast={savedLast}
            onRandom={startRandom}
            onQuiz={() => startQuiz({})}
            onCustom={() => startCustom()}
            onResumeQuiz={(progress) => startQuiz(progress.answers)}
            onDiscardProgress={() => {
              clearProgress();
              setSavedProgress(null);
            }}
            onRestoreLast={restoreLast}
            onDismissLast={dismissSavedLast}
          />
        )}

        {screen === 'quiz' && (
          <QuizPage
            initialAnswers={session.answers}
            initialCursor={savedProgress?.mode === 'quiz' ? savedProgress.cursor : 0}
            storageOk={storageOk}
            onProgress={handleQuizProgress}
            onSubmit={handleQuizSubmit}
            onExit={goHome}
            onSkipToRandom={startRandom}
          />
        )}

        {screen === 'custom' && (
          <CustomPage
            initial={session.custom}
            onSubmit={handleCustomSubmit}
            onExit={goHome}
            onSwitchToQuiz={() => startQuiz({})}
          />
        )}

        {screen === 'scan' && result && (
          <ScanPage
            key={scanKey}
            result={result}
            reducedMotion={reducedMotion}
            onToggleReducedMotion={() => setReducedMotion((v) => !v)}
            onDone={handleScanDone}
            onExit={handleExitScan}
          />
        )}

        {screen === 'result' && result && (
          <ResultPage
            result={result}
            template={template}
            onTemplateChange={setTemplate}
            onRescan={rescanSame}
            onRandomAgain={rescanNewSeed}
            onSwitchMode={handleSwitchMode}
            onHome={goHome}
            onStartQuiz={() => startQuiz({})}
            onStartCustom={() => startCustom()}
          />
        )}
      </div>

      <SiteFooter onCleared={handleCleared} />
    </div>
  );
}
