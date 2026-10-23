import { useEffect, useMemo, useRef, useState } from 'react';
import { QUESTIONS } from '../data/questions';
import type { AnswerMap } from '../lib/scoring';

interface QuizPageProps {
  initialAnswers: AnswerMap;
  initialCursor: number;
  storageOk: boolean;
  onProgress: (answers: AnswerMap, cursor: number) => void;
  onSubmit: (answers: AnswerMap) => void;
  onExit: () => void;
  onSkipToRandom: () => void;
}

export default function QuizPage(props: QuizPageProps) {
  const { initialAnswers, initialCursor, storageOk, onProgress, onSubmit, onExit, onSkipToRandom } = props;

  /** 恢复到第一道未答题，而不是简单回到上次题号 */
  const firstUnanswered = useMemo(() => {
    const idx = QUESTIONS.findIndex((q) => !initialAnswers[q.id]);
    if (idx >= 0) return idx;
    return Math.max(0, Math.min(QUESTIONS.length - 1, initialCursor));
  }, [initialAnswers, initialCursor]);

  const [answers, setAnswers] = useState<AnswerMap>(initialAnswers);
  const [cursor, setCursor] = useState(firstUnanswered);
  const [confirmReset, setConfirmReset] = useState(false);
  const liveRef = useRef<HTMLParagraphElement | null>(null);
  const resetTimer = useRef<number | null>(null);

  const question = QUESTIONS[cursor];
  const answeredCount = QUESTIONS.filter((q) => answers[q.id]).length;
  const isLast = cursor === QUESTIONS.length - 1;
  const allAnswered = answeredCount === QUESTIONS.length;

  useEffect(() => {
    return () => {
      if (resetTimer.current) window.clearTimeout(resetTimer.current);
    };
  }, []);

  const select = (optionId: string) => {
    const next = { ...answers, [question.id]: optionId };
    setAnswers(next);
    onProgress(next, cursor);
  };

  const goNext = () => {
    if (!answers[question.id]) return;
    if (isLast) {
      onSubmit(answers);
      return;
    }
    const next = cursor + 1;
    setCursor(next);
    onProgress(answers, next);
  };

  const goPrev = () => {
    if (cursor === 0) return;
    const next = cursor - 1;
    setCursor(next);
    onProgress(answers, next);
  };

  const startReset = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      resetTimer.current = window.setTimeout(() => setConfirmReset(false), 4000);
      return;
    }
    if (resetTimer.current) window.clearTimeout(resetTimer.current);
    setConfirmReset(false);
    setAnswers({});
    setCursor(0);
    onProgress({}, 0);
  };

  /* 键盘：1–5 选项、←/→ 翻页、Enter 下一步 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (/^[1-5]$/.test(e.key)) {
        const opt = question.options[Number(e.key) - 1];
        if (opt) {
          e.preventDefault();
          select(opt.id);
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if (e.key === 'Enter' && target?.tagName === 'BUTTON') return;
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, answers, cursor]);

  const progressPct = Math.round((answeredCount / QUESTIONS.length) * 100);

  return (
    <main className="page quiz">
      <div className="quiz-top">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onExit}>
          ← 返回首页
        </button>
        <span className="quiz-counter">
          {String(cursor + 1).padStart(2, '0')} / {String(QUESTIONS.length).padStart(2, '0')}
        </span>
        <span className="quiz-topic">主题 · {question.topic}</span>
      </div>

      <div className="progress" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
        <div className="progress-fill" style={{ width: `${progressPct}%` }} />
      </div>
      <p className="quiz-progress-text">
        已答 {answeredCount}/{QUESTIONS.length} 题 · {storageOk ? '进度已保存在本机浏览器' : '当前浏览器不保存进度'}
      </p>

      <section className="panel quiz-panel" aria-labelledby="q-prompt">
        <h1 className="quiz-prompt" id="q-prompt">
          {question.prompt}
        </h1>
        {question.hint ? <p className="quiz-hint">{question.hint}</p> : null}

        <div className="quiz-options" role="radiogroup" aria-labelledby="q-prompt">
          {question.options.map((opt, i) => {
            const checked = answers[question.id] === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={checked}
                className={`option${checked ? ' option-on' : ''}`}
                onClick={() => select(opt.id)}
                data-testid={`option-${question.id}-${opt.id}`}
              >
                <span className="option-key">{i + 1}</span>
                <span className="option-label">{opt.label}</span>
                {checked ? <span className="option-mark">✓</span> : null}
              </button>
            );
          })}
        </div>

        <div className="quiz-actions">
          <button type="button" className="btn" onClick={goPrev} disabled={cursor === 0}>
            上一步
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={goNext}
            disabled={!answers[question.id]}
            data-testid="quiz-next"
          >
            {isLast ? '提交并开始扫描' : '下一步'}
          </button>
          <button
            type="button"
            className={`btn btn-ghost${confirmReset ? ' btn-danger' : ''}`}
            onClick={startReset}
            data-testid="quiz-reset"
          >
            {confirmReset ? '再点一次确认重来' : '重新开始'}
          </button>
        </div>
        {allAnswered ? (
          <button type="button" className="btn btn-block btn-quiet" onClick={() => onSubmit(answers)}>
            全部答完，直接查看报告 →
          </button>
        ) : null}
      </section>

      <div className="quiz-bottom">
        <p className="terminal-line" ref={liveRef} aria-live="polite">
          &gt; 键盘可用：1–5 选择，←/→ 翻页，Enter 下一步。所有选择只留在本机，提交后仅用于本地计算。
        </p>
        <div className="quiz-bottom-actions">
          {QUESTIONS.map((q, i) => (
            <button
              key={q.id}
              type="button"
              className={`dot${i === cursor ? ' dot-on' : ''}${answers[q.id] ? ' dot-done' : ''}`}
              onClick={() => setCursor(i)}
              aria-label={`跳到第 ${i + 1} 题`}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onSkipToRandom}>
          不想答题？换成随机诊断
        </button>
      </div>
    </main>
  );
}
