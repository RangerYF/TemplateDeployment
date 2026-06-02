// ── 渲染常量 ──
const L = 30, DX = L * Math.cos(Math.PI / 6), DY = L * Math.sin(Math.PI / 6);
const STROKE = '#1A202C', SW = 2.4, HAL = '#B91C1C', K = 5, INSET = 4, R = 30;
const PAD = 14;

const r = (n) => Math.round(n * 100) / 100;
const isHalogen = (label) => /^(Br|Cl|F|I)/.test(label || '');
const ln = (x1, y1, x2, y2, color = STROKE) =>
  `<line x1="${r(x1)}" y1="${r(y1)}" x2="${r(x2)}" y2="${r(y2)}" stroke="${color}" stroke-width="${SW}" stroke-linecap="round"/>`;
const txt = (x, y, s, color = STROKE, size = 13) =>
  `<text x="${r(x)}" y="${r(y)}" font-size="${size}" font-weight="700" fill="${color}" text-anchor="middle" font-family="Arial, sans-serif">${s}</text>`;

// 链顶点坐标：i=0..atoms-1，偶数低、奇数高（锯齿）
function chainVertices(atoms) {
  const v = [];
  for (let i = 0; i < atoms; i++) v.push({ x: i * DX, y: i % 2 === 1 ? 0 : DY });
  return v;
}

// 环顶点坐标：平顶正多边形
function ringVertices(size) {
  const v = [];
  for (let i = 0; i < size; i++) {
    const ang = (Math.PI / 180) * (i * (360 / size));
    v.push({ x: R * Math.cos(ang), y: -R * Math.sin(ang) });
  }
  return v;
}

// 主键方向 A→B 的平行第二条线（朝 side 内侧偏移，两端内缩）
function parallelLine(a, b, side) {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len;
  const nx = -uy * side, ny = ux * side;
  const ax = a.x + ux * INSET + nx * K, ay = a.y + uy * INSET + ny * K;
  const bx = b.x - ux * INSET + nx * K, by = b.y - uy * INSET + ny * K;
  return ln(ax, ay, bx, by);
}

function bondOrderMap(bonds) {
  const m = new Map();
  for (const bd of bonds || []) m.set(`${Math.min(bd.a, bd.b)}-${Math.max(bd.a, bd.b)}`, bd.order);
  return m;
}

// 取代基：从顶点沿 dir 引短键 + 标注；返回片段与额外坐标（包围盒）
function renderSubs(subs, verts) {
  const parts = [], extra = [];
  for (const s of subs || []) {
    const p = verts[s.at - 1];
    if (!p) continue;
    const dy = s.dir === 'down' ? L * 0.8 : -L * 0.8;
    const tipX = p.x, tipY = p.y + dy;
    const color = isHalogen(s.label) ? HAL : STROKE;
    if (s.dbl === 'O') {
      parts.push(ln(p.x, p.y, tipX, tipY));
      parts.push(ln(p.x + 4, p.y + (dy > 0 ? 2 : -2), tipX + 4, tipY + (dy > 0 ? 2 : -2)));
      const oy = dy > 0 ? tipY + 12 : tipY - 4;
      parts.push(txt(tipX + 4, oy, 'O', STROKE));
      extra.push({ x: tipX + 10, y: oy });
    }
    if (s.label) {
      parts.push(ln(p.x, p.y, tipX, tipY, color));
      const ty = dy > 0 ? tipY + 12 : tipY - 4;
      parts.push(txt(tipX, ty, s.label, color));
      extra.push({ x: tipX, y: ty }, { x: tipX - 14, y: ty }, { x: tipX + 14, y: ty });
    }
  }
  return { parts, extra };
}

function renderTinyText(spec) {
  const label = spec._fallback || 'C';
  return `<svg viewBox="0 0 90 40" xmlns="http://www.w3.org/2000/svg">${txt(45, 25, label, STROKE, 16)}</svg>`;
}

export function renderSkeleton(spec) {
  if (spec.type === 'chain') {
    if (spec.atoms < 2) return renderTinyText(spec);
    const v = chainVertices(spec.atoms);
    const orders = bondOrderMap(spec.bonds);
    const parts = [];
    for (let i = 0; i < v.length - 1; i++) {
      const a = v[i], b = v[i + 1];
      parts.push(ln(a.x, a.y, b.x, b.y));
      const ord = orders.get(`${i + 1}-${i + 2}`) || 1;
      if (ord >= 2) parts.push(parallelLine(a, b, -1));
      if (ord === 3) parts.push(parallelLine(a, b, 1));
    }
    const sub = renderSubs(spec.subs, v);
    return svgWrap([...parts, ...sub.parts], v, sub.extra);
  }
  if (spec.type === 'ring') {
    const v = ringVertices(spec.size);
    const orders = bondOrderMap(spec.bonds);
    const parts = [];
    for (let i = 0; i < v.length; i++) {
      const a = v[i], b = v[(i + 1) % v.length];
      parts.push(ln(a.x, a.y, b.x, b.y));
      const lo = Math.min(i + 1, ((i + 1) % v.length) + 1), hi = Math.max(i + 1, ((i + 1) % v.length) + 1);
      if ((orders.get(`${lo}-${hi}`) || 1) >= 2) parts.push(parallelLine(a, b, 1));
    }
    if (spec.aromatic) parts.push(`<circle cx="0" cy="0" r="${r(R * 0.55)}" fill="none" stroke="${STROKE}" stroke-width="${SW}"/>`);
    const sub = renderSubs(spec.subs, v);
    return svgWrap([...parts, ...sub.parts], v, sub.extra);
  }
  return '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
}

function svgWrap(parts, verts, extra = []) {
  const xs = verts.map((p) => p.x).concat(extra.map((p) => p.x));
  const ys = verts.map((p) => p.y).concat(extra.map((p) => p.y));
  const minX = Math.min(...xs) - PAD, minY = Math.min(...ys) - PAD;
  const w = Math.max(...xs) - Math.min(...xs) + PAD * 2;
  const h = Math.max(...ys) - Math.min(...ys) + PAD * 2;
  return `<svg viewBox="${r(minX)} ${r(minY)} ${r(w)} ${r(h)}" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>`;
}

// ── 分子库（结构式/类别按人教版核对）──
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

// ── 路线库 ──
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
    if (!route.steps || !route.steps.length) { errors.push(`${rid}: 无步骤`); continue; }
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
