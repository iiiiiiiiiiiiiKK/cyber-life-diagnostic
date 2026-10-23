/**
 * 报告模板（不同风格的报告外观）。
 * 只影响排版与配色，不改变任何评分或结果内容。
 */

export type TemplateId = 'terminal' | 'dossier' | 'neon';

export interface ReportTemplate {
  id: TemplateId;
  name: string;
  /** 一句话说明 */
  hint: string;
  /** 选择器上的三色小样：底色 / 文字色 / 强调色（仅为预览，不参与渲染逻辑） */
  swatch: [string, string, string];
}

export const TEMPLATES: ReportTemplate[] = [
  {
    id: 'terminal',
    name: '经典终端',
    hint: '黑底荧光绿 · 扫描线',
    swatch: ['#08131a', '#dcefe7', '#5cff9d'],
  },
  {
    id: 'dossier',
    name: '机密档案',
    hint: '米黄纸张 · 深棕字',
    swatch: ['#f0e7d2', '#241f14', '#7a4a00'],
  },
  {
    id: 'neon',
    name: '霓虹广播',
    hint: '暗紫底 · 洋红描边',
    swatch: ['#17081f', '#ffe6fb', '#ff7ad4'],
  },
];

export const TEMPLATE_MAP: Record<string, ReportTemplate> = TEMPLATES.reduce(
  (acc, t) => {
    acc[t.id] = t;
    return acc;
  },
  {} as Record<string, ReportTemplate>,
);

export function normalizeTemplate(value: unknown): TemplateId {
  return value === 'dossier' || value === 'neon' || value === 'terminal' ? value : 'terminal';
}
