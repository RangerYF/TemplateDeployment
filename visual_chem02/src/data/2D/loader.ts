/**
 * 预计算 2D 化学式数据加载器
 * 使用 Vite 的 import.meta.glob 批量加载 JSON
 */

import type { Projected2D } from '@/engine/projection2d';

// Vite eager glob import — 编译时内联所有 JSON
const structuralModules = import.meta.glob<Projected2D>(
  './结构简式/*.json',
  { eager: true, import: 'default' },
);

const electronModules = import.meta.glob<Projected2D>(
  './电子式/*.json',
  { eager: true, import: 'default' },
);

// 构建 Map<moleculeId, Projected2D>
function buildMap(modules: Record<string, Projected2D>): Map<string, Projected2D> {
  const map = new Map<string, Projected2D>();
  for (const [path, data] of Object.entries(modules)) {
    // path 形如 "./结构简式/MOL-001.json"
    const match = path.match(/(MOL-\d+)\.json$/);
    if (match) {
      map.set(match[1], data);
    }
  }
  return map;
}

export const STRUCTURAL_2D = buildMap(structuralModules);
export const ELECTRON_2D = buildMap(electronModules);

/**
 * 获取预计算的 2D 数据
 * @param moleculeId 分子ID，如 "MOL-001"
 * @param mode 'structural' | 'electron-formula'
 * @returns Projected2D 或 null
 */
export function getPrecomputed2D(
  moleculeId: string,
  mode: string,
): Projected2D | null {
  if (mode === 'electron-formula') {
    return ELECTRON_2D.get(moleculeId) ?? null;
  }
  // structural 和 skeletal 都用结构简式数据
  return STRUCTURAL_2D.get(moleculeId) ?? null;
}
