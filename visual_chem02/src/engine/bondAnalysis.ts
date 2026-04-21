/**
 * 键长/键角/键能分析工具
 * 从 MoleculeModel + MoleculeMetadata 提取分析数据
 */

import type { MoleculeModel } from './types';
import type { MoleculeMetadata } from '@/data/moleculeMetadata';
import { BOND_LENGTH_REFERENCE } from '@/data/bondTypes';

export interface BondLengthEntry {
  label: string;       // 如 "C-H"
  length: number;      // 实测键长 pm
  refLength?: number;  // 标准键长 pm
  energy?: number;     // 键能 kJ/mol
}

export interface BondAngleEntry {
  label: string;
  angle: number;
}

export interface BondAnalysis {
  bondLengths: BondLengthEntry[];
  bondAngles: BondAngleEntry[];
}

/** 从模型和元数据提取键分析数据 */
export function analyzeBonds(model: MoleculeModel, meta?: MoleculeMetadata): BondAnalysis {
  // 唯一键长
  const seen = new Set<string>();
  const bondLengths: BondLengthEntry[] = [];

  for (const bond of model.bonds) {
    const a = model.atoms[bond.from]?.element ?? '?';
    const b = model.atoms[bond.to]?.element ?? '?';
    const roundedLength = Math.round(bond.length);
    const key = `${a}-${b}:${roundedLength}`;
    const keyReverse = `${b}-${a}:${roundedLength}`;
    if (seen.has(key) || seen.has(keyReverse)) continue;
    seen.add(key);

    const orderStr = bond.type === 'double' ? '=' : bond.type === 'triple' ? '≡' : '-';
    const label = `${a}${orderStr}${b}`;

    // 查标准值
    const refKey = `${a}${orderStr}${b}`;
    const refKeyRev = `${b}${orderStr}${a}`;
    const ref = BOND_LENGTH_REFERENCE[refKey] ?? BOND_LENGTH_REFERENCE[refKeyRev];

    bondLengths.push({
      label,
      length: roundedLength,
      refLength: ref?.length,
      energy: ref?.energy,
    });
  }

  // 键角
  const bondAngles: BondAngleEntry[] = [];
  if (meta?.bond_angles) {
    for (const [label, angle] of Object.entries(meta.bond_angles)) {
      bondAngles.push({ label, angle });
    }
  }

  return { bondLengths, bondAngles };
}

/** 格式化键长列表为简短字符串 */
export function formatBondLengths(entries: BondLengthEntry[]): string {
  return entries.map(e => `${e.label}: ${e.length}`).join(', ');
}

/** 格式化键角列表为简短字符串 */
export function formatBondAngles(entries: BondAngleEntry[]): string {
  return entries.map(e => `${e.label}: ${e.angle}`).join(', ');
}

/** 格式化键能列表为简短字符串 */
export function formatBondEnergies(entries: BondLengthEntry[]): string {
  return entries.filter(e => e.energy).map(e => `${e.label}: ${e.energy}`).join(', ');
}
