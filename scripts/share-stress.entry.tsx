/**
 * 分享卡压力测试入口（仅开发期，不进生产构建）。
 *
 * 作用：把 16 种结果 × 2 种比例全部渲染出来，并暴露 window.__shareJobs / window.__exportAll，
 * 供 scripts/verify-share.mjs 逐张导出、解码、量测。
 */
import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import ShareCard, { SHARE_DIMENSIONS, type ShareRatio } from '../src/components/ShareCard';
import { computeResult, type DiagnosticResult } from '../src/lib/scoring';
import { nodeToDataUrl } from '../src/lib/image';
import { ARCHETYPES } from '../src/data/archetypes';
import { SCAN_MODULES } from '../src/data/modules';
import type { ModuleKey } from '../src/data/modules';
import '../src/styles/share.css';

type TemplateId = 'terminal' | 'dossier' | 'neon';

interface Job {
  id: string;
  ratio: ShareRatio;
  template: TemplateId;
  result: DiagnosticResult;
}

/** 每种结果类型构造一份结果（随机搜索 + 自定义定向兜底） */
function buildResults(): DiagnosticResult[] {
  const found = new Map<string, DiagnosticResult>();
  for (let seed = 1; seed < 40000 && found.size < ARCHETYPES.length; seed += 1) {
    const res = computeResult({ mode: 'random', seed, now: 1700000000000 });
    if (!found.has(res.archetype.id)) found.set(res.archetype.id, res);
  }
  for (const a of ARCHETYPES) {
    if (found.has(a.id)) continue;
    const custom = {} as Record<ModuleKey, number>;
    for (const m of SCAN_MODULES) custom[m.key] = 50;
    for (const rule of a.rules) {
      const mod = SCAN_MODULES.find((m) => m.key === rule.module);
      if (!mod) continue;
      const value = rule.op === '>=' ? Math.min(100, rule.value + 6) : Math.max(0, rule.value - 6);
      custom[rule.module] = mod.invert ? 100 - value : value;
    }
    found.set(a.id, computeResult({ mode: 'custom', custom, now: 1700000000000 }));
  }
  return [...found.values()];
}

const results = buildResults();
const templates: TemplateId[] = ['terminal', 'dossier', 'neon'];
const ratios: ShareRatio[] = ['1x1', '3x4'];

const jobs: Job[] = [];
for (const template of templates) {
  for (const ratio of ratios) {
    for (const result of results) {
      jobs.push({ id: `${template}-${ratio}-${result.archetype.id}`, ratio, template, result });
    }
  }
}

const nodeMap = new Map<string, HTMLDivElement>();
const container = document.getElementById('cards');

for (const job of jobs) {
  const wrap = document.createElement('div');
  wrap.className = 'card-wrap';
  const label = document.createElement('div');
  label.className = 'meta';
  label.textContent = job.id;
  wrap.appendChild(label);
  const holder = document.createElement('div');
  holder.style.width = `${SHARE_DIMENSIONS[job.ratio].width}px`;
  holder.style.height = `${SHARE_DIMENSIONS[job.ratio].height}px`;
  wrap.appendChild(holder);
  container?.appendChild(wrap);

  createRoot(holder).render(
    createElement(ShareCard, {
      ref: (node: HTMLDivElement | null) => {
        if (node) nodeMap.set(job.id, node);
      },
      result: job.result,
      ratio: job.ratio,
      template: job.template,
    }),
  );
}

const bgOf = (t: TemplateId) => (t === 'dossier' ? '#f4eddc' : t === 'neon' ? '#12061a' : '#04070a');

const w = window as unknown as Record<string, unknown>;
w.__shareJobs = jobs.map((j) => ({
  id: j.id,
  ratio: j.ratio,
  template: j.template,
  archetype: j.result.archetype.name,
}));
w.__exportAll = async (onlyId?: string, pixelRatio = 3) => {
  const out: Record<string, unknown> = {};
  for (const job of jobs) {
    if (onlyId && job.id !== onlyId) continue;
    const node = nodeMap.get(job.id);
    if (!node) continue;
    const dataUrl = await nodeToDataUrl(node, { pixelRatio, backgroundColor: bgOf(job.template) });
    const cardRect = node.getBoundingClientRect();
    // 记录「标题」「结论/建议」区域（CSS px，相对卡片左上角），供导出后端做像素墨迹检测
    const relRect = (sel: string) => {
      const el = node.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        x: Math.round(r.left - cardRect.left),
        y: Math.round(r.top - cardRect.top),
        w: Math.round(r.width),
        h: Math.round(r.height),
      };
    };
    out[job.id] = {
      dataUrl,
      width: SHARE_DIMENSIONS[job.ratio].width * pixelRatio,
      height: SHARE_DIMENSIONS[job.ratio].height * pixelRatio,
      template: job.template,
      archetype: job.result.archetype.name,
      ratio: job.ratio,
      pixelRatio,
      rects: { title: relRect('.sc-title'), score: relRect('.sc-score') },
    };
  }
  return out;
};

const status = document.getElementById('status');
if (status) {
  status.textContent = `ready · ${jobs.length} cards (${results.length} types × ${ratios.length} ratios × ${templates.length} templates)`;
}
