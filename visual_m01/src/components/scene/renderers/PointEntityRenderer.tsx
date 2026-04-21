import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { useFrame } from '@react-three/fiber';
import { COLORS } from '@/styles/tokens';
import type { Entity } from '@/editor/entities/types';
import { useSelectionStore, useToolStore } from '@/editor/store';
import { useBuilderResult } from '@/editor/builderCache';
import { RenameEntityCommand, useHistoryStore } from '@/editor';
import type { Vec3 } from '@/engine/types';
import { registerRenderer } from './index';
import { computePointPosition } from './usePointPosition';
import { transientDragState } from '@/editor/store/dragState';
import { transientAnimationState } from '@/editor/store/animationStore';

const CUSTOM_POINT_COLOR = '#ef4444';
const CUSTOM_POINT_RADIUS = 0.04;

// ─── 标签样式 ───

const LABEL_BASE: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  padding: '1px 6px',
  borderRadius: 4,
  whiteSpace: 'nowrap',
  userSelect: 'none',
  cursor: 'pointer',
  transition: 'background 0.15s, color 0.15s, box-shadow 0.15s',
};

// ─── PointEntityRenderer ───

function PointEntityRenderer({ entity }: { entity: Entity }) {
  const pointEntity = entity as Entity<'point'>;
  const props = pointEntity.properties;

  const result = useBuilderResult(props.geometryId);
  const isSelected = useSelectionStore((s) => s.selectedIds.includes(entity.id));
  const isHovered = useSelectionStore((s) => s.hoveredId === entity.id);
  const activeToolId = useToolStore((s) => s.activeToolId);
  const isDrawingPulse = isSelected && activeToolId === 'drawSegment';

  const position = useMemo(() => {
    if (!result) return null;
    return computePointPosition(props, result);
  }, [props, result]);

  if (!position) return null;

  if (props.builtIn) {
    return (
      <BuiltInPointLabel
        entity={pointEntity}
        position={position}
        isSelected={isSelected}
        isHovered={isHovered}
        isPulsing={isDrawingPulse}
      />
    );
  }

  return (
    <CustomPointRenderer
      entity={pointEntity}
      position={position}
      isSelected={isSelected}
      isHovered={isHovered}
      isPulsing={isDrawingPulse}
    />
  );
}

// ─── builtIn 顶点标签 ───

/** CSS 脉冲动画（注入一次） */
const PULSE_STYLE_ID = 'point-pulse-keyframes';
function ensurePulseStyle() {
  if (document.getElementById(PULSE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = PULSE_STYLE_ID;
  style.textContent = `
    @keyframes point-pulse {
      0%, 100% { box-shadow: 0 0 0 2px rgba(34,197,94,0.4); }
      50% { box-shadow: 0 0 8px 4px rgba(34,197,94,0.6); }
    }
    @keyframes point-scale-pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.4); }
    }
  `;
  document.head.appendChild(style);
}

function BuiltInPointLabel({
  entity,
  position,
  isSelected,
  isHovered,
  isPulsing,
}: {
  entity: Entity<'point'>;
  position: Vec3;
  isSelected: boolean;
  isHovered: boolean;
  isPulsing: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const groupRef = useRef<THREE.Group>(null);

  const displayLabel = entity.properties.label;

  // 拖拽/动画时直接移动 group，绕过 React 重渲染
  useFrame(() => {
    if (!groupRef.current) return;
    if (transientDragState.pointId === entity.id && transientDragState.position) {
      const p = transientDragState.position;
      groupRef.current.position.set(p[0], p[1], p[2]);
    } else if (transientAnimationState.pointId === entity.id && transientAnimationState.position) {
      const p = transientAnimationState.position;
      groupRef.current.position.set(p[0], p[1], p[2]);
    } else {
      groupRef.current.position.set(position[0], position[1], position[2]);
    }
  });

  useEffect(() => {
    if (editing) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [editing]);

  const commitEdit = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (trimmed && trimmed !== displayLabel) {
        const cmd = new RenameEntityCommand(entity.id, displayLabel, trimmed);
        useHistoryStore.getState().execute(cmd);
      }
      setEditing(false);
    },
    [entity.id, displayLabel],
  );

  const handleMeshDoubleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    setEditing(true);
  }, []);

  useEffect(() => { if (isPulsing) ensurePulseStyle(); }, [isPulsing]);

  const style: React.CSSProperties = {
    ...LABEL_BASE,
    pointerEvents: 'none',
    color: isSelected ? '#fff' : isHovered ? COLORS.primary : COLORS.text,
    background: isSelected ? COLORS.primary : isHovered ? '#dbeafe' : 'rgba(255,255,255,0.85)',
    boxShadow: isSelected ? `0 0 0 2px ${COLORS.primary}40` : isHovered ? `0 0 0 2px #60a5fa80` : 'none',
    ...(isPulsing ? { animation: 'point-pulse 1.2s ease-in-out infinite' } : {}),
  };

  return (
    <group ref={groupRef}>
      {/* 不可见命中体积 — 供 raycasting 识别 + 双击编辑 */}
      <mesh
        userData={{ entityId: entity.id, entityType: 'point' }}
        onDoubleClick={handleMeshDoubleClick}
      >
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <Html center distanceFactor={8} style={{ pointerEvents: editing ? 'auto' : 'none' }}>
        {editing ? (
          <input
            ref={inputRef}
            defaultValue={displayLabel}
            style={{
              ...LABEL_BASE,
              pointerEvents: 'auto',
              width: 48,
              textAlign: 'center',
              outline: 'none',
              border: `2px solid ${COLORS.primary}`,
              background: '#fff',
              color: COLORS.text,
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitEdit(e.currentTarget.value);
              if (e.key === 'Escape') setEditing(false);
              e.stopPropagation();
            }}
            onBlur={(e) => commitEdit(e.currentTarget.value)}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div style={style}>
            {displayLabel}
          </div>
        )}
      </Html>
    </group>
  );
}

// ─── 用户自定义点渲染 ───

function CustomPointRenderer({
  entity,
  position,
  isSelected,
  isHovered,
  isPulsing,
}: {
  entity: Entity<'point'>;
  position: Vec3;
  isSelected: boolean;
  isHovered: boolean;
  isPulsing: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const displayLabel = entity.properties.label;
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (editing) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [editing]);

  const commitEdit = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (trimmed && trimmed !== displayLabel) {
        const cmd = new RenameEntityCommand(entity.id, displayLabel, trimmed);
        useHistoryStore.getState().execute(cmd);
      }
      setEditing(false);
    },
    [entity.id, displayLabel],
  );

  const handleMeshDoubleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    setEditing(true);
  }, []);

  const pointColor = isSelected ? '#00C06B' : isHovered ? '#60a5fa' : CUSTOM_POINT_COLOR;
  const meshRef = useRef<THREE.Mesh>(null);

  // 拖拽/动画时直接移动 group + 脉冲动画
  useFrame(({ clock }) => {
    if (groupRef.current) {
      if (transientDragState.pointId === entity.id && transientDragState.position) {
        const p = transientDragState.position;
        groupRef.current.position.set(p[0], p[1], p[2]);
      } else if (transientAnimationState.pointId === entity.id && transientAnimationState.position) {
        const p = transientAnimationState.position;
        groupRef.current.position.set(p[0], p[1], p[2]);
      } else {
        groupRef.current.position.set(position[0], position[1], position[2]);
      }
    }
    if (isPulsing && meshRef.current) {
      const s = 1 + 0.4 * Math.sin(clock.getElapsedTime() * 4);
      meshRef.current.scale.setScalar(s);
    }
  });

  // Reset scale when not pulsing
  useEffect(() => {
    if (!isPulsing && meshRef.current) {
      meshRef.current.scale.setScalar(1);
    }
  }, [isPulsing]);

  return (
    <group ref={groupRef}>
      {/* 可见小球 + 命中体积 */}
      <mesh
        ref={meshRef}
        userData={{ entityId: entity.id, entityType: 'point' }}
        onDoubleClick={handleMeshDoubleClick}
      >
        <sphereGeometry args={[CUSTOM_POINT_RADIUS, 16, 16]} />
        <meshBasicMaterial color={pointColor} />
      </mesh>

      {/* 不可见命中扩大体积 */}
      <mesh
        userData={{ entityId: entity.id, entityType: 'point' }}
      >
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* 标签 */}
      <Html center distanceFactor={8} style={{ pointerEvents: editing ? 'auto' : 'none' }}>
        {editing ? (
          <input
            ref={inputRef}
            defaultValue={displayLabel}
            style={{
              fontSize: 12,
              fontWeight: 600,
              width: 40,
              textAlign: 'center',
              padding: '0 2px',
              borderRadius: 3,
              border: `2px solid ${CUSTOM_POINT_COLOR}`,
              outline: 'none',
              background: '#fff',
              color: CUSTOM_POINT_COLOR,
              pointerEvents: 'auto',
              transform: 'translateY(-14px)',
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') commitEdit(e.currentTarget.value);
              if (e.key === 'Escape') setEditing(false);
            }}
            onBlur={(e) => commitEdit(e.currentTarget.value)}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: CUSTOM_POINT_COLOR,
              background: 'rgba(255,255,255,0.9)',
              padding: '0 4px',
              borderRadius: 3,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              transform: 'translateY(-14px)',
            }}
          >
            {displayLabel}
          </div>
        )}
      </Html>
    </group>
  );
}

registerRenderer('point', PointEntityRenderer);

export { PointEntityRenderer };
