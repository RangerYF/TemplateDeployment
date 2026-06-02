# C09 合成路线视图 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 C09 内新增"合成路线"面板，用手绘键线式 SVG + 反应条件箭头展示高中基础有机的多步合成路线，老师可选路线并逐步展开。

**Architecture:** 纯逻辑核心（键线式渲染器 + 分子/路线数据）写成独立 ESM 模块 `c09-synthesis/core.mjs`，用 vitest 做 TDD；构建脚本 `build-c07-c09-pages.mjs` 在构建 C-09 时把该模块内联进 `c07_c09_chemistry_tool.html` 的标记处。视图（DOM/事件/逐步展开）作为内联脚本写在 HTML 里，调用被注入的全局 `renderSkeleton/MOLECULES/ROUTES`。

**Tech Stack:** 原生 TypeScript/JS、SVG、vitest（已有）、pnpm。无外部化学库（守 <200KB 单文件原则）。

---

## 关键约定（所有任务共用）

**符号约定**：分子 `skeleton` 用声明式描述，渲染器算坐标。

```
SkeletonSpec =
  | { type:'chain', atoms:number, bonds?:BondMod[], subs?:Sub[] }
  | { type:'ring',  size:number, aromatic?:boolean, bonds?:BondMod[], subs?:Sub[] }
BondMod = { a:number, b:number, order:2|3 }   // 顶点 1-based，C-C 双/叁键
Sub = { at:number, dir:'up'|'down', label?:string, dbl?:'O' }
   // label：单键支链文字（Br/Cl/OH/NO₂/CH₃/OC₂H₅…）；dbl:'O'：羰基 =O
   // 同一 at 可同时有 dbl:'O' 与 label（如羧基 C(=O)OH）
```

**渲染常量**（core.mjs 顶部）：`L=30`（键长）、`DX=25.98`、`DY=15`、`STROKE='#1A202C'`、`SW=2.4`、`HAL='#B91C1C'`（卤素红）、双键偏移 `K=5`、内缩 `INSET=4`、环半径 `R=30`。

**卤素判定**：label 以 `Br/Cl/F/I` 开头 → 用 `HAL` 颜色，否则 `STROKE`。

---

## Task 1: 核心模块脚手架 + 链坐标渲染

**Files:**
- Create: `c09-synthesis/core.mjs`
- Test: `c09-synthesis/core.test.mjs`

- [ ] **Step 1: 写失败测试**

`c09-synthesis/core.test.mjs`：
```js
import { describe, it, expect } from 'vitest';
import { renderSkeleton } from './core.mjs';

describe('renderSkeleton chain', () => {
  it('丁烷 4 碳链：3 段主键、返回 <svg>', () => {
    const svg = renderSkeleton({ type: 'chain', atoms: 4 });
    expect(svg.startsWith('<svg')).toBe(true);
    // 3 段 C-C 主键 → 至少 3 条 <line
    expect((svg.match(/<line/g) || []).length).toBeGreaterThanOrEqual(3);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run c09-synthesis/core.test.mjs`
Expected: FAIL（`renderSkeleton` is not a function / 模块不存在）

- [ ] **Step 3: 最小实现**

`c09-synthesis/core.mjs`：
```js
// ── 渲染常量 ──
const L = 30, DX = L * Math.cos(Math.PI / 6), DY = L * Math.sin(Math.PI / 6);
const STROKE = '#1A202C', SW = 2.4, HAL = '#B91C1C', K = 5, INSET = 4, R = 30;
const PAD = 14;

const isHalogen = (label) => /^(Br|Cl|F|I)/.test(label || '');
const ln = (x1, y1, x2, y2, color = STROKE) =>
  `<line x1="${r(x1)}" y1="${r(y1)}" x2="${r(x2)}" y2="${r(y2)}" stroke="${color}" stroke-width="${SW}" stroke-linecap="round"/>`;
const r = (n) => Math.round(n * 100) / 100;

// 链顶点坐标：i=0..atoms-1，偶数低、奇数高（锯齿）
function chainVertices(atoms) {
  const v = [];
  for (let i = 0; i < atoms; i++) v.push({ x: i * DX, y: i % 2 === 1 ? 0 : DY });
  return v;
}

function svgWrap(parts, verts, extra = []) {
  const xs = verts.map((p) => p.x).concat(extra.map((p) => p.x));
  const ys = verts.map((p) => p.y).concat(extra.map((p) => p.y));
  const minX = Math.min(...xs) - PAD, minY = Math.min(...ys) - PAD;
  const w = Math.max(...xs) - Math.min(...xs) + PAD * 2;
  const h = Math.max(...ys) - Math.min(...ys) + PAD * 2;
  return `<svg viewBox="${r(minX)} ${r(minY)} ${r(w)} ${r(h)}" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>`;
}

export function renderSkeleton(spec) {
  if (spec.type === 'chain') {
    const v = chainVertices(spec.atoms);
    const parts = [];
    for (let i = 0; i < v.length - 1; i++) parts.push(ln(v[i].x, v[i].y, v[i + 1].x, v[i + 1].y));
    return svgWrap(parts, v);
  }
  return '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run c09-synthesis/core.test.mjs`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add c09-synthesis/core.mjs c09-synthesis/core.test.mjs
git commit -m "feat(c09): 键线式渲染器脚手架与链坐标"
```

---

## Task 2: C-C 双键 / 叁键平行渲染

**Files:** Modify `c09-synthesis/core.mjs`；Test `c09-synthesis/core.test.mjs`

- [ ] **Step 1: 写失败测试**（追加）

```js
describe('renderSkeleton 双键', () => {
  it('2-丁烯：a=2,b=3 双键 → 该段渲染两条平行线', () => {
    const svg = renderSkeleton({ type: 'chain', atoms: 4, bonds: [{ a: 2, b: 3, order: 2 }] });
    // 3 段主键 + 双键多 1 条 = 至少 4 条 line
    expect((svg.match(/<line/g) || []).length).toBeGreaterThanOrEqual(4);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run c09-synthesis/core.test.mjs`
Expected: FAIL（双键未渲染，line 数不足）

- [ ] **Step 3: 实现双键/叁键**

在 core.mjs 加平行线工具，并改造 chain 主键绘制以应用 `bonds`：
```js
// 主键方向 A→B 的平行第二条线（朝指定内侧偏移，两端内缩）
function parallelLine(a, b, side) {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len;           // 沿键单位
  const nx = -uy * side, ny = ux * side;         // 垂直单位（side=±1 选内侧）
  const ax = a.x + ux * INSET + nx * K, ay = a.y + uy * INSET + ny * K;
  const bx = b.x - ux * INSET + nx * K, by = b.y - uy * INSET + ny * K;
  return ln(ax, ay, bx, by);
}
function bondOrderMap(bonds, n) {
  const m = new Map();
  for (const bd of bonds || []) m.set(`${Math.min(bd.a, bd.b)}-${Math.max(bd.a, bd.b)}`, bd.order);
  return m;
}
```
把 chain 分支替换为：
```js
  if (spec.type === 'chain') {
    if (spec.atoms < 2) return renderTinyText(spec);   // Task 5 定义
    const v = chainVertices(spec.atoms);
    const orders = bondOrderMap(spec.bonds, spec.atoms);
    const parts = [];
    for (let i = 0; i < v.length - 1; i++) {
      const a = v[i], b = v[i + 1];
      parts.push(ln(a.x, a.y, b.x, b.y));
      const ord = orders.get(`${i + 1}-${i + 2}`) || 1;
      // 内侧方向：上行键(b 比 a 高,y 更小)内侧朝下，反之朝上 → 用 side 统一朝"链上方"
      if (ord >= 2) parts.push(parallelLine(a, b, -1));
      if (ord === 3) parts.push(parallelLine(a, b, 1));
    }
    const subParts = renderSubs(spec.subs, v);          // Task 3 定义
    return svgWrap([...parts, ...subParts.parts], v, subParts.extra);
  }
```
> 注：此时 `renderSubs`、`renderTinyText` 尚未定义，Task 3/5 会补上。为让本任务测试可跑，先加占位：
```js
function renderSubs() { return { parts: [], extra: [] }; }
function renderTinyText() { return ''; }
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run c09-synthesis/core.test.mjs`
Expected: PASS（两个 describe 全绿）

- [ ] **Step 5: 提交**

```bash
git add c09-synthesis/core.mjs c09-synthesis/core.test.mjs
git commit -m "feat(c09): C-C 双键/叁键平行渲染"
```

---

## Task 3: 取代基（卤素/官能团/羰基）

**Files:** Modify `c09-synthesis/core.mjs`；Test `c09-synthesis/core.test.mjs`

- [ ] **Step 1: 写失败测试**（追加）

```js
describe('renderSkeleton 取代基', () => {
  it('2-溴丁烷：Br 标注为红色', () => {
    const svg = renderSkeleton({ type: 'chain', atoms: 4, subs: [{ at: 2, label: 'Br', dir: 'up' }] });
    expect(svg).toContain('Br');
    expect(svg).toContain('#B91C1C');
  });
  it('乙酸：C2 同时有 =O 与 OH（羧基）', () => {
    const svg = renderSkeleton({ type: 'chain', atoms: 2, subs: [{ at: 2, dir: 'up', dbl: 'O' }, { at: 2, dir: 'down', label: 'OH' }] });
    expect(svg).toContain('O'); // 含 O 标注
    expect((svg.match(/<line/g) || []).length).toBeGreaterThanOrEqual(3); // 主键+羰基双键(2线)
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run c09-synthesis/core.test.mjs`
Expected: FAIL（取代基占位返回空）

- [ ] **Step 3: 实现 renderSubs**

替换 core.mjs 里的 `renderSubs` 占位：
```js
const txt = (x, y, s, color = STROKE, size = 13) =>
  `<text x="${r(x)}" y="${r(y)}" font-size="${size}" font-weight="700" fill="${color}" text-anchor="middle" font-family="Arial, sans-serif">${s}</text>`;

function vertsFor(spec) {
  return spec.type === 'ring' ? ringVertices(spec.size) : chainVertices(spec.atoms);
}

// 取代基：从顶点 v 沿 dir 引短键 + 标注；返回 svg 片段与额外坐标（用于 viewBox 包围盒）
function renderSubs(subs, verts) {
  const parts = [], extra = [];
  for (const s of subs || []) {
    const p = verts[s.at - 1];
    if (!p) continue;
    const dy = s.dir === 'down' ? L * 0.8 : -L * 0.8;
    const tipX = p.x, tipY = p.y + dy;
    const color = isHalogen(s.label) ? HAL : STROKE;
    if (s.dbl === 'O') {
      // 羰基：平行双键到 O
      parts.push(ln(p.x, p.y, tipX, tipY, HAL === color ? STROKE : STROKE));
      parts.push(ln(p.x + 4, p.y + (dy > 0 ? 2 : -2), tipX + 4, tipY + (dy > 0 ? 2 : -2)));
      parts.push(txt(tipX + 4, tipY + (dy > 0 ? 12 : -4), 'O', STROKE));
      extra.push({ x: tipX + 8, y: tipY + (dy > 0 ? 14 : -10) });
    }
    if (s.label) {
      parts.push(ln(p.x, p.y, tipX, tipY, color));
      const ty = dy > 0 ? tipY + 12 : tipY - 4;
      parts.push(txt(tipX, ty, s.label, color));
      extra.push({ x: tipX, y: ty }, { x: tipX - 12, y: ty }, { x: tipX + 12, y: ty });
    }
  }
  return { parts, extra };
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run c09-synthesis/core.test.mjs`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add c09-synthesis/core.mjs c09-synthesis/core.test.mjs
git commit -m "feat(c09): 取代基（卤素红/官能团/羰基=O）渲染"
```

---

## Task 4: 环系 + 芳香环

**Files:** Modify `c09-synthesis/core.mjs`；Test `c09-synthesis/core.test.mjs`

- [ ] **Step 1: 写失败测试**（追加）

```js
describe('renderSkeleton 环', () => {
  it('环己烷：6 条环边', () => {
    const svg = renderSkeleton({ type: 'ring', size: 6 });
    expect((svg.match(/<line/g) || []).length).toBe(6);
  });
  it('苯（aromatic）：含内圈 circle', () => {
    const svg = renderSkeleton({ type: 'ring', size: 6, aromatic: true });
    expect(svg).toContain('<circle');
  });
  it('环己烯：含 1 条环内双键（>6 条线）', () => {
    const svg = renderSkeleton({ type: 'ring', size: 6, bonds: [{ a: 1, b: 2, order: 2 }] });
    expect((svg.match(/<line/g) || []).length).toBeGreaterThan(6);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run c09-synthesis/core.test.mjs`
Expected: FAIL

- [ ] **Step 3: 实现环**

加 ring 顶点与渲染，并在 renderSkeleton 增加 ring 分支：
```js
function ringVertices(size) {
  const cx = 0, cy = 0, v = [];
  for (let i = 0; i < size; i++) {
    const ang = (Math.PI / 180) * (i * (360 / size)); // 平顶六边形：0,60,120…
    v.push({ x: cx + R * Math.cos(ang), y: cy - R * Math.sin(ang) });
  }
  return v;
}
```
在 renderSkeleton 末尾（return ring）前替换：
```js
  if (spec.type === 'ring') {
    const v = ringVertices(spec.size);
    const orders = bondOrderMap(spec.bonds, spec.size);
    const parts = [];
    for (let i = 0; i < v.length; i++) {
      const a = v[i], b = v[(i + 1) % v.length];
      parts.push(ln(a.x, a.y, b.x, b.y));
      const key = `${Math.min(i + 1, ((i + 1) % v.length) + 1)}-${Math.max(i + 1, ((i + 1) % v.length) + 1)}`;
      if ((orders.get(key) || 1) >= 2) parts.push(parallelLine(a, b, 1)); // 环内侧
    }
    if (spec.aromatic) parts.push(`<circle cx="0" cy="0" r="${r(R * 0.55)}" fill="none" stroke="${STROKE}" stroke-width="${SW}"/>`);
    const subParts = renderSubs(spec.subs, v);
    return svgWrap([...parts, ...subParts.parts], v, subParts.extra);
  }
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run c09-synthesis/core.test.mjs`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add c09-synthesis/core.mjs c09-synthesis/core.test.mjs
git commit -m "feat(c09): 环系与芳香环（内圈圆）渲染"
```

---

## Task 5: 单碳分子文本回退

**Files:** Modify `c09-synthesis/core.mjs`；Test `c09-synthesis/core.test.mjs`

- [ ] **Step 1: 写失败测试**（追加）

```js
describe('renderSkeleton 单碳回退', () => {
  it('甲烷 atoms:1 → 文本回退含 text', () => {
    const svg = renderSkeleton({ type: 'chain', atoms: 1, _fallback: 'CH₄' });
    expect(svg).toContain('<text');
    expect(svg).toContain('CH');
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run c09-synthesis/core.test.mjs`
Expected: FAIL（renderTinyText 占位返回空字符串，无 <text）

- [ ] **Step 3: 实现 renderTinyText**

替换占位：
```js
function renderTinyText(spec) {
  const label = spec._fallback || 'C';
  return `<svg viewBox="0 0 80 40" xmlns="http://www.w3.org/2000/svg"><text x="40" y="25" font-size="16" font-weight="700" fill="${STROKE}" text-anchor="middle" font-family="Arial, sans-serif">${label}</text></svg>`;
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run c09-synthesis/core.test.mjs`
Expected: PASS（全部 describe 绿）

- [ ] **Step 5: 提交**

```bash
git add c09-synthesis/core.mjs c09-synthesis/core.test.mjs
git commit -m "feat(c09): 单碳分子文本回退"
```

---

## Task 6: 分子库 MOLECULES + getMolecule

**Files:** Modify `c09-synthesis/core.mjs`；Test `c09-synthesis/core.test.mjs`

- [ ] **Step 1: 写失败测试**（追加）

```js
import { MOLECULES, getMolecule } from './core.mjs';
describe('MOLECULES', () => {
  it('含 23 个分子且每个能渲染无错', () => {
    const ids = Object.keys(MOLECULES);
    expect(ids.length).toBe(23);
    for (const id of ids) {
      const m = MOLECULES[id];
      expect(m.name && m.condensed && m.formula && m.category).toBeTruthy();
      const svg = renderSkeleton({ ...m.skeleton, _fallback: m.condensed });
      expect(svg.startsWith('<svg')).toBe(true);
    }
  });
  it('getMolecule 未知 id 返回 null', () => {
    expect(getMolecule('nope')).toBeNull();
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run c09-synthesis/core.test.mjs`
Expected: FAIL（MOLECULES 未定义）

- [ ] **Step 3: 加 MOLECULES 数据 + getMolecule**

在 core.mjs 追加（导出）。下列 23 个分子（结构式/类别均按人教版核对）：
```js
export const MOLECULES = {
  'methane':            { name:'甲烷', condensed:'CH₄', formula:'CH₄', category:'alkane', skeleton:{type:'chain',atoms:1} },
  'chloromethane':      { name:'一氯甲烷', condensed:'CH₃Cl', formula:'CH₃Cl', category:'haloalkane', skeleton:{type:'chain',atoms:1} },
  'ethene':             { name:'乙烯', condensed:'CH₂=CH₂', formula:'C₂H₄', category:'alkene', skeleton:{type:'chain',atoms:2,bonds:[{a:1,b:2,order:2}]} },
  'ethanol':            { name:'乙醇', condensed:'CH₃CH₂OH', formula:'C₂H₆O', category:'alcohol', skeleton:{type:'chain',atoms:2,subs:[{at:2,dir:'up',label:'OH'}]} },
  'ethanal':            { name:'乙醛', condensed:'CH₃CHO', formula:'C₂H₄O', category:'aldehyde', skeleton:{type:'chain',atoms:2,subs:[{at:2,dir:'up',dbl:'O'}]} },
  'acetic-acid':        { name:'乙酸', condensed:'CH₃COOH', formula:'C₂H₄O₂', category:'carboxylic', skeleton:{type:'chain',atoms:2,subs:[{at:2,dir:'up',dbl:'O'},{at:2,dir:'down',label:'OH'}]} },
  'ethyl-acetate':      { name:'乙酸乙酯', condensed:'CH₃COOC₂H₅', formula:'C₄H₈O₂', category:'ester', skeleton:{type:'chain',atoms:2,subs:[{at:2,dir:'up',dbl:'O'},{at:2,dir:'down',label:'OC₂H₅'}]} },
  'bromoethane':        { name:'溴乙烷', condensed:'CH₃CH₂Br', formula:'C₂H₅Br', category:'haloalkane', skeleton:{type:'chain',atoms:2,subs:[{at:2,dir:'up',label:'Br'}]} },
  '1,2-dibromoethane':  { name:'1,2-二溴乙烷', condensed:'CH₂BrCH₂Br', formula:'C₂H₄Br₂', category:'haloalkane', skeleton:{type:'chain',atoms:2,subs:[{at:1,dir:'down',label:'Br'},{at:2,dir:'up',label:'Br'}]} },
  '2-bromobutane':      { name:'2-溴丁烷', condensed:'CH₃CHBrCH₂CH₃', formula:'C₄H₉Br', category:'haloalkane', skeleton:{type:'chain',atoms:4,subs:[{at:2,dir:'up',label:'Br'}]} },
  '2-butene':           { name:'2-丁烯', condensed:'CH₃CH=CHCH₃', formula:'C₄H₈', category:'alkene', skeleton:{type:'chain',atoms:4,bonds:[{a:2,b:3,order:2}]} },
  '2,3-dibromobutane':  { name:'2,3-二溴丁烷', condensed:'CH₃CHBrCHBrCH₃', formula:'C₄H₈Br₂', category:'haloalkane', skeleton:{type:'chain',atoms:4,subs:[{at:2,dir:'up',label:'Br'},{at:3,dir:'down',label:'Br'}]} },
  'benzene':            { name:'苯', condensed:'C₆H₆', formula:'C₆H₆', category:'aromatic', skeleton:{type:'ring',size:6,aromatic:true} },
  'bromobenzene':       { name:'溴苯', condensed:'C₆H₅Br', formula:'C₆H₅Br', category:'aromatic', skeleton:{type:'ring',size:6,aromatic:true,subs:[{at:1,dir:'up',label:'Br'}]} },
  'nitrobenzene':       { name:'硝基苯', condensed:'C₆H₅NO₂', formula:'C₆H₅NO₂', category:'aromatic', skeleton:{type:'ring',size:6,aromatic:true,subs:[{at:1,dir:'up',label:'NO₂'}]} },
  'toluene':            { name:'甲苯', condensed:'C₆H₅CH₃', formula:'C₇H₈', category:'aromatic', skeleton:{type:'ring',size:6,aromatic:true,subs:[{at:1,dir:'up',label:'CH₃'}]} },
  'benzoic-acid':       { name:'苯甲酸', condensed:'C₆H₅COOH', formula:'C₇H₆O₂', category:'carboxylic', skeleton:{type:'ring',size:6,aromatic:true,subs:[{at:1,dir:'up',label:'COOH'}]} },
  'bromocyclohexane':   { name:'溴代环己烷', condensed:'C₆H₁₁Br', formula:'C₆H₁₁Br', category:'haloalkane', skeleton:{type:'ring',size:6,subs:[{at:1,dir:'up',label:'Br'}]} },
  'cyclohexene':        { name:'环己烯', condensed:'C₆H₁₀', formula:'C₆H₁₀', category:'alkene', skeleton:{type:'ring',size:6,bonds:[{a:1,b:2,order:2}]} },
  '1,2-dibromocyclohexane':{ name:'1,2-二溴环己烷', condensed:'C₆H₁₀Br₂', formula:'C₆H₁₀Br₂', category:'haloalkane', skeleton:{type:'ring',size:6,subs:[{at:1,dir:'up',label:'Br'},{at:2,dir:'up',label:'Br'}]} },
  '1,3-butadiene':      { name:'1,3-丁二烯', condensed:'CH₂=CHCH=CH₂', formula:'C₄H₆', category:'alkene', skeleton:{type:'chain',atoms:4,bonds:[{a:1,b:2,order:2},{a:3,b:4,order:2}]} },
  '1,4-dibromo-2-butene':{ name:'1,4-二溴-2-丁烯', condensed:'BrCH₂CH=CHCH₂Br', formula:'C₄H₆Br₂', category:'haloalkane', skeleton:{type:'chain',atoms:4,bonds:[{a:2,b:3,order:2}],subs:[{at:1,dir:'down',label:'Br'},{at:4,dir:'up',label:'Br'}]} },
  '1,4-dibromobutane':  { name:'1,4-二溴丁烷', condensed:'BrCH₂CH₂CH₂CH₂Br', formula:'C₄H₈Br₂', category:'haloalkane', skeleton:{type:'chain',atoms:4,subs:[{at:1,dir:'down',label:'Br'},{at:4,dir:'up',label:'Br'}]} },
};

export function getMolecule(id) {
  return Object.prototype.hasOwnProperty.call(MOLECULES, id) ? MOLECULES[id] : null;
}
```
> 同时把 renderSkeleton 内 `renderTinyText` 的 `_fallback` 传递保留（Task 5 已支持）。

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run c09-synthesis/core.test.mjs`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add c09-synthesis/core.mjs c09-synthesis/core.test.mjs
git commit -m "feat(c09): 23 个核心分子数据与 getMolecule"
```

---

## Task 7: 路线库 ROUTES + 数据校验

**Files:** Modify `c09-synthesis/core.mjs`；Test `c09-synthesis/core.test.mjs`

- [ ] **Step 1: 写失败测试**（追加）

```js
import { ROUTES, validateSynthesisData } from './core.mjs';
describe('ROUTES 数据完整性', () => {
  it('校验全部通过：分子引用存在、步骤连续', () => {
    const errors = validateSynthesisData();
    expect(errors).toEqual([]);
  });
  it('至少 12 条路线', () => {
    expect(Object.keys(ROUTES).length).toBeGreaterThanOrEqual(12);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run c09-synthesis/core.test.mjs`
Expected: FAIL（ROUTES / validateSynthesisData 未定义）

- [ ] **Step 3: 加 ROUTES + validateSynthesisData**

```js
export const ROUTES = {
  'methane-chlorination': { title:'甲烷氯代', group:'必修主线', steps:[
    { from:'methane', to:'chloromethane', reactionType:'取代', conditions:'Cl₂ / 光照', equation:'CH₄ + Cl₂ →(光照) CH₃Cl + HCl' } ] },
  'ethene-hydration': { title:'乙烯水合制乙醇', group:'必修主线', steps:[
    { from:'ethene', to:'ethanol', reactionType:'加成', conditions:'H₂O / 催化剂 / 加热', equation:'CH₂=CH₂ + H₂O →(催化剂) CH₃CH₂OH' } ] },
  'ethanol-elimination': { title:'乙醇消去制乙烯', group:'必修主线', steps:[
    { from:'ethanol', to:'ethene', reactionType:'消去', conditions:'浓 H₂SO₄ / 170℃', equation:'CH₃CH₂OH →(浓硫酸,170℃) CH₂=CH₂↑ + H₂O' } ] },
  'ethene-bromination': { title:'乙烯加成制二溴乙烷', group:'必修主线', steps:[
    { from:'ethene', to:'1,2-dibromoethane', reactionType:'加成', conditions:'Br₂', equation:'CH₂=CH₂ + Br₂ → CH₂BrCH₂Br' } ] },
  'bromoethane-hydrolysis': { title:'溴乙烷水解制乙醇', group:'必修主线', steps:[
    { from:'bromoethane', to:'ethanol', reactionType:'水解', conditions:'NaOH(aq) / 加热', equation:'CH₃CH₂Br + NaOH →(水,Δ) CH₃CH₂OH + NaBr' } ] },
  'ethanol-oxidation-chain': { title:'乙醇氧化链', group:'必修主线', steps:[
    { from:'ethanol', to:'ethanal', reactionType:'氧化', conditions:'CuO / 加热（或 O₂/Cu 催化）', equation:'2CH₃CH₂OH + O₂ →(Cu,Δ) 2CH₃CHO + 2H₂O' },
    { from:'ethanal', to:'acetic-acid', reactionType:'氧化', conditions:'O₂ / 催化剂', equation:'2CH₃CHO + O₂ →(催化剂) 2CH₃COOH' },
    { from:'acetic-acid', to:'ethyl-acetate', reactionType:'酯化', conditions:'乙醇 / 浓 H₂SO₄ / 加热', equation:'CH₃COOH + C₂H₅OH ⇌(浓硫酸,Δ) CH₃COOC₂H₅ + H₂O' } ] },
  'haloalkane-alkene-cycle': { title:'卤代烃↔烯烃互变', group:'必修主线', steps:[
    { from:'2-bromobutane', to:'2-butene', reactionType:'消去', conditions:'NaOH / 醇 / 加热', equation:'CH₃CHBrCH₂CH₃ →(NaOH醇,Δ) CH₃CH=CHCH₃ + HBr' },
    { from:'2-butene', to:'2,3-dibromobutane', reactionType:'加成', conditions:'Br₂', equation:'CH₃CH=CHCH₃ + Br₂ → CH₃CHBrCHBrCH₃' } ] },
  'benzene-bromination': { title:'苯 → 溴苯', group:'必修主线', steps:[
    { from:'benzene', to:'bromobenzene', reactionType:'取代', conditions:'Br₂ / Fe（FeBr₃）', equation:'C₆H₆ + Br₂ →(Fe) C₆H₅Br + HBr' } ] },
  'benzene-nitration': { title:'苯 → 硝基苯', group:'选修拓展', steps:[
    { from:'benzene', to:'nitrobenzene', reactionType:'取代', conditions:'浓 HNO₃ / 浓 H₂SO₄ / 加热', equation:'C₆H₆ + HNO₃ →(浓硫酸,Δ) C₆H₅NO₂ + H₂O' } ] },
  'toluene-oxidation': { title:'甲苯 → 苯甲酸', group:'选修拓展', steps:[
    { from:'toluene', to:'benzoic-acid', reactionType:'氧化', conditions:'KMnO₄ / 加热后酸化', equation:'C₆H₅CH₃ →(KMnO₄) C₆H₅COOH' } ] },
  'cyclohexane-cycle': { title:'环系互变', group:'选修拓展', steps:[
    { from:'bromocyclohexane', to:'cyclohexene', reactionType:'消去', conditions:'NaOH / 醇 / 加热', equation:'C₆H₁₁Br →(NaOH醇,Δ) C₆H₁₀ + HBr' },
    { from:'cyclohexene', to:'1,2-dibromocyclohexane', reactionType:'加成', conditions:'Br₂', equation:'C₆H₁₀ + Br₂ → C₆H₁₀Br₂' } ] },
  'butadiene-addition': { title:'1,3-丁二烯加成', group:'选修拓展', steps:[
    { from:'1,3-butadiene', to:'1,4-dibromo-2-butene', reactionType:'加成', conditions:'Br₂（1,4-加成）', equation:'CH₂=CHCH=CH₂ + Br₂ → BrCH₂CH=CHCH₂Br' },
    { from:'1,4-dibromo-2-butene', to:'1,4-dibromobutane', reactionType:'加成', conditions:'H₂ / 催化剂 / 加热', equation:'BrCH₂CH=CHCH₂Br + H₂ →(催化剂) BrCH₂CH₂CH₂CH₂Br' } ] },
};

export function validateSynthesisData() {
  const errors = [];
  for (const [rid, route] of Object.entries(ROUTES)) {
    if (!route.steps || !route.steps.length) errors.push(`${rid}: 无步骤`);
    route.steps.forEach((st, i) => {
      if (!getMolecule(st.from)) errors.push(`${rid}.step${i}: from 分子不存在 ${st.from}`);
      if (!getMolecule(st.to)) errors.push(`${rid}.step${i}: to 分子不存在 ${st.to}`);
      if (i > 0 && route.steps[i - 1].to !== st.from)
        errors.push(`${rid}.step${i}: 步骤不连续（${route.steps[i - 1].to} ≠ ${st.from}）`);
      if (!st.reactionType || !st.conditions) errors.push(`${rid}.step${i}: 缺反应类型/条件`);
    });
  }
  return errors;
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run c09-synthesis/core.test.mjs`
Expected: PASS（全部绿）

- [ ] **Step 5: 提交**

```bash
git add c09-synthesis/core.mjs c09-synthesis/core.test.mjs
git commit -m "feat(c09): 12 条合成路线数据与完整性校验"
```

---

## Task 8: 构建时把 core.mjs 注入 HTML

**Files:** Modify `scripts/build-c07-c09-pages.mjs`；Modify `c07_c09_chemistry_tool.html`（仅加注入标记）

- [ ] **Step 1: 在 HTML 主 `<script>` 起始处加注入标记**

在 `c07_c09_chemistry_tool.html` 里 C09 逻辑所在的主 `<script>` 标签内、最顶部加一行（用 Grep 找到含 `organicsPathData` 的 `<script>`，在其紧随的 `'use strict'` 或脚本首行后插入）：
```js
/*__C09_SYNTHESIS_CORE__*/
```

- [ ] **Step 2: 修改构建脚本注入逻辑**

在 `scripts/build-c07-c09-pages.mjs` 顶部 import 后加：
```js
const coreFile = path.join(rootDir, 'c09-synthesis', 'core.mjs');
function readCore() {
  let src = fs.readFileSync(coreFile, 'utf8');
  // 剥离 ESM export，转为浏览器可用的全局声明
  src = src.replace(/^export\s+(const|function)\s+/gm, '$1 ');
  return src;
}
```
在 `buildPage` 函数开头（`let html = sourceHtml;` 之后）加：
```js
  html = html.replace('/*__C09_SYNTHESIS_CORE__*/', readCore());
```

- [ ] **Step 3: 运行构建，确认注入成功**

Run: `node scripts/build-c07-c09-pages.mjs`
Expected: 输出 `Built .../C-09-organic-pathways.html`；用 Grep 验证 `grep -c "renderSkeleton" dist/C-09-organic-pathways.html` ≥ 1

- [ ] **Step 4: 自包含校验**

Run: `npx tsx scripts/validate-output.ts 2>&1 | grep "C-09"`
Expected: `PASS C-09-organic-pathways.html ... self-contained`

- [ ] **Step 5: 提交**

```bash
git add scripts/build-c07-c09-pages.mjs c07_c09_chemistry_tool.html
git commit -m "feat(c09): 构建时注入合成路线核心模块"
```

---

## Task 9: HTML — 合成路线面板样式与结构

**Files:** Modify `c07_c09_chemistry_tool.html`

- [ ] **Step 1: 加样式**

在 `</style>` 前插入：
```css
.c09-syn-panel{display:grid;gap:14px}
.c09-syn-body{display:flex;gap:14px;min-height:300px}
.c09-syn-menu{width:170px;flex-shrink:0;border-right:1px solid var(--color-border);padding-right:10px;overflow-y:auto}
.c09-syn-grp{font-size:10px;font-weight:700;color:#A16207;text-transform:uppercase;letter-spacing:.04em;margin:10px 4px 5px}
.c09-syn-grp:first-child{margin-top:0}
.c09-syn-it{padding:7px 9px;border-radius:7px;color:var(--color-text);cursor:pointer;margin-bottom:2px;border:1px solid transparent;font-size:13px}
.c09-syn-it:hover{background:var(--color-primary-light)}
.c09-syn-it.active{background:var(--color-primary-light);border-color:var(--color-primary-dark);color:var(--color-primary-dark);font-weight:600}
.c09-syn-main{flex:1;min-width:0}
.c09-syn-ctrl{display:flex;align-items:center;gap:8px;margin:10px 0 12px;flex-wrap:wrap}
.c09-syn-prog{font-size:12px;color:var(--color-subtext)}
.c09-syn-flow{display:flex;align-items:flex-start;gap:4px;border:1px solid var(--color-border);border-radius:10px;padding:18px 10px;overflow-x:auto;background:var(--color-white)}
.c09-syn-node{text-align:center;flex-shrink:0;cursor:pointer;border:1.5px solid transparent;border-radius:10px;padding:6px 4px}
.c09-syn-node:hover{border-color:#86EFAC;background:var(--color-primary-light)}
.c09-syn-node.sel{border-color:var(--color-primary-dark);background:var(--color-primary-light)}
.c09-syn-node svg{width:108px;height:auto}
.c09-syn-nm{font-size:12px;font-weight:600;color:var(--color-text);margin-top:2px}
.c09-syn-sf{font-size:10.5px;color:var(--color-subtext);font-family:Consolas,Menlo,monospace;margin-top:1px}
.c09-syn-ar{text-align:center;min-width:92px;flex-shrink:0;padding-top:26px;cursor:pointer;border-radius:8px}
.c09-syn-ar:hover{background:var(--color-primary-light)}
.c09-syn-ar .ty{font-size:11px;color:var(--color-primary-dark);font-weight:700}
.c09-syn-ar .ln{font-size:14px;color:var(--color-text);letter-spacing:-1px}
.c09-syn-ar .cd{font-size:10px;color:var(--color-subtext)}
.c09-syn-ghost{opacity:.32}
.c09-syn-detail{margin-top:12px;border:1px solid #CDEFD9;border-left:3px solid var(--color-primary-dark);border-radius:0 10px 10px 0;padding:11px 14px;background:var(--color-white)}
.c09-syn-detail:empty{display:none}
```

- [ ] **Step 2: 加面板 DOM**

在 `#tab-c09` 内、isomer-section（`<div class="panel-card isomer-section">`，约 773 行）**之前**插入：
```html
        <div class="panel-card">
          <div class="card-title-row"><h3>合成路线（键线式 + 反应条件）</h3><span class="panel-badge">选路线 · 逐步展开</span></div>
          <div class="c09-syn-panel">
            <div class="c09-syn-body">
              <div class="c09-syn-menu" id="c09SynMenu"></div>
              <div class="c09-syn-main">
                <div class="c09-syn-ctrl">
                  <button class="btn-secondary" id="c09SynPrev">← 上一步</button>
                  <button class="btn-primary" id="c09SynNext">下一步 →</button>
                  <button class="btn-ghost" id="c09SynAll">全部展开</button>
                  <span class="c09-syn-prog" id="c09SynProg"></span>
                </div>
                <div class="c09-syn-flow" id="c09SynFlow"></div>
                <div class="c09-syn-detail" id="c09SynDetail"></div>
              </div>
            </div>
          </div>
        </div>
```

- [ ] **Step 3: 构建验证 DOM 存在**

Run: `node scripts/build-c07-c09-pages.mjs && grep -c "c09SynFlow" dist/C-09-organic-pathways.html`
Expected: ≥ 1

- [ ] **Step 4: 提交**

```bash
git add c07_c09_chemistry_tool.html
git commit -m "feat(c09): 合成路线面板样式与结构"
```

---

## Task 10: HTML — 合成路线视图脚本（渲染/选路/逐步/详情）

**Files:** Modify `c07_c09_chemistry_tool.html`

- [ ] **Step 1: 在主 `<script>` 末尾（C09 初始化区）加视图逻辑**

紧接 `/*__C09_SYNTHESIS_CORE__*/`（注入后即拥有 MOLECULES/ROUTES/renderSkeleton/getMolecule）能用的位置之后、DOMContentLoaded 或 C09 init 处加：
```js
(function initC09Synthesis() {
  const menuEl = document.getElementById('c09SynMenu');
  const flowEl = document.getElementById('c09SynFlow');
  const detailEl = document.getElementById('c09SynDetail');
  const progEl = document.getElementById('c09SynProg');
  if (!menuEl || !flowEl) return;

  const state = { routeId: null, revealed: 1, sel: null };

  function molSvg(id) {
    const m = getMolecule(id);
    if (!m) return '<div style="color:#C53030">缺失分子: ' + id + '</div>';
    const svg = renderSkeleton(Object.assign({}, m.skeleton, { _fallback: m.condensed }));
    return svg + '<div class="c09-syn-nm">' + m.name + '</div><div class="c09-syn-sf">' + m.condensed + '</div>';
  }

  function renderMenu() {
    const groups = {};
    for (const [id, r] of Object.entries(ROUTES)) (groups[r.group] = groups[r.group] || []).push([id, r]);
    let html = '';
    for (const [g, items] of Object.entries(groups)) {
      html += '<div class="c09-syn-grp">' + g + '</div>';
      for (const [id, r] of items)
        html += '<div class="c09-syn-it' + (id === state.routeId ? ' active' : '') + '" data-route="' + id + '">' + r.title + '</div>';
    }
    menuEl.innerHTML = html;
    menuEl.querySelectorAll('[data-route]').forEach((el) =>
      el.addEventListener('click', () => selectRoute(el.dataset.route)));
  }

  function selectRoute(id) {
    state.routeId = id; state.revealed = 1; state.sel = null;
    detailEl.innerHTML = ''; renderMenu(); renderFlow();
  }

  function renderFlow() {
    const route = ROUTES[state.routeId];
    if (!route) { flowEl.innerHTML = '<div class="subtle-text">请选择左侧路线</div>'; progEl.textContent = ''; return; }
    const N = route.steps.length;
    state.revealed = Math.max(1, Math.min(state.revealed, N));
    let html = '';
    // 起始分子
    html += '<div class="c09-syn-node" data-mol="' + route.steps[0].from + '">' + molSvg(route.steps[0].from) + '</div>';
    route.steps.forEach((st, i) => {
      const ghost = i + 1 > state.revealed ? ' c09-syn-ghost' : '';
      html += '<div class="c09-syn-ar' + ghost + '" data-step="' + i + '"><div class="ty">' + st.reactionType + '</div><div class="ln">─────▶</div><div class="cd">' + st.conditions + '</div></div>';
      html += '<div class="c09-syn-node' + ghost + '" data-mol="' + st.to + '">' + molSvg(st.to) + '</div>';
    });
    flowEl.innerHTML = html;
    progEl.textContent = '第 ' + state.revealed + ' / ' + N + ' 步';
    flowEl.querySelectorAll('[data-mol]').forEach((el) => el.addEventListener('click', () => showMol(el.dataset.mol)));
    flowEl.querySelectorAll('[data-step]').forEach((el) => el.addEventListener('click', () => showStep(+el.dataset.step)));
  }

  function showMol(id) {
    const m = getMolecule(id); if (!m) return;
    detailEl.innerHTML = '<h4 style="margin:0 0 5px;color:var(--color-primary-dark)">' + m.name + '</h4>' +
      '<div>结构简式：<code>' + m.condensed + '</code>　分子式：<code>' + m.formula + '</code></div>' +
      '<div>类别：' + (C09_CATEGORY_NAMES[m.category] || m.category) + '</div>';
  }

  function showStep(i) {
    const st = ROUTES[state.routeId].steps[i];
    detailEl.innerHTML = '<h4 style="margin:0 0 5px;color:var(--color-primary-dark)">' + st.reactionType + '反应</h4>' +
      '<div>条件：' + st.conditions + '</div>' +
      '<div>方程式：<code>' + st.equation + '</code></div>' +
      (st.note ? '<div style="color:#A16207">提示：' + st.note + '</div>' : '');
  }

  const C09_CATEGORY_NAMES = { alkane:'烷烃', alkene:'烯烃', haloalkane:'卤代烃', alcohol:'醇', aldehyde:'醛', carboxylic:'羧酸', ester:'酯', aromatic:'芳香烃' };

  document.getElementById('c09SynNext').addEventListener('click', () => { state.revealed++; renderFlow(); });
  document.getElementById('c09SynPrev').addEventListener('click', () => { state.revealed--; renderFlow(); });
  document.getElementById('c09SynAll').addEventListener('click', () => { state.revealed = (ROUTES[state.routeId] || { steps: [] }).steps.length; renderFlow(); });

  // 默认选第一条路线
  selectRoute(Object.keys(ROUTES)[0]);
})();
```

- [ ] **Step 2: 构建并人工目检**

Run: `node scripts/build-c07-c09-pages.mjs`
然后在浏览器打开 `dist/C-09-organic-pathways.html`，确认：合成路线面板出现、左侧菜单可切换、"下一步"逐步展开、点分子/箭头出详情、键线式双键平行。

- [ ] **Step 3: 提交**

```bash
git add c07_c09_chemistry_tool.html
git commit -m "feat(c09): 合成路线视图脚本（选路/逐步/详情）"
```

---

## Task 11: AI 集成（bridge 操作 + ai-capability-c09.json）

**Files:** Modify `c07_c09_chemistry_tool.html`（C09 bridge）；Modify `ai-capability-c09.json`

- [ ] **Step 1: 在 C09 的 applyOperations / supportedOperations 加路线操作**

用 Grep 找到 C09 的 `applyOperations`（或等价的 operation 分发 switch）与 `getAiContext`。加：
```js
// applyOperations 内新增 case
case 'loadSynthesisRoute': {
  if (ROUTES[op.routeId]) { window.__c09SynSelectRoute && window.__c09SynSelectRoute(op.routeId); applied.push(type); }
  else warnings.push('未知路线: ' + op.routeId);
  return;
}
case 'revealRouteStep': {
  window.__c09SynReveal && window.__c09SynReveal(op.count); applied.push(type); return;
}
```
为此在 Task 10 的 IIFE 末尾导出两个钩子：
```js
  window.__c09SynSelectRoute = selectRoute;
  window.__c09SynReveal = (n) => { state.revealed = n == null ? (ROUTES[state.routeId] || {steps:[]}).steps.length : n; renderFlow(); };
```
并在 `getAiContext` 返回对象里加：
```js
  synthesis: { currentRouteId: state /* 见下 */ ? undefined : undefined, routes: Object.keys(ROUTES) },
```
> 简化：在 IIFE 里 `window.__c09SynState = state;`，getAiContext 用 `window.__c09SynState` 读取 `{ currentRouteId, revealed }`。

- [ ] **Step 2: 更新 ai-capability-c09.json**

在 `operations` 数组加两条（保持文件既有格式）：
```json
{ "type": "loadSynthesisRoute", "summary": "切换并展示某条合成路线", "payload": { "routeId": "haloalkane-alkene-cycle" }, "useWhen": "用户想看某个有机合成/转化路线", "doNotUseWhen": "用户在问官能团网络或同分异构" },
{ "type": "revealRouteStep", "summary": "展开合成路线到第 N 步", "payload": { "count": 2 }, "useWhen": "逐步讲解合成路线", "doNotUseWhen": "未先 loadSynthesisRoute" }
```
并在约束/planningRules 中补一句：合成路线相关意图只输出上述两种 operation，routeId 取值见 ROUTES。

- [ ] **Step 3: 构建 + 校验 JSON**

Run: `node scripts/build-c07-c09-pages.mjs && node -e "JSON.parse(require('fs').readFileSync('ai-capability-c09.json','utf8')); console.log('json ok')"`
Expected: `json ok` 且构建成功

- [ ] **Step 4: 提交**

```bash
git add c07_c09_chemistry_tool.html ai-capability-c09.json
git commit -m "feat(c09): 合成路线 AI bridge 操作与能力声明"
```

---

## Task 12: 全量验证与收尾

**Files:** 无（验证）

- [ ] **Step 1: 跑全部单测**

Run: `npx vitest run`
Expected: 含 c09-synthesis 在内全部 PASS

- [ ] **Step 2: 构建全部并校验自包含**

Run: `pnpm build:all && npx tsx scripts/validate-output.ts 2>&1 | grep -E "C-0[39]"`
Expected: C-03/C-04/C-07/C-09 均 self-contained

- [ ] **Step 3: 渲染冒烟（人工）**

打开 `dist/C-09-organic-pathways.html`，逐条切换 12 路线，确认每个分子键线式正确（双键平行、取代基位置、苯环内圈、羧基/羰基），逐步展开与详情正常。

- [ ] **Step 4: 提交（如有微调）**

```bash
git add -A && git commit -m "test(c09): 合成路线全量验证通过"
```

---

## Self-Review 记录

- **Spec 覆盖**：分子库(T6)、渲染器(T1-5)、路线库(T7)、新视图(T9-10)、逐步展开(T10)、点击详情(T10)、AI 集成(T11)、构建注入(T8)、测试(T1-7,12)、自包含(T8,12) — 均有对应任务。
- **类型一致**：`renderSkeleton/MOLECULES/ROUTES/getMolecule/validateSynthesisData` 命名跨任务一致；视图钩子 `__c09SynSelectRoute/__c09SynReveal/__c09SynState` 一致。
- **已知简化**（实现时注意）：酯/羧酸用支链文字标注（OC₂H₅/COOH）而非完整展开，属教学可接受简化；苯环取代基默认 dir:'up'，多取代位置为示意而非严格邻间对位。
```
