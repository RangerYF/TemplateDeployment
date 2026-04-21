/**
 * 2D 化学式容器 — 替代 Canvas 的 SVG 渲染
 * 根据 displayMode 选择 StructuralFormula / ElectronFormula / SkeletalFormula
 *
 * 内置分子使用拓扑布局（layout2d），导入分子回退PCA投影
 */

import { useMemo } from 'react';
import type { MoleculeModel } from '@/engine/types';
import type { DisplayMode } from '@/store/uiStore';
import { generateLayout2D } from '@/engine/layout2d';
import { buildProjected2DFromPositions, project3Dto2D, layoutForSVG } from '@/engine/projection2d';
import { getPrecomputed2D } from '@/data/2D/loader';
import { StructuralFormula } from './StructuralFormula';
import { ElectronFormula } from './ElectronFormula';
import { SkeletalFormula } from './SkeletalFormula';
import { COLORS } from '@/styles/tokens';
import { MOLECULE_MAP } from '@/data/moleculeMetadata';

const SVG_WIDTH = 600;
const SVG_HEIGHT = 500;

interface Props {
  model: MoleculeModel;
  moleculeId?: string;
  displayMode: DisplayMode;
  showBondLengths?: boolean;
}

export function Formula2DView({ model, moleculeId, displayMode, showBondLengths }: Props) {
  // 碳原子 < 4 时键线式自动回退到结构简式
  const carbonCount = model.atoms.filter(a => a.element === 'C').length;
  const effectiveMode = (displayMode === 'skeletal' && carbonCount < 4) ? 'structural' : displayMode;

  // 电子式: 不合并H; 键线式: 合并所有H; 结构简式: 合并所有H（CH→C, OH→O等）
  const mergeMode = effectiveMode === 'electron-formula' ? 'none'
    : 'all' as const;
  const isElectronFormula = effectiveMode === 'electron-formula';

  // 获取Lewis形式电荷（如SO₂、O₃等使用北京教材Lewis结构式）
  const meta = moleculeId ? MOLECULE_MAP.get(moleculeId) : null;
  const lewisFormalCharges = isElectronFormula ? (meta?.lewisFormalCharges ?? undefined) : undefined;

  const data = useMemo(() => {
    let projected;

    // 优先使用预计算的 2D 数据（从 data/2D/ JSON 文件加载）
    if (moleculeId) {
      const precomputed = getPrecomputed2D(moleculeId, effectiveMode);
      if (precomputed) {
        projected = precomputed;
      }
    }

    // 回退：实时计算拓扑布局（内置分子无预计算数据时）
    if (!projected && moleculeId) {
      const positions = generateLayout2D(moleculeId, model, isElectronFormula);
      if (positions) {
        projected = buildProjected2DFromPositions(
          positions,
          model,
          mergeMode,
          false, // structuralSimplified
          lewisFormalCharges,
        );
      }
    }

    // 回退到PCA投影（导入分子或布局失败）
    if (!projected) {
      projected = project3Dto2D(model);
    }

    return layoutForSVG(projected, SVG_WIDTH, SVG_HEIGHT);
  }, [model, moleculeId, effectiveMode, mergeMode, isElectronFormula, lewisFormalCharges]);

  return (
    <div className="w-full h-full flex items-center justify-center" style={{ background: COLORS.bgPage }}>
      <svg
        viewBox={`${-SVG_WIDTH / 2} ${-SVG_HEIGHT / 2} ${SVG_WIDTH} ${SVG_HEIGHT}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        style={{ maxWidth: SVG_WIDTH, maxHeight: SVG_HEIGHT }}
      >
        {effectiveMode === 'structural' && <StructuralFormula data={data} showBondLengths={showBondLengths} />}
        {effectiveMode === 'electron-formula' && <ElectronFormula data={data} />}
        {effectiveMode === 'skeletal' && <SkeletalFormula data={data} showBondLengths={showBondLengths} />}
      </svg>
    </div>
  );
}
