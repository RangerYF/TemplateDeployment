/**
 * 对比模式双视口场景
 * 左右分栏各渲染一个分子，支持 2D/3D 切换
 */

import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useMoleculeStore } from '@/store/moleculeStore';
import { useUIStore, is2DMode } from '@/store/uiStore';
import { MoleculeGroup } from './MoleculeGroup';
import { Formula2DView } from '@/components/formula/Formula2DView';
import { COLORS } from '@/styles/tokens';

export function CompareScene() {
  const currentModel = useMoleculeStore(s => s.currentModel);
  const compareModel = useMoleculeStore(s => s.compareModel);
  const currentMolecule = useMoleculeStore(s => s.currentMolecule);
  const compareMolecule = useMoleculeStore(s => s.compareMolecule);
  const displayMode = useUIStore(s => s.displayMode);
  const showLabels = useUIStore(s => s.showLabels);
  const showBondLengths = useUIStore(s => s.showBondLengths);
  const showLonePairs = useUIStore(s => s.showLonePairs);

  const in2D = is2DMode(displayMode);

  return (
    <div className="w-full h-full flex">
      {/* 左侧分子 */}
      <div className="flex-1 relative" style={{ borderRight: `1px solid ${COLORS.border}` }}>
        <div
          className="absolute top-3 left-3 z-10 px-3 py-1 text-xs font-medium"
          style={{
            background: COLORS.bg,
            color: COLORS.text,
            borderRadius: '8px',
            border: `1px solid ${COLORS.border}`,
          }}
        >
          {currentMolecule?.name_cn ?? '未选择'}
        </div>
        {in2D && currentModel ? (
          <Formula2DView model={currentModel} moleculeId={currentMolecule?.id} displayMode={displayMode} showBondLengths={showBondLengths} />
        ) : (
          <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
            <ambientLight intensity={0.6} />
            <directionalLight position={[5, 5, 5]} intensity={0.8} />
            <OrbitControls enableDamping dampingFactor={0.1} />
            {currentModel && (
              <MoleculeGroup
                model={currentModel}
                displayMode={displayMode}
                showLabels={showLabels}
                showLonePairs={showLonePairs}
                selectedAtomIndices={[]}
                hoveredAtomIndex={null}
                onAtomClick={() => {}}
                onAtomHover={() => {}}
              />
            )}
          </Canvas>
        )}
      </div>

      {/* 右侧对比分子 */}
      <div className="flex-1 relative">
        <div
          className="absolute top-3 left-3 z-10 px-3 py-1 text-xs font-medium"
          style={{
            background: COLORS.bg,
            color: COLORS.text,
            borderRadius: '8px',
            border: `1px solid ${COLORS.border}`,
          }}
        >
          {compareMolecule?.name_cn ?? '请选择对比分子'}
        </div>
        {in2D && compareModel ? (
          <Formula2DView model={compareModel} moleculeId={compareMolecule?.id} displayMode={displayMode} showBondLengths={showBondLengths} />
        ) : (
          <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
            <ambientLight intensity={0.6} />
            <directionalLight position={[5, 5, 5]} intensity={0.8} />
            <OrbitControls enableDamping dampingFactor={0.1} />
            {compareModel && (
              <MoleculeGroup
                model={compareModel}
                displayMode={displayMode}
                showLabels={showLabels}
                showLonePairs={showLonePairs}
                selectedAtomIndices={[]}
                hoveredAtomIndex={null}
                onAtomClick={() => {}}
                onAtomHover={() => {}}
              />
            )}
          </Canvas>
        )}
      </div>
    </div>
  );
}
