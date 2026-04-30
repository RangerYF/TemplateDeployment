import { parseEquation } from './parser';
import { balance } from './balancer';
import type { ParsedEquation } from './parser/types';
import { escapeHtml as escHtml, formatEquation, formatFormulaForDisplay } from './formatting';

const TEMPLATE_KEY = 'c03';
const RUNTIME_KEY = 'chemistry-zhd-c03-equation-balancer';
const BRIDGE_VERSION = '1.0.0';
const SNAPSHOT_SCHEMA_VERSION = 1;
const DEFAULT_INPUT = 'H2 + O2 = H2O';
const TEMPLATE_BRIDGE_GLOBAL_KEY = '__EDUMIND_TEMPLATE_BRIDGE__';

type C03RunState = 'idle' | 'success' | 'error';

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

interface ApplyOperationsResult {
  ok: boolean;
  applied: string[];
  warnings: string[];
}

interface C03SnapshotPayload {
  editor: {
    rawInput: string;
    runState: C03RunState;
  };
  ui: {
    revealedStepCount: number;
  };
  preferences: {
    quickGroups: QuickGroup[];
  };
  history: {
    items: HistItem[];
  };
}

interface C03SnapshotDocument {
  envelope: SnapshotEnvelope;
  payload: C03SnapshotPayload;
}

declare global {
  interface Window {
    __EDUMIND_TEMPLATE_BRIDGE__?: {
      getDefaultSnapshot: () => C03SnapshotDocument;
      getSnapshot: () => C03SnapshotDocument;
      loadSnapshot: (snapshot: unknown) => void;
      validateSnapshot: (snapshot: unknown) => SnapshotValidationResult;
      getAiContext: () => ReturnType<typeof getAiContext>;
      applyOperations: (operations: unknown) => ApplyOperationsResult;
    };
  }
}

type ReviewTone = 'pass' | 'warn';

interface ReviewItem {
  tone: ReviewTone;
  label: string;
  detail: string;
}

interface EquationReview {
  summary: string;
  allowHistory: boolean;
  items: ReviewItem[];
}

const COMMON_HIGH_SCHOOL_SPECIES = new Set([
  'H2', 'O2', 'H2O', 'N2', 'Cl2', 'Br2', 'I2', 'HCl', 'H2SO4', 'HNO3', 'NH3', 'CO2', 'CO', 'CH4',
  'NaOH', 'KOH', 'Ca(OH)2', 'Al(OH)3', 'Al(OH)4-', 'Na(Al(OH)4)', 'Na2CO3', 'NaHCO3', 'CaCO3', 'CuO',
  'Fe2O3', 'KMnO4', 'K2Cr2O7', 'MnO2', 'Na2O2', 'C6H12O6', 'C6H12O7', 'Ag', 'AgCl', 'AgNO3',
  'Ag(NH3)2+', 'Ag(NH3)2OH', 'Cu(OH)2', 'Cu2+', 'Cu+', 'Fe2+', 'Fe3+', 'MnO4-', 'Mn2+', 'H+', 'OH-',
  'e-', 'SO42-', 'SO32-', 'CO32-', 'HCO3-', 'NO3-', 'NH4+', 'Cl-', 'Br-', 'I-', 'Na+', 'K+', 'Ca2+',
  'Mg2+', 'Al3+', 'Ba2+', 'SO2', 'SO3', 'H2S', 'PCl5', 'PCl3', 'NO', 'NO2', 'N2O4', 'HI'
]);

function normalizeSpeciesKey(formula: string): string {
  let normalized = formula
    .trim()
    .replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (c) => String(c.codePointAt(0)! - 0x2080))
    .replace(/[［【\[{（]/g, '(')
    .replace(/[］】\]}）]/g, ')')
    .replace(/[•]/g, '·')
    .replace(/(\(s\)|\(g\)|\(l\)|\(aq\)|↑|↓)$/i, '')
    .replace(/\s+/g, '');
  normalized = normalized.replace(/^\((.+)\)([1-9]?[+-])$/, '$1$2');
  return normalized;
}

function buildEquationReview(eq: ParsedEquation): EquationReview {
  const allMols = [...eq.reactants, ...eq.products];
  const speciesKeys = allMols.map((mol) => normalizeSpeciesKey(mol.rawFormula));
  const uncovered = [...new Set(speciesKeys.filter((key) => !COMMON_HIGH_SCHOOL_SPECIES.has(key)))];
  const hasMediumSensitiveSpecies = speciesKeys.some((key) => ['H+', 'OH-', 'H2O', 'e-', 'MnO4-', 'Ag(NH3)2OH', 'Ag(NH3)2+'].includes(key));
  const hasComplexNotation = speciesKeys.some((key) => /[()·]/.test(key) || key.length >= 10);

  const items: ReviewItem[] = [
    {
      tone: 'pass',
      label: '守恒检查',
      detail: `本次结果已经通过${eq.equationType === 'ionic' ? '元素与电荷' : '元素'}守恒校验，可用于课堂上的配平核对。`,
    },
    uncovered.length === 0
      ? {
          tone: 'pass',
          label: '物质库覆盖',
          detail: '所有物种都落在当前内置的高中常见物质库内，这类结果会写入历史记录。',
        }
      : {
          tone: 'warn',
          label: '物质库覆盖',
          detail: `以下物种未完全落在当前高中常用物质库：${uncovered.join('、')}。结果仅作守恒参考，本次不写入历史记录。`,
        },
    hasMediumSensitiveSpecies
      ? {
          tone: 'warn',
          label: '条件与介质',
          detail: '当前方程式涉及离子、电子或特定介质物种。请再结合酸碱环境、氧化还原方向和教材条件复核。',
        }
      : {
          tone: 'pass',
          label: '条件与介质',
          detail: '页面已经完成守恒配平，但“反应是否发生、产物是否唯一”仍需结合实验条件判断。',
        },
  ];

  if (hasComplexNotation) {
    items.push({
      tone: 'warn',
      label: '复杂结构提醒',
      detail: '当前方程式包含配位写法、嵌套括号或水合物。工具已完成计量解析，但复杂体系更适合再做一次人工检查。',
    });
  }

  return {
    allowHistory: uncovered.length === 0,
    summary: uncovered.length === 0
      ? '已通过守恒与物质库检查，结果可直接用于课堂核对，也会写入历史记录。'
      : '已给出守恒配平结果，但因超出当前常用物质库覆盖范围，本次只展示结果，不写入历史记录。',
    items,
  };
}

// ── CSS — 对齐 C04 设计规范 ────────────────────────────────────
// 色彩 token（与 C04 完全一致）
// brand:#00A85A  brand-dark:#007A42  brand-tint:#E8F8F0
// surface:#FAFAFA  border:#E2E8F0  border-strong:#CBD5E0
// text-primary:#1A202C  text-body:#2D3748  text-secondary:#718096  text-caption:#4A5568
// danger:#C53030
const css = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;
  background:#F7FAFC;color:#1A202C;min-height:100vh
}
#app{max-width:920px;margin:0 auto;padding:32px 24px 64px}

/* ── Header ── */
.c03-header{margin-bottom:18px}
.c03-chip{
  display:inline-block;background:#E8F8F0;color:#00A85A;
  padding:4px 10px;border-radius:6px;font-size:12px;font-weight:700;margin-bottom:10px
}
.c03-title{font-size:30px;font-weight:800;color:#1A202C;margin-bottom:6px;letter-spacing:-0.02em}
.c03-subtitle{font-size:14px;color:#4A5568;line-height:1.65}

/* ── 快速说明 ── */
.c03-quickstart{
  display:grid;gap:12px;margin-bottom:16px;padding:18px 20px;
  border:1px solid #D7E3EF;border-radius:14px;background:linear-gradient(180deg,#FFFFFF 0%,#F8FCFA 100%);
  box-shadow:0 10px 28px rgba(15,23,42,.05)
}
.c03-quick-header{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.c03-quick-header strong{display:block;font-size:16px;color:#1A202C}
.c03-quick-header p{font-size:13px;color:#4A5568;line-height:1.65}
.c03-quick-badge{
  display:inline-flex;align-items:center;padding:4px 10px;border-radius:999px;
  background:#E8F8F0;color:#007A42;font-size:11px;font-weight:800;white-space:nowrap
}
.c03-quick-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.c03-quick-item{
  padding:14px;border-radius:12px;background:#FFFFFF;border:1px solid #E2E8F0
}
.c03-quick-item strong{display:block;font-size:14px;color:#1A202C;margin-bottom:6px}
.c03-quick-item p{font-size:13px;line-height:1.6;color:#4A5568}

/* ── 卡片基础（共用）── */
.input-card,.result-card,.review-card,.conservation-card,.steps-card{
  background:#FFFFFF;border:1px solid #D7E3EF;border-radius:14px;
  padding:22px;box-shadow:0 8px 24px rgba(15,23,42,.05)
}
.input-card{margin-bottom:16px}
.result-card{margin-bottom:16px;display:none}
.result-card.visible{display:block;animation:fade-in .18s ease}
.review-card{margin-bottom:16px;display:none}
.review-card.visible{display:block;animation:fade-in .18s ease}
.conservation-card{margin-bottom:16px;display:none}
.conservation-card.visible{display:block;animation:fade-in .18s ease}
.steps-card{display:none}
.steps-card.visible{display:block;animation:fade-in .18s ease}
@keyframes fade-in{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}

/* ── Input ── */
.input-row{display:flex;gap:8px;align-items:center}
.eq-input{
  flex:1;font-size:16px;padding:10px 14px;
  border:1px solid #CBD5E0;border-radius:10px;
  outline:none;background:#FFFFFF;color:#1A202C;transition:border-color .12s
}
.eq-input:focus{border-color:#00A85A;box-shadow:0 0 0 3px rgba(0,168,90,.12)}
.balance-btn{
  padding:10px 22px;background:#00A85A;color:#FFFFFF;
  font-size:14px;font-weight:700;border:1px solid #00A85A;
  border-radius:20px;cursor:pointer;transition:background .12s,border-color .12s;white-space:nowrap
}
.balance-btn:hover{background:#007A42;border-color:#007A42}
.input-hint{margin-top:10px;font-size:13px;color:#4A5568;line-height:1.65}
.input-hint strong{color:#1A202C}

/* ── Section label（与 C04 detail-section h3 一致）── */
.section-title,.result-label{
  font-size:11.5px;font-weight:700;color:#007A42;
  text-transform:uppercase;letter-spacing:.06em;margin-bottom:12px
}

/* ── 配平结果 ── */
.result-eq{font-size:28px;font-weight:800;color:#1A202C;line-height:1.55;word-break:break-all}
.equation-term{display:inline-flex;align-items:baseline;white-space:nowrap}
.coeff{color:#00A85A;font-weight:900;margin-right:.04em}
.formula-token{display:inline-block;line-height:1}
.formula-token sub,
.formula-token sup{
  font-size:.56em;
  line-height:0;
  position:relative;
  font-weight:800;
}
.formula-token sub{bottom:-.24em}
.formula-token sup{top:-.52em}
.formula-state{
  font-size:.58em;
  color:#4A5568;
  margin-left:.08em;
  vertical-align:baseline;
}
.eq-type-chip{
  display:inline-block;background:#E8F8F0;color:#007A42;
  padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700;
  margin-bottom:8px;letter-spacing:.02em
}
.result-error{font-size:15px;color:#C53030;font-weight:700}
.result-note{margin-top:10px;font-size:13px;color:#4A5568;line-height:1.7}

/* ── 结果复核 ── */
.review-summary{
  margin-bottom:14px;padding:12px 14px;border-radius:10px;
  background:#F0FAF5;border:1px solid #CDEFD9;font-size:14px;color:#1A202C;line-height:1.7
}
.review-list{display:grid;gap:10px}
.review-item{
  padding:12px 14px;border-radius:12px;border:1px solid #D7E3EF;background:#FCFDFE
}
.review-item--warn{background:#FFF9F1;border-color:#F3D5A4}
.review-item-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px}
.review-item-label{font-size:14px;font-weight:800;color:#1A202C}
.review-item-tag{
  display:inline-flex;align-items:center;padding:3px 8px;border-radius:999px;
  font-size:11px;font-weight:800;background:#E8F8F0;color:#007A42
}
.review-item-tag.warn{background:#FFF1F0;color:#C53030}
.review-item p{font-size:13px;line-height:1.7;color:#4A5568}

/* ── 守恒表 ── */
.cons-table{width:100%;border-collapse:collapse;font-size:14px}
.cons-table th{
  text-align:center;padding:10px 12px;
  background:#F7FAFC;color:#007A42;
  font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;
  border-bottom:1.5px solid #CBD5E0
}
.cons-table td{text-align:center;padding:10px 12px;border-bottom:1px solid #EDF2F7;color:#2D3748}
.cons-table td:first-child{font-weight:700;color:#1A202C}
.cons-table tr:last-child td{border-bottom:none}
.check-ok{color:#00A85A;font-size:15px;font-weight:700}
.check-fail{color:#C53030;font-size:15px;font-weight:700}

/* ── 步骤卡片 ── */
.step-item{
  background:#FFFFFF;border:1px solid #E2E8F0;
  border-left:3px solid #00A85A;border-radius:0 8px 8px 0;
  padding:14px 16px;color:#2D3748;line-height:1.7
}
.step-item+.step-item{margin-top:8px}
.step-item.step-hidden{display:none}
@keyframes step-in{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
.step-item.step-enter{animation:step-in .22s ease}

.step-header{display:flex;align-items:center;gap:8px}
.step-badge{
  display:inline-block;background:#E8F8F0;color:#00A85A;
  font-size:11px;font-weight:700;padding:2px 8px;
  border-radius:6px;letter-spacing:.04em;white-space:nowrap
}
.step-title{font-weight:800;color:#1A202C;font-size:15px}
.step-body{margin-top:8px;font-size:13px;color:#2D3748;line-height:1.75}
.step-body p{margin-bottom:6px}
.step-body p:last-child{margin-bottom:0}
.step-body table{width:100%;border-collapse:collapse;font-size:13px;margin-top:6px}
.step-body th{
  text-align:left;padding:6px 10px;background:#F7FAFC;
  color:#007A42;font-size:10px;font-weight:700;
  text-transform:uppercase;letter-spacing:.06em;border-bottom:1.5px solid #CBD5E0
}
.step-body td{padding:6px 10px;border-bottom:1px solid #EDF2F7;vertical-align:middle;color:#2D3748}
.step-body tr:last-child td{border-bottom:none}
.step-body .inline-eq{
  display:inline-block;padding:6px 14px;background:#E8F8F0;
  border-radius:8px;font-weight:800;font-size:18px;color:#007A42;margin-top:8px
}
.step-body .coeff{color:#00A85A;font-weight:900}
.step-body .formula-token sub,
.step-body .formula-token sup{font-size:.62em}
.step-dim{font-size:12px;color:#718096;margin-top:4px}

/* ── 下一步按钮（与 C04 color-btn 一致）── */
.next-step-row{display:flex;justify-content:flex-end;margin-top:12px}
.next-step-btn{
  padding:4px 14px;background:#FFFFFF;color:#4A5568;
  font-size:12px;font-weight:500;border:1px solid #E2E8F0;
  border-radius:20px;cursor:pointer;transition:border-color .12s,color .12s,background .12s
}
.next-step-btn:hover{border-color:#00A85A;color:#00A85A}
.next-step-btn:disabled{opacity:.4;cursor:default;pointer-events:none}

/* ── 快捷输入条 ── */
.qb-section{margin-top:14px;padding-top:12px;border-top:1px solid #E2E8F0}
.qb-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.qb-title{font-size:11px;font-weight:700;color:#007A42;text-transform:uppercase;letter-spacing:.06em}
.qb-group{display:flex;align-items:flex-start;gap:8px;margin-bottom:5px}
.qb-gname{font-size:11px;color:#718096;min-width:28px;padding-top:3px;flex-shrink:0;text-align:right}
.qb-chips{display:flex;flex-wrap:wrap;gap:4px}
.qb-chip{
  padding:2px 7px;font-size:13px;line-height:1.5;border-radius:6px;cursor:pointer;
  border:1px solid #E2E8F0;background:#FFFFFF;color:#2D3748;
  transition:border-color .1s,background .1s,color .1s;font-family:inherit
}
.qb-chip:hover{background:#E8F8F0;color:#00A85A;border-color:#00A85A}
.qb-hdr-btns{display:flex;gap:6px}
.qb-btn{
  padding:3px 10px;font-size:12px;font-weight:500;border-radius:16px;cursor:pointer;
  border:1px solid #E2E8F0;background:#FFFFFF;color:#4A5568;
  transition:border-color .12s,color .12s,background .12s;white-space:nowrap
}
.qb-btn:hover{border-color:#00A85A;color:#00A85A}
.qb-btn-primary{background:#00A85A;color:#FFFFFF;border-color:#00A85A}
.qb-btn-primary:hover{background:#007A42;border-color:#007A42;color:#FFFFFF}
.qb-btn-danger:hover{border-color:#C53030;color:#C53030}
/* 编辑模式 */
.qb-edit-card{
  background:#FFFFFF;border:1px solid #E2E8F0;border-radius:8px;
  padding:10px 12px;margin-bottom:8px
}
.qb-edit-card-hdr{display:flex;align-items:center;gap:8px;margin-bottom:6px}
.qb-edit-name{
  flex:1;font-size:13px;font-weight:600;color:#1A202C;
  padding:4px 8px;border:1px solid #E2E8F0;border-radius:6px;
  outline:none;background:#FAFAFA;font-family:inherit
}
.qb-edit-name:focus{border-color:#00A85A}
.qb-edit-hint{font-size:11px;color:#718096;margin-bottom:5px}
.qb-edit-hint code{background:#EDF2F7;padding:1px 4px;border-radius:3px;font-family:monospace;font-size:10px}
.qb-edit-area{
  width:100%;font-size:12px;color:#2D3748;font-family:monospace;
  padding:7px 8px;border:1px solid #E2E8F0;border-radius:6px;
  outline:none;background:#FAFAFA;resize:vertical;line-height:1.7;box-sizing:border-box
}
.qb-edit-area:focus{border-color:#00A85A}
.qb-add-group{
  width:100%;margin-top:4px;padding:6px;font-size:12px;border-radius:8px;cursor:pointer;
  border:1px dashed #CBD5E0;background:#FAFAFA;color:#718096;
  transition:border-color .12s,color .12s;font-family:inherit
}
.qb-add-group:hover{border-color:#00A85A;color:#00A85A}

/* ── 实时预览行 ── */
.preview-line{min-height:18px;font-size:13px;color:#007A42;margin-top:8px;padding-left:2px;line-height:1.8;word-break:break-all}
.preview-line .formula-token sub,
.preview-line .formula-token sup{font-size:.64em}
.preview-line:empty{display:none}

/* ── 错误高亮 ── */
.error-token{background:#FED7D7;color:#C53030;border-radius:3px;padding:0 3px;font-weight:700}
.error-context{
  background:#FFF5F5;border:1px solid #FED7D7;border-radius:6px;
  padding:8px 10px;margin-top:8px;font-size:13px;font-family:monospace;
  color:#742A2A;word-break:break-all;line-height:1.6
}

/* ── 历史记录 ── */
.hist-card{
  background:#FFFFFF;border:1px solid #D7E3EF;border-radius:14px;
  padding:16px 20px;margin-bottom:16px;box-shadow:0 8px 24px rgba(15,23,42,.05)
}
.hist-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.hist-item{
  display:flex;align-items:center;padding:6px 10px;border-radius:8px;cursor:pointer;
  font-size:13px;color:#2D3748;border:1px solid transparent;
  transition:background .1s,border-color .1s;margin-bottom:4px;word-break:break-all;line-height:1.5
}
.hist-item:hover{background:#E8F8F0;border-color:#B2F0D2;color:#007A42}
.hist-item:last-child{margin-bottom:0}

/* ── 移动端适配 ── */
@media(max-width:600px){
  #app{padding:16px 12px 40px}
  .c03-title{font-size:24px}
  .c03-quick-grid{grid-template-columns:minmax(0,1fr)}
  .result-eq{font-size:18px}
  .input-row{flex-wrap:wrap;gap:6px}
  .eq-input{min-width:0}
  .balance-btn{flex-shrink:0}
  .qb-gname{display:none}
  .qb-chip{padding:2px 5px;font-size:12px}
  .step-item{padding:10px 12px}
  .cons-table th,.cons-table td{padding:6px 8px;font-size:12px}
}
`;

// ── DOM 构建 ───────────────────────────────────────────────────
const app = document.getElementById('app')!;

const style = document.createElement('style');
style.textContent = css;
document.head.appendChild(style);

app.innerHTML = `
<div class="c03-header">
  <div class="c03-chip">化学模块 / C-03</div>
  <div class="c03-title">化学方程式配平器</div>
  <div class="c03-subtitle">先给出最小整数系数，再做守恒检查与课堂复核。页面重点改为“配平 + 检查”，不把代数结果直接等同于反应一定成立。</div>
</div>

<div class="c03-quickstart">
  <div class="c03-quick-header">
    <div>
      <strong>功能说明与建议用法</strong>
      <p>适合课堂上的“先输入，再核对，再追问条件”。支持括号、离子、电荷、配位写法与部分水合物，但复杂氧化还原仍建议结合介质和电子转移方法复核。</p>
    </div>
    <span class="c03-quick-badge">先检查，再记忆</span>
  </div>
  <div class="c03-quick-grid">
    <div class="c03-quick-item">
      <strong>1. 输入方程式</strong>
      <p>支持 =、→、⇌，也支持 Unicode 下标、离子电荷和 [Ag(NH3)2]+ 一类配位写法。</p>
    </div>
    <div class="c03-quick-item">
      <strong>2. 看复核结果</strong>
      <p>页面会先判断守恒是否通过、物质是否落在常见物质库、是否需要额外检查介质条件。</p>
    </div>
    <div class="c03-quick-item">
      <strong>3. 再展开步骤</strong>
      <p>下方步骤区保留“识别物质 → 统计原子 → 给系数 → 守恒验证 → 课堂复核”的顺序，适合带学生逐步检查。</p>
    </div>
  </div>
</div>

<div class="input-card">
  <div class="input-row">
    <input class="eq-input" id="eq-input" type="text" placeholder="例如：H2 + O2 = H2O" value="${DEFAULT_INPUT}" autocomplete="off" spellcheck="false" />
    <button class="balance-btn" id="balance-btn">配平</button>
  </div>
  <div id="preview-line" class="preview-line"></div>
  <div class="input-hint">
    支持格式：<strong>H2 + O2 = H2O</strong>，箭头可用 <strong>=</strong> 或 <strong>→</strong>，括号如 <strong>Ca(OH)2</strong>，支持 Unicode 下标 / 状态符号如 <strong>(s)(aq)↑</strong>
  </div>
  <div id="quickbar"></div>
</div>

<div id="hist-section"></div>

<div class="result-card" id="result-card">
  <div class="result-label">配平结果</div>
  <div id="result-content"></div>
</div>

<div class="review-card" id="review-card">
  <div class="section-title">课堂复核</div>
  <div id="review-content"></div>
</div>

<div class="conservation-card" id="conservation-card">
  <div class="section-title">原子守恒校验</div>
  <table class="cons-table">
    <thead><tr><th>元素</th><th>反应物</th><th>生成物</th><th>守恒</th></tr></thead>
    <tbody id="cons-tbody"></tbody>
  </table>
</div>

<div class="steps-card" id="steps-card">
  <div class="section-title">配平过程</div>
  <div id="steps-list"></div>
  <div class="next-step-row" id="next-step-row" style="display:none">
    <button class="next-step-btn" id="next-step-btn">下一步 →</button>
  </div>
</div>
`;

// ── 状态 ───────────────────────────────────────────────────────
const input = document.getElementById('eq-input') as HTMLInputElement;
const btn   = document.getElementById('balance-btn') as HTMLButtonElement;
const resultCard  = document.getElementById('result-card')!;
const resultContent = document.getElementById('result-content')!;
const reviewCard = document.getElementById('review-card')!;
const reviewContent = document.getElementById('review-content')!;
const consCard  = document.getElementById('conservation-card')!;
const consTbody = document.getElementById('cons-tbody')!;
const stepsCard     = document.getElementById('steps-card')!;
const stepsList     = document.getElementById('steps-list')!;
const nextStepRow   = document.getElementById('next-step-row')!;
const nextStepBtn   = document.getElementById('next-step-btn') as HTMLButtonElement;

let stepRevealCount = 0; // 当前已展开的步骤数
let currentRunState: C03RunState = 'idle';
let currentResultSourceInput: string | null = null;

// ── 快捷输入条 ─────────────────────────────────────────────────
interface QuickItem  { label: string; insert: string }
interface QuickGroup { id: string; name: string; items: QuickItem[] }

const QB_DEFAULTS: QuickGroup[] = [
  { id:'sym',  name:'符号',  items:[
    {label:'=',insert:'='},{label:'→',insert:'→'},{label:'⇌',insert:'⇌'},
    {label:'+',insert:'+'},{label:'↑',insert:'↑'},{label:'↓',insert:'↓'},
    {label:'(s)',insert:'(s)'},{label:'(g)',insert:'(g)'},
    {label:'(l)',insert:'(l)'},{label:'(aq)',insert:'(aq)'},
  ]},
  { id:'sub',  name:'下标',  items:
    '₁₂₃₄₅₆₇₈₉'.split('').map(c=>({label:c,insert:c}))
  },
  { id:'chg',  name:'电荷',  items:[
    {label:'⁺',insert:'+'},{label:'⁻',insert:'-'},
    {label:'²⁺',insert:'2+'},{label:'²⁻',insert:'2-'},
    {label:'³⁺',insert:'3+'},{label:'³⁻',insert:'3-'},
    {label:'⁴⁺',insert:'4+'},{label:'⁴⁻',insert:'4-'},
  ]},
  { id:'elem', name:'元素',  items:
    ['H','O','C','N','S','Cl','Fe','Ca','Na','K','Al','Mg','Cu','Zn','P','Mn','Cr','Br','I']
      .map(e=>({label:e,insert:e}))
  },
  { id:'mol',  name:'分子',  items:[
    {label:'H₂O',insert:'H2O'},{label:'O₂',insert:'O2'},{label:'H₂',insert:'H2'},
    {label:'N₂',insert:'N2'},{label:'CO₂',insert:'CO2'},{label:'HCl',insert:'HCl'},
    {label:'H₂SO₄',insert:'H2SO4'},{label:'HNO₃',insert:'HNO3'},
    {label:'NaOH',insert:'NaOH'},{label:'Ca(OH)₂',insert:'Ca(OH)2'},
    {label:'NaCl',insert:'NaCl'},{label:'CaCO₃',insert:'CaCO3'},
    {label:'KMnO₄',insert:'KMnO4'},{label:'Fe₂O₃',insert:'Fe2O3'},
  ]},
  { id:'ion',  name:'离子',  items:[
    {label:'H⁺',insert:'H+'},{label:'OH⁻',insert:'OH-'},
    {label:'Na⁺',insert:'Na+'},{label:'K⁺',insert:'K+'},
    {label:'Ca²⁺',insert:'Ca2+'},{label:'Mg²⁺',insert:'Mg2+'},
    {label:'Fe²⁺',insert:'Fe2+'},{label:'Fe³⁺',insert:'Fe3+'},
    {label:'Al³⁺',insert:'Al3+'},{label:'Cu²⁺',insert:'Cu2+'},
    {label:'Cl⁻',insert:'Cl-'},{label:'SO₄²⁻',insert:'SO42-'},
    {label:'CO₃²⁻',insert:'CO32-'},{label:'NO₃⁻',insert:'NO3-'},
    {label:'MnO₄⁻',insert:'MnO4-'},{label:'HCO₃⁻',insert:'HCO3-'},
    {label:'NH₄⁺',insert:'NH4+'},{label:'PO₄³⁻',insert:'PO43-'},
    {label:'e⁻',insert:'e-'},
  ]},
  { id:'org',  name:'有机物', items:[
    {label:'CH₄',insert:'CH4'},{label:'C₂H₄',insert:'C2H4'},
    {label:'C₂H₂',insert:'C2H2'},{label:'C₂H₅OH',insert:'C2H5OH'},
    {label:'C₃H₈',insert:'C3H8'},{label:'CH₃COOH',insert:'CH3COOH'},
    {label:'C₆H₁₂O₆',insert:'C6H12O6'},{label:'C₁₂H₂₂O₁₁',insert:'C12H22O11'},
  ]},
];

const QB_KEY = 'c03-qb-v1';
function qbLoad(): QuickGroup[] {
  try { const s = localStorage.getItem(QB_KEY); if (s) return JSON.parse(s) as QuickGroup[]; } catch {}
  return JSON.parse(JSON.stringify(QB_DEFAULTS)) as QuickGroup[];
}
function qbSave(g: QuickGroup[]) { localStorage.setItem(QB_KEY, JSON.stringify(g)); }

let qbGroups = qbLoad();
let qbEditMode = false;
const quickbarEl = document.getElementById('quickbar')!;

function insertAtCursor(text: string) {
  const s = input.selectionStart ?? input.value.length;
  const e = input.selectionEnd ?? input.value.length;
  input.value = input.value.slice(0, s) + text + input.value.slice(e);
  input.selectionStart = input.selectionEnd = s + text.length;
  input.focus();
}

function serializeItems(items: QuickItem[]): string {
  return items.map(it => it.label === it.insert ? it.label : `${it.label}|${it.insert}`).join('\n');
}
function parseItems(text: string): QuickItem[] {
  return text.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const p = l.indexOf('|');
    return p === -1 ? {label:l,insert:l} : {label:l.slice(0,p),insert:l.slice(p+1)};
  });
}

function renderQuickBar() { qbEditMode ? renderQBEdit() : renderQBView(); }

function renderQBView() {
  const rows = qbGroups.map(g =>
    `<div class="qb-group">
      <span class="qb-gname">${escHtml(g.name)}</span>
      <div class="qb-chips">${
        g.items.map(it =>
          `<button class="qb-chip" data-insert="${escHtml(it.insert)}">${escHtml(it.label)}</button>`
        ).join('')
      }</div>
    </div>`
  ).join('');

  quickbarEl.innerHTML = `
    <div class="qb-section">
      <div class="qb-header">
        <span class="qb-title">快捷输入</span>
        <div class="qb-hdr-btns">
          <button class="qb-btn" id="qb-toggle">⚙ 自定义</button>
        </div>
      </div>
      ${rows}
    </div>`;

  document.getElementById('qb-toggle')!.addEventListener('click', () => { qbEditMode = true; renderQuickBar(); });
  quickbarEl.querySelectorAll<HTMLButtonElement>('.qb-chip').forEach(btn => {
    btn.addEventListener('click', () => insertAtCursor(btn.dataset.insert ?? ''));
  });
}

function renderQBEdit() {
  const cards = qbGroups.map((g, gi) => `
    <div class="qb-edit-card" data-gi="${gi}">
      <div class="qb-edit-card-hdr">
        <input class="qb-edit-name" value="${escHtml(g.name)}" data-gi="${gi}" placeholder="分组名" />
        <button class="qb-btn qb-btn-danger" data-gi="${gi}" id="qb-del-${gi}">删除分组</button>
      </div>
      <div class="qb-edit-hint">每行一项，格式：<code>显示文字|插入内容</code>（内容相同可省略竖线）</div>
      <textarea class="qb-edit-area" data-gi="${gi}" rows="4">${escHtml(serializeItems(g.items))}</textarea>
    </div>`
  ).join('');

  quickbarEl.innerHTML = `
    <div class="qb-section">
      <div class="qb-header">
        <span class="qb-title">自定义快捷键</span>
        <div class="qb-hdr-btns">
          <button class="qb-btn qb-btn-danger" id="qb-reset">恢复默认</button>
          <button class="qb-btn qb-btn-primary" id="qb-done">完成</button>
        </div>
      </div>
      ${cards}
      <button class="qb-add-group" id="qb-add">＋ 添加分组</button>
    </div>`;

  const sync = () => {
    quickbarEl.querySelectorAll<HTMLElement>('.qb-edit-card').forEach(card => {
      const gi = parseInt(card.dataset.gi ?? '0');
      const nameInp = card.querySelector<HTMLInputElement>('.qb-edit-name');
      const ta = card.querySelector<HTMLTextAreaElement>('.qb-edit-area');
      if (nameInp && qbGroups[gi]) qbGroups[gi].name = nameInp.value;
      if (ta && qbGroups[gi]) qbGroups[gi].items = parseItems(ta.value);
    });
    qbSave(qbGroups);
  };

  quickbarEl.querySelectorAll<HTMLElement>('.qb-edit-area, .qb-edit-name').forEach(el => {
    el.addEventListener('input', sync);
  });

  qbGroups.forEach((_, gi) => {
    document.getElementById(`qb-del-${gi}`)?.addEventListener('click', () => {
      sync();
      qbGroups.splice(gi, 1);
      qbSave(qbGroups);
      renderQBEdit();
    });
  });

  document.getElementById('qb-add')!.addEventListener('click', () => {
    sync();
    qbGroups.push({ id: 'g' + Date.now(), name: '新分组', items: [] });
    qbSave(qbGroups);
    renderQBEdit();
  });

  document.getElementById('qb-reset')!.addEventListener('click', () => {
    if (confirm('将恢复所有默认快捷键，自定义内容会丢失，确认吗？')) {
      qbGroups = JSON.parse(JSON.stringify(QB_DEFAULTS)) as QuickGroup[];
      qbSave(qbGroups);
      renderQBEdit();
    }
  });

  document.getElementById('qb-done')!.addEventListener('click', () => {
    sync();
    qbEditMode = false;
    renderQuickBar();
  });
}

renderQuickBar();

// ── 历史记录 ─────────────────────────────────────────────────────
interface HistItem { raw: string; balanced: string }
const HIST_KEY = 'c03-hist-v1';
const HIST_MAX = 10;
const histSection = document.getElementById('hist-section')!;
const previewLine  = document.getElementById('preview-line')!;

function histLoad(): HistItem[] {
  try { const s = localStorage.getItem(HIST_KEY); if (s) return JSON.parse(s) as HistItem[]; } catch {}
  return [];
}
function histSave(items: HistItem[]) { localStorage.setItem(HIST_KEY, JSON.stringify(items)); }

function renderHist() {
  const items = histLoad();
  if (items.length === 0) { histSection.innerHTML = ''; return; }
  histSection.innerHTML = `
    <div class="hist-card">
      <div class="hist-header">
        <span class="section-title" style="margin-bottom:0">历史记录</span>
        <button class="qb-btn" id="hist-clear">清除</button>
      </div>
      ${items.map((it, i) =>
        `<div class="hist-item" data-idx="${i}" data-raw="${escHtml(it.raw)}">${it.balanced}</div>`
      ).join('')}
    </div>`;
  document.getElementById('hist-clear')?.addEventListener('click', () => { histSave([]); renderHist(); });
  histSection.querySelectorAll<HTMLElement>('.hist-item').forEach(el => {
    el.addEventListener('click', () => { input.value = el.dataset.raw ?? ''; run(); });
  });
}

function addToHist(raw: string, balanced: string) {
  const items = histLoad().filter(it => it.raw !== raw);
  items.unshift({ raw, balanced });
  histSave(items.slice(0, HIST_MAX));
  renderHist();
}

renderHist();

const EQUATION_PRESETS: Record<string, { input: string; label: string; topic: string }> = {
  combustion: { input: 'CH4 + O2 = CO2 + H2O', label: '甲烷燃烧', topic: '燃烧反应' },
  synthesis: { input: 'H2 + O2 = H2O', label: '氢气燃烧生成水', topic: '化合反应' },
  decomposition: { input: 'KClO3 = KCl + O2', label: '氯酸钾分解', topic: '分解反应' },
  replacement: { input: 'Fe + CuSO4 = FeSO4 + Cu', label: '铁置换铜', topic: '置换反应' },
  neutralization: { input: 'HCl + NaOH = NaCl + H2O', label: '酸碱中和', topic: '复分解反应' },
  redox: { input: 'KMnO4 + HCl = KCl + MnCl2 + Cl2 + H2O', label: '高锰酸钾氧化盐酸', topic: '氧化还原反应' },
  ionic: { input: 'Fe3+ + OH- = Fe(OH)3', label: '铁离子与氢氧根生成沉淀', topic: '离子方程式' },
  carbonate: { input: 'CaCO3 + HCl = CaCl2 + CO2 + H2O', label: '碳酸钙与盐酸', topic: '气体生成反应' },
};

function renderReview(review: EquationReview): void {
  reviewContent.innerHTML = `
    <div class="review-summary">${escHtml(review.summary)}</div>
    <div class="review-list">
      ${review.items.map((item) => `
        <div class="review-item${item.tone === 'warn' ? ' review-item--warn' : ''}">
          <div class="review-item-head">
            <span class="review-item-label">${escHtml(item.label)}</span>
            <span class="review-item-tag${item.tone === 'warn' ? ' warn' : ''}">${item.tone === 'warn' ? '需复核' : '通过'}</span>
          </div>
          <p>${escHtml(item.detail)}</p>
        </div>
      `).join('')}
    </div>
  `;
  reviewCard.classList.add('visible');
}

function clearRenderedState() {
  resultContent.innerHTML = '';
  reviewContent.innerHTML = '';
  consTbody.innerHTML = '';
  stepsList.innerHTML = '';
  resultCard.classList.remove('visible');
  reviewCard.classList.remove('visible');
  consCard.classList.remove('visible');
  stepsCard.classList.remove('visible');
  nextStepRow.style.display = 'none';
  stepRevealCount = 0;
}

function restoreRevealedSteps(savedCount: number) {
  const total = stepsList.querySelectorAll('.step-item').length;
  const target = Math.max(1, Math.min(savedCount, total));
  for (let i = 0; i < total; i++) {
    const item = document.getElementById(`step-${i}`);
    if (!item) continue;
    if (i < target) item.classList.remove('step-hidden');
    else item.classList.add('step-hidden');
  }
  stepRevealCount = target;
  nextStepRow.style.display = target < total ? '' : 'none';
}

function cloneDefaults<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

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

function getEffectiveRunState(rawInput: string): C03RunState {
  if (!rawInput) return 'idle';
  if (currentRunState === 'idle') return 'idle';
  if (currentResultSourceInput !== rawInput) return 'idle';
  return currentRunState;
}

function buildSnapshotPayload(useDefaults = false): C03SnapshotPayload {
  if (useDefaults) {
    return {
      editor: {
        rawInput: DEFAULT_INPUT,
        runState: 'idle',
      },
      ui: {
        revealedStepCount: 0,
      },
      preferences: {
        quickGroups: cloneDefaults(QB_DEFAULTS),
      },
      history: {
        items: [],
      },
    };
  }

  const rawInput = input.value.trim();
  const effectiveRunState = getEffectiveRunState(rawInput);

  return {
    editor: {
      rawInput,
      runState: effectiveRunState,
    },
    ui: {
      revealedStepCount: effectiveRunState === 'success' ? stepRevealCount : 0,
    },
    preferences: {
      quickGroups: cloneDefaults(qbGroups),
    },
    history: {
      items: histLoad(),
    },
  };
}

function getDefaultSnapshot(): C03SnapshotDocument {
  return {
    envelope: buildEnvelope(),
    payload: buildSnapshotPayload(true),
  };
}

function getSnapshot(): C03SnapshotDocument {
  return {
    envelope: buildEnvelope(),
    payload: buildSnapshotPayload(false),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isQuickItem(value: unknown): value is QuickItem {
  return isRecord(value) &&
    typeof value.label === 'string' &&
    typeof value.insert === 'string';
}

function isQuickGroup(value: unknown): value is QuickGroup {
  return isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    Array.isArray(value.items) &&
    value.items.every(isQuickItem);
}

function isHistItem(value: unknown): value is HistItem {
  return isRecord(value) &&
    typeof value.raw === 'string' &&
    typeof value.balanced === 'string';
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

    if (!isRecord(payload.editor)) {
      errors.push('payload.editor 缺失或非法');
    } else {
      if (typeof payload.editor.rawInput !== 'string') {
        errors.push('payload.editor.rawInput 必须为字符串');
      }
      if (!['idle', 'success', 'error'].includes(String(payload.editor.runState))) {
        errors.push('payload.editor.runState 必须为 idle / success / error');
      }
    }

    if (!isRecord(payload.ui)) {
      errors.push('payload.ui 缺失或非法');
    } else if (
      typeof payload.ui.revealedStepCount !== 'number' ||
      Number.isNaN(payload.ui.revealedStepCount) ||
      payload.ui.revealedStepCount < 0
    ) {
      errors.push('payload.ui.revealedStepCount 必须为大于等于 0 的数字');
    }

    if (!isRecord(payload.preferences)) {
      errors.push('payload.preferences 缺失或非法');
    } else if (
      !Array.isArray(payload.preferences.quickGroups) ||
      !payload.preferences.quickGroups.every(isQuickGroup)
    ) {
      errors.push('payload.preferences.quickGroups 缺失或非法');
    }

    if (!isRecord(payload.history)) {
      errors.push('payload.history 缺失或非法');
    } else if (
      !Array.isArray(payload.history.items) ||
      !payload.history.items.every(isHistItem)
    ) {
      errors.push('payload.history.items 缺失或非法');
    }
  }

  return { ok: errors.length === 0, errors };
}

interface RunOptions {
  recordHistory?: boolean;
}

// ── 实时预览 ──────────────────────────────────────────────────────
let previewTimer: ReturnType<typeof setTimeout> | null = null;
function updatePreview() {
  const raw = input.value.trim();
  if (!raw) { previewLine.innerHTML = ''; return; }
  const parsed = parseEquation(raw);
  if (!parsed.ok) { previewLine.innerHTML = ''; return; }
  const balanced = balance(parsed.equation);
  if (!balanced.ok) { previewLine.innerHTML = ''; return; }
  previewLine.innerHTML = '→ ' + formatEquation(parsed.equation, balanced.coefficients);
}

// ── 教学步骤数据 ───────────────────────────────────────────────
interface StepData { title: string; bodyHtml: string }

function buildSteps(eq: ParsedEquation, coeffs: number[], review: EquationReview): StepData[] {
  const allMols = [...eq.reactants, ...eq.products];
  const n = eq.reactants.length;
  const elemSet = new Set<string>();
  for (const mol of allMols) for (const e of Object.keys(mol.atoms)) elemSet.add(e);
  const elements = [...elemSet].sort();

  const isIonic = eq.equationType === 'ionic';
  const fmtCharge = (v: number) => v === 0 ? '0' : (v > 0 ? '+' : '') + v;

  // Step 1：识别反应物和生成物（离子方程式额外展示净电荷）
  let s1: string;
  if (isIonic) {
    const ionRows = allMols.map((mol, j) => {
      const side = j < n ? '反应物' : '生成物';
      const charge = mol.charge !== 0
        ? `<span style="color:#007A42;font-weight:700">${fmtCharge(mol.charge)}</span>`
        : '<span style="color:#718096">0（中性）</span>';
      return `<tr>
        <td><strong>${formatFormulaForDisplay(mol.rawFormula)}</strong></td>
        <td style="color:#64748B">${side}</td>
        <td>${charge}</td>
      </tr>`;
    }).join('');
    s1 = `
      <p>反应物（左侧）：${eq.reactants.map(m => `<strong>${formatFormulaForDisplay(m.rawFormula)}</strong>`).join('、')}</p>
      <p>生成物（右侧）：${eq.products.map(m => `<strong>${formatFormulaForDisplay(m.rawFormula)}</strong>`).join('、')}</p>
      <table>
        <thead><tr><th>离子/分子</th><th>类型</th><th>净电荷</th></tr></thead>
        <tbody>${ionRows}</tbody>
      </table>
      <p class="step-dim" style="margin-top:8px">目标：找到一组最小正整数系数，使左右两侧每种元素的原子数<strong>且总电荷</strong>均相等。</p>`;
  } else {
    const fmtList = (mols: typeof eq.reactants) =>
      mols.map(m => `<strong>${formatFormulaForDisplay(m.rawFormula)}</strong>`).join('、');
    s1 = `
      <p>反应物（左侧）：${fmtList(eq.reactants)}</p>
      <p>生成物（右侧）：${fmtList(eq.products)}</p>
      <p class="step-dim">目标：找到一组最小正整数系数，使左右两侧每种元素的原子数相等。</p>`;
  }

  // Step 2：统计各元素原子数（离子方程式额外显示电荷列）
  const atomRows = allMols.map((mol, j) => {
    const side = j < n ? '反应物' : '生成物';
    const counts = elements
      .filter(e => (mol.atoms[e] ?? 0) > 0)
      .map(e => `${e}×${mol.atoms[e]}`).join('，') || '—';
    const chargeCell = isIonic
      ? `<td style="color:#007A42">${fmtCharge(mol.charge)}</td>` : '';
    return `<tr>
      <td><strong>${formatFormulaForDisplay(mol.rawFormula)}</strong></td>
      <td style="color:#64748B">${side}</td>
      <td>${counts}</td>
      ${chargeCell}
    </tr>`;
  }).join('');
  const s2 = `
    <p>先统计每个分子中各元素的原子数${isIonic ? '及净电荷' : ''}：</p>
    <table>
      <thead><tr><th>分子</th><th>类型</th><th>原子组成</th>${isIonic ? '<th>电荷</th>' : ''}</tr></thead>
      <tbody>${atomRows}</tbody>
    </table>
    <p class="step-dim" style="margin-top:8px">逐个统计每种分子包含的元素及数量，是配平的出发点。</p>`;

  // Step 3：确定配平系数
  const coeffLines = allMols.map((mol, j) =>
    `${formatFormulaForDisplay(mol.rawFormula)} 的系数 = <strong>${coeffs[j]}</strong>`
  ).join('<br>');
  const s3 = `
    <p>通过调整各物质前的系数，使每种元素的原子数${isIonic ? '及两侧总电荷' : ''}相等：</p>
    <div style="margin:8px 0;line-height:2">${coeffLines}</div>
    <div class="inline-eq">${formatEquation(eq, coeffs)}</div>`;

  // Step 4：验证原子守恒（离子方程式额外验证电荷守恒）
  const verifyRows = elements.map(e => {
    const L = eq.reactants.reduce((s, m, i) => s + (m.atoms[e] ?? 0) * coeffs[i], 0);
    const R = eq.products.reduce((s, m, i)  => s + (m.atoms[e] ?? 0) * coeffs[n + i], 0);
    const ok = L === R;
    const detail = (side: typeof eq.reactants, cs: number[]) =>
      side.map((m, i) => {
        const cnt = m.atoms[e] ?? 0;
        return cnt > 0 ? `${cs[i]}×${cnt}` : null;
      }).filter(Boolean).join('+') || '0';
    return `<tr>
      <td><strong>${e}</strong></td>
      <td>${detail(eq.reactants, coeffs.slice(0, n))} = ${L}</td>
      <td>${detail(eq.products, coeffs.slice(n))} = ${R}</td>
      <td style="text-align:center;color:${ok ? '#22C55E' : '#DC2626'}">${ok ? '✓' : '✗'}</td>
    </tr>`;
  }).join('');

  let chargeVerifyRow = '';
  if (isIonic) {
    const lq = eq.reactants.reduce((s, m, i) => s + m.charge * coeffs[i], 0);
    const rq = eq.products.reduce((s, m, i)  => s + m.charge * coeffs[n + i], 0);
    const lqDetail = eq.reactants.map((m, i) => m.charge !== 0 ? `${coeffs[i]}×(${fmtCharge(m.charge)})` : null).filter(Boolean).join('+') || '0';
    const rqDetail = eq.products.map((m, i)  => m.charge !== 0 ? `${coeffs[n + i]}×(${fmtCharge(m.charge)})` : null).filter(Boolean).join('+') || '0';
    const ok = lq === rq;
    chargeVerifyRow = `<tr style="color:#007A42;font-style:italic">
      <td><strong>电荷</strong></td>
      <td>${lqDetail} = ${fmtCharge(lq)}</td>
      <td>${rqDetail} = ${fmtCharge(rq)}</td>
      <td style="text-align:center;color:${ok ? '#22C55E' : '#DC2626'};font-style:normal">${ok ? '✓' : '✗'}</td>
    </tr>`;
  }

  const s4 = `
    <table>
      <thead><tr><th>元素/电荷</th><th>反应物侧</th><th>生成物侧</th><th style="text-align:center">守恒</th></tr></thead>
      <tbody>${verifyRows}${chargeVerifyRow}</tbody>
    </table>
    <p style="color:#22C55E;font-weight:600;margin-top:10px">✓ 所有元素原子数${isIonic ? '及电荷' : ''}已完全相等，方程式配平完成。</p>`;

  const s5 = `
    <table>
      <thead><tr><th>检查项目</th><th>状态</th><th>课堂提示</th></tr></thead>
      <tbody>
        ${review.items.map((item) => `
          <tr>
            <td><strong>${escHtml(item.label)}</strong></td>
            <td style="color:${item.tone === 'warn' ? '#C53030' : '#007A42'}">${item.tone === 'warn' ? '需复核' : '通过'}</td>
            <td>${escHtml(item.detail)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <p class="step-dim" style="margin-top:8px">${escHtml(review.summary)}</p>`;

  return [
    { title: '识别反应物和生成物', bodyHtml: s1 },
    { title: '统计各元素原子数',   bodyHtml: s2 },
    { title: '确定最小整数系数',   bodyHtml: s3 },
    { title: `验证${isIonic ? '元素与电荷' : '元素'}守恒`, bodyHtml: s4 },
    { title: '课堂复核',           bodyHtml: s5 },
  ];
}

// ── 主逻辑 ─────────────────────────────────────────────────────
function run(options: RunOptions = {}) {
  const { recordHistory = true } = options;
  const raw = input.value.trim();
  if (!raw) {
    currentRunState = 'idle';
    currentResultSourceInput = null;
    clearRenderedState();
    return;
  }

  const parsed = parseEquation(raw);
  if (!parsed.ok) {
    showError(parsed.error.message, raw);
    return;
  }

  const eq = parsed.equation;
  const result = balance(eq);

  if (!result.ok) {
    showError(result.message, raw);
    return;
  }

  const { coefficients } = result;
  const balancedHtml = formatEquation(eq, coefficients);
  const review = buildEquationReview(eq);

  // 历史记录
  if (recordHistory && review.allowHistory) {
    addToHist(raw, balancedHtml);
  }

  // 结果行（含题型 chip + 多解提示）
  const typeChip = eq.equationType === 'ionic'
    ? '<div class="eq-type-chip">离子方程式</div>' : '';
  const noteHtml = result.note
    ? `<div class="step-dim" style="margin-top:4px">⚠ ${escHtml(result.note)}</div>` : '';
  const historyNote = recordHistory && !review.allowHistory
    ? '<div class="result-note">本次结果未写入历史记录：方程式超出了当前高中常用物质库的完整覆盖范围，请先人工复核后再作为课堂答案使用。</div>'
    : '';
  resultContent.innerHTML = `${typeChip}<div class="result-eq">${balancedHtml}</div>${noteHtml}${historyNote}`;
  resultCard.classList.add('visible');
  renderReview(review);

  // 守恒表
  const elemSet = new Set<string>();
  const allMols = [...eq.reactants, ...eq.products];
  for (const mol of allMols) for (const e of Object.keys(mol.atoms)) elemSet.add(e);
  const elements = [...elemSet].sort();
  const n = eq.reactants.length;

  const atomRows = elements.map(e => {
    const lc = eq.reactants.reduce((s, m, i) => s + (m.atoms[e] ?? 0) * coefficients[i], 0);
    const rc = eq.products.reduce((s, m, i)  => s + (m.atoms[e] ?? 0) * coefficients[n + i], 0);
    const ok = lc === rc;
    return `<tr>
      <td>${e}</td><td>${lc}</td><td>${rc}</td>
      <td>${ok ? '<span class="check-ok">✓</span>' : '<span class="check-fail">✗</span>'}</td>
    </tr>`;
  }).join('');

  let chargeRow = '';
  if (eq.equationType === 'ionic') {
    const lq = eq.reactants.reduce((s, m, i) => s + m.charge * coefficients[i], 0);
    const rq = eq.products.reduce((s, m, i)  => s + m.charge * coefficients[n + i], 0);
    const ok = lq === rq;
    const fmt = (v: number) => v === 0 ? '0' : (v > 0 ? '+' : '') + v;
    chargeRow = `<tr>
      <td style="color:#007A42;font-style:italic">电荷</td>
      <td>${fmt(lq)}</td><td>${fmt(rq)}</td>
      <td>${ok ? '<span class="check-ok">✓</span>' : '<span class="check-fail">✗</span>'}</td>
    </tr>`;
  }
  consTbody.innerHTML = atomRows + chargeRow;
  consCard.classList.add('visible');

  // 步骤卡片（逐步展开）
  const steps = buildSteps(eq, coefficients, review);
  stepRevealCount = 1;
  stepsList.innerHTML = steps.map((s, i) => `
    <div class="step-item${i > 0 ? ' step-hidden' : ''}" id="step-${i}">
      <div class="step-header">
        <span class="step-badge">Step ${i + 1}</span>
        <span class="step-title">${escHtml(s.title)}</span>
      </div>
      <div class="step-body">${s.bodyHtml}</div>
    </div>`).join('');
  nextStepRow.style.display = steps.length > 1 ? '' : 'none';
  nextStepBtn.textContent = '下一步 →';
  nextStepBtn.disabled = false;
  stepsCard.classList.add('visible');
  currentRunState = 'success';
  currentResultSourceInput = raw;
}

function showError(msg: string, rawInput?: string) {
  let html = `<div class="result-error">错误：${escHtml(msg)}</div>`;
  if (msg.includes('多组配平解')) {
    html += '<div class="result-note">这类情况通常不是“再试一次”就能解决，而是要先检查反应条件、反应物是否写全，或是否把多个独立反应写在了一起。</div>';
  }
  if (rawInput) {
    // 从错误信息中提取被提及的 token（如 "未知元素符号: Xx" → "Xx"）
    const mentioned = /[：:]\s*"?([^"\n]+?)"?\s*$/.exec(msg)?.[1]?.trim();
    let displayRaw = escHtml(rawInput);
    if (mentioned && rawInput.includes(mentioned)) {
      displayRaw = displayRaw.replace(
        new RegExp(escHtml(mentioned).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
        `<span class="error-token">${escHtml(mentioned)}</span>`
      );
    }
    html += `<div class="error-context">${displayRaw}</div>`;
  }
  resultContent.innerHTML = html;
  resultCard.classList.add('visible');
  reviewCard.classList.remove('visible');
  reviewContent.innerHTML = '';
  consCard.classList.remove('visible');
  stepsCard.classList.remove('visible');
  nextStepRow.style.display = 'none';
  stepRevealCount = 0;
  currentRunState = 'error';
  currentResultSourceInput = rawInput?.trim() || input.value.trim() || null;
}

nextStepBtn.addEventListener('click', () => {
  const next = document.getElementById(`step-${stepRevealCount}`);
  if (!next) return;
  next.classList.remove('step-hidden');
  next.classList.add('step-enter');
  next.addEventListener('animationend', () => next.classList.remove('step-enter'), { once: true });
  stepRevealCount++;
  // 所有步骤展开后隐藏按钮
  const total = stepsList.querySelectorAll('.step-item').length;
  if (stepRevealCount >= total) nextStepRow.style.display = 'none';
});

btn.addEventListener('click', run);
input.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
input.addEventListener('input', () => {
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = setTimeout(updatePreview, 400);
});

function loadSnapshot(snapshot: unknown): void {
  const validation = validateSnapshot(snapshot);
  if (!validation.ok) {
    throw new Error(validation.errors.join('；'));
  }

  const doc = snapshot as C03SnapshotDocument;
  const { payload } = doc;

  qbGroups = cloneDefaults(payload.preferences.quickGroups);
  qbSave(qbGroups);
  qbEditMode = false;
  renderQuickBar();

  histSave(payload.history.items);
  renderHist();

  input.value = payload.editor.rawInput;
  updatePreview();

  currentRunState = 'idle';
  currentResultSourceInput = null;
  clearRenderedState();

  if (payload.editor.runState === 'idle') {
    return;
  }

  run({ recordHistory: false });

  if (payload.editor.runState === 'success') {
    restoreRevealedSteps(payload.ui.revealedStepCount);
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function analyzeEquation(rawInput: string) {
  if (!rawInput.trim()) {
    return { status: 'empty' as const };
  }

  const parsed = parseEquation(rawInput);
  if (!parsed.ok) {
    return {
      status: 'parse-error' as const,
      error: parsed.error,
    };
  }

  const balanced = balance(parsed.equation);
  if (!balanced.ok) {
    return {
      status: 'balance-error' as const,
      equation: parsed.equation,
      error: balanced,
    };
  }

  return {
    status: 'success' as const,
    equation: parsed.equation,
    coefficients: balanced.coefficients,
    note: balanced.note,
    balancedText: formatEquation(parsed.equation, balanced.coefficients).replace(/<[^>]+>/g, ''),
  };
}

function getAiContext() {
  const rawInput = input.value.trim();
  const analysis = analyzeEquation(rawInput);
  return {
    templateKey: TEMPLATE_KEY,
    editor: {
      rawInput,
      runState: getEffectiveRunState(rawInput),
    },
    ui: {
      revealedStepCount: stepRevealCount,
      totalStepCount: stepsList.querySelectorAll('.step-item').length,
    },
    analysis,
    history: histLoad(),
    presets: Object.entries(EQUATION_PRESETS).map(([presetId, preset]) => ({
      presetId,
      ...preset,
    })),
    controls: {
      supportedOperations: [
        'setEquation',
        'balanceEquation',
        'revealSteps',
        'loadEquationPreset',
        'clearHistory',
      ],
      acceptsUnicodeSubscripts: true,
      supportedArrows: ['=', '→', '⇌'],
      supportsIonicChargeBalance: true,
    },
  };
}

function setEquationValue(rawInput: string, shouldRun: boolean): void {
  input.value = rawInput;
  updatePreview();
  if (shouldRun) {
    run();
    return;
  }
  currentRunState = 'idle';
  currentResultSourceInput = null;
  clearRenderedState();
}

function revealSteps(count: number | undefined): void {
  if (getEffectiveRunState(input.value.trim()) !== 'success') {
    run();
  }
  const total = stepsList.querySelectorAll('.step-item').length;
  if (total === 0) return;
  restoreRevealedSteps(count === undefined ? total : count);
}

function applyOneOperation(op: Record<string, unknown>, applied: string[], warnings: string[]): void {
  const type = asString(op.type);
  if (!type) {
    warnings.push('operation 缺少 type。');
    return;
  }

  switch (type) {
    case 'setEquation': {
      const rawInput = asString(op.rawInput) ?? asString(op.equation) ?? asString(op.input);
      if (!rawInput) {
        warnings.push('setEquation 需要 rawInput/equation。');
        return;
      }
      const shouldRun = op.run === true || op.balance === true;
      setEquationValue(rawInput, shouldRun);
      applied.push(type);
      return;
    }

    case 'balanceEquation': {
      const rawInput = asString(op.rawInput) ?? asString(op.equation) ?? asString(op.input);
      if (rawInput) setEquationValue(rawInput, false);
      run();
      applied.push(type);
      return;
    }

    case 'revealSteps': {
      const count = asNumber(op.count) ?? asNumber(op.revealedStepCount);
      revealSteps(count);
      applied.push(type);
      return;
    }

    case 'loadEquationPreset': {
      const presetId = asString(op.presetId) ?? asString(op.id);
      if (!presetId || !EQUATION_PRESETS[presetId]) {
        warnings.push(`未知方程式预设：${presetId ?? '空'}`);
        return;
      }
      setEquationValue(EQUATION_PRESETS[presetId].input, true);
      applied.push(type);
      return;
    }

    case 'clearHistory': {
      histSave([]);
      renderHist();
      applied.push(type);
      return;
    }

    default:
      warnings.push(`不支持的 operation：${type}`);
  }
}

function applyOperations(inputValue: unknown): ApplyOperationsResult {
  const operations = Array.isArray(inputValue)
    ? inputValue
    : isRecord(inputValue) && Array.isArray(inputValue.operations)
      ? inputValue.operations
      : null;
  const applied: string[] = [];
  const warnings: string[] = [];
  if (!operations) {
    return { ok: false, applied, warnings: ['operations 必须是数组。'] };
  }

  for (const op of operations) {
    if (!isRecord(op)) {
      warnings.push('operation 必须是对象。');
      continue;
    }
    applyOneOperation(op, applied, warnings);
  }

  return { ok: warnings.length === 0, applied, warnings };
}

window[TEMPLATE_BRIDGE_GLOBAL_KEY] = {
  getDefaultSnapshot,
  getSnapshot,
  loadSnapshot,
  validateSnapshot,
  getAiContext,
  applyOperations,
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
      case 'getAiContext':
        response = {
          namespace: 'edumind.templateBridge',
          type: 'response',
          requestId: data.requestId,
          success: true,
          payload: getAiContext(),
        };
        break;
      case 'applyOperations':
        response = {
          namespace: 'edumind.templateBridge',
          type: 'response',
          requestId: data.requestId,
          success: true,
          payload: applyOperations(data.payload),
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
