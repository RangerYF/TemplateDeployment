/**
 * 结构简式 SVG 渲染
 * 显示所有原子标签(元素符号+H数) + 键线(单/双/三/离域)
 * 已合并的H原子不单独显示，独立H原子（如 H₂）正常渲染
 */

import type { Projected2D } from '@/engine/projection2d';
import { COLORS } from '@/styles/tokens';

interface Props {
  data: Projected2D;
  showBondLengths?: boolean;
}

/** 计算离域键端点的质心，用于统一虚线方向 */
function computeDelocCenter(data: Projected2D): { x: number; y: number } | undefined {
  const pts: { x: number; y: number }[] = [];
  for (const b of data.bonds) {
    if (b.type !== 'delocalized') continue;
    const fa = data.atoms[b.from];
    const ta = data.atoms[b.to];
    if (fa && ta) { pts.push(fa, ta); }
  }
  if (pts.length === 0) return undefined;
  return {
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
  };
}

export function StructuralFormula({ data, showBondLengths }: Props) {
  const delocCenter = computeDelocCenter(data);
  return (
    <g>
      {/* 键 — 跳过已合并H原子的键 */}
      {data.bonds.map((bond, i) => {
        const fa = data.atoms[bond.from];
        const ta = data.atoms[bond.to];
        if (!fa || !ta) return null;
        if (fa.merged || ta.merged) return null;
        return (
          <BondLine
            key={i}
            x1={fa.x} y1={fa.y} x2={ta.x} y2={ta.y}
            order={bond.order} type={bond.type}
            innerRef={bond.type === 'delocalized' ? delocCenter : undefined}
          />
        );
      })}

      {/* 原子标签 — 跳过已合并的H */}
      {data.atoms.map((atom) => {
        if (atom.merged) return null;
        return (
          <g key={atom.index}>
            {/* 白色描边背景：遮盖下层键线，形成 halo 效果 */}
            <text
              x={atom.x}
              y={atom.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="16"
              fontWeight="600"
              fontFamily="system-ui, sans-serif"
              fill="none"
              stroke={COLORS.bg}
              strokeWidth="4"
              strokeLinejoin="round"
            >
              {atom.label}
            </text>
            <text
              x={atom.x}
              y={atom.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="16"
              fontWeight="600"
              fontFamily="system-ui, sans-serif"
              fill={COLORS.text}
            >
              {atom.label}
            </text>
            {atom.formalCharge !== 0 && (
              <FormalChargeLabel cx={atom.x} cy={atom.y} charge={atom.formalCharge} />
            )}
          </g>
        );
      })}

      {/* 键长标注 */}
      {showBondLengths && data.bonds.map((bond, i) => {
        const fa = data.atoms[bond.from];
        const ta = data.atoms[bond.to];
        if (!fa || !ta) return null;
        if (fa.merged || ta.merged) return null;
        const mx = (fa.x + ta.x) / 2;
        const my = (fa.y + ta.y) / 2;
        return (
          <text
            key={`bl-${i}`}
            x={mx}
            y={my - 10}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="12"
            fontFamily="system-ui, sans-serif"
            fill={COLORS.textMuted}
          >
            {Math.round(bond.length)} pm
          </text>
        );
      })}
    </g>
  );
}

function BondLine({ x1, y1, x2, y2, order, type, innerRef }: {
  x1: number; y1: number; x2: number; y2: number;
  order: number; type: string;
  innerRef?: { x: number; y: number };
}) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.01) return null;
  const shrink = Math.min(18, len * 0.2);
  const nx = dx / len;
  const ny = dy / len;
  const sx1 = x1 + nx * shrink;
  const sy1 = y1 + ny * shrink;
  const sx2 = x2 - nx * shrink;
  const sy2 = y2 - ny * shrink;

  const perpX = -ny;
  const perpY = nx;
  const offset = 3;

  // 离域键 → 1 实线 + 1 虚线（介于单键和双键之间，表示共振）
  // 虚线统一偏向内侧（质心方向），使多条离域键的虚线在同一面
  if (type === 'delocalized') {
    const mx = (sx1 + sx2) / 2;
    const my = (sy1 + sy2) / 2;
    // 判断 perp 方向哪一侧更靠近质心 → 虚线放在该侧
    let sign = 1;
    if (innerRef) {
      const dot = perpX * (innerRef.x - mx) + perpY * (innerRef.y - my);
      sign = dot >= 0 ? 1 : -1;
    }
    return (
      <g>
        <line x1={sx1 - sign * perpX * offset} y1={sy1 - sign * perpY * offset} x2={sx2 - sign * perpX * offset} y2={sy2 - sign * perpY * offset} stroke={COLORS.text} strokeWidth="2" />
        <line x1={sx1 + sign * perpX * offset} y1={sy1 + sign * perpY * offset} x2={sx2 + sign * perpX * offset} y2={sy2 + sign * perpY * offset} stroke={COLORS.text} strokeWidth="2" strokeDasharray="6 3" />
      </g>
    );
  }

  // 氢键 → 点线
  if (type === 'hydrogen') {
    return <line x1={sx1} y1={sy1} x2={sx2} y2={sy2} stroke={COLORS.textMuted} strokeWidth="1.5" strokeDasharray="2 3" />;
  }

  // 配位键 → 箭头线
  if (type === 'coordinate') {
    return <line x1={sx1} y1={sy1} x2={sx2} y2={sy2} stroke={COLORS.text} strokeWidth="2" markerEnd="url(#arrowhead)" />;
  }

  if (order === 1) {
    return <line x1={sx1} y1={sy1} x2={sx2} y2={sy2} stroke={COLORS.text} strokeWidth="2" />;
  }

  if (order === 2) {
    return (
      <g>
        <line x1={sx1 + perpX * offset} y1={sy1 + perpY * offset} x2={sx2 + perpX * offset} y2={sy2 + perpY * offset} stroke={COLORS.text} strokeWidth="2" />
        <line x1={sx1 - perpX * offset} y1={sy1 - perpY * offset} x2={sx2 - perpX * offset} y2={sy2 - perpY * offset} stroke={COLORS.text} strokeWidth="2" />
      </g>
    );
  }

  if (order >= 3) {
    return (
      <g>
        <line x1={sx1} y1={sy1} x2={sx2} y2={sy2} stroke={COLORS.text} strokeWidth="2" />
        <line x1={sx1 + perpX * offset * 1.5} y1={sy1 + perpY * offset * 1.5} x2={sx2 + perpX * offset * 1.5} y2={sy2 + perpY * offset * 1.5} stroke={COLORS.text} strokeWidth="2" />
        <line x1={sx1 - perpX * offset * 1.5} y1={sy1 - perpY * offset * 1.5} x2={sx2 - perpX * offset * 1.5} y2={sy2 - perpY * offset * 1.5} stroke={COLORS.text} strokeWidth="2" />
      </g>
    );
  }

  return <line x1={sx1} y1={sy1} x2={sx2} y2={sy2} stroke={COLORS.text} strokeWidth="2" />;
}

/** 形式电荷标注：右上角显示 +/−/2+/2− 等 */
function FormalChargeLabel({ cx, cy, charge }: { cx: number; cy: number; charge: number }) {
  const abs = Math.abs(charge);
  const sign = charge > 0 ? '+' : '−';
  const label = abs === 1 ? sign : `${abs}${sign}`;
  return (
    <g>
      <circle cx={cx + 12} cy={cy - 12} r={7} fill="none" stroke="#E74C3C" strokeWidth={1} />
      <text
        x={cx + 12}
        y={cy - 12}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="9"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
        fill="#E74C3C"
      >
        {label}
      </text>
    </g>
  );
}
