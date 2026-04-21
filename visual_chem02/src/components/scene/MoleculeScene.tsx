/**
 * 分子 3D 场景容器
 * React Three Fiber Canvas + OrbitControls + 灯光
 * 支持 2D/3D 模式切换
 */

import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useMoleculeStore } from '@/store/moleculeStore';
import { useUIStore, is2DMode } from '@/store/uiStore';
import { MoleculeGroup } from './MoleculeGroup';
import { Formula2DView } from '@/components/formula/Formula2DView';
import { COLORS } from '@/styles/tokens';
import { Type } from 'lucide-react';

export function MoleculeScene() {
  const currentModel = useMoleculeStore(s => s.currentModel);
  const selectedAtomIndices = useMoleculeStore(s => s.selectedAtomIndices);
  const hoveredAtomIndex = useMoleculeStore(s => s.hoveredAtomIndex);
  const toggleAtomSelection = useMoleculeStore(s => s.toggleAtomSelection);
  const setHoveredAtom = useMoleculeStore(s => s.setHoveredAtom);
  const clearAtomSelection = useMoleculeStore(s => s.clearAtomSelection);
  const loading = useMoleculeStore(s => s.loading);

  const currentMolecule = useMoleculeStore(s => s.currentMolecule);

  const displayMode = useUIStore(s => s.displayMode);
  const showLabels = useUIStore(s => s.showLabels);
  const toggleLabels = useUIStore(s => s.toggleLabels);
  const showBondLengths = useUIStore(s => s.showBondLengths);
  const showLonePairs = useUIStore(s => s.showLonePairs);
  const autoRotate = useUIStore(s => s.autoRotate);
  const setPopupAtom = useUIStore(s => s.setPopupAtom);
  const setPopupBond = useUIStore(s => s.setPopupBond);

  const in2D = is2DMode(displayMode);

  // 判断当前分子是否仅有 2D 数据
  const isOnly2D = currentMolecule?.has3D === false;

  return (
    <div className="w-full h-full relative" style={{ background: COLORS.bgPage }}>
      {/* 无 3D 构型提示 */}
      {!in2D && isOnly2D && (
        <div
          className="absolute top-3 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-lg text-xs font-medium"
          style={{
            background: 'rgba(231, 76, 60, 0.9)',
            color: '#fff',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}
        >
          该分子仅有 2D 结构数据，3D 模型为平面近似，键长/键角不可用
        </div>
      )}

      {/* Loading 指示 */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div
            className="px-4 py-2 rounded-lg text-sm"
            style={{ background: COLORS.bg, color: COLORS.textSecondary, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
          >
            加载中...
          </div>
        </div>
      )}

      {/* 2D 模式 */}
      {in2D && currentModel && (
        <Formula2DView
          model={currentModel}
          moleculeId={currentMolecule?.id}
          displayMode={displayMode}
          showBondLengths={showBondLengths}
        />
      )}

      {/* 3D 模式 */}
      {!in2D && (
        <Canvas
          camera={{ position: [0, 0, 5], fov: 50 }}
          onPointerMissed={() => { clearAtomSelection(); setPopupAtom(null); setPopupBond(null); }}
        >
          {/* 灯光 */}
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 5, 5]} intensity={0.8} />
          <directionalLight position={[-5, -3, -5]} intensity={0.3} />

          {/* 相机控制 */}
          <OrbitControls
            autoRotate={autoRotate}
            autoRotateSpeed={2}
            enableDamping
            dampingFactor={0.1}
            minDistance={1}
            maxDistance={20}
          />

          {/* 分子渲染 */}
          {currentModel && (
            <MoleculeGroup
              model={currentModel}
              displayMode={displayMode}
              showLabels={showLabels}
              showBondLengths={!isOnly2D && showBondLengths}
              showLonePairs={showLonePairs}
              selectedAtomIndices={isOnly2D ? [] : selectedAtomIndices}
              hoveredAtomIndex={isOnly2D ? null : hoveredAtomIndex}
              onAtomClick={isOnly2D ? undefined : toggleAtomSelection}
              onAtomHover={isOnly2D ? undefined : setHoveredAtom}
            />
          )}

          {/* 无分子时的提示 */}
          {!currentModel && !loading && (
            <mesh>
              <sphereGeometry args={[0.5, 32, 32]} />
              <meshStandardMaterial color={COLORS.bgActive} transparent opacity={0.3} />
            </mesh>
          )}
        </Canvas>
      )}

      {/* 右下角原子名称切换按钮 */}
      {!in2D && (
        <button
          className="absolute bottom-4 right-4 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
          style={{
            background: showLabels ? COLORS.primary : COLORS.bg,
            color: showLabels ? COLORS.white : COLORS.textSecondary,
            border: `1px solid ${showLabels ? COLORS.primary : COLORS.border}`,
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            cursor: 'pointer',
            zIndex: 10,
          }}
          onClick={toggleLabels}
          title={showLabels ? '隐藏原子名称' : '显示原子名称'}
        >
          <Type size={14} />
          原子名称
        </button>
      )}
    </div>
  );
}
