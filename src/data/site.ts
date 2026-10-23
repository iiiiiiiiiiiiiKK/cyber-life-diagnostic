/**
 * 品牌与声明文案。
 * 所有对外可见的「隐私/权限」表述集中在这里，方便审计：
 * 本项目不申请任何浏览器权限，也不调用任何真实设备检测 API。
 */

export const SITE_NAME = '赛博人生诊断器';
export const SITE_NAME_EN = 'CYBER LIFE DIAGNOSTIC';
export const SITE_URL = 'https://cyber-life.example.com';
export const SITE_URL_LABEL = 'cyber-life.example.com';
export const SITE_TAGLINE = '把人生当成一台机器，做一次不严肃的体检';
export const SITE_VERSION = 'v1.0 / SIM-ONLY';

/** 作者标识：顶部品牌行右侧的 𝕏 外链 */
export const AUTHOR_HANDLE = '@0xkillcoin';
export const AUTHOR_X_URL = 'https://x.com/0xkillcoin';
export const AUTHOR_X_GLYPH = '𝕏';

/** 首屏的隐私说明（逐条展示） */
export const PRIVACY_POINTS: string[] = [
  '本扫描是纯前端模拟，不会读取你的摄像头、麦克风、剪贴板、文件或浏览记录。',
  '不会申请任何浏览器权限，也不会因为「检测」而弹出权限对话框。',
  '不联网、不上传、不需要注册，所有数值都在你的浏览器里临时算出来。',
  '检测项名称是虚构的（例如「拖延缓存占用」），不对应任何真实系统接口。',
];

/** 报告页与分享图共用的免责声明 */
export const DISCLAIMER_SHORT = '娱乐模拟 · 非医疗 · 非心理诊断';

export const DISCLAIMER_LIST: string[] = [
  '所有分数均由本站写死的模拟规则或你的选择生成，不代表任何真实身体状况、心理状态或设备信息。',
  '检测项目、异常告警、系统日志均为虚构表演，用于营造复古终端体验。',
  '如果你正在经历持续的情绪困扰，请寻求专业心理服务；本页面不能替代任何专业意见。',
];

/** 数据来源说明：把「模拟规则」写明，避免被误认为真实检测 */
export const SIM_RULE_TEXT: Record<'random' | 'quiz' | 'custom', string> = {
  random: '随机模式：每个模块的读数由本次会话的种子值代入固定公式生成（区间 8–92），与你本人无关。',
  quiz: '问答模式：从 8 道生活习惯题的选项累加出各模块的健康度，再按固定阈值映射为读数。',
  custom: '自定义模式：读数完全由你拖动的 8 个参数按公开公式换算，拖动多少就显示多少。',
};
