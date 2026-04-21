/**
 * 双击键信息弹窗
 * 使用 drei Html 组件定位在键中点
 */

import { Html } from '@react-three/drei';
import type { Bond3D, Atom3D } from '@/engine/types';
import { getElement } from '@/data/elements';
import { BOND_LENGTH_REFERENCE } from '@/data/bondTypes';
import { COLORS } from '@/styles/tokens';

interface Props {
  bond: Bond3D;
  atoms: Atom3D[];
  onClose: () => void;
}

const BOND_TYPE_CN: Record<string, string> = {
  single: '单键',
  double: '双键',
  triple: '三键',
  delocalized: '离域键',
  coordinate: '配位键',
  hydrogen: '氢键',
};

export function BondInfoPopup({ bond, atoms, onClose }: Props) {
  const fromAtom = atoms[bond.from];
  const toAtom = atoms[bond.to];
  if (!fromAtom || !toAtom) return null;

  const midX = (bond.fromPos[0] + bond.toPos[0]) / 2;
  const midY = (bond.fromPos[1] + bond.toPos[1]) / 2;
  const midZ = (bond.fromPos[2] + bond.toPos[2]) / 2;

  const elA = getElement(fromAtom.element);
  const elB = getElement(toAtom.element);
  const enDiff = Math.abs(elA.electronegativity - elB.electronegativity);
  const polarity = enDiff < 0.4 ? '非极性' : enDiff < 1.7 ? '极性' : '离子性';

  // 查标准键长/键能
  const orderStr = bond.order === 2 ? '=' : bond.order >= 3 ? '≡' : '-';
  const keyA = `${fromAtom.element}${orderStr}${toAtom.element}`;
  const keyB = `${toAtom.element}${orderStr}${fromAtom.element}`;
  const ref = BOND_LENGTH_REFERENCE[keyA] ?? BOND_LENGTH_REFERENCE[keyB];

  return (
    <group position={[midX, midY, midZ]}>
      <Html
        center
        style={{ pointerEvents: 'auto' }}
        distanceFactor={6}
      >
        <div
          style={{
            background: 'rgba(255,255,255,0.95)',
            borderRadius: '10px',
            padding: '12px 14px',
            minWidth: '170px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            border: `1px solid ${COLORS.border}`,
            transform: 'translateY(-40px)',
            fontSize: '12px',
            color: COLORS.text,
            lineHeight: '1.6',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* 关闭按钮 */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: 4,
              right: 6,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              color: COLORS.textMuted,
              lineHeight: 1,
            }}
          >
            ×
          </button>

          {/* 键名 */}
          <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: 6, color: COLORS.primary }}>
            {fromAtom.element}{orderStr}{toAtom.element}
            <span style={{ fontWeight: 400, fontSize: '12px', color: COLORS.textSecondary, marginLeft: 6 }}>
              {BOND_TYPE_CN[bond.type] ?? bond.type}
            </span>
          </div>

          <Row label="实测键长" value={`${Math.round(bond.length)} pm`} />
          {ref && <Row label="标准键长" value={`${ref.length} pm`} />}
          {ref && <Row label="键能" value={`${ref.energy} kJ/mol`} />}
          <Row label="电负性差" value={enDiff.toFixed(2)} />
          <Row label="极性" value={polarity} />
        </div>
      </Html>
    </group>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ color: COLORS.textMuted }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  );
}
