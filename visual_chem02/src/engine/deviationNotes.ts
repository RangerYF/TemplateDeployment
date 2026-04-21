/**
 * 键角偏差计算引擎
 * 对比实际键角与 VSEPR 理想键角，生成偏差注释
 */

import type { MoleculeMetadata } from '@/data/moleculeMetadata';
import { VSEPR_TEMPLATES } from '@/data/vsepr';

export interface DeviationNote {
  angleName: string;      // 如 "H-O-H"
  actualAngle: number;    // 实测值
  idealAngle: number;     // VSEPR 理想值
  deviation: number;      // 差值(实际-理想)
  explanation: string;    // 偏差原因说明
}

/** 从元数据计算键角偏差注释 */
export function computeDeviationNotes(meta: MoleculeMetadata): DeviationNote[] {
  if (!meta.bond_angles) return [];

  // 查找 VSEPR 模板获取理想键角
  let idealAngle: number | null = null;
  if (meta.bond_pairs !== undefined && meta.lone_pairs !== undefined) {
    const template = findTemplateByPairs(meta.bond_pairs, meta.lone_pairs);
    if (template) {
      idealAngle = template.idealAngle;
    }
  }

  if (idealAngle === null) return [];

  const notes: DeviationNote[] = [];

  for (const [angleName, actualAngle] of Object.entries(meta.bond_angles)) {
    const deviation = actualAngle - idealAngle;
    if (Math.abs(deviation) <= 1) continue; // 忽略 ≤1° 的偏差

    const explanation = generateExplanation(deviation, meta.lone_pairs ?? 0);
    notes.push({ angleName, actualAngle, idealAngle, deviation, explanation });
  }

  return notes;
}

function findTemplateByPairs(bondPairs: number, lonePairs: number) {
  return Object.values(VSEPR_TEMPLATES).find(
    t => t.bondPairs === bondPairs && t.lonePairs === lonePairs,
  );
}

function generateExplanation(deviation: number, lonePairs: number): string {
  if (deviation < 0 && lonePairs > 0) {
    return lonePairs === 1
      ? '孤电子对排斥力大于成键电子对，压缩键角'
      : `${lonePairs}对孤电子对的排斥使键角显著减小`;
  }
  if (deviation < 0) {
    return '配体电负性差异或空间位阻导致键角减小';
  }
  if (deviation > 0 && lonePairs > 0) {
    return '不等价配体间排斥力差异导致键角偏大';
  }
  return '原子间电子密度分布不均导致键角偏离';
}
