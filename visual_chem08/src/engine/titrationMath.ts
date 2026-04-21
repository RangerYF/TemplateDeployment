/**
 * pH 计算引擎 — 纯函数，无副作用
 *
 * 支持 4 种滴定类型 + 缓冲液计算
 */

import type { TitrationType } from '@/data/titrationPresets';

const Kw = 1e-14; // 25°C 水的离子积

// ============================================
// 核心 pH 计算（单点）
// ============================================

/** 强酸滴强碱: HCl(Ca, Va added) → NaOH(Cb, Vb initial) */
function pH_strongAcid_strongBase(Ca: number, Va: number, Cb: number, Vb: number): number {
  const totalV = Va + Vb;
  const nAcid = Ca * Va;
  const nBase = Cb * Vb;
  if (Math.abs(nAcid - nBase) < 1e-12) return 7.0;
  if (nAcid < nBase) {
    const cOH = Math.max(1e-14, (nBase - nAcid) / totalV);
    return 14 + Math.log10(cOH);
  }
  const cH = Math.max(1e-14, (nAcid - nBase) / totalV);
  return -Math.log10(cH);
}

/** 强碱滴强酸: NaOH(Cb, Vb added) → HCl(Ca, Va initial) */
function pH_strongBase_strongAcid(Cb: number, Vb: number, Ca: number, Va: number): number {
  const totalV = Va + Vb;
  const nBase = Cb * Vb;
  const nAcid = Ca * Va;
  if (Math.abs(nBase - nAcid) < 1e-12) return 7.0;
  if (nBase < nAcid) {
    const cH = Math.max(1e-14, (nAcid - nBase) / totalV);
    return -Math.log10(cH);
  }
  const cOH = Math.max(1e-14, (nBase - nAcid) / totalV);
  return 14 + Math.log10(cOH);
}

/** 强碱滴弱酸: NaOH(Cb, Vb added) → weak acid(Ca, Va initial, Ka) */
function pH_strongBase_weakAcid(Cb: number, Vb: number, Ca: number, Va: number, Ka: number): number {
  const totalV = Va + Vb;
  const nBase = Cb * Vb;
  const nAcid = Ca * Va;

  if (Vb < 1e-10) {
    // Pure weak acid: solve h² + Ka·h - Ka·Ca = 0
    const h = (-Ka + Math.sqrt(Ka * Ka + 4 * Ka * Ca)) / 2;
    return -Math.log10(Math.max(1e-14, h));
  }

  if (nBase < nAcid - 1e-12) {
    // Buffer region: Henderson-Hasselbalch
    const nSalt = nBase;
    const nRemaining = nAcid - nBase;
    const pKa = -Math.log10(Ka);
    return pKa + Math.log10(Math.max(1e-14, nSalt) / Math.max(1e-14, nRemaining));
  }

  if (Math.abs(nBase - nAcid) < 1e-12) {
    // Equivalence point: conjugate base hydrolysis
    const cSalt = nAcid / totalV;
    const Kb = Kw / Ka;
    const cOH = Math.sqrt(Kb * Math.max(1e-14, cSalt));
    return 14 + Math.log10(Math.max(1e-14, cOH));
  }

  // After equivalence: excess NaOH
  const cOH = Math.max(1e-14, (nBase - nAcid) / totalV);
  return 14 + Math.log10(cOH);
}

/** 强酸滴弱碱: HCl(Ca, Va added) → weak base(Cb, Vb initial, Kb) */
function pH_strongAcid_weakBase(Ca: number, Va: number, Cb: number, Vb: number, Kb: number): number {
  const totalV = Va + Vb;
  const nAcid = Ca * Va;
  const nBase = Cb * Vb;
  const Ka_conj = Kw / Kb; // Ka of conjugate acid (e.g., NH4+)
  const pKa_conj = -Math.log10(Ka_conj);

  if (Va < 1e-10) {
    // Pure weak base: [OH-] = sqrt(Kb * Cb)
    const cOH = Math.sqrt(Kb * Cb);
    return 14 + Math.log10(Math.max(1e-14, cOH));
  }

  if (nAcid < nBase - 1e-12) {
    // Buffer region (B/BH+ pair)
    const nRemaining = nBase - nAcid;
    const nSalt = nAcid;
    return pKa_conj + Math.log10(Math.max(1e-14, nRemaining) / Math.max(1e-14, nSalt));
  }

  if (Math.abs(nAcid - nBase) < 1e-12) {
    // Equivalence point: conjugate acid hydrolysis
    const cSalt = nBase / totalV;
    const cH = Math.sqrt(Ka_conj * Math.max(1e-14, cSalt));
    return -Math.log10(Math.max(1e-14, cH));
  }

  // After equivalence: excess HCl
  const cH = Math.max(1e-14, (nAcid - nBase) / totalV);
  return -Math.log10(cH);
}

// ============================================
// 统一调度
// ============================================

/** 根据滴定类型计算单点 pH */
export function calcPH(
  type: TitrationType,
  titrantConc: number,
  addedVol: number,
  analyteConc: number,
  analyteVol: number,
  pKa?: number,
): number {
  // Convert mL to L
  const Va_L = addedVol / 1000;
  const Vb_L = analyteVol / 1000;

  switch (type) {
    case 'strongAcid_strongBase':
      return pH_strongAcid_strongBase(titrantConc, Va_L, analyteConc, Vb_L);
    case 'strongBase_strongAcid':
      return pH_strongBase_strongAcid(titrantConc, Va_L, analyteConc, Vb_L);
    case 'strongBase_weakAcid': {
      const Ka = Math.pow(10, -(pKa ?? 4.75));
      return pH_strongBase_weakAcid(titrantConc, Va_L, analyteConc, Vb_L, Ka);
    }
    case 'strongAcid_weakBase': {
      const Kb = Math.pow(10, -(14 - (pKa ?? 9.25)));
      return pH_strongAcid_weakBase(titrantConc, Va_L, analyteConc, Vb_L, Kb);
    }
  }
}

// ============================================
// 曲线生成
// ============================================

export interface CurvePoint {
  volume: number; // mL
  pH: number;
}

export interface TitrationCurveResult {
  points: CurvePoint[];
  startPH: number;
  eqVolume: number;         // mL
  eqPH: number;
  halfEqVolume?: number;    // mL (only for weak acid/base)
  halfEqPH?: number;
  jumpRange: [number, number]; // [pHLow, pHHigh]
  maxVolume: number;        // mL
}

export function generateTitrationCurve(
  type: TitrationType,
  titrantConc: number,
  analyteConc: number,
  analyteVol: number,
  pKa?: number,
): TitrationCurveResult {
  const eqVol = analyteConc * analyteVol / titrantConc;
  const maxVol = Math.max(eqVol * 2, 5);
  const points: CurvePoint[] = [];

  // Adaptive sampling: dense near equivalence point
  const addPoint = (v: number) => {
    const pH = clampPH(calcPH(type, titrantConc, v, analyteConc, analyteVol, pKa));
    points.push({ volume: v, pH });
  };

  // Before jump zone (coarse)
  for (let v = 0; v <= Math.max(0, eqVol - 1); v += 0.5) {
    addPoint(v);
  }

  // Jump zone: dense sampling ±1 mL around equivalence
  const jumpStart = Math.max(0, eqVol - 1);
  const jumpEnd = Math.min(maxVol, eqVol + 1);
  for (let v = jumpStart; v <= jumpEnd; v += 0.02) {
    addPoint(v);
  }

  // After jump zone (coarse)
  for (let v = Math.ceil(eqVol + 1); v <= maxVol; v += 0.5) {
    addPoint(v);
  }

  // Ensure endpoint
  if (points[points.length - 1].volume < maxVol) {
    addPoint(maxVol);
  }

  const startPH = clampPH(calcPH(type, titrantConc, 0, analyteConc, analyteVol, pKa));
  const eqPH = clampPH(calcPH(type, titrantConc, eqVol, analyteConc, analyteVol, pKa));

  // Half-equivalence (only for weak acid/base)
  let halfEqVolume: number | undefined;
  let halfEqPH: number | undefined;
  if (type === 'strongBase_weakAcid' || type === 'strongAcid_weakBase') {
    halfEqVolume = eqVol / 2;
    halfEqPH = clampPH(calcPH(type, titrantConc, halfEqVolume, analyteConc, analyteVol, pKa));
  }

  // Jump range: pH at ±0.05 mL from equivalence (≈ 1 drop)
  const pHBefore = clampPH(calcPH(type, titrantConc, Math.max(0, eqVol - 0.05), analyteConc, analyteVol, pKa));
  const pHAfter = clampPH(calcPH(type, titrantConc, eqVol + 0.05, analyteConc, analyteVol, pKa));
  const jumpRange: [number, number] = [Math.min(pHBefore, pHAfter), Math.max(pHBefore, pHAfter)];

  return {
    points,
    startPH,
    eqVolume: eqVol,
    eqPH,
    halfEqVolume,
    halfEqPH,
    jumpRange,
    maxVolume: maxVol,
  };
}

// ============================================
// 缓冲液计算
// ============================================

export interface BufferResult {
  bufferInitialPH: number;
  bufferFinalPH: number;
  bufferPHChange: number;
  waterInitialPH: number;
  waterFinalPH: number;
  waterPHChange: number;
}

/**
 * 计算缓冲液 vs 纯水的 pH 变化对比
 * @param pKa 缓冲体系 pKa
 * @param bufferConc 缓冲溶液中酸和碱的浓度 (mol/L)，默认等浓度
 * @param bufferVol 缓冲溶液体积 (mL)
 * @param addedMoles 加入的酸或碱的摩尔数
 * @param isAcid 加入的是酸(true)还是碱(false)
 */
export function calcBufferComparison(
  pKa: number,
  bufferConc: number,
  bufferVol: number,
  addedMoles: number,
  isAcid: boolean,
): BufferResult {
  const volL = bufferVol / 1000;
  const n0 = bufferConc * volL; // moles of acid = moles of conjugate base (1:1 buffer)

  // Buffer initial pH = pKa (for 1:1 ratio)
  const bufferInitialPH = pKa;

  // Buffer after adding acid/base (Henderson-Hasselbalch)
  let bufferFinalPH: number;
  if (addedMoles >= n0) {
    // Buffer capacity exceeded
    bufferFinalPH = isAcid ? 1.0 : 13.0;
  } else {
    const nAcid = isAcid ? n0 + addedMoles : n0 - addedMoles;
    const nBase = isAcid ? n0 - addedMoles : n0 + addedMoles;
    bufferFinalPH = pKa + Math.log10(Math.max(1e-14, nBase) / Math.max(1e-14, nAcid));
  }

  // Pure water
  const waterInitialPH = 7.0;
  let waterFinalPH: number;
  if (addedMoles <= 0) {
    waterFinalPH = waterInitialPH;
  } else if (isAcid) {
    const cH = addedMoles / volL;
    waterFinalPH = -Math.log10(cH);
  } else {
    const cOH = addedMoles / volL;
    waterFinalPH = 14 + Math.log10(cOH);
  }

  return {
    bufferInitialPH,
    bufferFinalPH: clampPH(bufferFinalPH),
    bufferPHChange: Math.abs(bufferFinalPH - bufferInitialPH),
    waterInitialPH,
    waterFinalPH: clampPH(waterFinalPH),
    waterPHChange: Math.abs(waterFinalPH - waterInitialPH),
  };
}

// ============================================
// 误差方向判断
// ============================================

export type ErrorDirection = 'high' | 'low' | 'good';

/**
 * 判断指示剂产生的滴定误差方向
 * @param indicatorMidPH 指示剂变色范围的中点 pH
 * @param eqPH 等当点 pH
 * @param titrantIsAcid 滴定剂是否为酸
 */
export function getErrorDirection(
  indicatorMidPH: number,
  eqPH: number,
  titrantIsAcid: boolean,
): ErrorDirection {
  const diff = indicatorMidPH - eqPH;
  if (Math.abs(diff) < 0.5) return 'good';

  if (titrantIsAcid) {
    // 滴定剂是酸：指示剂变色点 pH 高于等当点 → 多加了酸 → 结果偏小
    //               指示剂变色点 pH 低于等当点 → 少加了酸 → 结果偏大
    return diff > 0 ? 'low' : 'high';
  } else {
    // 滴定剂是碱：指示剂变色点 pH 高于等当点 → 少加了碱 → 结果偏小
    //               指示剂变色点 pH 低于等当点 → 多加了碱 → 结果偏大
    return diff > 0 ? 'low' : 'high';
  }
}

export function errorDirectionLabel(dir: ErrorDirection): string {
  switch (dir) {
    case 'high': return '偏大';
    case 'low': return '偏小';
    case 'good': return '适合';
  }
}

// ============================================
// 工具函数
// ============================================

function clampPH(pH: number): number {
  return Math.max(0, Math.min(14, pH));
}
