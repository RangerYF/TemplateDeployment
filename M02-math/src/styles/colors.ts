export const COLORS = {
  primary:        '#32D583',
  primaryHover:   '#28B86D',
  dark:           '#F8F9FA',   // topbar / app chrome background
  neutral:        '#9CA3AF',
  border:         '#E5E7EB',   // panel borders, dividers
  surface:        '#FFFFFF',   // canvas area, card backgrounds
  surfaceAlt:     '#F5F7FA',   // sidebar, hover states
  white:          '#FFFFFF',
  textPrimary:    '#111827',   // main readable text
  textSecondary:  '#6B7280',   // secondary / caption text
  error:          '#EF4444',
  warning:        '#F59E0B',
  // ── M03 解析几何专用 ───────────────────────────────────────────────────────
  focusPoint:     '#FF0000',   // 焦点 — 纯红 (projector-visible)
  directrix:      '#60A5FA',   // 准线 — 蓝色
  asymptote:      '#F97316',   // 渐近线 — 橙色

  // ── M04 三角函数演示台专用 ─────────────────────────────────────────────────
  sinColor:       '#32D583',   // sin 投影线（主色绿）
  cosColor:       '#3B82F6',   // cos 投影线（蓝）
  tanColor:       '#F59E0B',   // tan 渐近线（琥珀）
  angleArc:       '#A78BFA',   // 角度弧线（紫）
  traceHistory:   '#64748B',   // 追踪历史（灰蓝）
  auxiliaryCurve1: '#3B82F6',  // 辅助角分量1 a·sinx（蓝）
  auxiliaryCurve2: '#F59E0B',  // 辅助角分量2 b·cosx（橙）
  triangleSolution1: '#32D583', // SSA 解1（主色绿）
  triangleSolution2: '#3B82F6', // SSA 解2（蓝）

  // ── 语义交互 token ──────────────────────────────────────────────────────────
  borderMuted:      '#D1D5DB',   // 浅边框
  textDark:         '#374151',   // 中深色文字
  textDisabled:     '#4B5563',   // 禁用/提示文字
  surfaceHover:     '#F9FAFB',   // 悬停背景
  surfaceLight:     '#F3F4F6',   // 浅背景
  primaryLight:     '#F0FBF6',   // 主色浅底
  primaryFocusRing: 'rgba(50,213,131,0.15)', // 焦点环

  // ── 深色画布覆盖层 (CanvasToolbar, HUD, ContextMenu, Inspector) ────────────
  canvasBg:         'rgba(24, 24, 28, 0.94)',   // 浮层背景
  canvasBorder:     '#3A3A3E',                  // 浮层边框
  canvasText:       '#F0F0F0',                  // 浮层主文本
  canvasTextDim:    '#9CA3AF',                  // 浮层弱文本
  canvasSurface:    'rgba(40, 40, 46, 0.9)',    // 浮层二级面板
  canvasInputBg:    'rgba(30, 30, 34, 0.95)',   // 浮层输入框背景

  // ── 语义色补充 ──────────────────────────────────────────────────────────────
  errorDark:        '#DC2626',   // 深红（停止/危险按钮 hover）
  errorLight:       '#FFF1F0',   // 错误浅底
  errorBg:          '#FEE2E2',   // 错误输入背景
  errorBorder:      '#FECACA',   // 错误输入边框
  warningLight:     '#FEF3C7',   // 警告浅底
  infoBlue:         '#3B82F6',   // 信息蓝
  infoBlueBg:       '#EFF6FF',   // 信息蓝浅底
  infoBlueBorder:   '#BFDBFE',   // 信息蓝边框
  infoBlueDark:     '#1D4ED8',   // 信息蓝深色文本
} as const;

export type ColorKey = keyof typeof COLORS;
