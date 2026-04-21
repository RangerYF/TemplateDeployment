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
import { AtomRenderer } from './renderers/AtomRenderer';
import { BondRenderer } from './renderers/BondRenderer';
import { UnitCellRenderer } from './renderers/UnitCellRenderer';
import { LabelRenderer } from './renderers/LabelRenderer';
import { CoordinationHighlight } from './renderers/CoordinationHighlight';
import { PackingRenderer } from './renderers/PackingRenderer';
import { PolyhedronRenderer } from './renderers/PolyhedronRenderer';
import { COLORS } from '@/styles/tokens';

// ---------------------------------------------------------------------------
// View presets
// ---------------------------------------------------------------------------

type ViewPreset = '重置' | '前' | '顶' | '侧';

const VIEW_POSITIONS: Record<ViewPreset, [number, number, number]> = {
  '重置': [8, 8, 8],
  '前': [0, 0, 14],
  '顶': [0, 14, 0],
  '侧': [14, 0, 0],
};

// Module-level bridge: outside-Canvas buttons -> inside-Canvas camera controller
let _pendingViewTarget: ViewPreset | null = null;
let _viewForceUpdate: (() => void) | null = null;

// ---------------------------------------------------------------------------
// Camera controller - applies view presets via imperative camera update
// ---------------------------------------------------------------------------

function CameraController() {
  const { camera, invalidate } = useThree();
  const [, setTick] = useState(0);

  // Register the force-update callback so outside buttons can trigger re-render
  _viewForceUpdate = useCallback(() => {
    setTick((t) => t + 1);
  }, []);

  if (_pendingViewTarget) {
    const pos = VIEW_POSITIONS[_pendingViewTarget];
    camera.position.set(pos[0], pos[1], pos[2]);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    invalidate();
    _pendingViewTarget = null;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Inner scene content - rendered inside Canvas
// ---------------------------------------------------------------------------

function SceneContent() {
  const controlsRef = useRef<any>(null);

  const {
    selectedCrystalId,
    activeTab,
    renderMode,
    expansionRange,
    showUnitCell,
    showBonds,
    showLabels,
    showAxes,
    highlightedAtomIdx,
    highlightedNeighbors,
  } = useCrystalStore();

  // Crystal definition (for polyhedra etc.)
  const crystal = getCrystalById(selectedCrystalId);

  // Memoized crystal scene computation
  const crystalScene = useMemo(() => {
    if (!crystal) return null;
    return expandCrystal(crystal, expansionRange, renderMode);
  }, [crystal, expansionRange, renderMode]);

  // Compute coordination neighbors when an atom is highlighted
  const setHighlightedNeighbors = useCrystalStore((s) => s.setHighlightedNeighbors);
  useEffect(() => {
    if (highlightedAtomIdx === null || !crystalScene) {
      setHighlightedNeighbors([]);
      return;
    }
    const cutoff = crystal?.neighborCutoff ?? 4.0;
    const shell = findCoordinationShell(crystalScene.atoms, highlightedAtomIdx, cutoff);
    setHighlightedNeighbors(shell.map((n) => n.atomIndex));
  }, [highlightedAtomIdx, crystalScene, crystal, setHighlightedNeighbors]);

  return (
    <>
      {/* Camera & Controls */}
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

      {/* Lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 10]} intensity={0.8} />
      <directionalLight position={[-5, -5, -5]} intensity={0.3} />

      {/* Grid */}
      <gridHelper args={[20, 20, '#ddd', '#eee']} />

      {/* Crystal or Packing mode */}
      {activeTab === 'packing' ? (
        <PackingRenderer />
      ) : (
        crystalScene && (
          <>
            {/* Atoms */}
            <AtomRenderer atoms={crystalScene.atoms} />

            {/* Bonds */}
            {showBonds && <BondRenderer bonds={crystalScene.bonds} atoms={crystalScene.atoms} />}

            {/* Unit cell wireframe */}
            {showUnitCell && (
              <UnitCellRenderer
                vertices={crystalScene.unitCellVertices}
                edges={crystalScene.unitCellEdges}
                latticeVectors={crystalScene.latticeVectors}
              />
            )}

            {/* Labels */}
            {showLabels && <LabelRenderer atoms={crystalScene.atoms} />}

            {/* Coordination highlight */}
            {highlightedAtomIdx !== null && (
              <CoordinationHighlight
                atoms={crystalScene.atoms}
                centerIdx={highlightedAtomIdx}
                neighborIndices={highlightedNeighbors}
              />
            )}

            {/* Polyhedra (polyhedral mode) */}
            {renderMode === 'polyhedral' && crystalScene && crystal?.polyhedra && (
              <PolyhedronRenderer
                atoms={crystalScene.atoms}
                polyhedra={crystal.polyhedra}
              />
            )}

            {/* Axes helper */}
            {showAxes && <axesHelper args={[3]} />}
          </>
        )
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// View preset button (rendered outside Canvas)
// ---------------------------------------------------------------------------

function ViewPresetButton({ preset }: { preset: ViewPreset }) {
  const handleClick = useCallback(() => {
    _pendingViewTarget = preset;
    _viewForceUpdate?.();
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
      onMouseEnter={(e) => {
        (e.target as HTMLElement).style.background = COLORS.primaryLight;
        (e.target as HTMLElement).style.borderColor = COLORS.primary;
      }}
      onMouseLeave={(e) => {
        (e.target as HTMLElement).style.background = COLORS.white;
        (e.target as HTMLElement).style.borderColor = COLORS.border;
      }}
    >
      {preset}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Exported component
// ---------------------------------------------------------------------------

export function CrystalScene3D() {
  return (
    <div
      className="relative w-full h-full"
      style={{ minHeight: 400 }}
      onContextMenu={(event) => {
        event.preventDefault();
      }}
      onDoubleClick={() => {
        _pendingViewTarget = '重置';
        _viewForceUpdate?.();
      }}
    >
      <Canvas
        camera={{ position: [8, 8, 8], fov: 50, near: 0.1, far: 1000 }}
        style={{ background: '#fafafa' }}
        gl={{ antialias: true }}
      >
        <SceneContent />
      </Canvas>

      {/* View preset buttons */}
      <div className="absolute bottom-3 left-3 flex gap-1">
        {(['重置', '前', '顶', '侧'] as const).map((preset) => (
          <ViewPresetButton key={preset} preset={preset} />
        ))}
      </div>
    </div>
  );
}
