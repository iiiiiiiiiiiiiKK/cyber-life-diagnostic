/**
 * 结果文本序列化（复制到聊天 / 笔记用）。
 * 纯函数，便于自测。
 */
import type { DiagnosticResult } from './scoring';
import { DISCLAIMER_SHORT, SITE_NAME, SITE_URL } from '../data/site';

export function modeLabel(mode: DiagnosticResult['mode']): string {
  if (mode === 'quiz') return '问答诊断';
  if (mode === 'custom') return '自定义参数';
  return '随机诊断';
}

/** 纯文本版（默认复制格式） */
export function toPlainText(result: DiagnosticResult): string {
  const lines: string[] = [];
  lines.push(`【${SITE_NAME}】${result.archetype.name}`);
  lines.push(`编号：${result.serial} · 模式：${modeLabel(result.mode)}`);
  lines.push(`系统状态：${result.statusLine}（综合健康度 ${result.healthScore}/100）`);
  lines.push('');
  lines.push(`> ${result.archetype.subtitle}`);
  lines.push('');
  lines.push('— 模拟检测读数 —');
  for (const r of result.readings) {
    lines.push(`${r.name}：${r.value}${r.unit}（${r.tierLabel}）`);
  }
  lines.push('');
  if (result.anomalies.length > 0) {
    lines.push('— 异常项目 —');
    for (const a of result.anomalies) {
      lines.push(`${a.name}：${a.value}${a.unit} · ${a.tierLabel}`);
    }
    lines.push('');
  }
  lines.push('— 趣味日志 —');
  for (const log of result.logs.slice(-4)) {
    lines.push(log.text);
  }
  lines.push('');
  lines.push(`最终结论：${result.archetype.verdict}`);
  lines.push('');
  lines.push('— 三条轻松建议 —');
  result.archetype.advice.forEach((a, i) => lines.push(`${i + 1}. ${a}`));
  lines.push('');
  lines.push(`数据来源：${result.simRule}`);
  lines.push(`所有读数均为娱乐模拟，${DISCLAIMER_SHORT}。`);
  lines.push(`${SITE_URL}`);
  return lines.join('\n');
}

/** Markdown 版 */
export function toMarkdown(result: DiagnosticResult): string {
  const lines: string[] = [];
  lines.push(`## ${result.archetype.name}`);
  lines.push('');
  lines.push(`\`${result.serial}\` · ${modeLabel(result.mode)} · 综合健康度 **${result.healthScore}/100**`);
  lines.push('');
  lines.push(`> ${result.archetype.subtitle}`);
  lines.push('');
  lines.push('| 检测项目 | 读数 | 档位 |');
  lines.push('| --- | --- | --- |');
  for (const r of result.readings) {
    lines.push(`| ${r.name} | ${r.value}${r.unit} | ${r.tierLabel} |`);
  }
  lines.push('');
  if (result.anomalies.length > 0) {
    lines.push('**异常项目**：' + result.anomalies.map((a) => `${a.name}(${a.value}%)`).join('、'));
    lines.push('');
  }
  lines.push(`**最终结论**：${result.archetype.verdict}`);
  lines.push('');
  lines.push('**行动建议**');
  result.archetype.advice.forEach((a, i) => lines.push(`${i + 1}. ${a}`));
  lines.push('');
  lines.push(`_${result.simRule} 所有读数均为娱乐模拟，${DISCLAIMER_SHORT}。_`);
  lines.push(`<${SITE_URL}>`);
  return lines.join('\n');
}

/** 分享图下方附带的文本（系统分享用） */
export function shareCaption(result: DiagnosticResult): string {
  return `${SITE_NAME}｜我是「${result.archetype.name}」：${result.archetype.verdict}\n${SITE_URL}\n（娱乐模拟，非心理或医疗诊断）`;
}
