import { elements, ChemicalElement, ElementCategory } from '../data/elements';

// ----------------------------------------------------------------
// 类型
// ----------------------------------------------------------------
type ColorSet = { bg: string; text: string; border: string };

export type ColorMode = 'category' | 'state' | 'electronegativity';

// ----------------------------------------------------------------
// 分类配色（Mode: category）
// ----------------------------------------------------------------
export const CATEGORY_COLORS: Record<ElementCategory, ColorSet> = {
  'alkali-metal':          { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' },
  'alkaline-earth-metal':  { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' },
  'transition-metal':      { bg: '#FEFCE8', text: '#A16207', border: '#FEF08A' },
  'post-transition-metal': { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  'metalloid':             { bg: '#F0FDFA', text: '#0F766E', border: '#99F6E4' },
  'nonmetal':              { bg: '#F0FDF4', text: '#15803D', border: '#86EFAC' },
  'halogen':               { bg: '#F7FEE7', text: '#4D7C0F', border: '#BEF264' },
  'noble-gas':             { bg: '#FAF5FF', text: '#6D28D9', border: '#DDD6FE' },
  'lanthanide':            { bg: '#FDF4FF', text: '#86198F', border: '#F0ABFC' },
  'actinide':              { bg: '#FFF1F2', text: '#9F1239', border: '#FECDD3' },
};

export const CATEGORY_NAMES: Record<ElementCategory, string> = {
  'alkali-metal':          '碱金属',
  'alkaline-earth-metal':  '碱土金属',
  'transition-metal':      '过渡金属',
  'post-transition-metal': '主族金属',
  'metalloid':             '交界元素',
  'nonmetal':              '非金属',
  'halogen':               '卤素',
  'noble-gas':             '稀有气体',
  'lanthanide':            '镧系',
  'actinide':              '锕系',
};

// ----------------------------------------------------------------
// 分类说明（用于图例点击详情）
// ----------------------------------------------------------------
export type CategoryDescription = {
  summary: string;
  relationship: string;
  hsNote: string;
  examples: string;
};

export const CATEGORY_DESCRIPTIONS: Record<ElementCategory, CategoryDescription> = {
  'alkali-metal': {
    summary: '第IA族元素（氢除外），均为活泼金属，与水或酸剧烈反应，最外层只有1个电子，常见氧化态为+1。',
    relationship: '碱金属属于广义主族金属，只是因为性质特别典型而单独列出。它与“主族金属”不是并列互斥关系，而是其中一个重要子类。',
    hsNote: '常考：Na与水反应、Na₂O₂的特殊性，焰色反应（Na→黄色，K→紫色），Na₂CO₃与NaHCO₃的区别。',
    examples: 'Li、Na、K、Rb、Cs、Fr',
  },
  'alkaline-earth-metal': {
    summary: '第IIA族元素，活泼金属，最外层有2个电子，常见氧化态为+2，氧化物和氢氧化物多显碱性。',
    relationship: '碱土金属同样属于广义主族金属。课堂上通常把它和碱金属分开讲，是为了突出“最外层电子数”和典型化学性质。',
    hsNote: '常考：Ca的化合物（CaCO₃、Ca(OH)₂、CaO），Mg在CO₂中燃烧，Be的两性（与酸碱均反应）。',
    examples: 'Be、Mg、Ca、Sr、Ba、Ra',
  },
  'transition-metal': {
    summary: '位于d区（第3—12族），具有多种氧化态，密度大、熔点高，是良好导体和催化剂，多数有磁性或特征颜色。',
    relationship: '过渡金属构成元素周期表的"中间地带"，镧系和锕系在广义上也归为内过渡金属。',
    hsNote: '常考：Fe的+2/+3价态转化，Cu的化合物颜色，Fe₃O₄的组成，工业合成氨用Fe催化剂。',
    examples: 'Fe、Cu、Zn、Ni、Cr、Mn、Ti、Ag、Au、Pt',
  },
  'post-transition-metal': {
    summary: '位于过渡金属右侧的p区金属，性质介于过渡金属和非金属之间，熔点相对较低，多具延展性。',
    relationship: '这里的“主族金属”专指 p 区金属，方便在页面里和碱金属、碱土金属分开说明。三者都属于广义主族金属，并不是互相排斥的三大类。',
    hsNote: '常考：Al的两性（既与盐酸又与NaOH溶液反应），Al₂O₃的特殊性，铝热反应，Pb和Sn的化合物毒性。',
    examples: 'Al、Ga、In、Sn、Tl、Pb、Bi',
  },
  'metalloid': {
    summary: '这里用“交界元素”标记位于金属与非金属交界地带、常表现出半金属性质的一组元素。高中教学中更常见的说法是“交界元素”或“半金属”，而不是把它当作与金属、非金属并列互补的大类。',
    relationship: '交界元素强调的是“边界特征”，不是独立于金属/非金属之外的一套互斥分类。页面把它单列，是为了帮助学生理解硅、锗、砷、锑、碲等元素为什么常兼具两侧特征。',
    hsNote: 'Si是最重要的考点：半导体材料、SiO₂与HF反应（唯一与非金属氧化物反应的酸）、硅酸盐工业。B无氧酸（硼酸）是弱酸。',
    examples: 'B、Si、Ge、As、Sb、Te',
  },
  'nonmetal': {
    summary: '位于元素周期表右上方（不含卤素和稀有气体），得电子能力强，导电性差，固态时多为分子晶体或原子晶体。',
    relationship: '广义非金属包含卤素和稀有气体，但因其各自特性显著，通常单独列出。此处仅指"其他非金属"。',
    hsNote: '常考：C的同素异形体（金刚石、石墨、C₆₀），N₂的稳定性，S的化合物（SO₂、H₂SO₄），P的多种氧化态。',
    examples: 'H、C、N、O、P、S、Se',
  },
  'halogen': {
    summary: '第VIIA族，活泼非金属，得电子能力极强，常见氧化态为-1，单质为双原子分子（X₂），颜色从F₂淡黄→Cl₂黄绿→Br₂红棕→I₂紫黑。',
    relationship: '卤素是非金属的子集，活泼性在所有非金属中最强（F₂最强，可氧化水）。卤素之间活泼性：F>Cl>Br>I，可用强卤素置换弱卤素。',
    hsNote: '常考：Cl₂的制备与漂白原理，卤素活泼性比较实验，AgCl/AgBr/AgI颜色与溶解性，碘的淀粉反应。',
    examples: 'F、Cl、Br、I、At',
  },
  'noble-gas': {
    summary: '第0族（第18族），最外层电子全满（He为2，其余为8），化学性质极不活泼，通常不参与反应，曾称"惰性气体"。',
    relationship: '稀有气体独立于金属/非金属的两分体系之外，其电子构型是判断其他元素稳定性的参照基准（八隅体规则）。',
    hsNote: '高中一般不考其化学反应，但需熟悉各族最外层电子数规律，He的特殊性（最外层2个即满）。',
    examples: 'He、Ne、Ar、Kr、Xe、Rn',
  },
  'lanthanide': {
    summary: '4f区元素（57—71号），化学性质高度相似，常见+3价，因此难以分离提纯，统称"稀土元素"（La系部分）。',
    relationship: '镧系与锕系合称"内过渡元素"（f区），通常单独列于主表下方。镧系属于第6周期，与铪（Hf）之后的元素存在"镧系收缩"效应。',
    hsNote: '高中阶段不作重点要求，了解稀土元素的应用（荧光材料、永磁体、光纤）即可。',
    examples: 'La、Ce、Pr、Nd、Pm、Sm、Eu、Gd、Tb、Dy、Ho、Er、Tm、Yb、Lu',
  },
  'actinide': {
    summary: '5f区元素（89—103号），多数为放射性元素，天然存在仅少数（Th、U等），其余为人工合成。U和Pu是核燃料的主要来源。',
    relationship: '锕系与镧系同为f区内过渡元素，化学性质相近但价态更多样（+3至+7均有）。',
    hsNote: '高中阶段仅需了解放射性衰变、核裂变的基本概念。Th、U、Pu的核反应在选修《核化学》中涉及。',
    examples: 'Ac、Th、Pa、U、Np、Pu、Am、Cm',
  },
};

// ----------------------------------------------------------------
// 常温状态配色（Mode: state）
// 检测 stateAtRoomTemp 字符串中的关键字
// ----------------------------------------------------------------
const STATE_SCHEME = {
  gas:     { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE', label: '气态' },
  liquid:  { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA', label: '液态' },
  solid:   { bg: '#F0FDF4', text: '#15803D', border: '#86EFAC', label: '固态' },
  unknown: { bg: '#F7F7F7', text: '#9CA3AF', border: '#E5E7EB', label: '未知' },
} as const;

function getStateKey(el: ChemicalElement): keyof typeof STATE_SCHEME {
  const s = el.stateAtRoomTemp;
  if (!s || s === '—') return 'unknown';
  if (s.includes('气')) return 'gas';
  if (s.includes('液')) return 'liquid';
  return 'solid';
}

// ----------------------------------------------------------------
// 电负性配色（Mode: electronegativity）
// Pauling 电负性范围约 0.7–3.98，分 5 档 + 无数据
// ----------------------------------------------------------------
const EN_SCHEME = [
  { bg: '#EFF6FF', text: '#1E40AF', border: '#BFDBFE', label: '极低  < 1.2' },
  { bg: '#F0FDF4', text: '#166534', border: '#86EFAC', label: '低  1.2–1.8' },
  { bg: '#FEFCE8', text: '#92400E', border: '#FDE68A', label: '中  1.8–2.5' },
  { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA', label: '高  2.5–3.2' },
  { bg: '#FFF1F2', text: '#9F1239', border: '#FECDD3', label: '极高  > 3.2' },
  { bg: '#F7F7F7', text: '#9CA3AF', border: '#E5E7EB', label: '无数据' },
] as const;

function getENIndex(el: ChemicalElement): number {
  if (el.electronegativity === null) return 5;
  const v = el.electronegativity;
  if (v < 1.2) return 0;
  if (v < 1.8) return 1;
  if (v < 2.5) return 2;
  if (v < 3.2) return 3;
  return 4;
}

// ----------------------------------------------------------------
// 颜色派发
// ----------------------------------------------------------------
function getColor(mode: ColorMode, el: ChemicalElement): ColorSet {
  if (mode === 'category')        return CATEGORY_COLORS[el.category];
  if (mode === 'state')           return STATE_SCHEME[getStateKey(el)];
  /* electronegativity */         return EN_SCHEME[getENIndex(el)];
}

// ----------------------------------------------------------------
// 图例渲染（随模式切换）
// ----------------------------------------------------------------
type LegendItem = { bg: string; border: string; label: string; cat?: ElementCategory };

function bindKeyboardButton(
  el: HTMLElement,
  onActivate: () => void,
  ariaLabel?: string,
): void {
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
  if (ariaLabel) el.setAttribute('aria-label', ariaLabel);
  el.addEventListener('click', onActivate);
  el.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onActivate();
  });
}

function getLegendItems(mode: ColorMode): LegendItem[] {
  if (mode === 'category') {
    return (Object.keys(CATEGORY_NAMES) as ElementCategory[]).map(cat => ({
      bg: CATEGORY_COLORS[cat].bg,
      border: CATEGORY_COLORS[cat].border,
      label: CATEGORY_NAMES[cat],
      cat,
    }));
  }
  if (mode === 'state') {
    return Object.values(STATE_SCHEME).map(c => ({ bg: c.bg, border: c.border, label: c.label }));
  }
  // electronegativity
  return EN_SCHEME.map(c => ({ bg: c.bg, border: c.border, label: c.label }));
}

function renderLegend(
  legend: HTMLElement,
  mode: ColorMode,
  legendByCategory: Map<ElementCategory, HTMLElement>,
  onCategorySelect?: (cat: ElementCategory, anchorEl: HTMLElement) => void,
): void {
  legend.innerHTML = '';
  legendByCategory.clear();
  for (const item of getLegendItems(mode)) {
    const div = document.createElement('div');
    div.className = 'pt-legend-item';
    if (item.cat && onCategorySelect) {
      div.classList.add('pt-legend-item--clickable');
      div.setAttribute('aria-haspopup', 'dialog');
      bindKeyboardButton(div, () => onCategorySelect(item.cat!, div), `${item.label}分类说明`);
      legendByCategory.set(item.cat, div);
    }
    div.innerHTML = `
      <span class="pt-legend-dot" style="background:${item.bg};border-color:${item.border};"></span>
      <span>${item.label}</span>
    `;
    legend.appendChild(div);
  }
}

// ----------------------------------------------------------------
// 渲染入口
// ----------------------------------------------------------------
export function renderPeriodicTable(
  container: HTMLElement,
  onSelect?: (el: ChemicalElement, cellEl: HTMLElement) => void,
  onCategorySelect?: (cat: ElementCategory, anchorEl: HTMLElement) => void,
): {
  setColorMode: (mode: ColorMode) => void;
  setSelectedElementByAtomicNumber: (atomicNumber: number | null) => void;
  activateElementByAtomicNumber: (atomicNumber: number) => void;
  activateCategory: (cat: ElementCategory) => void;
} {
  // 建立 "period-group" → element 的快速查找表
  const elementMap = new Map<string, ChemicalElement>();
  for (const el of elements) {
    if (el.group !== null) {
      elementMap.set(`${el.period}-${el.group}`, el);
    }
  }

  // 网格容器
  const grid = document.createElement('div');
  grid.className = 'pt-grid';

  let selectedCell: HTMLElement | null = null;
  const cellEntries: Array<{ cell: HTMLElement; el: ChemicalElement }> = [];
  const elementByAtomicNumber = new Map<number, ChemicalElement>();
  const cellByAtomicNumber = new Map<number, HTMLElement>();
  const legendByCategory = new Map<ElementCategory, HTMLElement>();

  function setSelectedCell(cell: HTMLElement | null): void {
    selectedCell?.classList.remove('pt-cell--selected');
    selectedCell = cell;
    selectedCell?.classList.add('pt-cell--selected');
  }

  // 遍历 7 周期 × 18 族，逐格渲染
  for (let period = 1; period <= 7; period++) {
    for (let group = 1; group <= 18; group++) {
      const el = elementMap.get(`${period}-${group}`);
      const cell = document.createElement('div');

      if (el) {
        const c = CATEGORY_COLORS[el.category];
        cell.className = 'pt-cell';
        cell.style.cssText = `background:${c.bg};color:${c.text};border-color:${c.border};`;
        cell.dataset.atomicNumber = String(el.atomicNumber);
        cell.innerHTML = `
          <span class="pt-num">${el.atomicNumber}</span>
          <span class="pt-symbol">${el.symbol}</span>
          <span class="pt-name">${el.nameZh}</span>
        `;
        cellEntries.push({ cell, el });
        elementByAtomicNumber.set(el.atomicNumber, el);
        cellByAtomicNumber.set(el.atomicNumber, cell);
        if (onSelect) {
          const activate = () => {
            setSelectedCell(cell);
            onSelect(el, cell);
          };
          bindKeyboardButton(cell, activate, `${el.nameZh} ${el.symbol}，原子序数 ${el.atomicNumber}`);
          cell.setAttribute('aria-haspopup', 'dialog');
        }
      } else if ((period === 6 || period === 7) && group === 3) {
        // 镧系 / 锕系占位格
        const cat: ElementCategory = period === 6 ? 'lanthanide' : 'actinide';
        const c = CATEGORY_COLORS[cat];
        cell.className = 'pt-cell pt-placeholder';
        cell.style.cssText = `background:${c.bg};color:${c.text};border-color:${c.border};`;
        cell.innerHTML = `<span class="pt-placeholder-label">${period === 6 ? '57–71' : '89–103'}</span>`;
      } else {
        // 空格占位，保持网格结构
        cell.className = 'pt-ghost';
      }

      grid.appendChild(cell);
    }
  }

  container.appendChild(grid);

  // ── f-block：镧系（57-71）+ 锕系（89-103）各一行 ──
  const fBlock = document.createElement('div');
  fBlock.className = 'pt-f-block';

  for (const cat of ['lanthanide', 'actinide'] as ElementCategory[]) {
    const row = document.createElement('div');
    row.className = 'pt-f-row';

    // 前 2 列留空（对齐主表第 1-2 族）
    for (let i = 0; i < 2; i++) {
      const g = document.createElement('div');
      g.className = 'pt-ghost';
      row.appendChild(g);
    }

    // 15 个元素格（对齐第 3-17 列）
    const series = elements
      .filter(e => e.category === cat)
      .sort((a, b) => a.atomicNumber - b.atomicNumber);

    for (const fe of series) {
      const c = CATEGORY_COLORS[fe.category];
      const fcell = document.createElement('div');
      fcell.className = 'pt-cell';
      fcell.style.cssText = `background:${c.bg};color:${c.text};border-color:${c.border};`;
      fcell.dataset.atomicNumber = String(fe.atomicNumber);
      fcell.innerHTML = `
        <span class="pt-num">${fe.atomicNumber}</span>
        <span class="pt-symbol">${fe.symbol}</span>
        <span class="pt-name">${fe.nameZh}</span>
      `;
      cellEntries.push({ cell: fcell, el: fe });
      elementByAtomicNumber.set(fe.atomicNumber, fe);
      cellByAtomicNumber.set(fe.atomicNumber, fcell);
      if (onSelect) {
        const activate = () => {
          setSelectedCell(fcell);
          onSelect(fe, fcell);
        };
        bindKeyboardButton(fcell, activate, `${fe.nameZh} ${fe.symbol}，原子序数 ${fe.atomicNumber}`);
        fcell.setAttribute('aria-haspopup', 'dialog');
      }
      row.appendChild(fcell);
    }

    // 第 18 列留空
    const g = document.createElement('div');
    g.className = 'pt-ghost';
    row.appendChild(g);

    fBlock.appendChild(row);
  }

  container.appendChild(fBlock);

  // 图例
  const legend = document.createElement('div');
  legend.className = 'pt-legend';
  renderLegend(legend, 'category', legendByCategory, onCategorySelect);
  container.appendChild(legend);

  // ---- setColorMode ----
  function setColorMode(mode: ColorMode): void {
    for (const { cell, el } of cellEntries) {
      const c = getColor(mode, el);
      cell.style.background = c.bg;
      cell.style.color = c.text;
      cell.style.borderColor = c.border;
    }
    renderLegend(legend, mode, legendByCategory, onCategorySelect);
  }

  function setSelectedElementByAtomicNumber(atomicNumber: number | null): void {
    if (atomicNumber === null) {
      setSelectedCell(null);
      return;
    }
    const cell = cellByAtomicNumber.get(atomicNumber) || null;
    setSelectedCell(cell);
  }

  function activateElementByAtomicNumber(atomicNumber: number): void {
    const cell = cellByAtomicNumber.get(atomicNumber);
    const el = elementByAtomicNumber.get(atomicNumber);
    if (!cell || !el || !onSelect) return;
    setSelectedCell(cell);
    onSelect(el, cell);
  }

  function activateCategory(cat: ElementCategory): void {
    const anchorEl = legendByCategory.get(cat);
    if (!anchorEl || !onCategorySelect) return;
    onCategorySelect(cat, anchorEl);
  }

  return {
    setColorMode,
    setSelectedElementByAtomicNumber,
    activateElementByAtomicNumber,
    activateCategory,
  };
}
