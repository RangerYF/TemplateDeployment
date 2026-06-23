import { useEffect, useMemo, useState } from 'react';
import { Select } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { COLORS, SHADOWS } from '@/styles/tokens';
import { registerPageSnapshotAdapter } from '@/snapshotPageRegistry';
import { AppLayout } from '@/shell/layout/AppLayout';
import { useP08SpecialPageNav } from '@/shell/hooks/useP08SpecialPageNav';

interface Props {
  onSelectPreset: (id: string) => void;
}

const PRESET_ID = 'P02-EMF011-efield-acceleration';

interface ParticleVisual {
  color: string;
  radius: number;
  divergence: number;
  bias: 1 | -1;
}

interface Point2D {
  x: number;
  y: number;
}

const SVG_WIDTH = 920;
const SVG_HEIGHT = 620;
const FIELD_X = 116;
const FIELD_Y = 88;
const FIELD_WIDTH = 688;
const FIELD_HEIGHT = 430;
const SOURCE_X = FIELD_X + 54;
const SOURCE_Y = FIELD_Y + FIELD_HEIGHT / 2;
const EXIT_X = FIELD_X + FIELD_WIDTH + 76;
const PARTICLE_COLORS = [
  '#355C7D',
  '#6C5B7B',
  '#3E6B61',
  '#C06C84',
  '#8C6F56',
  '#4F6D7A',
  '#7D8F69',
  '#7A5C61',
];

type FieldDirectionMode = 'upward-first' | 'downward-first';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(start: number, end: number, t: number): number {
  return start + ((end - start) * t);
}

function cubicBezierPoint(p0: Point2D, p1: Point2D, p2: Point2D, p3: Point2D, t: number): Point2D {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  const a = mt2 * mt;
  const b = 3 * mt2 * t;
  const c = 3 * mt * t2;
  const d = t2 * t;
  return {
    x: (p0.x * a) + (p1.x * b) + (p2.x * c) + (p3.x * d),
    y: (p0.y * a) + (p1.y * b) + (p2.y * c) + (p3.y * d),
  };
}

function buildPathFromPoints(points: Point2D[]): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  return `M ${first!.x.toFixed(2)} ${first!.y.toFixed(2)} ${rest.map((point) => `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ')}`;
}

function samplePolyline(points: Point2D[], progress: number): Point2D {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0]!;
  const clamped = clamp(progress, 0, 0.999999);
  const lengths: number[] = [];
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const prev = points[index - 1]!;
    const current = points[index]!;
    const length = Math.hypot(current.x - prev.x, current.y - prev.y);
    lengths.push(length);
    total += length;
  }
  const target = total * clamped;
  let traversed = 0;
  for (let index = 0; index < lengths.length; index += 1) {
    const segment = lengths[index]!;
    if (traversed + segment >= target) {
      const ratio = (target - traversed) / Math.max(segment, 1e-6);
      return {
        x: lerp(points[index]!.x, points[index + 1]!.x, ratio),
        y: lerp(points[index]!.y, points[index + 1]!.y, ratio),
      };
    }
    traversed += segment;
  }
  return points[points.length - 1]!;
}

function buildPlateArrow(
  x: number,
  y: number,
  direction: 'up' | 'down',
): string {
  const length = 18;
  const tipY = direction === 'up' ? y - length : y + length;
  const tailY = direction === 'up' ? y + length : y - length;
  return `M ${x} ${tailY} L ${x} ${tipY} M ${x - 5} ${tipY + (direction === 'up' ? 6 : -6)} L ${x} ${tipY} L ${x + 5} ${tipY + (direction === 'up' ? 6 : -6)}`;
}

function buildOscillationTrack(options: {
  source: Point2D;
  exitX: number;
  amplitudePx: number;
  frequency: number;
  polarity: 1 | -1;
  divergence: number;
}): Point2D[] {
  const { source, exitX, amplitudePx, frequency, polarity, divergence } = options;
  const span = exitX - source.x;
  const segments = Math.max(2, Math.round(frequency * 2));
  const points: Point2D[] = [{ ...source }];
  let start = { ...source };
  let direction = polarity;

  for (let index = 0; index < segments; index += 1) {
    const t0 = index / segments;
    const t1 = (index + 1) / segments;
    const x0 = source.x + span * t0;
    const x1 = source.x + span * t1;
    const yTarget = source.y + direction * amplitudePx * divergence;
    const end = index === segments - 1
      ? { x: x1, y: source.y + direction * amplitudePx * divergence * 0.46 }
      : { x: x1, y: yTarget };
    const cp1 = {
      x: x0 + (x1 - x0) * 0.34,
      y: start.y,
    };
    const cp2 = {
      x: x0 + (x1 - x0) * 0.72,
      y: end.y,
    };

    for (let sampleIndex = 1; sampleIndex <= 24; sampleIndex += 1) {
      points.push(cubicBezierPoint(start, cp1, cp2, end, sampleIndex / 24));
    }

    start = end;
    direction *= -1;
  }

  if (points[points.length - 1]!.x < exitX) {
    points.push({ x: exitX, y: points[points.length - 1]!.y });
  }

  return points;
}

function buildParticleSet(count: number): ParticleVisual[] {
  const safeCount = clamp(Math.round(count), 3, 8);
  const maxDivergence = 1;
  const minDivergence = 0.16;
  return Array.from({ length: safeCount }, (_, index) => {
    const t = safeCount === 1 ? 0 : index / (safeCount - 1);
    const divergence = lerp(maxDivergence, minDivergence, t);
    const paletteIndex = index % PARTICLE_COLORS.length;
    return {
      color: PARTICLE_COLORS[paletteIndex] ?? PARTICLE_COLORS[PARTICLE_COLORS.length - 1]!,
      radius: lerp(4.4, 3.8, t),
      divergence,
      bias: index % 2 === 0 ? 1 : -1,
    };
  });
}

export function P08ElectricOscillationPage({ onSelectPreset }: Props) {
  const { tabs, handleSelectTab, moduleSelector } = useP08SpecialPageNav(PRESET_ID, onSelectPreset);
  const [particleCount, setParticleCount] = useState(7);
  const [speed, setSpeed] = useState(1.9);
  const [amplitude, setAmplitude] = useState(0.7);
  const [frequency, setFrequency] = useState(1.1);
  const [fieldDirectionMode, setFieldDirectionMode] = useState<FieldDirectionMode>('upward-first');
  const [showFieldArrows, setShowFieldArrows] = useState(false);
  const [showTrajectories, setShowTrajectories] = useState(true);
  const [showParticles, setShowParticles] = useState(true);
  const [showDirectionGuide, setShowDirectionGuide] = useState(true);
  const [animationPhase, setAnimationPhase] = useState(0);

  useEffect(() => registerPageSnapshotAdapter('p08-electric-oscillation', {
    getSnapshot: () => ({
      particleCount,
      speed,
      amplitude,
      frequency,
      fieldDirectionMode,
      showFieldArrows,
      showTrajectories,
      showParticles,
      showDirectionGuide,
    }),
    loadSnapshot: (snapshot) => {
      const value = snapshot as Partial<{
        particleCount: number;
        speed: number;
        amplitude: number;
        frequency: number;
        fieldDirectionMode: FieldDirectionMode;
        showFieldArrows: boolean;
        showTrajectories: boolean;
        showParticles: boolean;
        showDirectionGuide: boolean;
      }>;
      if (typeof value.particleCount === 'number') setParticleCount(value.particleCount);
      if (typeof value.speed === 'number') setSpeed(value.speed);
      if (typeof value.amplitude === 'number') setAmplitude(value.amplitude);
      if (typeof value.frequency === 'number') setFrequency(value.frequency);
      if (value.fieldDirectionMode) setFieldDirectionMode(value.fieldDirectionMode);
      if (typeof value.showFieldArrows === 'boolean') setShowFieldArrows(value.showFieldArrows);
      if (typeof value.showTrajectories === 'boolean') setShowTrajectories(value.showTrajectories);
      if (typeof value.showParticles === 'boolean') setShowParticles(value.showParticles);
      if (typeof value.showDirectionGuide === 'boolean') setShowDirectionGuide(value.showDirectionGuide);
      setAnimationPhase(0);
    },
  }), [
    amplitude,
    fieldDirectionMode,
    frequency,
    particleCount,
    showDirectionGuide,
    showFieldArrows,
    showParticles,
    showTrajectories,
    speed,
  ]);

  useEffect(() => {
    let frameId = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const elapsed = (now - last) / 1000;
      last = now;
      setAnimationPhase((previous) => (previous + elapsed * speed * 0.118) % 1);
      frameId = window.requestAnimationFrame(tick);
    };
    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [speed]);

  const activeParticles = useMemo(() => buildParticleSet(particleCount), [particleCount]);

  const amplitudePx = amplitude * 118;
  const cycleDirection = fieldDirectionMode === 'upward-first' ? '先向上偏，再向下偏' : '先向下偏，再向上偏';
  const polarity = fieldDirectionMode === 'upward-first' ? -1 : 1;
  const source = { x: SOURCE_X, y: SOURCE_Y };

  const tracks = useMemo(() => {
    return activeParticles.map((particle) => ({
      ...particle,
      points: buildOscillationTrack({
        source,
        exitX: EXIT_X,
        amplitudePx,
        frequency,
        polarity: particle.bias > 0 ? polarity : (polarity === 1 ? -1 : 1),
        divergence: particle.divergence,
      }),
    }));
  }, [activeParticles, amplitudePx, frequency, polarity]);

  return (
    <AppLayout
      title="P-08 电磁场模拟器"
      tabs={tabs}
      activeTabId={PRESET_ID}
      onSelectTab={handleSelectTab}
      moduleSelector={moduleSelector}
      pageStyle={{ background: COLORS.bgPage }}
      sidebar={
        <div className="flex h-full flex-col">
          <section className="border-b p-4" style={{ borderColor: 'var(--theme-border)' }}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)', letterSpacing: '0.05em' }}>核心参数</h2>
            <div className="space-y-4">
              <Field label="交变起始方向">
                <Select
                  value={fieldDirectionMode}
                  onChange={(event) => {
                    setFieldDirectionMode(event.target.value === 'downward-first' ? 'downward-first' : 'upward-first');
                  }}
                  options={[
                    { value: 'upward-first', label: '先向上偏' },
                    { value: 'downward-first', label: '先向下偏' },
                  ]}
                />
              </Field>
              <SliderField label="水平速度" value={speed} min={1} max={3.5} step={0.1} unit="格/s" onChange={setSpeed} />
              <SliderField label="最大往返振幅" value={amplitude} min={0.35} max={1.15} step={0.05} unit="板间比例" onChange={setAmplitude} precision={2} />
              <SliderField label="交变频率" value={frequency} min={0.6} max={1.8} step={0.1} unit="周期数" onChange={setFrequency} />
              <SliderField label="粒子数量" value={particleCount} min={3} max={8} step={1} unit="个" onChange={(value) => setParticleCount(Math.round(value))} precision={0} />
            </div>
          </section>
          <section className="border-b p-4" style={{ borderColor: 'var(--theme-border)' }}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)', letterSpacing: '0.05em' }}>显示选项</h2>
            <div className="space-y-3">
              <ToggleRow label="显示电场方向" checked={showFieldArrows} onChange={setShowFieldArrows} />
              <ToggleRow label="显示轨迹曲线" checked={showTrajectories} onChange={setShowTrajectories} />
              <ToggleRow label="显示运动粒子" checked={showParticles} onChange={setShowParticles} />
              <ToggleRow label="显示速度指引" checked={showDirectionGuide} onChange={setShowDirectionGuide} />
            </div>
          </section>
          <section className="p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)', letterSpacing: '0.05em' }}>结果解读</h2>
            <div className="space-y-2 text-sm" style={{ color: COLORS.textSecondary }}>
              <Metric label="共同起点" value="同一点 P 入射" />
              <Metric label="画面重点" value="水平匀速，竖直往返" />
              <Metric label="场方向节奏" value={cycleDirection} />
              <Metric label="适合讲解" value="同起点粒子在交变场中的分段偏转差异" />
            </div>
          </section>
        </div>
      }
    >
      <div className="flex-1 overflow-auto p-5">
        <section className="rounded-[30px] border p-5" style={{ borderColor: COLORS.border, backgroundColor: COLORS.bg, boxShadow: SHADOWS.md }}>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold" style={{ color: COLORS.text }}>
                主图
              </h2>
              <p className="mt-1 text-sm leading-6" style={{ color: COLORS.textSecondary }}>
                起点 P 唯一且固定；所有轨迹都先共线进入极板区域，然后在交变电场作用下逐段分叉，整体更接近教材中的技术插图画法。
              </p>
            </div>
            <div
              className="rounded-xl px-4 py-3"
              style={{
                color: '#7C2D12',
                backgroundColor: '#FFFBEB',
                border: '1px solid #FCD34D',
                minWidth: 240,
              }}
            >
              <div className="text-sm font-semibold">共起点，后分叉</div>
              <div className="mt-1 text-[11px]" style={{ color: '#9A3412' }}>先重合进入，再在板间形成不同偏转轨迹。</div>
            </div>
          </div>

          <svg
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
            className="h-auto w-full rounded-[12px]"
            style={{ background: '#FFFFFF' }}
          >
            <defs>
              <linearGradient id="plate-metal" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#CBD5E1" />
                <stop offset="50%" stopColor="#E2E8F0" />
                <stop offset="100%" stopColor="#94A3B8" />
              </linearGradient>
              <linearGradient id="field-band" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(14,165,233,0.07)" />
                <stop offset="50%" stopColor="rgba(255,255,255,0.02)" />
                <stop offset="100%" stopColor="rgba(249,115,22,0.07)" />
              </linearGradient>
              <marker id="osc-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 z" fill="#475569" />
              </marker>
            </defs>

            <rect x={FIELD_X} y={FIELD_Y} width={FIELD_WIDTH} height={FIELD_HEIGHT} rx="10" fill="#FFFEFC" stroke="#CBD5E1" strokeWidth="1.1" />
            <rect x={FIELD_X} y={FIELD_Y - 18} width={FIELD_WIDTH} height="18" rx="8" fill="url(#plate-metal)" />
            <rect x={FIELD_X} y={FIELD_Y + FIELD_HEIGHT} width={FIELD_WIDTH} height="18" rx="8" fill="url(#plate-metal)" />
            <rect x={FIELD_X} y={FIELD_Y} width={FIELD_WIDTH} height={FIELD_HEIGHT} rx="10" fill="url(#field-band)" />

            <line x1={SOURCE_X} y1={SOURCE_Y} x2={EXIT_X} y2={SOURCE_Y} stroke="#CBD5E1" strokeWidth="1.1" strokeDasharray="6 8" />
            <text x={EXIT_X - 4} y={SOURCE_Y - 14} fontSize="12" fill="#64748B" textAnchor="end">
              水平匀速直线运动
            </text>

            <circle cx={SOURCE_X} cy={SOURCE_Y} r="7" fill="#111827" />
            <circle cx={SOURCE_X} cy={SOURCE_Y} r="18" fill="rgba(245,158,11,0.14)" />
            {showFieldArrows && Array.from({ length: 6 }, (_, index) => {
              const x = FIELD_X + 78 + index * 90;
              const upward = (index % 2 === 0) === (fieldDirectionMode === 'upward-first');
              return (
                <g key={`field-arrow-${x}`}>
                  <path
                    d={buildPlateArrow(x, SOURCE_Y, upward ? 'up' : 'down')}
                    fill="none"
                    stroke={upward ? '#0EA5E9' : '#F97316'}
                    strokeWidth="2.1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              );
            })}

            <text x={FIELD_X + 14} y={FIELD_Y - 34} fontSize="13" fontWeight="700" fill="#0F172A">
              平行板交变电场
            </text>
            <text x={FIELD_X + 16} y={FIELD_Y + FIELD_HEIGHT + 46} fontSize="12.5" fill="#475569">
              {fieldDirectionMode === 'upward-first' ? 'E 先向上再向下交替' : 'E 先向下再向上交替'}
            </text>

            {tracks.map((track, index) => {
              const progress = Math.max(0, animationPhase - index * 0.045);
              const movingPoint = samplePolyline(track.points, progress);
              const nextPoint = samplePolyline(track.points, Math.min(progress + 0.028, 1));
              return (
                <g key={`particle-${index}`}>
                  {showTrajectories && (
                    <path
                      d={buildPathFromPoints(track.points)}
                      fill="none"
                      stroke={track.color}
                      strokeWidth={index === 0 ? 1.8 : 1.3}
                      opacity={0.82 - index * 0.055}
                      strokeLinecap="round"
                    />
                  )}
                  {showDirectionGuide && progress > 0.03 && (
                    <line
                      x1={movingPoint.x - 18}
                      y1={movingPoint.y}
                      x2={nextPoint.x}
                      y2={nextPoint.y}
                      stroke={track.color}
                      strokeWidth="1"
                      opacity={0.34}
                      markerEnd="url(#osc-arrow)"
                    />
                  )}
                  {showParticles && (
                    <circle
                      cx={movingPoint.x}
                      cy={movingPoint.y}
                      r={track.radius}
                      fill={track.color}
                      stroke="#FFFFFF"
                      strokeWidth="0.9"
                    />
                  )}
                </g>
              );
            })}

            <text x={FIELD_X + FIELD_WIDTH + 18} y={FIELD_Y + 18} fontSize="12" fill="#64748B">
              出板后仍保持水平前进
            </text>
            <text x="58" y={SVG_HEIGHT - 38} fontSize="12.5" fill="#475569">
              教学重点：所有粒子从同一点进入，前段先共线，随后在交变场中逐段分叉；更适合讲"同起点粒子束在板间的分层偏转"。
            </text>
          </svg>
        </section>
      </div>
    </AppLayout>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium" style={{ color: COLORS.textSecondary }}>{label}</div>
      {children}
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  precision = 1,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
  precision?: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span style={{ color: COLORS.textSecondary }}>{label}</span>
        <span style={{ color: COLORS.text }}>{value.toFixed(precision)} {unit}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([next]) => {
          if (next !== undefined) onChange(next);
        }}
      />
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm" style={{ color: COLORS.textSecondary }}>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span>{label}</span>
      <span className="text-right" style={{ color: COLORS.text, fontWeight: 600 }}>{value}</span>
    </div>
  );
}
