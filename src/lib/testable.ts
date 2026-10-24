/**
 * 测试聚合出口（仅供 scripts/selftest.mjs 打包使用，不参与生产构建）。
 */
export {
  computeResult,
  quizHealth,
  randomHealth,
  customHealth,
  valueFromHealth,
  pickArchetype,
  buildReading,
  healthScoreOf,
  statusLineOf,
  anomaliesOf,
  readingsToValues,
  hashString,
  mulberry32,
  clamp,
} from './scoring';
export type { AnswerMap, CustomHealth, DiagnosticResult, Mode, ModuleReading } from './scoring';
export { buildScanPlan, stepAt, progressAt, phaseIndexOfStep, SCAN_PHASES } from './scan';
export { toPlainText, toMarkdown, shareCaption, modeLabel } from './share';
export { SCAN_MODULES, MODULE_MAP, tierOf, healthOf, healthBand } from '../data/modules';
export type { ModuleKey, ScanModule } from '../data/modules';
export { QUESTIONS, QUESTION_SET_VERSION } from '../data/questions';
export { ARCHETYPES } from '../data/archetypes';
export { CUSTOM_PARAMS, CUSTOM_PRESETS, DEFAULT_CUSTOM } from '../data/custom';
export { TEMPLATES, TEMPLATE_MAP, normalizeTemplate } from '../data/templates';
export { PRIVACY_POINTS, DISCLAIMER_LIST, SIM_RULE_TEXT, SITE_URL, SITE_URL_LABEL, AUTHOR_X_URL } from '../data/site';
