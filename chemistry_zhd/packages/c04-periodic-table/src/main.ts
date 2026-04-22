import { elements, ChemicalElement, ElementCategory } from './data/elements';
import { renderPeriodicTable, CATEGORY_COLORS, CATEGORY_NAMES, CATEGORY_DESCRIPTIONS, ColorMode } from './components/PeriodicTable';

const TEMPLATE_KEY = 'c04';
const RUNTIME_KEY = 'chemistry-zhd-c04-periodic-table';
const BRIDGE_VERSION = '1.0.0';
const SNAPSHOT_SCHEMA_VERSION = 1;
const TEMPLATE_BRIDGE_GLOBAL_KEY = '__EDUMIND_TEMPLATE_BRIDGE__';

interface SnapshotEnvelope {
  templateKey: string;
  runtimeKey: string;
  bridgeVersion: string;
  snapshotSchemaVersion: number;
  createdAt: string;
  updatedAt: string;
}

interface SnapshotValidationResult {
  ok: boolean;
  errors: string[];
}

type OverlayType = 'none' | 'element-detail' | 'category-detail';

interface C04SnapshotPayload {
  view: {
    colorMode: ColorMode;
  };
  selection: {
    selectedElementAtomicNumber: number | null;
  };
  overlay: {
    type: OverlayType;
    elementAtomicNumber: number | null;
    category: ElementCategory | null;
  };
}

interface C04SnapshotDocument {
  envelope: SnapshotEnvelope;
  payload: C04SnapshotPayload;
}

interface C04RuntimeState {
  colorMode: ColorMode;
  selectedElementAtomicNumber: number | null;
  overlay: {
    type: OverlayType;
    elementAtomicNumber: number | null;
    category: ElementCategory | null;
  };
}

declare global {
  interface Window {
    __EDUMIND_TEMPLATE_BRIDGE__?: {
      getDefaultSnapshot: () => C04SnapshotDocument;
      getSnapshot: () => C04SnapshotDocument;
      loadSnapshot: (snapshot: unknown) => void;
      validateSnapshot: (snapshot: unknown) => SnapshotValidationResult;
    };
  }
}

// ----------------------------------------------------------------
// 全局样式
// ----------------------------------------------------------------
const style = document.createElement('style');
style.textContent = `
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    background: #FFFFFF;
    color: #1A202C;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',
      'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  }

  /* ---- 周期表网格 ---- */
  .pt-grid {
    display: grid;
    grid-template-columns: repeat(18, 1fr);
    gap: 3px;
    width: 100%;
    min-width: 720px;
  }

  .pt-cell {
    aspect-ratio: 1;
    border: 1px solid transparent;
    border-radius: 5px;
    padding: 3px 2px 2px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    transition: transform 0.12s ease, box-shadow 0.12s ease;
    position: relative;
    min-width: 0;
  }

  .pt-cell:hover {
    transform: scale(1.2);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
    z-index: 10;
  }

  .pt-cell:focus-visible,
  .pt-legend-item--clickable:focus-visible {
    outline: 2px solid #00A85A;
    outline-offset: 2px;
  }

  .pt-ghost {
    aspect-ratio: 1;
  }

  .pt-num {
    font-size: 10px;
    line-height: 1;
    opacity: 0.65;
    align-self: flex-start;
    padding-left: 1px;
  }

  .pt-symbol {
    font-size: clamp(13px, 1.6vw, 22px);
    font-weight: 700;
    line-height: 1;
  }

  .pt-name {
    font-size: clamp(8px, 0.85vw, 12px);
    line-height: 1;
    opacity: 0.8;
  }

  /* ---- 颜色模式工具栏 ---- */
  .color-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }

  .color-toolbar-label {
    font-size: 12px;
    color: #718096;
    font-weight: 500;
    margin-right: 2px;
  }

  .color-btn {
    padding: 4px 14px;
    border-radius: 20px;
    border: 1px solid #E2E8F0;
    background: #FFFFFF;
    color: #4A5568;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: border-color 0.12s, color 0.12s, background 0.12s;
  }

  .color-btn:hover {
    border-color: #00A85A;
    color: #00A85A;
  }

  .color-btn--active {
    background: #00A85A;
    border-color: #00A85A;
    color: #FFFFFF;
  }

  /* ---- 选中态 ---- */
  .pt-cell--selected {
    outline: 2px solid #00A85A;
    outline-offset: 1px;
    transform: scale(1.15) !important;
    box-shadow: 0 0 0 4px rgba(0, 168, 90, 0.2) !important;
    z-index: 10;
  }

  /* ---- 浮动详情面板（桌面 popover）---- */
  .detail-popover {
    box-sizing: border-box;
    position: fixed;
    z-index: 1000;
    width: min(460px, calc(100vw - 16px));
    max-height: min(88vh, calc(100vh - 16px));
    overflow-y: auto;
    background: #FAFAFA;
    border: 1.5px solid #CBD5E0;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.14), 0 2px 8px rgba(0, 0, 0, 0.08);
    animation: popover-in 0.15s ease;
  }

  @keyframes popover-in {
    from { opacity: 0; transform: scale(0.96); }
    to   { opacity: 1; transform: scale(1); }
  }

  /* 窄屏 bottom sheet（预留：后续可在此媒体查询内覆盖定位逻辑）*/
  /* @media (max-width: 600px) {
    .detail-popover {
      width: 100%;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      top: auto !important;
      border-radius: 16px 16px 0 0;
      max-height: 60vh;
    }
  } */

  .detail-popover-close {
    position: absolute;
    top: 10px;
    right: 10px;
    width: 26px;
    height: 26px;
    border: none;
    background: transparent;
    cursor: pointer;
    color: #9CA3AF;
    font-size: 18px;
    line-height: 1;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .detail-popover-close:hover {
    background: #F3F4F6;
    color: #374151;
  }

  .detail-popover-close:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px #00A85A;
  }

  .detail-header {
    display: flex;
    gap: 14px;
    margin-bottom: 12px;
    align-items: flex-start;
  }

  .detail-symbol-block {
    flex-shrink: 0;
    width: 86px;
    border: 2px solid transparent;
    border-radius: 10px;
    padding: 10px 6px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .detail-atomic-num {
    font-size: 11px;
    color: #4A5568;
    align-self: flex-start;
  }

  .detail-symbol {
    font-size: 36px;
    font-weight: 800;
    line-height: 1;
  }

  .detail-name-zh {
    font-size: 14px;
    font-weight: 800;
    margin-top: 2px;
  }

  .detail-name-en {
    font-size: 11px;
    color: #4A5568;
  }

  .detail-meta {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: 6px 10px;
    align-content: start;
  }

  .detail-prop {}

  .detail-prop-label {
    display: block;
    font-size: 10px;
    color: #4A5568;
    font-weight: 600;
    margin-bottom: 2px;
  }

  .detail-prop-value {
    display: block;
    font-size: 13px;
    color: #1A202C;
    font-weight: 700;
  }

  .detail-sections {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 8px;
    padding-top: 12px;
    border-top: 1px solid #CBD5E0;
  }

  .detail-section {
    background: #FFFFFF;
    border: 1px solid #CBD5E0;
    border-radius: 8px;
    padding: 10px 12px;
  }

  .detail-section h3 {
    font-size: 11.5px;
    font-weight: 700;
    color: #007A42;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 6px;
  }

  .detail-section p {
    font-size: 13px;
    color: #2D3748;
    line-height: 1.7;
    margin: 0;
  }

  .detail-section ul {
    margin: 0;
    padding-left: 16px;
  }

  .detail-section li {
    font-size: 12px;
    color: #2D3748;
    line-height: 1.9;
  }

  /* ---- 人工合成元素提示条 ---- */
  .detail-synthetic-note {
    font-size: 11.5px;
    color: #4A5568;
    background: #F7FAFC;
    border: 1px solid #CBD5E0;
    border-radius: 6px;
    padding: 6px 10px;
    margin-bottom: 12px;
    line-height: 1.6;
  }

  /* ---- 同素异形体提示条 ---- */
  .detail-allotrope-note {
    font-size: 11.5px;
    color: #744210;
    background: #FEFCE8;
    border: 1px solid #FDE68A;
    border-radius: 6px;
    padding: 6px 10px;
    margin-bottom: 12px;
    line-height: 1.6;
  }

  /* ---- f-block（镧系/锕系行）---- */
  .pt-f-block {
    margin-top: 4px;
  }

  .pt-f-row {
    display: grid;
    grid-template-columns: repeat(18, 1fr);
    gap: 3px;
    width: 100%;
    min-width: 720px;
  }

  .pt-f-row + .pt-f-row {
    margin-top: 3px;
  }

  .pt-placeholder {
    cursor: default;
    border-style: dashed !important;
    justify-content: center;
  }

  .pt-placeholder-label {
    font-size: clamp(6px, 0.6vw, 8px);
    font-weight: 700;
    opacity: 0.75;
    line-height: 1;
  }

  /* ---- 图例 ---- */
  .pt-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
    margin-top: 16px;
  }

  .pt-legend-item {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 15px;
    color: #4A5568;
  }

  .pt-legend-dot {
    display: inline-block;
    width: 12px;
    height: 12px;
    border-radius: 3px;
    border: 1px solid;
    flex-shrink: 0;
  }

  .pt-legend-item--clickable {
    cursor: pointer;
    border-radius: 6px;
    padding: 2px 4px;
    margin: -2px -4px;
    transition: background 0.1s;
  }

  .pt-legend-item--clickable:hover {
    background: #EDF2F7;
  }

  /* ---- 分类说明 popover ---- */
  .cat-popover {
    box-sizing: border-box;
    position: fixed;
    z-index: 1001;
    width: min(320px, calc(100vw - 16px));
    max-height: min(88vh, calc(100vh - 16px));
    overflow-y: auto;
    background: #FAFAFA;
    border: 1.5px solid #CBD5E0;
    border-radius: 12px;
    padding: 16px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.14), 0 2px 8px rgba(0, 0, 0, 0.08);
    animation: popover-in 0.15s ease;
  }

  .cat-pop-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
    padding-right: 28px;
  }

  .cat-pop-dot {
    display: inline-block;
    width: 18px;
    height: 18px;
    border-radius: 5px;
    border: 1.5px solid;
    flex-shrink: 0;
  }

  .cat-pop-name {
    font-size: 17px;
    font-weight: 800;
    color: #1A202C;
  }

  .cat-pop-summary {
    font-size: 13px;
    color: #2D3748;
    line-height: 1.65;
    margin: 0 0 12px;
  }

  .cat-pop-block {
    margin-bottom: 10px;
  }

  .cat-pop-block:last-child {
    margin-bottom: 0;
  }

  .cat-pop-block-label {
    display: block;
    font-size: 10px;
    font-weight: 700;
    color: #007A42;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 4px;
  }

  .cat-pop-block-text {
    font-size: 12.5px;
    color: #2D3748;
    line-height: 1.65;
    margin: 0;
  }
`;
document.head.appendChild(style);

// ----------------------------------------------------------------
// 页面结构
// ----------------------------------------------------------------
const app = document.querySelector<HTMLDivElement>('#app')!;

// 顶部标题区
const header = document.createElement('div');
header.style.cssText = 'margin-bottom: 20px;';
header.innerHTML = `
  <span style="
    display: inline-block;
    background: #E8F8F0;
    color: #00A85A;
    padding: 3px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 10px;
  ">化学模块 / C-04</span>
  <h1 style="font-size: 26px; font-weight: 800; color: #1A202C; margin-bottom: 6px;">
    元素周期表交互平台
  </h1>
  <p style="font-size: 13px; color: #718096;">
    点击元素查看详细信息 · 当前收录 ${elements.length} 个元素
  </p>
`;

// 周期表卡片容器
const card = document.createElement('div');
card.style.cssText = `
  background: #FAFAFA;
  border: 1px solid #E2E8F0;
  border-radius: 12px;
  padding: 20px;
  overflow-x: auto;
`;

// 外层页面
const page = document.createElement('div');
page.style.cssText = 'min-height: 100vh; padding: 32px;';

const inner = document.createElement('div');
inner.style.cssText = 'max-width: 1400px; margin: 0 auto;';

// 颜色模式工具栏
const toolbar = document.createElement('div');
toolbar.className = 'color-toolbar';
toolbar.innerHTML = `
  <span class="color-toolbar-label">配色模式：</span>
  <button class="color-btn color-btn--active" data-mode="category">元素分类</button>
  <button class="color-btn" data-mode="state">常温状态（25 °C）</button>
  <button class="color-btn" data-mode="electronegativity">电负性</button>
`;

inner.appendChild(header);
inner.appendChild(toolbar);
inner.appendChild(card);
page.appendChild(inner);
app.appendChild(page);

// ----------------------------------------------------------------
// 元素详情 popover（挂到 body，脱离页面流）
// ----------------------------------------------------------------
const popover = document.createElement('div');
popover.className = 'detail-popover';
popover.style.display = 'none';
document.body.appendChild(popover);

// ----------------------------------------------------------------
// 分类说明 popover
// ----------------------------------------------------------------
const catPopover = document.createElement('div');
catPopover.className = 'cat-popover';
catPopover.style.display = 'none';
document.body.appendChild(catPopover);

// 当前锚定的元素格，用于 resize/scroll 重定位
let currentAnchorCell: HTMLElement | null = null;
let runtimeState: C04RuntimeState = {
  colorMode: 'category',
  selectedElementAtomicNumber: null,
  overlay: {
    type: 'none',
    elementAtomicNumber: null,
    category: null,
  },
};

function buildEnvelope(): SnapshotEnvelope {
  const now = new Date().toISOString();
  return {
    templateKey: TEMPLATE_KEY,
    runtimeKey: RUNTIME_KEY,
    bridgeVersion: BRIDGE_VERSION,
    snapshotSchemaVersion: SNAPSHOT_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
  };
}

function getDefaultSnapshotPayload(): C04SnapshotPayload {
  return {
    view: {
      colorMode: 'category',
    },
    selection: {
      selectedElementAtomicNumber: null,
    },
    overlay: {
      type: 'none',
      elementAtomicNumber: null,
      category: null,
    },
  };
}

function getDefaultSnapshot(): C04SnapshotDocument {
  return {
    envelope: buildEnvelope(),
    payload: getDefaultSnapshotPayload(),
  };
}

function getSnapshot(): C04SnapshotDocument {
  return {
    envelope: buildEnvelope(),
    payload: {
      view: {
        colorMode: runtimeState.colorMode,
      },
      selection: {
        selectedElementAtomicNumber: runtimeState.selectedElementAtomicNumber,
      },
      overlay: {
        type: runtimeState.overlay.type,
        elementAtomicNumber: runtimeState.overlay.elementAtomicNumber,
        category: runtimeState.overlay.category,
      },
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidColorMode(value: unknown): value is ColorMode {
  return value === 'category' || value === 'state' || value === 'electronegativity';
}

function isValidOverlayType(value: unknown): value is OverlayType {
  return value === 'none' || value === 'element-detail' || value === 'category-detail';
}

function isValidCategory(value: unknown): value is ElementCategory {
  return typeof value === 'string' && value in CATEGORY_NAMES;
}

function validateSnapshot(snapshot: unknown): SnapshotValidationResult {
  const errors: string[] = [];

  if (!isRecord(snapshot)) {
    return { ok: false, errors: ['snapshot 必须是对象'] };
  }

  if (!isRecord(snapshot.envelope)) {
    errors.push('envelope 缺失或非法');
  } else {
    const envelope = snapshot.envelope;
    if (envelope.templateKey !== TEMPLATE_KEY) {
      errors.push(`envelope.templateKey 必须为 ${TEMPLATE_KEY}`);
    }
    if (envelope.runtimeKey !== RUNTIME_KEY) {
      errors.push(`envelope.runtimeKey 必须为 ${RUNTIME_KEY}`);
    }
    if (typeof envelope.bridgeVersion !== 'string') {
      errors.push('envelope.bridgeVersion 必须为字符串');
    }
    if (envelope.snapshotSchemaVersion !== SNAPSHOT_SCHEMA_VERSION) {
      errors.push(`envelope.snapshotSchemaVersion 必须为 ${SNAPSHOT_SCHEMA_VERSION}`);
    }
  }

  if (!isRecord(snapshot.payload)) {
    errors.push('payload 缺失或非法');
  } else {
    const payload = snapshot.payload;

    if (!isRecord(payload.view)) {
      errors.push('payload.view 缺失或非法');
    } else if (!isValidColorMode(payload.view.colorMode)) {
      errors.push('payload.view.colorMode 必须为 category / state / electronegativity');
    }

    if (!isRecord(payload.selection)) {
      errors.push('payload.selection 缺失或非法');
    } else if (
      payload.selection.selectedElementAtomicNumber !== null &&
      typeof payload.selection.selectedElementAtomicNumber !== 'number'
    ) {
      errors.push('payload.selection.selectedElementAtomicNumber 必须为 number 或 null');
    }

    if (!isRecord(payload.overlay)) {
      errors.push('payload.overlay 缺失或非法');
    } else {
      if (!isValidOverlayType(payload.overlay.type)) {
        errors.push('payload.overlay.type 必须为 none / element-detail / category-detail');
      }
      if (
        payload.overlay.elementAtomicNumber !== null &&
        typeof payload.overlay.elementAtomicNumber !== 'number'
      ) {
        errors.push('payload.overlay.elementAtomicNumber 必须为 number 或 null');
      }
      if (
        payload.overlay.category !== null &&
        !isValidCategory(payload.overlay.category)
      ) {
        errors.push('payload.overlay.category 必须为合法 ElementCategory 或 null');
      }
      if (
        payload.overlay.type === 'element-detail' &&
        payload.overlay.elementAtomicNumber === null
      ) {
        errors.push('overlay.type 为 element-detail 时必须提供 elementAtomicNumber');
      }
      if (
        payload.overlay.type === 'category-detail' &&
        payload.overlay.category === null
      ) {
        errors.push('overlay.type 为 category-detail 时必须提供 category');
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

function closePopover(): void {
  popover.style.display = 'none';
  popover.style.visibility = 'hidden';
  currentAnchorCell = null;
  runtimeState.overlay = {
    type: 'none',
    elementAtomicNumber: null,
    category: null,
  };
  // 不清除选中态，由 PeriodicTable 内部管理
}

function closeCatPopover(): void {
  catPopover.style.display = 'none';
  catPopover.style.visibility = 'hidden';
  currentCatAnchor = null;
  runtimeState.overlay = {
    type: 'none',
    elementAtomicNumber: null,
    category: null,
  };
}

// 外部点击关闭：.pt-cell 点击交给 click handler，图例项点击交给 legend handler
document.addEventListener('mousedown', (e) => {
  const target = e.target as Element;
  if (popover.style.display !== 'none') {
    if (!popover.contains(target) && !target.closest('.pt-cell')) closePopover();
  }
  if (catPopover.style.display !== 'none') {
    if (!catPopover.contains(target) && !target.closest('.pt-legend-item--clickable')) closeCatPopover();
  }
});

// Esc 关闭并将焦点归还锚定格
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (catPopover.style.display !== 'none') { closeCatPopover(); currentCatAnchor?.focus(); return; }
  if (popover.style.display !== 'none') { closePopover(); currentAnchorCell?.focus(); }
});

// 两个 popover 均跟随视口变化重新定位
let currentCatAnchor: HTMLElement | null = null;

function repositionIfOpen(): void {
  if (popover.style.display !== 'none' && currentAnchorCell) {
    positionPopover(currentAnchorCell);
  }
  if (catPopover.style.display !== 'none' && currentCatAnchor) {
    positionEl(catPopover, currentCatAnchor);
  }
}
window.addEventListener('resize', repositionIfOpen);
// capture:true 捕获所有可滚动容器（含 overflow-x:auto 的周期表卡片）
window.addEventListener('scroll', repositionIfOpen, true);

// 通用桌面端定位（被 positionPopover / positionEl 复用）
function _desktopPosition(el: HTMLElement, anchorEl: HTMLElement): void {
  const MARGIN = 8;
  el.style.right    = '';
  el.style.width    = '';
  el.style.bottom   = '';
  el.style.maxHeight = '';

  const rect = anchorEl.getBoundingClientRect();
  const pw   = el.offsetWidth;
  const ph   = el.offsetHeight;

  let left: number;
  if (rect.right + MARGIN + pw <= window.innerWidth - MARGIN) {
    left = rect.right + MARGIN;
  } else if (rect.left - MARGIN - pw >= MARGIN) {
    left = rect.left - pw - MARGIN;
  } else {
    left = Math.max(MARGIN, window.innerWidth - pw - MARGIN);
  }

  let top = rect.top;
  if (top + ph > window.innerHeight - MARGIN) top = window.innerHeight - ph - MARGIN;
  top = Math.max(MARGIN, top);

  el.style.left = `${left}px`;
  el.style.top  = `${top}px`;
}

// 元素 popover 定位（窄屏 bottom sheet）
function positionPopover(cellEl: HTMLElement): void {
  const MARGIN = 8;
  if (window.innerWidth < 768) {
    popover.style.left   = `${MARGIN}px`;
    popover.style.right  = `${MARGIN}px`;
    popover.style.width  = 'auto';
    popover.style.bottom = `${MARGIN}px`;
    popover.style.top    = 'auto';
    popover.style.maxHeight = `min(60vh, calc(100vh - ${MARGIN * 2}px))`;
    return;
  }
  _desktopPosition(popover, cellEl);
}

// 分类 popover 定位（始终桌面模式，窄屏时底部简单居中）
function positionEl(el: HTMLElement, anchorEl: HTMLElement): void {
  const MARGIN = 8;
  if (window.innerWidth < 768) {
    el.style.left   = `${MARGIN}px`;
    el.style.right  = `${MARGIN}px`;
    el.style.width  = 'auto';
    el.style.bottom = `${MARGIN}px`;
    el.style.top    = 'auto';
    return;
  }
  _desktopPosition(el, anchorEl);
}

// ----------------------------------------------------------------
// 详情面板渲染
// ----------------------------------------------------------------
function showDetail(el: ChemicalElement, cellEl: HTMLElement): void {
  closeCatPopover();
  currentAnchorCell = cellEl;
  runtimeState.selectedElementAtomicNumber = el.atomicNumber;
  runtimeState.overlay = {
    type: 'element-detail',
    elementAtomicNumber: el.atomicNumber,
    category: null,
  };

  const c = CATEGORY_COLORS[el.category];
  const catName = CATEGORY_NAMES[el.category];

  const eduLinks = el.educationalLinks.length > 0
    ? `<div class="detail-section">
        <h3>教学关联</h3>
        <ul>${el.educationalLinks.map(l => `<li>${l}</li>`).join('')}</ul>
      </div>`
    : '';

  popover.innerHTML = `
    <button class="detail-popover-close" aria-label="关闭">✕</button>
    <div class="detail-header">
      <div class="detail-symbol-block"
           style="background:${c.bg};color:${c.text};border-color:${c.border};">
        <span class="detail-atomic-num">${el.atomicNumber}</span>
        <span class="detail-symbol">${el.symbol}</span>
        <span class="detail-name-zh">${el.nameZh}</span>
        <span class="detail-name-en">${el.nameEn}</span>
      </div>
      <div class="detail-meta">
        <div class="detail-prop">
          <span class="detail-prop-label">原子量</span>
          <span class="detail-prop-value">${el.atomicMass}</span>
        </div>
        <div class="detail-prop">
          <span class="detail-prop-label">分类</span>
          <span class="detail-prop-value">${catName}</span>
        </div>
        <div class="detail-prop">
          <span class="detail-prop-label">周期 / 族</span>
          <span class="detail-prop-value">第 ${el.period} 周期 · ${el.groupLabel}</span>
        </div>
        <div class="detail-prop">
          <span class="detail-prop-label">常温状态（25 °C）</span>
          <span class="detail-prop-value">${el.stateAtRoomTemp}</span>
        </div>
        <div class="detail-prop">
          <span class="detail-prop-label">密度</span>
          <span class="detail-prop-value">${el.density}</span>
        </div>
        ${el.atomicNumber < 93 ? `
        <div class="detail-prop">
          <span class="detail-prop-label">熔点 / 沸点</span>
          <span class="detail-prop-value">${el.meltingPoint !== 0 ? el.meltingPoint + ' °C' : '—'} / ${el.boilingPoint !== 0 ? el.boilingPoint + ' °C' : '—'}</span>
        </div>` : ''}
        <div class="detail-prop">
          <span class="detail-prop-label">电负性</span>
          <span class="detail-prop-value">${el.electronegativity !== null ? el.electronegativity.toFixed(2) : '—'}</span>
        </div>
        <div class="detail-prop">
          <span class="detail-prop-label">电子构型</span>
          <span class="detail-prop-value">${el.electronConfiguration}</span>
        </div>
        ${el.atomicNumber < 93 ? `
        <div class="detail-prop">
          <span class="detail-prop-label">氧化态</span>
          <span class="detail-prop-value">${el.oxidationStates}</span>
        </div>` : ''}
      </div>
    </div>
    <div class="detail-sections">
      <div class="detail-section">
        <h3>化学性质</h3>
        <p>${el.chemicalProperties}</p>
      </div>
      <div class="detail-section">
        <h3>发现历史</h3>
        <p>${el.history}</p>
      </div>
      <div class="detail-section">
        <h3>主要用途</h3>
        <p>${el.applications}</p>
      </div>
      <div class="detail-section">
        <h3>趣味知识</h3>
        <p>${el.funFact}</p>
      </div>
      ${eduLinks}
    </div>
    ${el.atomicNumber >= 93 ? `<div class="detail-synthetic-note">⚠ 该元素为人工合成元素，熔沸点、氧化态等物理化学性质暂无可靠实测数据。</div>` : ''}
    ${el.allotropeNote ? `<div class="detail-allotrope-note">⚗ ${el.allotropeNote}</div>` : ''}
  `;

  popover.querySelector<HTMLButtonElement>('.detail-popover-close')!
    .addEventListener('click', closePopover);

  // visibility:hidden 渲染后量高，再定位，最后显示，避免坐标闪烁
  popover.style.visibility = 'hidden';
  popover.style.display    = 'block';
  popover.style.animation  = 'none';
  popover.offsetHeight;     // eslint-disable-line @typescript-eslint/no-unused-expressions
  positionPopover(cellEl);
  popover.style.visibility = 'visible';
  popover.style.animation  = '';
}

// ----------------------------------------------------------------
// 分类说明 popover
// ----------------------------------------------------------------
function showCategoryDetail(cat: ElementCategory, anchorEl: HTMLElement): void {
  closePopover();
  currentCatAnchor = anchorEl;
  runtimeState.overlay = {
    type: 'category-detail',
    elementAtomicNumber: null,
    category: cat,
  };

  const desc = CATEGORY_DESCRIPTIONS[cat];
  const c    = CATEGORY_COLORS[cat];
  const name = CATEGORY_NAMES[cat];

  catPopover.innerHTML = `
    <button class="detail-popover-close" aria-label="关闭">✕</button>
    <div class="cat-pop-header">
      <span class="cat-pop-dot" style="background:${c.bg};border-color:${c.border};"></span>
      <span class="cat-pop-name" style="color:${c.text};">${name}</span>
    </div>
    <p class="cat-pop-summary">${desc.summary}</p>
    <div class="cat-pop-block">
      <span class="cat-pop-block-label">与其他分类的关系</span>
      <p class="cat-pop-block-text">${desc.relationship}</p>
    </div>
    <div class="cat-pop-block">
      <span class="cat-pop-block-label">高中考点</span>
      <p class="cat-pop-block-text">${desc.hsNote}</p>
    </div>
    <div class="cat-pop-block">
      <span class="cat-pop-block-label">代表元素</span>
      <p class="cat-pop-block-text">${desc.examples}</p>
    </div>
  `;

  catPopover.querySelector<HTMLButtonElement>('.detail-popover-close')!
    .addEventListener('click', closeCatPopover);

  catPopover.style.visibility = 'hidden';
  catPopover.style.display    = 'block';
  catPopover.style.animation  = 'none';
  catPopover.offsetHeight;    // eslint-disable-line @typescript-eslint/no-unused-expressions
  positionEl(catPopover, anchorEl);
  catPopover.style.visibility = 'visible';
  catPopover.style.animation  = '';
}

// ----------------------------------------------------------------
// 渲染周期表
// ----------------------------------------------------------------
const periodicTableApi = renderPeriodicTable(card, showDetail, showCategoryDetail);

function applyColorMode(mode: ColorMode): void {
  runtimeState.colorMode = mode;
  toolbar.querySelectorAll('.color-btn').forEach((button) => {
    button.classList.toggle('color-btn--active', button instanceof HTMLButtonElement && button.dataset.mode === mode);
  });
  periodicTableApi.setColorMode(mode);
  if (mode !== 'category' && runtimeState.overlay.type === 'category-detail') {
    closeCatPopover();
  }
}

toolbar.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.color-btn');
  if (!btn?.dataset.mode) return;
  applyColorMode(btn.dataset.mode as ColorMode);
});

function loadSnapshot(snapshot: unknown): void {
  const validation = validateSnapshot(snapshot);
  if (!validation.ok) {
    throw new Error(validation.errors.join('；'));
  }

  const doc = snapshot as C04SnapshotDocument;
  const { payload } = doc;

  closePopover();
  closeCatPopover();

  runtimeState = {
    colorMode: payload.view.colorMode,
    selectedElementAtomicNumber: payload.selection.selectedElementAtomicNumber,
    overlay: {
      type: 'none',
      elementAtomicNumber: null,
      category: null,
    },
  };

  applyColorMode(payload.view.colorMode);
  periodicTableApi.setSelectedElementByAtomicNumber(payload.selection.selectedElementAtomicNumber);

  if (payload.overlay.type === 'element-detail' && payload.overlay.elementAtomicNumber !== null) {
    periodicTableApi.activateElementByAtomicNumber(payload.overlay.elementAtomicNumber);
    return;
  }

  if (payload.overlay.type === 'category-detail' && payload.overlay.category !== null) {
    if (runtimeState.colorMode !== 'category') {
      applyColorMode('category');
    }
    periodicTableApi.activateCategory(payload.overlay.category);
    return;
  }

  runtimeState.overlay = {
    type: 'none',
    elementAtomicNumber: null,
    category: null,
  };
}

window[TEMPLATE_BRIDGE_GLOBAL_KEY] = {
  getDefaultSnapshot,
  getSnapshot,
  loadSnapshot,
  validateSnapshot,
};

function handleBridgeMessage(event: MessageEvent) {
  const message = event.data;
  if (!message || typeof message !== 'object') return;

  const data = message as {
    namespace?: string;
    type?: string;
    requestId?: string;
    payload?: unknown;
  };

  if (data.namespace !== 'edumind.templateBridge') return;

  let response:
    | { namespace: string; type: string; requestId?: string; success: true; payload?: unknown }
    | { namespace: string; type: string; requestId?: string; success: false; error: string };

  try {
    switch (data.type) {
      case 'getDefaultSnapshot':
        response = {
          namespace: 'edumind.templateBridge',
          type: 'response',
          requestId: data.requestId,
          success: true,
          payload: getDefaultSnapshot(),
        };
        break;
      case 'getSnapshot':
        response = {
          namespace: 'edumind.templateBridge',
          type: 'response',
          requestId: data.requestId,
          success: true,
          payload: getSnapshot(),
        };
        break;
      case 'loadSnapshot':
        loadSnapshot(data.payload);
        response = {
          namespace: 'edumind.templateBridge',
          type: 'response',
          requestId: data.requestId,
          success: true,
          payload: { loaded: true },
        };
        break;
      case 'validateSnapshot':
        response = {
          namespace: 'edumind.templateBridge',
          type: 'response',
          requestId: data.requestId,
          success: true,
          payload: validateSnapshot(data.payload),
        };
        break;
      default:
        return;
    }
  } catch (error) {
    response = {
      namespace: 'edumind.templateBridge',
      type: 'response',
      requestId: data.requestId,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  event.source?.postMessage(response, { targetOrigin: '*' });
}

window.addEventListener('message', handleBridgeMessage);
