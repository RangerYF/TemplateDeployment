/**
 * 电子式 SVG 渲染
 * 在结构简式基础上：
 * - 共用电子对用 ·· 显示在键两侧
 * - 孤电子对用 ·· 标记在原子周围
 * 使用 merged 标记判断哪些H已合并，独立H正常显示
 * 使用 type 字段区分离域键/氢键等
 */

import type { ReactNode } from 'react';
import type { Projected2D } from '@/engine/projection2d';
import { COLORS } from '@/styles/tokens';

interface Props {
  data: Projected2D;
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

export function ElectronFormula({ data }: Props) {
  const delocCenter = computeDelocCenter(data);
  return (
    <g>
      {/* 键（共用电子对）— 跳过已合并H的键 */}
      {data.bonds.map((bond, i) => {
        const fa = data.atoms[bond.from];
        const ta = data.atoms[bond.to];
        if (!fa || !ta) return null;
        if (fa.merged || ta.merged) return null;
        return (
          <ElectronBond
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
            {/* 白色描边背景：遮盖下层键线/电子点 */}
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
            <LonePairDots
              cx={atom.x} cy={atom.y}
              count={atom.lonePairs}
              unpairedElectrons={atom.unpairedElectrons ?? 0}
              bondAngles={getBondAngles(atom.index, data)}
            />
          </g>
        );
      })}
    </g>
  );
}

/** 共用电子对：沿键方向放置电子点 */
function ElectronBond({ x1, y1, x2, y2, order, type, innerRef }: {
  x1: number; y1: number; x2: number; y2: number;
  order: number; type: string;
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
  const shrink = Math.min(18, len * 0.2);
  const sx1 = x1 + nx * shrink;
  const sy1 = y1 + ny * shrink;
  const sx2 = x2 - nx * shrink;
  const sy2 = y2 - ny * shrink;
  const mx = (sx1 + sx2) / 2;
  const my = (sy1 + sy2) / 2;

  // 离域键：1实+1虚并列 + 单对电子点（共振键，介于单双键之间）
  const isDelocalized = type === 'delocalized';
  const effectiveOrder = isDelocalized ? 1 : Math.min(order, 3);
  const isDashed = type === 'hydrogen';

  const dots: ReactNode[] = [];
  const r = 2;
  const colGap = 4;    // 两列间距（垂直于键方向，键两侧各一列）
  const rowGap = 5;    // 行间距（沿垂直于键方向堆叠）

  if (effectiveOrder === 1) {
    // 单键：两个点垂直于键方向（竖排 :）
    dots.push(
      <circle key="e-0-a" cx={mx + perpX * colGap} cy={my + perpY * colGap} r={r} fill={COLORS.primary} />,
      <circle key="e-0-b" cx={mx - perpX * colGap} cy={my - perpY * colGap} r={r} fill={COLORS.primary} />,
    );
  } else {
    // 双键/三键：两列（沿键方向左右各一列），行数 = effectiveOrder，沿垂直方向堆叠
    for (let row = 0; row < effectiveOrder; row++) {
      const rowOffset = (row - (effectiveOrder - 1) / 2) * rowGap;
      const px = mx + perpX * rowOffset;
      const py = my + perpY * rowOffset;
      dots.push(
        <circle key={`e-${row}-a`} cx={px + nx * colGap} cy={py + ny * colGap} r={r} fill={COLORS.primary} />,
        <circle key={`e-${row}-b`} cx={px - nx * colGap} cy={py - ny * colGap} r={r} fill={COLORS.primary} />,
      );
    }
  }

  const bondOffset = 3;

  // 离域键：虚线统一偏向质心（内侧）
  let delocSign = 1;
  if (isDelocalized && innerRef) {
    const bmx = (sx1 + sx2) / 2;
    const bmy = (sy1 + sy2) / 2;
    const dot = perpX * (innerRef.x - bmx) + perpY * (innerRef.y - bmy);
    delocSign = dot >= 0 ? 1 : -1;
  }

  return (
    <g>
      {isDelocalized ? (
        <>
          <line
            x1={sx1 - delocSign * perpX * bondOffset} y1={sy1 - delocSign * perpY * bondOffset}
            x2={sx2 - delocSign * perpX * bondOffset} y2={sy2 - delocSign * perpY * bondOffset}
            stroke={COLORS.border} strokeWidth="1" opacity={0.5}
          />
          <line
            x1={sx1 + delocSign * perpX * bondOffset} y1={sy1 + delocSign * perpY * bondOffset}
            x2={sx2 + delocSign * perpX * bondOffset} y2={sy2 + delocSign * perpY * bondOffset}
            stroke={COLORS.border} strokeWidth="1" opacity={0.5}
            strokeDasharray="4 3"
          />
        </>
      ) : (
        <line
          x1={sx1} y1={sy1} x2={sx2} y2={sy2}
          stroke={COLORS.border} strokeWidth="1" opacity={0.5}
          strokeDasharray={isDashed ? '4 3' : undefined}
        />
      )}
      {dots}
    </g>
  );
}

/** 获取原子的所有键方向角度（SVG坐标系） */
function getBondAngles(atomIndex: number, data: Projected2D): number[] {
  const atom = data.atoms[atomIndex];
  const angles: number[] = [];
  for (const bond of data.bonds) {
    if (bond.from === atomIndex) {
      const other = data.atoms[bond.to];
      if (other && !other.merged) {
        angles.push(Math.atan2(other.y - atom.y, other.x - atom.x));
      }
    } else if (bond.to === atomIndex) {
      const other = data.atoms[bond.from];
      if (other && !other.merged) {
        angles.push(Math.atan2(other.y - atom.y, other.x - atom.x));
      }
    }
  }
  return angles;
}

/**
 * sp3 四个正交方向（上/右/下/左），电子式中价层4对固定用这四个方向
 */
const CARDINAL_4 = [
  -Math.PI / 2,  // 上
  0,              // 右
  Math.PI / 2,   // 下
  Math.PI,        // 左
] as const;

/**
 * sp2 三个120°方向（上/右下/左下），电子式中价层3对用这三个方向
 */
const TRIGONAL_3 = [
  -Math.PI / 2,                 // 上 (90°)
  -Math.PI / 2 + 2 * Math.PI / 3,  // 右下 (210° → 150° in SVG)
  -Math.PI / 2 - 2 * Math.PI / 3,  // 左下 (-210° → -150° in SVG)
] as const;

/** 将角度归一化到 [-π, π) */
function normalizeAngle(a: number): number {
  let r = a % (2 * Math.PI);
  if (r >= Math.PI) r -= 2 * Math.PI;
  if (r < -Math.PI) r += 2 * Math.PI;
  return r;
}

/** 两个角度之间的最小绝对差 */
function angleDiff(a: number, b: number): number {
  let d = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  if (d > Math.PI) d = 2 * Math.PI - d;
  return d;
}

/**
 * 从固定方向集合中为键分配方向，剩余方向给孤电子对
 */
function assignFromFixedDirs(
  dirs: readonly number[], bondAngles: number[], count: number,
): number[] {
  const usedIndices = new Set<number>();
  for (const ba of bondAngles) {
    let bestIdx = 0, bestDiff = Infinity;
    for (let i = 0; i < dirs.length; i++) {
      if (usedIndices.has(i)) continue;
      const d = angleDiff(ba, dirs[i]);
      if (d < bestDiff) { bestDiff = d; bestIdx = i; }
    }
    usedIndices.add(bestIdx);
  }
  const result: number[] = [];
  for (let i = 0; i < dirs.length && result.length < count; i++) {
    if (!usedIndices.has(i)) {
      result.push(dirs[i]);
    }
  }
  return result;
}

/**
 * 电子式孤电子对放置角度
 * - sp3（总域数=4）：上下左右90°正交
 * - sp2（总域数=3）：120°三角分布
 * - sp（总域数=2）：180°线性
 */
function findLonePairAngles(bondAngles: number[], count: number): number[] {
  if (count === 0) return [];

  const totalDomains = bondAngles.length + count;

  if (bondAngles.length === 0) {
    if (totalDomains === 4) return CARDINAL_4.slice(0, count) as unknown as number[];
    if (totalDomains === 3) return TRIGONAL_3.slice(0, count) as unknown as number[];
    if (totalDomains === 2) return count >= 2 ? [-Math.PI / 2, Math.PI / 2] : [-Math.PI / 2];
    return Array.from({ length: count }, (_, i) =>
      -Math.PI / 2 + i * 2 * Math.PI / count,
    );
  }

  // sp（2个域）：线性180°，LP 在键的对面
  if (totalDomains === 2) {
    return [normalizeAngle(bondAngles[0] + Math.PI)];
  }

  // sp2（3个域）：120°三角，以实际键方向为基准旋转
  if (totalDomains === 3) {
    if (bondAngles.length === 1) {
      // 1键+2LP：以键方向为基准，±120° 放置孤电子对
      const ba = bondAngles[0];
      return [
        normalizeAngle(ba + 2 * Math.PI / 3),
        normalizeAngle(ba - 2 * Math.PI / 3),
      ];
    }
    if (bondAngles.length === 2) {
      // 2键+1LP：LP 放在两键方向的反向质心
      const avg = Math.atan2(
        Math.sin(bondAngles[0]) + Math.sin(bondAngles[1]),
        Math.cos(bondAngles[0]) + Math.cos(bondAngles[1]),
      );
      return [normalizeAngle(avg + Math.PI)];
    }
    return [];
  }

  // sp3（4个域）：90°正交
  if (totalDomains === 4) {
    return assignFromFixedDirs(CARDINAL_4, bondAngles, count);
  }

  // 5对及以上：均匀分布后贪心填充
  const allAngles = [...bondAngles];
  const result: number[] = [];
  for (let p = 0; p < count; p++) {
    const sorted = [...allAngles].sort((a, b) => a - b);
    let maxGap = 0, maxStart = 0;
    for (let i = 0; i < sorted.length; i++) {
      const next = i + 1 < sorted.length ? sorted[i + 1] : sorted[0] + 2 * Math.PI;
      const gap = next - sorted[i];
      if (gap > maxGap) { maxGap = gap; maxStart = sorted[i]; }
    }
    const angle = maxStart + maxGap / 2;
    result.push(angle);
    allAngles.push(angle);
  }
  return result;
}

/** 形式电荷标注：右上角显示 +/−/2+/2− 等 */
function FormalChargeLabel({ cx, cy, charge }: { cx: number; cy: number; charge: number }) {
  const abs = Math.abs(charge);
  const sign = charge > 0 ? '+' : '−';
  const label = abs === 1 ? sign : `${abs}${sign}`;
  return (
    <g>
      {/* 圆圈背景 */}
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

/** 孤电子对 + 未成对电子：根据键方向在空隙处放置 ·· 或 · */
function LonePairDots({ cx, cy, count, unpairedElectrons = 0, bondAngles }: {
  cx: number; cy: number; count: number; unpairedElectrons?: number; bondAngles: number[];
}) {
  if (count === 0 && unpairedElectrons === 0) return null;

  // 孤电子对 + 未成对电子共同占用方向槽位
  const totalSlots = count + unpairedElectrons;
  const lpAngles = findLonePairAngles(bondAngles, Math.min(totalSlots, 4));
  const dist = 20;
  const dots: ReactNode[] = [];

  for (let i = 0; i < lpAngles.length; i++) {
    const angle = lpAngles[i];
    const px = cx + Math.cos(angle) * dist;
    const py = cy + Math.sin(angle) * dist;

    if (i < count) {
      // 孤电子对：两个点垂直于方向排列
      const perpX = -Math.sin(angle) * 3;
      const perpY = Math.cos(angle) * 3;
      dots.push(
        <circle key={`lp-${i}-a`} cx={px + perpX} cy={py + perpY} r={2} fill="#3050F8" />,
        <circle key={`lp-${i}-b`} cx={px - perpX} cy={py - perpY} r={2} fill="#3050F8" />,
      );
    } else {
      // 未成对电子：单个点（自由基·）
      dots.push(
        <circle key={`rad-${i}`} cx={px} cy={py} r={2.5} fill="#E74C3C" />,
      );
    }
  }

  return <g>{dots}</g>;
}
