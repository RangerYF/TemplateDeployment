import { useRef, useEffect, useState, useCallback } from 'react';
import { useSimulationStore } from '@/store';
import { simulator } from '@/core/engine/simulator';
import type { EntityId, PhysicsResult, Vec2 } from '@/core/types';

// ═══════════════════════════════════════════════
// 常量
// ═══════════════════════════════════════════════

const VELOCITY_COLOR = '#2563EB';
const ACCEL_COLOR = '#DC2626';
const DISP_COLOR = '#059669';

type ChartType = 'v-t' | 'a-t' | 'x-t';

const CHART_CONFIGS: Record<ChartType, { color: string; yLabel: string; emptyHint: string }> = {
  'v-t': { color: VELOCITY_COLOR, yLabel: 'v (m/s)', emptyHint: '播放后显示' },
  'a-t': { color: ACCEL_COLOR, yLabel: 'a (m/s²)', emptyHint: '播放后显示' },
  'x-t': { color: DISP_COLOR, yLabel: 'x (m)', emptyHint: '播放后显示' },
};

const PANEL_W = 300;
const CHART_PAD = { top: 22, right: 16, bottom: 26, left: 36 };

// ═══════════════════════════════════════════════
// 参考方向（决定标量投影的正方向）
// ═══════════════════════════════════════════════

interface MotionRef {
  dir: Vec2;
  pos0: Vec2;
  /** 人类可读的正方向描述 */
  dirLabel: string;
}

function computeRef(history: PhysicsResult[], entityId: EntityId): MotionRef | null {
  if (history.length === 0) return null;
  const first = history[0]!.motionStates.get(entityId);
  if (!first) return null;

  const vMag = Math.hypot(first.velocity.x, first.velocity.y);
  let dir: Vec2;
  if (vMag > 1e-6) {
    dir = { x: first.velocity.x / vMag, y: first.velocity.y / vMag };
  } else {
    const aMag = Math.hypot(first.acceleration.x, first.acceleration.y);
    if (aMag > 1e-6) {
      dir = { x: first.acceleration.x / aMag, y: first.acceleration.y / aMag };
    } else {
      dir = { x: 1, y: 0 };
    }
  }
  return { dir, pos0: first.position, dirLabel: describeDirection(dir) };
}

/** 根据方向向量生成可读描述 */
function describeDirection(dir: Vec2): string {
  const ax = Math.abs(dir.x);
  const ay = Math.abs(dir.y);

  // 近似水平
  if (ay < 0.1) return dir.x > 0 ? '向右为正' : '向左为正';
  // 近似竖直
  if (ax < 0.1) return dir.y > 0 ? '向上为正' : '向下为正';
  // 斜面
  if (dir.y > 0) return '沿斜面向上为正';
  return '沿斜面向下为正';
}

// ═══════════════════════════════════════════════
// 数据提取
// ═══════════════════════════════════════════════

interface SeriesData {
  times: number[];
  velocities: number[];
  accelerations: number[];
  displacements: number[];
}

function extractSeries(
  history: PhysicsResult[],
  entityId: EntityId,
  ref: MotionRef,
): SeriesData {
  const times: number[] = [];
  const velocities: number[] = [];
  const accelerations: number[] = [];
  const displacements: number[] = [];

  for (const frame of history) {
    const m = frame.motionStates.get(entityId);
    if (!m) continue;
    times.push(frame.time);
    velocities.push(m.velocity.x * ref.dir.x + m.velocity.y * ref.dir.y);
    accelerations.push(m.acceleration.x * ref.dir.x + m.acceleration.y * ref.dir.y);
    const dx = m.position.x - ref.pos0.x;
    const dy = m.position.y - ref.pos0.y;
    displacements.push(dx * ref.dir.x + dy * ref.dir.y);
  }

  return { times, velocities, accelerations, displacements };
}

function getValues(series: SeriesData, type: ChartType): number[] {
  switch (type) {
    case 'v-t': return series.velocities;
    case 'a-t': return series.accelerations;
    case 'x-t': return series.displacements;
  }
}

// ═══════════════════════════════════════════════
// 图表绘制
// ═══════════════════════════════════════════════

function drawChart(
  ctx: CanvasRenderingContext2D,
  dpr: number,
  ox: number,
  oy: number,
  w: number,
  h: number,
  times: number[],
  values: number[],
  currentTime: number,
  totalDuration: number,
  lineColor: string,
  yLabel: string,
  emptyHint: string,
): void {
  ctx.save();
  ctx.scale(dpr, dpr);

  const plotLeft = ox + CHART_PAD.left;
  const plotTop = oy + CHART_PAD.top;
  const plotW = w - CHART_PAD.left - CHART_PAD.right;
  const plotH = h - CHART_PAD.top - CHART_PAD.bottom;

  // Y 轴标签（顶部水平显示）
  ctx.fillStyle = '#64748B';
  ctx.font = "11px 'Inter', sans-serif";
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(yLabel, plotLeft, oy + CHART_PAD.top - 6);

  // X 轴标签
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('t (s)', plotLeft + plotW / 2, oy + h - 12);

  if (times.length === 0) {
    ctx.fillStyle = '#94A3B8';
    ctx.font = "13px 'Inter', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emptyHint, ox + w / 2, oy + h / 2);
    ctx.restore();
    return;
  }

  // 数据范围
  const tMin = 0;
  const tMax = totalDuration > 0 ? totalDuration : (times[times.length - 1] ?? 1);

  // 过滤到当前时刻
  const filteredT: number[] = [];
  const filteredV: number[] = [];
  for (let i = 0; i < times.length; i++) {
    if (times[i]! <= currentTime + 1e-6) {
      filteredT.push(times[i]!);
      filteredV.push(values[i]!);
    }
  }

  // Y 范围（全量数据，保持稳定）
  let yMin = 0;
  let yMax = 0;
  for (const v of values) {
    if (v < yMin) yMin = v;
    if (v > yMax) yMax = v;
  }
  if (Math.abs(yMax - yMin) < 1e-6) {
    yMax += 1;
    yMin -= 1;
  }
  const yPad = (yMax - yMin) * 0.12;
  yMin -= yPad;
  yMax += yPad;

  const toX = (t: number) => plotLeft + ((t - tMin) / (tMax - tMin)) * plotW;
  const toY = (v: number) => plotTop + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  // 网格虚线
  ctx.setLineDash([2, 3]);
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 0.5;
  const yTicks = niceTicks(yMin, yMax, 4);
  for (const tick of yTicks) {
    const ty = toY(tick);
    if (ty >= plotTop - 1 && ty <= plotTop + plotH + 1) {
      ctx.beginPath();
      ctx.moveTo(plotLeft, ty);
      ctx.lineTo(plotLeft + plotW, ty);
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);

  // 零线（醒目）
  if (yMin < 0 && yMax > 0) {
    const zeroY = toY(0);
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotLeft, zeroY);
    ctx.lineTo(plotLeft + plotW, zeroY);
    ctx.stroke();

    // "0" 标注
    ctx.fillStyle = '#94A3B8';
    ctx.font = "10px 'Inter', sans-serif";
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('0', plotLeft - 4, zeroY);
  }

  // 坐标轴
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(plotLeft, plotTop);
  ctx.lineTo(plotLeft, plotTop + plotH);
  ctx.lineTo(plotLeft + plotW, plotTop + plotH);
  ctx.stroke();

  // Y 刻度
  ctx.fillStyle = '#94A3B8';
  ctx.font = "10px 'Inter', sans-serif";
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const tick of yTicks) {
    if (Math.abs(tick) < 1e-9) continue; // 零线已单独处理
    const ty = toY(tick);
    if (ty >= plotTop - 1 && ty <= plotTop + plotH + 1) {
      ctx.fillText(fmtTick(tick), plotLeft - 4, ty);
    }
  }

  // X 刻度
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const xTicks = niceTicks(tMin, tMax, 5);
  for (const tick of xTicks) {
    const tx = toX(tick);
    if (tx >= plotLeft - 1 && tx <= plotLeft + plotW + 1) {
      ctx.fillText(fmtTick(tick), tx, plotTop + plotH + 3);
    }
  }

  // 数据线
  if (filteredT.length >= 2) {
    ctx.beginPath();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.moveTo(toX(filteredT[0]!), toY(filteredV[0]!));
    for (let i = 1; i < filteredT.length; i++) {
      ctx.lineTo(toX(filteredT[i]!), toY(filteredV[i]!));
    }
    ctx.stroke();
  } else if (filteredT.length === 1) {
    ctx.beginPath();
    ctx.fillStyle = lineColor;
    ctx.arc(toX(filteredT[0]!), toY(filteredV[0]!), 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // 当前时刻标记
  if (filteredT.length > 0) {
    const ct = filteredT[filteredT.length - 1]!;
    const cv = filteredV[filteredV.length - 1]!;
    const cx = toX(ct);
    const cy = toY(cv);

    // 竖线
    ctx.strokeStyle = lineColor;
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(cx, plotTop);
    ctx.lineTo(cx, plotTop + plotH);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // 圆点
    ctx.beginPath();
    ctx.fillStyle = lineColor;
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 数值标注
    ctx.fillStyle = lineColor;
    ctx.font = "bold 11px 'Inter', sans-serif";
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(fmtTick(cv), cx + 8, cy - 4);
  }

  ctx.restore();
}

function niceTicks(min: number, max: number, count: number): number[] {
  const range = max - min;
  if (range <= 0) return [min];
  const rawStep = range / count;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const res = rawStep / mag;
  let step: number;
  if (res <= 1.5) step = mag;
  else if (res <= 3.5) step = 2 * mag;
  else if (res <= 7.5) step = 5 * mag;
  else step = 10 * mag;

  const ticks: number[] = [];
  const start = Math.ceil(min / step) * step;
  for (let t = start; t <= max + step * 0.01; t += step) {
    ticks.push(t);
  }
  return ticks;
}

function fmtTick(v: number): string {
  if (Math.abs(v) < 1e-9) return '0';
  if (Math.abs(v) >= 100) return v.toFixed(0);
  if (Math.abs(v) >= 1) return v.toFixed(1);
  return v.toFixed(2);
}

// ═══════════════════════════════════════════════
// React 组件
// ═══════════════════════════════════════════════

export function MotionCharts() {
  const viewport = useSimulationStore((s) => s.viewportState.primary);
  const currentTime = useSimulationStore((s) => s.simulationState.timeline.currentTime);
  const duration = useSimulationStore((s) => s.simulationState.timeline.duration);
  const status = useSimulationStore((s) => s.simulationState.status);

  const [activeCharts, setActiveCharts] = useState<ChartType[]>(['v-t']);
  const [dirLabel, setDirLabel] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const toggleChart = useCallback((type: ChartType) => {
    setActiveCharts((prev) => {
      if (prev.includes(type)) {
        // 至少保留一个
        if (prev.length <= 1) return prev;
        return prev.filter((t) => t !== type);
      }
      return [...prev, type];
    });
  }, []);

  // 重绘图表
  useEffect(() => {
    if (viewport !== 'motion') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const chartH = activeCharts.length === 1 ? 200 : activeCharts.length === 2 ? 160 : 130;
    const totalH = activeCharts.length * chartH;

    canvas.width = PANEL_W * dpr;
    canvas.height = totalH * dpr;
    canvas.style.width = `${PANEL_W}px`;
    canvas.style.height = `${totalH}px`;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 获取数据
    const history = simulator.getResultHistory();
    const currentResult = simulator.getCurrentResult();
    if (!currentResult) {
      // 绘制空图表
      activeCharts.forEach((type, i) => {
        const cfg = CHART_CONFIGS[type];
        drawChart(ctx, dpr, 0, i * chartH, PANEL_W, chartH,
          [], [], 0, duration, cfg.color, cfg.yLabel, cfg.emptyHint);
      });
      return;
    }

    // 找第一个运动实体
    const entityId = currentResult.motionStates.keys().next().value as EntityId | undefined;
    if (!entityId) return;

    const ref = computeRef(history, entityId);
    if (!ref) return;
    setDirLabel(ref.dirLabel);

    const series = extractSeries(history, entityId, ref);

    activeCharts.forEach((type, i) => {
      const cfg = CHART_CONFIGS[type];
      const vals = getValues(series, type);
      drawChart(ctx, dpr, 0, i * chartH, PANEL_W, chartH,
        series.times, vals, currentTime, duration,
        cfg.color, cfg.yLabel, cfg.emptyHint);
    });
  }, [viewport, currentTime, duration, status, activeCharts]);

  if (viewport !== 'motion') return null;

  return (
    <div
      className="absolute right-3 top-14 z-10 flex flex-col gap-2"
      style={{ width: PANEL_W }}
    >
      {/* 图表选择芯片 + 正方向说明 */}
      <div className="flex items-center gap-1">
        {(['v-t', 'a-t', 'x-t'] as ChartType[]).map((type) => {
          const active = activeCharts.includes(type);
          return (
            <button
              key={type}
              onClick={() => toggleChart(type)}
              className="rounded-md px-2.5 py-0.5 text-xs font-medium transition-colors"
              style={{
                backgroundColor: active ? CHART_CONFIGS[type].color : 'rgba(255,255,255,0.85)',
                color: active ? '#fff' : '#64748B',
                border: active ? 'none' : '1px solid #E2E8F0',
              }}
            >
              {type}
            </button>
          );
        })}
        {dirLabel && (
          <span className="ml-1 text-xs" style={{ color: '#94A3B8' }}>
            {dirLabel}
          </span>
        )}
      </div>

      {/* 图表画布 */}
      <div
        className="overflow-hidden rounded-lg"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.94)',
          border: '1px solid #E2E8F0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}
      >
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
