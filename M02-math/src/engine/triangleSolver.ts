/**
 * triangleSolver — M04 Phase 5
 *
 * Solves triangles via five input modes:
 *   SSS — three sides
 *   SAS — two sides + included angle
 *   ASA — two angles + included side
 *   AAS — two angles + non-included side
 *   SSA — two sides + non-included angle (may have 0, 1, or 2 solutions)
 *
 * Angle inputs are in degrees; internal calculations in radians.
 */

import type { Triangle, SolveMode, SolveResult } from '@/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const D2R = Math.PI / 180;

function buildTriangle(
  a: number, b: number, c: number,
  A: number, B: number, C: number,
): Triangle {
  const s = (a + b + c) / 2;
  const area = Math.sqrt(Math.max(0, s * (s - a) * (s - b) * (s - c)));
  return {
    a, b, c, A, B, C,
    area,
    perimeter: a + b + c,
    circumradius: a / (2 * Math.sin(A)),
    inradius:     area / s,
  };
}

// ─── SSS ─────────────────────────────────────────────────────────────────────

function solveSSS(inputs: Record<string, number>): SolveResult {
  const { a, b, c } = inputs;
  if (a <= 0 || b <= 0 || c <= 0)
    return { valid: false, reason: '边长必须为正数' };
  if (a + b <= c || b + c <= a || a + c <= b)
    return { valid: false, reason: '三角不等式不成立（a+b≤c 等）' };

  const A = Math.acos((b * b + c * c - a * a) / (2 * b * c));
  const B = Math.acos((a * a + c * c - b * b) / (2 * a * c));
  const C = Math.PI - A - B;
  return { valid: true, case: 'unique', triangle: buildTriangle(a, b, c, A, B, C) };
}

// ─── SAS ─────────────────────────────────────────────────────────────────────
// Inputs: a, b (sides), C (included angle in degrees)

function solveSAS(inputs: Record<string, number>): SolveResult {
  const { a, b } = inputs;
  const C = inputs['C'] * D2R;
  if (a <= 0 || b <= 0) return { valid: false, reason: '边长必须为正数' };
  if (C <= 0 || C >= Math.PI) return { valid: false, reason: '角 C 必须在 0° 到 180° 之间' };

  const c2 = a * a + b * b - 2 * a * b * Math.cos(C);
  if (c2 <= 0) return { valid: false, reason: '计算结果无效（c² ≤ 0）' };
  const c = Math.sqrt(c2);
  const A = Math.acos(Math.max(-1, Math.min(1, (b * b + c * c - a * a) / (2 * b * c))));
  const B = Math.PI - A - C;
  if (B <= 0) return { valid: false, reason: '计算角 B ≤ 0，输入无效' };
  return { valid: true, case: 'unique', triangle: buildTriangle(a, b, c, A, B, C) };
}

// ─── ASA ─────────────────────────────────────────────────────────────────────
// Inputs: A, B (angles in degrees), c (included side)

function solveASA(inputs: Record<string, number>): SolveResult {
  const A = inputs['A'] * D2R;
  const B = inputs['B'] * D2R;
  const { c } = inputs;
  if (c <= 0) return { valid: false, reason: '边长 c 必须为正数' };
  if (A <= 0 || B <= 0) return { valid: false, reason: '角度必须为正数' };
  if (A + B >= Math.PI) return { valid: false, reason: 'A + B ≥ 180°，无法构成三角形' };

  const C = Math.PI - A - B;
  const a = c * Math.sin(A) / Math.sin(C);
  const b = c * Math.sin(B) / Math.sin(C);
  return { valid: true, case: 'unique', triangle: buildTriangle(a, b, c, A, B, C) };
}

// ─── AAS ─────────────────────────────────────────────────────────────────────
// Inputs: A, B (angles in degrees), a (side opposite A)

function solveAAS(inputs: Record<string, number>): SolveResult {
  const A = inputs['A'] * D2R;
  const B = inputs['B'] * D2R;
  const { a } = inputs;
  if (a <= 0) return { valid: false, reason: '边长 a 必须为正数' };
  if (A <= 0 || B <= 0) return { valid: false, reason: '角度必须为正数' };
  if (A + B >= Math.PI) return { valid: false, reason: 'A + B ≥ 180°，无法构成三角形' };

  const C = Math.PI - A - B;
  const b = a * Math.sin(B) / Math.sin(A);
  const c = a * Math.sin(C) / Math.sin(A);
  return { valid: true, case: 'unique', triangle: buildTriangle(a, b, c, A, B, C) };
}

// ─── SSA ─────────────────────────────────────────────────────────────────────
// Inputs: a, b, A (angle in degrees); a is opposite to A.
//
// Decision tree:
//   h = b·sin(A)
//   a < h              → no solution
//   a ≈ h && A < 90°   → unique (right triangle)
//   h < a < b && A<90° → two solutions
//   a ≥ b || A ≥ 90°   → unique

function solveSSA(inputs: Record<string, number>): SolveResult {
  const { a, b } = inputs;
  const A = inputs['A'] * D2R;

  if (A <= 0 || A >= Math.PI) return { valid: false, reason: '角 A 必须在 0° 到 180° 之间' };
  if (a <= 0 || b <= 0) return { valid: false, reason: '边长必须为正数' };

  const h = b * Math.sin(A);

  if (a < h - 1e-9)
    return { valid: false, reason: `无解（a=${a.toFixed(3)} < h=b·sinA=${h.toFixed(3)}）` };

  // Right-triangle degenerate case
  if (Math.abs(a - h) < 1e-9 && A < Math.PI / 2) {
    const B = Math.PI / 2;
    const C = Math.PI - A - B;
    const c = a * Math.sin(C) / Math.sin(A);
    return { valid: true, case: 'unique', triangle: buildTriangle(a, b, c, A, B, C) };
  }

  const sinB = b * Math.sin(A) / a;
  if (sinB > 1 + 1e-9) return { valid: false, reason: '无解（sinB > 1）' };
  const sinBClamped = Math.min(1, sinB);

  if (a >= b || A >= Math.PI / 2) {
    // Unique solution
    const B = Math.asin(sinBClamped);
    const C = Math.PI - A - B;
    if (C <= 0) return { valid: false, reason: '无解（角 C ≤ 0）' };
    const c = a * Math.sin(C) / Math.sin(A);
    return { valid: true, case: 'unique', triangle: buildTriangle(a, b, c, A, B, C) };
  }

  // Two solutions: h < a < b && A < 90°
  const B1 = Math.asin(sinBClamped);
  const B2 = Math.PI - B1;
  const C1 = Math.PI - A - B1;
  const C2 = Math.PI - A - B2;

  if (C1 <= 0) return { valid: false, reason: '无解（角 C₁ ≤ 0）' };

  const c1 = a * Math.sin(C1) / Math.sin(A);

  if (C2 <= 1e-9) {
    // Second solution degenerate
    return { valid: true, case: 'unique', triangle: buildTriangle(a, b, c1, A, B1, C1) };
  }

  const c2 = a * Math.sin(C2) / Math.sin(A);
  return {
    valid: true,
    case: 'two-solutions',
    triangle1: buildTriangle(a, b, c1, A, B1, C1),
    triangle2: buildTriangle(a, b, c2, A, B2, C2),
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function solveSolveMode(
  mode: SolveMode,
  inputs: Record<string, number>,
): SolveResult {
  switch (mode) {
    case 'SSS': return solveSSS(inputs);
    case 'SAS': return solveSAS(inputs);
    case 'ASA': return solveASA(inputs);
    case 'AAS': return solveAAS(inputs);
    case 'SSA': return solveSSA(inputs);
  }
}
