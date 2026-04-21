/**
 * 双击原子信息弹窗
 * 使用 drei Html 组件定位在原子上方
 */

import { Html } from '@react-three/drei';
import type { Atom3D, MoleculeModel } from '@/engine/types';
import { getElement } from '@/data/elements';
import { COLORS } from '@/styles/tokens';
import { useMoleculeStore } from '@/store/moleculeStore';

interface Props {
  atom: Atom3D;
  model: MoleculeModel;
  onClose: () => void;
}

export function AtomInfoPopup({ atom, model, onClose }: Props) {
  const el = getElement(atom.element);
  const mol = useMoleculeStore(s => s.currentMolecule);

  // 统计连接键数
  const connectedBonds = model.bonds.filter(b => b.from === atom.index || b.to === atom.index);
  const bondCount = connectedBonds.length;

  return (
    <group position={atom.position}>
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
            minWidth: '160px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            border: `1px solid ${COLORS.border}`,
            transform: 'translateY(-50px)',
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

          {/* 元素符号 + 名称 */}
          <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: 6, color: COLORS.primary }}>
            {el.symbol}
            <span style={{ fontWeight: 400, fontSize: '12px', color: COLORS.textSecondary, marginLeft: 6 }}>
              {el.name_cn} · {el.name_en}
            </span>
          </div>

          <Row label="共价半径" value={el.covalentRadiusUncertainty > 0 ? `${el.covalentRadius} ± ${el.covalentRadiusUncertainty} pm` : `${el.covalentRadius} pm`} />
          <Row label="范德华半径" value={`${el.vdwRadius} pm`} />
          <Row label="电负性" value={el.electronegativity.toFixed(2)} />
          <Row label="连接键数" value={bondCount.toString()} />
          {mol?.hybridization && (
            <Row label="杂化方式" value={mol.hybridization} />
          )}
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
