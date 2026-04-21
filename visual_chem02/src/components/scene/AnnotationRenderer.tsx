/**
 * 键长/键角标注渲染器
 * 点选 2 个原子显示键长，点选 3 个原子显示键角
 */

import { Html } from '@react-three/drei';
import type { Atom3D, Bond3D } from '@/engine/types';
import { vec3Add, vec3Scale } from '@/engine/types';
import { computeBondLength, computeBondAngle, formatBondLength, formatBondAngle } from '@/engine/bondAngle';
import { COLORS, RADIUS } from '@/styles/tokens';

interface AnnotationRendererProps {
  selectedAtomIndices: number[];
  atoms: Atom3D[];
  bonds: Bond3D[];
}

export function AnnotationRenderer({ selectedAtomIndices, atoms, bonds }: AnnotationRendererProps) {
  if (selectedAtomIndices.length === 2) {
    return <BondLengthAnnotation atoms={atoms} bonds={bonds} indices={selectedAtomIndices} />;
  }
  if (selectedAtomIndices.length === 3) {
    return <BondAngleAnnotation atoms={atoms} bonds={bonds} indices={selectedAtomIndices} />;
  }
  return null;
}

function BondLengthAnnotation({ atoms, bonds, indices }: { atoms: Atom3D[]; bonds: Bond3D[]; indices: number[] }) {
  const a = atoms[indices[0]];
  const b = atoms[indices[1]];
  if (!a || !b) return null;

  // 仅当两原子间存在真实键时才显示键长
  const hasBond = bonds.some(bd =>
    (bd.from === indices[0] && bd.to === indices[1]) || (bd.from === indices[1] && bd.to === indices[0]),
  );
  if (!hasBond) return null;

  const midpoint = vec3Scale(vec3Add(a.position, b.position), 0.5);
  const length = computeBondLength(a.position, b.position);

  return (
    <group>
      {/* 虚线连接 */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([...a.position, ...b.position]), 3]}
            count={2}
          />
        </bufferGeometry>
        <lineBasicMaterial color={COLORS.primary} linewidth={2} />
      </line>

      {/* 标注标签 */}
      <group position={midpoint}>
        <Html center distanceFactor={8} style={{ pointerEvents: 'none' }}>
          <div style={{
            background: COLORS.bg,
            border: `1px solid ${COLORS.primary}`,
            borderRadius: RADIUS.sm,
            padding: '4px 8px',
            fontSize: '12px',
            fontWeight: 600,
            color: COLORS.primary,
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}>
            {formatBondLength(length)}
          </div>
        </Html>
      </group>
    </group>
  );
}

function BondAngleAnnotation({ atoms, bonds, indices }: { atoms: Atom3D[]; bonds: Bond3D[]; indices: number[] }) {
  const a = atoms[indices[0]];
  const b = atoms[indices[1]]; // 中心原子
  const c = atoms[indices[2]];
  if (!a || !b || !c) return null;

  // 仅当中心原子 B 与 A、C 均有真实键连接时才显示键角
  const hasBondAB = bonds.some(bd =>
    (bd.from === indices[0] && bd.to === indices[1]) || (bd.from === indices[1] && bd.to === indices[0]),
  );
  const hasBondBC = bonds.some(bd =>
    (bd.from === indices[1] && bd.to === indices[2]) || (bd.from === indices[2] && bd.to === indices[1]),
  );
  if (!hasBondAB || !hasBondBC) return null;

  const angle = computeBondAngle(a.position, b.position, c.position);

  return (
    <group position={b.position}>
      <Html center distanceFactor={8} style={{ pointerEvents: 'none' }}>
        <div style={{
          background: COLORS.bg,
          border: `1px solid ${COLORS.info}`,
          borderRadius: RADIUS.sm,
          padding: '4px 8px',
          fontSize: '12px',
          fontWeight: 600,
          color: COLORS.info,
          whiteSpace: 'nowrap',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          transform: 'translateY(-24px)',
        }}>
          {formatBondAngle(angle)}
        </div>
      </Html>
    </group>
  );
}
