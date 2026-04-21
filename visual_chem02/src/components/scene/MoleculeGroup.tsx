/**
 * 单分子 3D 渲染组
 * 整合 AtomRenderer + BondRenderer + LonePairRenderer + AnnotationRenderer + ElectronCloudRenderer
 */

import type { MoleculeModel } from '@/engine/types';
import type { DisplayMode } from '@/store/uiStore';
import { useUIStore } from '@/store/uiStore';
import { AtomRenderer } from './AtomRenderer';
import { BondRenderer } from './BondRenderer';
import { LonePairRenderer } from './LonePairRenderer';
import { AnnotationRenderer } from './AnnotationRenderer';
import { ElectronCloudRenderer } from './ElectronCloudRenderer';
import { AtomInfoPopup } from './AtomInfoPopup';
import { BondInfoPopup } from './BondInfoPopup';

interface MoleculeGroupProps {
  model: MoleculeModel;
  displayMode: DisplayMode;
  showLabels: boolean;
  showBondLengths?: boolean;
  showLonePairs: boolean;
  selectedAtomIndices: number[];
  hoveredAtomIndex: number | null;
  onAtomClick?: (index: number) => void;
  onAtomHover?: (index: number | null) => void;
}

export function MoleculeGroup({
  model,
  displayMode,
  showLabels,
  showBondLengths,
  showLonePairs,
  selectedAtomIndices,
  hoveredAtomIndex,
  onAtomClick,
  onAtomHover,
}: MoleculeGroupProps) {
  const popupAtomIndex = useUIStore(s => s.popupAtomIndex);
  const popupBondIndex = useUIStore(s => s.popupBondIndex);
  const setPopupAtom = useUIStore(s => s.setPopupAtom);
  const setPopupBond = useUIStore(s => s.setPopupBond);

  return (
    <group>
      {/* 化学键（先渲染，在原子下方） */}
      {model.bonds.map((bond, i) => (
        <BondRenderer
          key={`bond-${i}`}
          bond={bond}
          atoms={model.atoms}
          displayMode={displayMode}
          showBondLength={showBondLengths}
          onDoubleClick={() => setPopupBond(i)}
        />
      ))}

      {/* 原子球体 */}
      {model.atoms.map((atom) => (
        <AtomRenderer
          key={`atom-${atom.index}`}
          atom={atom}
          displayMode={displayMode}
          showLabel={showLabels}
          isSelected={selectedAtomIndices.includes(atom.index)}
          isHovered={hoveredAtomIndex === atom.index}
          onPointerOver={() => onAtomHover?.(atom.index)}
          onPointerOut={() => onAtomHover?.(null)}
          onClick={() => onAtomClick?.(atom.index)}
          onDoubleClick={() => setPopupAtom(atom.index)}
        />
      ))}

      {/* 电子云层（electron-cloud 模式） */}
      {displayMode === 'electron-cloud' && (
        <ElectronCloudRenderer model={model} />
      )}

      {/* 孤电子对 */}
      {showLonePairs && model.lonePairs.map((lp, i) => (
        <LonePairRenderer
          key={`lp-${i}`}
          lonePair={lp}
          atoms={model.atoms}
        />
      ))}

      {/* 标注 */}
      <AnnotationRenderer
        selectedAtomIndices={selectedAtomIndices}
        atoms={model.atoms}
        bonds={model.bonds}
      />

      {/* 双击弹窗 */}
      {popupAtomIndex !== null && model.atoms[popupAtomIndex] && (
        <AtomInfoPopup
          atom={model.atoms[popupAtomIndex]}
          model={model}
          onClose={() => setPopupAtom(null)}
        />
      )}
      {popupBondIndex !== null && model.bonds[popupBondIndex] && (
        <BondInfoPopup
          bond={model.bonds[popupBondIndex]}
          atoms={model.atoms}
          onClose={() => setPopupBond(null)}
        />
      )}
    </group>
  );
}
