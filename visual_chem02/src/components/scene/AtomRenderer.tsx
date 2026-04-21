/**
 * 原子球体渲染器
 * 支持球棍模型、空间填充模型、电子云模型三种渲染模式
 */

import { useRef } from 'react';
import { Html } from '@react-three/drei';
import type { Mesh } from 'three';
import type { Atom3D } from '@/engine/types';
import type { DisplayMode } from '@/store/uiStore';
import { COLORS } from '@/styles/tokens';

interface AtomRendererProps {
  atom: Atom3D;
  displayMode: DisplayMode;
  showLabel: boolean;
  isSelected: boolean;
  isHovered: boolean;
  onPointerOver: () => void;
  onPointerOut: () => void;
  onClick: () => void;
  onDoubleClick?: () => void;
}

export function AtomRenderer({
  atom,
  displayMode,
  showLabel,
  isSelected,
  isHovered,
  onPointerOver,
  onPointerOut,
  onClick,
  onDoubleClick,
}: AtomRendererProps) {
  const meshRef = useRef<Mesh>(null);

  let radius: number;
  if (displayMode === 'space-filling') {
    radius = atom.spaceFillRadius;
  } else if (displayMode === 'electron-cloud') {
    radius = atom.radius * 0.6;
  } else {
    radius = atom.radius;
  }

  const emissiveIntensity = isSelected ? 0.4 : isHovered ? 0.2 : 0;

  return (
    <group position={atom.position}>
      <mesh
        ref={meshRef}
        onPointerOver={(e) => { e.stopPropagation(); onPointerOver(); }}
        onPointerOut={(e) => { e.stopPropagation(); onPointerOut(); }}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick?.(); }}
      >
        <sphereGeometry args={[radius, 32, 32]} />
        <meshStandardMaterial
          color={atom.color}
          emissive={isSelected ? COLORS.primary : isHovered ? '#ffffff' : '#000000'}
          emissiveIntensity={emissiveIntensity}
          roughness={0.3}
          metalness={0.1}
        />
      </mesh>

      {/* 原子选中高亮环 */}
      {isSelected && (
        <mesh>
          <sphereGeometry args={[radius * 1.15, 32, 32]} />
          <meshBasicMaterial color={COLORS.primary} transparent opacity={0.2} />
        </mesh>
      )}

      {/* 原子标签 */}
      {showLabel && (
        <Html
          center
          distanceFactor={8}
          style={{
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          <div style={{
            color: COLORS.text,
            fontSize: '28px',
            fontWeight: 700,
            background: 'rgba(255,255,255,0.9)',
            padding: '2px 8px',
            borderRadius: '6px',
            whiteSpace: 'nowrap',
            transform: 'translateY(-28px)',
          }}>
            {atom.label ?? atom.element}
          </div>
        </Html>
      )}

      {/* 形式电荷标签 */}
      {atom.formalCharge != null && atom.formalCharge !== 0 && (
        <Html
          center
          distanceFactor={8}
          style={{
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          <div style={{
            fontSize: '22px',
            fontWeight: 700,
            color: atom.formalCharge > 0 ? '#DC2626' : '#2563EB',
            background: 'rgba(255,255,255,0.85)',
            padding: '0px 5px',
            borderRadius: '50%',
            whiteSpace: 'nowrap',
            transform: `translate(${radius * 28}px, -${radius * 20}px)`,
            lineHeight: '1.2',
          }}>
            {atom.formalCharge > 0
              ? (atom.formalCharge === 1 ? '+' : `${atom.formalCharge}+`)
              : (atom.formalCharge === -1 ? '−' : `${Math.abs(atom.formalCharge)}−`)}
          </div>
        </Html>
      )}
    </group>
  );
}
