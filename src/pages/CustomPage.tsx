import { useState } from 'react';
import { CUSTOM_PARAMS, CUSTOM_PRESETS, DEFAULT_CUSTOM } from '../data/custom';
import { MODULE_MAP, type ModuleKey } from '../data/modules';
import type { CustomHealth } from '../lib/scoring';

interface CustomPageProps {
  initial: Partial<CustomHealth>;
  onSubmit: (custom: Partial<CustomHealth>) => void;
  onExit: () => void;
  onSwitchToQuiz: () => void;
}

/** 健康度 → 对外读数（invert 模块取反），用于实时预览 */
function previewValue(key: ModuleKey, health: number): number {
  return MODULE_MAP[key].invert ? 100 - health : health;
}

export default function CustomPage({ initial, onSubmit, onExit, onSwitchToQuiz }: CustomPageProps) {
  const [values, setValues] = useState<Record<ModuleKey, number>>(() => {
    const base = { ...DEFAULT_CUSTOM };
    for (const p of CUSTOM_PARAMS) {
      const v = initial[p.key];
      if (typeof v === 'number' && Number.isFinite(v)) base[p.key] = Math.round(v);
    }
    return base;
  });
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const setValue = (key: ModuleKey, value: number) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setActivePreset(null);
  };

  const applyPreset = (id: string) => {
    const preset = CUSTOM_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setValues((prev) => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(preset.values)) {
        if (typeof v === 'number') next[k as ModuleKey] = v;
      }
      return next;
    });
    setActivePreset(id);
  };

  return (
    <main className="page custom">
      <div className="quiz-top">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onExit}>
          ← 返回首页
        </button>
        <span className="quiz-topic">自定义参数 · MANUAL CONFIG</span>
      </div>

      <section className="panel">
        <h1 className="section-h1">手动配置你的人生参数</h1>
        <p className="section-lead">
          滑杆值代表「该项有多轻松」，例如把「拖延缓存」拖到左边表示缓存爆满。所有读数都是<b>线性换算</b>的，
          你拖到哪里，报告里就显示哪里——这一模式最适合验证「规则真的在按我的输入算」。
        </p>

        <div className="preset-row">
          <span className="preset-label">预设：</span>
          {CUSTOM_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`chip-btn${activePreset === p.id ? ' chip-btn-on' : ''}`}
              onClick={() => applyPreset(p.id)}
              title={p.hint}
            >
              {p.name}
            </button>
          ))}
          <button
            type="button"
            className="chip-btn"
            onClick={() => {
              setValues({ ...DEFAULT_CUSTOM });
              setActivePreset(null);
            }}
          >
            恢复默认
          </button>
        </div>

        <div className="slider-list">
          {CUSTOM_PARAMS.map((p) => {
            const health = values[p.key];
            const shown = previewValue(p.key, health);
            const module = MODULE_MAP[p.key];
            return (
              <div className="slider-item" key={p.key}>
                <div className="slider-head">
                  <span className="slider-name">
                    <b>{module.name}</b>
                    <span className="slider-reading">{p.reading}</span>
                  </span>
                  <span className="slider-value">
                    {shown}
                    <small>{module.unit}</small>
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={health}
                  onChange={(e) => setValue(p.key, Number(e.target.value))}
                  aria-label={`${module.name}：${p.low} 到 ${p.high}`}
                  data-testid={`slider-${p.key}`}
                />
                <div className="slider-ends">
                  <span>{p.low}</span>
                  <span>{p.high}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="quiz-actions">
          <button type="button" className="btn btn-primary" onClick={() => onSubmit(values)} data-testid="custom-submit">
            用这些参数开始扫描
          </button>
          <button type="button" className="btn btn-ghost" onClick={onSwitchToQuiz}>
            改用问答诊断
          </button>
        </div>
        <p className="quiz-bottom-note">
          说明：这里的滑杆不读取任何真实数据，只是把你手动设定的数值代入公式；报告里会写明「数据来源：自定义参数」。
        </p>
      </section>
    </main>
  );
}
