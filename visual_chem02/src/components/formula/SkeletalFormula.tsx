/**
 * 键线式 SVG 渲染
 * - 渲染碳骨架折线
 * - 碳原子一般不显示元素符号（仅在交点处隐含）
 * - 杂原子(O, N, S, Cl等)显示元素符号 + H 计数
 * - 已合并的 H 不显示
 * - 双键用平行线，三键用三线，离域键用虚线
 * - 小分子回退：若隐藏后无可见原子则显示全部
 */

import { useMemo } from 'react';
import type { Projected2D } from '@/engine/projection2d';
import { COLORS } from '@/styles/tokens';

interface Props {
  data: Projected2D;
  showBondLengths?: boolean;
}

/** 计算离域键端点的质心 */
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

export function SkeletalFormula({ data, showBondLengths }: Props) {
  const delocCenter = computeDelocCenter(data);
  // 预计算每个C原子的非H邻居是否全为杂原子（如CO₂的C连的全是O）
  const carbonShowSet = useMemo(() => {
    const set = new Set<number>();
    for (const atom of data.atoms) {
      if (atom.element !== 'C' || atom.merged) continue;
      // 找该C的所有非H非merged邻居
      const neighbors = data.bonds
        .filter(b => (b.from === atom.index || b.to === atom.index))
        .map(b => data.atoms[b.from === atom.index ? b.to : b.from])
        .filter(a => a && !a.merged && a.element !== 'H');
      // 如果所有邻居都是杂原子（非C），则显示这个C（如CO₂、CS₂）
      // 或者该C没有非H邻居（如CH₄，唯一重原子），也显示
      if (neighbors.length === 0 || neighbors.every(a => a.element !== 'C')) {
        set.add(atom.index);
      }
    }
    return set;
  }, [data.atoms, data.bonds]);

  const shouldShowLabel = (el: string, index: number) => {
    if (el === 'H') return false;
    if (el === 'C') return carbonShowSet.has(index);
    return true;
  };

  return (
    <g>
      {/* 键 — 跳过已合并H和醛基氧/羧酸羟基氧 */}
      {data.bonds.map((bond, i) => {
        const fa = data.atoms[bond.from];
        const ta = data.atoms[bond.to];
        if (!fa || !ta) return null;
        // 跳过醛基氧和羧酸羟基氧（已合并到CHO/COOH中）
        if (fa.aldehydeOxygen || ta.aldehydeOxygen) return null;
        if (fa.carboxylicOH || ta.carboxylicOH) return null;
        if (fa.merged || ta.merged) return null;
        const fromNeedsGap = shouldShowLabel(fa.element, fa.index);
        const toNeedsGap = shouldShowLabel(ta.element, ta.index);
        return (
          <SkeletalBond
            key={i}
            x1={fa.x} y1={fa.y}
            x2={ta.x} y2={ta.y}
            order={bond.order} type={bond.type}
            shrinkFrom={fromNeedsGap}
            shrinkTo={toNeedsGap}
            innerRef={bond.type === 'delocalized' ? delocCenter : undefined}
          />
        );
      })}

      {/* 原子标签 */}
      {data.atoms.map((atom) => {
        if (atom.merged || atom.aldehydeOxygen || atom.carboxylicOH) return null;
        // 形式电荷即使C不显示标签也要显示
        const showLabel = shouldShowLabel(atom.element, atom.index);
        const showCharge = atom.formalCharge !== 0;
        if (!showLabel && !showCharge) return null;
        return (
          <g key={atom.index}>
            {showLabel && (
              <>
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
              </>
            )}
            {showCharge && (
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
        if (fa.aldehydeOxygen || ta.aldehydeOxygen) return null;
        if (fa.carboxylicOH || ta.carboxylicOH) return null;
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

function SkeletalBond({ x1, y1, x2, y2, order, type, shrinkFrom, shrinkTo, innerRef }: {
  x1: number; y1: number; x2: number; y2: number;
  order: number; type: string;
  shrinkFrom: boolean; shrinkTo: boolean;
  innerRef?: { x: number; y: number };
}) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.01) return null;

  const nx = dx / len;
  const ny = dy / len;
  const perpX = -ny;
  const perpY = nx;

  const gapFrom = shrinkFrom ? Math.min(14, len * 0.15) : 0;
  const gapTo = shrinkTo ? Math.min(14, len * 0.15) : 0;
  const sx1 = x1 + nx * gapFrom;
  const sy1 = y1 + ny * gapFrom;
  const sx2 = x2 - nx * gapTo;
  const sy2 = y2 - ny * gapTo;

  const offset = 3;

  // 离域键 → 1 实线 + 1 虚线（共振键，介于单键和双键之间）
  // 虚线统一偏向内侧（质心方向）
  if (type === 'delocalized') {
    const bmx = (sx1 + sx2) / 2;
    const bmy = (sy1 + sy2) / 2;
    let sign = 1;
    if (innerRef) {
      const dot = perpX * (innerRef.x - bmx) + perpY * (innerRef.y - bmy);
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
