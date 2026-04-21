/**
 * CrystalScene3D - Main 3D scene container for the crystal viewer.
 *
 * Renders the R3F Canvas with orbit controls, lighting, and all
 * crystal sub-renderers (atoms, bonds, unit cell, labels, coordination,
 * packing).
 */

import { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useCrystalStore } from '@/store';
import { getCrystalById } from '@/data/crystalRepository';
import { expandCrystal } from '@/engine/crystalExpander';
import { findCoordinationShell } from '@/engine/coordinationEngine';
import { AtomRenderer } from '@/components/scene/renderers/AtomRenderer';
import { BondRenderer } from '@/components/scene/renderers/BondRenderer';
import { UnitCellRenderer } from '@/components/scene/renderers/UnitCellRenderer';
import { LabelRenderer } from '@/components/scene/renderers/LabelRenderer';
import { CoordinationHighlight } from '@/components/scene/renderers/CoordinationHighlight';
import { PackingRenderer } from '@/components/scene/renderers/PackingRenderer';
import { PolyhedronRenderer } from '@/components/scene/renderers/PolyhedronRenderer';
import { COLORS } from '@/styles/tokens';

type ViewPreset = '重置' | '前' | '顶' | '侧';

const VIEW_POSITIONS: Record<ViewPreset, [number, number, number]> = {
  '重置': [8, 8, 8],
  '前': [0, 0, 14],
  '顶': [0, 14, 0],
  '侧': [14, 0, 0],
};

let pendingViewTarget: ViewPreset | null = null;
let viewForceUpdate: (() => void) | null = null;

function CameraController() {
  const { camera, invalidate } = useThree();
  const [, setTick] = useState(0);

  viewForceUpdate = useCallback(() => {
    setTick((tick) => tick + 1);
  }, []);

  if (pendingViewTarget) {
    const position = VIEW_POSITIONS[pendingViewTarget];
    camera.position.set(position[0], position[1], position[2]);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    invalidate();
    pendingViewTarget = null;
  }

  return null;
}

function SceneContent() {
  const controlsRef = useRef(null);

  const {
    selectedCrystalId,
    activeTab,
    structureSourceMode,
    renderMode,
    expansionRange,
    showUnitCell,
    showBonds,
    showLabels,
    showAxes,
    highlightedAtomIdx,
    highlightedNeighbors,
  } = useCrystalStore();

  const crystal = getCrystalById(selectedCrystalId, structureSourceMode);

  const crystalScene = useMemo(() => {
    if (!crystal) return null;
    return expandCrystal(crystal, expansionRange, renderMode);
  }, [crystal, expansionRange, renderMode]);

  const setHighlightedNeighbors = useCrystalStore((state) => state.setHighlightedNeighbors);
  useEffect(() => {
    if (highlightedAtomIdx === null || !crystalScene) {
      setHighlightedNeighbors([]);
      return;
    }

    const cutoff = crystal?.neighborCutoff ?? 4.0;
    const shell = findCoordinationShell(crystalScene.atoms, highlightedAtomIdx, cutoff);
    setHighlightedNeighbors(shell.map((neighbor) => neighbor.atomIndex));
  }, [highlightedAtomIdx, crystalScene, crystal, setHighlightedNeighbors]);

  return (
    <>
      <CameraController />
      <OrbitControls
        ref={controlsRef}
        enablePan
        enableZoom
        enableRotate
        mouseButtons={{
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN,
        }}
      />

      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 10]} intensity={0.8} />
      <directionalLight position={[-5, -5, -5]} intensity={0.3} />
      <gridHelper args={[20, 20, '#ddd', '#eee']} />

      {activeTab === 'packing' ? (
        <PackingRenderer />
      ) : (
        crystalScene && (
          <>
            <AtomRenderer atoms={crystalScene.atoms} />
            {showBonds && <BondRenderer bonds={crystalScene.bonds} atoms={crystalScene.atoms} />}
            {showUnitCell && (
              <UnitCellRenderer
                vertices={crystalScene.unitCellVertices}
                edges={crystalScene.unitCellEdges}
                latticeVectors={crystalScene.latticeVectors}
              />
            )}
            {showLabels && <LabelRenderer atoms={crystalScene.atoms} />}
            {highlightedAtomIdx !== null && (
              <CoordinationHighlight
                atoms={crystalScene.atoms}
                centerIdx={highlightedAtomIdx}
                neighborIndices={highlightedNeighbors}
              />
            )}
            {renderMode === 'polyhedral' && crystal?.polyhedra && (
              <PolyhedronRenderer atoms={crystalScene.atoms} polyhedra={crystal.polyhedra} />
            )}
            {showAxes && <axesHelper args={[3]} />}
          </>
        )
      )}
    </>
  );
}

function ViewPresetButton({ preset }: { preset: ViewPreset }) {
  const handleClick = useCallback(() => {
    pendingViewTarget = preset;
    viewForceUpdate?.();
  }, [preset]);

  return (
    <button
      onClick={handleClick}
      className="px-2 py-1 text-xs rounded shadow-sm border transition-colors"
      style={{
        background: COLORS.white,
        borderColor: COLORS.border,
        color: COLORS.text,
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.background = COLORS.primaryLight;
        event.currentTarget.style.borderColor = COLORS.primary;
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.background = COLORS.white;
        event.currentTarget.style.borderColor = COLORS.border;
      }}
    >
      {preset}
    </button>
  );
}

export function CrystalScene3D() {
  return (
    <div
      className="relative w-full h-full"
      style={{ minHeight: 400 }}
      onContextMenu={(event) => {
        event.preventDefault();
      }}
      onDoubleClick={() => {
        pendingViewTarget = '重置';
        viewForceUpdate?.();
      }}
    >
      <Canvas
        camera={{ position: [8, 8, 8], fov: 50, near: 0.1, far: 1000 }}
        style={{ background: '#fafafa' }}
        gl={{ antialias: true }}
      >
        <SceneContent />
      </Canvas>

      <div className="absolute bottom-3 left-3 flex gap-1">
        {(['重置', '前', '顶', '侧'] as const).map((preset) => (
          <ViewPresetButton key={preset} preset={preset} />
        ))}
      </div>
    </div>
  );
}
