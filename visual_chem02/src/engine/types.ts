/**
 * 3D 分子模型类型定义
 */

import type { BondType } from '@/data/bondTypes';

export type Vec3 = [number, number, number];

export interface Atom3D {
  index: number;
  element: string;
  position: Vec3;
  label?: string;
  radius: number;        // 球棍模型球体半径
  spaceFillRadius: number; // 空间填充半径
  color: string;          // CPK 颜色
  formalCharge?: number;  // 形式电荷（Lewis结构用）
}

export interface Bond3D {
  from: number;
  to: number;
  order: number;
  type: BondType;
  length: number;         // pm
  fromPos: Vec3;
  toPos: Vec3;
}

export interface LonePair3D {
  position: Vec3;
  direction: Vec3;        // 从中心原子指向孤电子对的方向
  centerAtomIndex: number;
}

export interface MoleculeModel {
  atoms: Atom3D[];
  bonds: Bond3D[];
  lonePairs: LonePair3D[];
  center: Vec3;
  radius: number;          // 包围球半径（用于相机定位）
}

/** 向量工具 */
export function vec3Add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function vec3Sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function vec3Scale(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s];
}

export function vec3Length(v: Vec3): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

export function vec3Normalize(v: Vec3): Vec3 {
  const len = vec3Length(v);
  if (len < 1e-10) return [0, 0, 1];
  return [v[0] / len, v[1] / len, v[2] / len];
}

export function vec3Cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function vec3Dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

// ============ SDF 解析相关类型 ============

export interface SdfAtom {
  x: number;      // Angstrom
  y: number;
  z: number;
  element: string;
}

export interface SdfBond {
  from: number;   // 0-based
  to: number;
  order: number;  // 1=single, 2=double, 3=triple, 4=delocalized
}

export interface SdfParseResult {
  name: string;
  atoms: SdfAtom[];
  bonds: SdfBond[];
}
