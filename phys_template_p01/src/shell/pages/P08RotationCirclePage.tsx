import { useEffect, useMemo, useState } from 'react';
import { Select } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { COLORS, SHADOWS } from '@/styles/tokens';
import { registerPageSnapshotAdapter } from '@/snapshotPageRegistry';
import {
  buildRectFieldSymbolPositions,
  buildRotationTrajectories,
  computeOrbitRadius,
  mapPhysicalRadiusToPixels,
  pathFromPoints,
  polarOffset,
  samplePathPoint,
  toSvgPoint,
  type MagneticFieldDirection,
  type MagneticSharedParams,
} from './p08MagneticDiagramUtils';

interface Props {
  onBack: () => void;
}

const SVG_WIDTH = 880;
const SVG_HEIGHT = 620;
const FIELD_MARGIN_X = 72;
const FIELD_MARGIN_Y = 78;
const FIELD_WIDTH = 736;
const FIELD_HEIGHT = 458;
const SOURCE_POINT = {
  x: FIELD_MARGIN_X + (FIELD_WIDTH * 0.5),
  y: FIELD_MARGIN_Y + (FIELD_HEIGHT * 0.5),
};
const FIELD_SYMBOL_SPACING = 74;
const TRAJECTORY_COLORS = [
  '#C2410C',
  '#2563EB',
  '#0F766E',
  '#B45309',
  '#374151',
  '#B45309',
  '#0369A1',
  '#166534',
  '#9A3412',
];
const FORMULA_TEXT = 'R = m v₀ / (|q| B)';
const FORMULA_NOTE = '同一 v₀、m、|q|、B 下，所有轨迹半径相同';

export function P08RotationCirclePage({ onBack }: Props) {
  const [fieldDirection, setFieldDirection] = useState<MagneticFieldDirection>('into');
  const [chargeSign, setChargeSign] = useState<1 | -1>(1);
  const [speed, setSpeed] = useState(2.2);
  const [fieldMagnitude, setFieldMagnitude] = useState(1.0);
  const [chargeMagnitude, setChargeMagnitude] = useState(0.1);
  const [mass, setMass] = useState(0.1);
  const [particleCount, setParticleCount] = useState(6);
  const [showFieldSymbols, setShowFieldSymbols] = useState(true);
  const [showCenters, setShowCenters] = useState(true);
  const [showFormula, setShowFormula] = useState(true);
  const [showAnimatedParticles, setShowAnimatedParticles] = useState(true);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [animationPhase, setAnimationPhase] = useState(0);

  useEffect(() => registerPageSnapshotAdapter('p08-rotation-circle', {
    getSnapshot: () => ({
      fieldDirection,
      chargeSign,
      speed,
      fieldMagnitude,
      chargeMagnitude,
      mass,
      particleCount,
      showFieldSymbols,
      showCenters,
      showFormula,
      showAnimatedParticles,
    }),
    loadSnapshot: (snapshot) => {
      const value = snapshot as Partial<{
        fieldDirection: MagneticFieldDirection;
        chargeSign: 1 | -1;
        speed: number;
        fieldMagnitude: number;
        chargeMagnitude: number;
        mass: number;
        particleCount: number;
        showFieldSymbols: boolean;
        showCenters: boolean;
        showFormula: boolean;
        showAnimatedParticles: boolean;
      }>;
      if (value.fieldDirection) setFieldDirection(value.fieldDirection);
      if (value.chargeSign === 1 || value.chargeSign === -1) setChargeSign(value.chargeSign);
      if (typeof value.speed === 'number') setSpeed(value.speed);
      if (typeof value.fieldMagnitude === 'number') setFieldMagnitude(value.fieldMagnitude);
      if (typeof value.chargeMagnitude === 'number') setChargeMagnitude(value.chargeMagnitude);
      if (typeof value.mass === 'number') setMass(value.mass);
      if (typeof value.particleCount === 'number') setParticleCount(value.particleCount);
      if (typeof value.showFieldSymbols === 'boolean') setShowFieldSymbols(value.showFieldSymbols);
      if (typeof value.showCenters === 'boolean') setShowCenters(value.showCenters);
      if (typeof value.showFormula === 'boolean') setShowFormula(value.showFormula);
      if (typeof value.showAnimatedParticles === 'boolean') setShowAnimatedParticles(value.showAnimatedParticles);
      setHoveredIndex(null);
      setAnimationPhase(0);
    },
  }), [
    chargeMagnitude,
    chargeSign,
    fieldDirection,
    fieldMagnitude,
    mass,
    particleCount,
    showAnimatedParticles,
    showCenters,
    showFieldSymbols,
    showFormula,
    speed,
  ]);

  useEffect(() => {
    let frameId = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const elapsed = (now - last) / 1000;
      last = now;
      setAnimationPhase((previous) => (previous + elapsed * 0.115) % 1);
      frameId = window.requestAnimationFrame(tick);
    };
    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  const magneticParams = useMemo<MagneticSharedParams>(() => ({
    fieldDirection,
    chargeSign,
    chargeMagnitude,
    mass,
    speed,
    fieldMagnitude,
  }), [chargeMagnitude, chargeSign, fieldDirection, fieldMagnitude, mass, speed]);

  const orbitRadiusPhysical = useMemo(
    () => computeOrbitRadius(magneticParams),
    [magneticParams],
  );

  const orbitRadiusPx = useMemo(
    () => mapPhysicalRadiusToPixels(orbitRadiusPhysical, 54, 108),
    [orbitRadiusPhysical],
  );

  const trajectories = useMemo(
    () => buildRotationTrajectories({
      source: { x: 0, y: 0 },
      particleCount,
      orbitRadius: orbitRadiusPx,
      params: magneticParams,
      arcSpanRad: Math.PI * 2,
      arcSpanVarianceRad: 0,
      launchAngleStartDeg: 0,
      launchAngleEndDeg: 360,
    }),
    [magneticParams, orbitRadiusPx, particleCount],
  );

  const fieldSymbols = useMemo(
    () => buildRectFieldSymbolPositions({
      width: FIELD_WIDTH,
      height: FIELD_HEIGHT,
      spacing: FIELD_SYMBOL_SPACING,
    }),
    [],
  );

  const highlightedIndex = hoveredIndex ?? 0;
  const highlighted = trajectories[highlightedIndex] ?? null;
  const rotationDirectionLabel = chargeSign * (fieldDirection === 'out' ? 1 : -1) > 0
    ? '顺时针'
    : '逆时针';
  const centerLabelIndices = useMemo(() => {
    return trajectories.map((_, index) => index).filter((index) => index < 3 || index === trajectories.length - 1);
  }, [particleCount, trajectories]);

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ backgroundColor: COLORS.bgPage }}>
      <aside
        className="flex w-[332px] shrink-0 flex-col overflow-y-auto border-r px-4 py-4"
        style={{ borderColor: COLORS.border, backgroundColor: COLORS.bg }}
      >
        <button
          onClick={onBack}
          className="mb-3 text-left text-xs transition-opacity hover:opacity-70"
          style={{ color: COLORS.textSecondary }}
        >
          ← 返回 P-08
        </button>

        <h1 className="text-lg font-semibold" style={{ color: COLORS.text }}>
          中心全向发射的完整旋转圆
        </h1>
        <p className="mt-2 text-sm leading-6" style={{ color: COLORS.textSecondary }}>
          所有粒子从画布中央同一点 P 向各个方向射入匀强磁场；不同发射方向只改变圆心位置，每条轨迹都显示为完整圆。
        </p>

        <section className="mt-5 rounded-3xl border p-4" style={{ borderColor: COLORS.border, boxShadow: SHADOWS.sm }}>
          <h2 className="text-sm font-semibold" style={{ color: COLORS.text }}>核心参数</h2>
          <div className="mt-4 space-y-4">
            <Field label="磁场方向">
              <Select
                value={fieldDirection}
                onChange={(event) => setFieldDirection(event.target.value === 'out' ? 'out' : 'into')}
                options={[
                  { value: 'into', label: '入屏 ×' },
                  { value: 'out', label: '出屏 ·' },
                ]}
              />
            </Field>
            <Field label="粒子电荷">
              <Select
                value={chargeSign > 0 ? 'positive' : 'negative'}
                onChange={(event) => setChargeSign(event.target.value === 'negative' ? -1 : 1)}
                options={[
                  { value: 'positive', label: '正电荷' },
                  { value: 'negative', label: '负电荷' },
                ]}
              />
            </Field>
            <SliderField label="初速度 v₀" value={speed} unit="m/s" min={0.8} max={4.8} step={0.1} onChange={setSpeed} />
            <SliderField label="磁感应强度 B" value={fieldMagnitude} unit="T" min={0.3} max={2.6} step={0.1} onChange={setFieldMagnitude} />
            <SliderField label="电荷量 |q|" value={chargeMagnitude} unit="C" min={0.02} max={0.2} step={0.01} onChange={setChargeMagnitude} precision={2} />
            <SliderField label="质量 m" value={mass} unit="kg" min={0.02} max={0.3} step={0.01} onChange={setMass} precision={2} />
            <SliderField label="粒子数量" value={particleCount} unit="个" min={4} max={12} step={1} onChange={(value) => setParticleCount(Math.round(value))} precision={0} />
          </div>
        </section>

        <section className="mt-4 rounded-3xl border p-4" style={{ borderColor: COLORS.border, boxShadow: SHADOWS.sm }}>
          <h2 className="text-sm font-semibold" style={{ color: COLORS.text }}>显示选项</h2>
          <div className="mt-4 space-y-3">
            <ToggleRow label="显示磁场符号" checked={showFieldSymbols} onChange={setShowFieldSymbols} />
            <ToggleRow label="显示轨道圆心" checked={showCenters} onChange={setShowCenters} />
            <ToggleRow label="显示公式" checked={showFormula} onChange={setShowFormula} />
            <ToggleRow label="显示动画粒子" checked={showAnimatedParticles} onChange={setShowAnimatedParticles} />
          </div>
        </section>

        <section className="mt-4 rounded-3xl border p-4" style={{ borderColor: COLORS.border, boxShadow: SHADOWS.sm }}>
          <h2 className="text-sm font-semibold" style={{ color: COLORS.text }}>结果解读</h2>
          <div className="mt-3 space-y-2 text-sm" style={{ color: COLORS.textSecondary }}>
            <Metric label="共同轨道半径 R" value={`${orbitRadiusPhysical.toFixed(3)} m`} />
            <Metric label="当前旋转方向" value={rotationDirectionLabel} />
            <Metric label="当前高亮轨迹" value={highlighted ? `${highlighted.launchAngleDeg.toFixed(0)}° 方向` : '—'} />
            <Metric label="趋势总结" value="v₀↑ 或 m↑ → R↑" />
            <Metric label="趋势总结" value="B↑ 或 |q|↑ → R↓" />
            <div className="mt-3 rounded-2xl px-3 py-3 text-[12px]" style={{ backgroundColor: COLORS.primaryLight, color: COLORS.textSecondary, lineHeight: 1.75 }}>
              不同发射方向只改变圆心位置，不改变半径大小。
            </div>
          </div>
        </section>
      </aside>

      <main className="min-w-0 flex-1 overflow-auto p-5">
        <section
          className="rounded-[30px] border p-5"
          style={{
            borderColor: COLORS.border,
            backgroundColor: COLORS.bg,
            boxShadow: SHADOWS.md,
          }}
        >
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold" style={{ color: COLORS.text }}>
                主图
              </h2>
              <p className="mt-1 text-sm leading-6" style={{ color: COLORS.textSecondary }}>
                粒子源固定在画布中央；共同速度大小决定共同半径，改变入射方向后只是圆心沿对应法线方向移动，因此形成一组完整的等半径圆。
              </p>
            </div>
            {showFormula && (
              <div
                className="rounded-xl px-4 py-3"
                style={{
                  color: '#7C2D12',
                  backgroundColor: '#FFFBEB',
                  border: '1px solid #FCD34D',
                  minWidth: 220,
                }}
              >
                <div className="text-sm font-semibold">{FORMULA_TEXT}</div>
                <div className="mt-1 text-[11px]" style={{ color: '#9A3412' }}>{FORMULA_NOTE}</div>
              </div>
            )}
          </div>

          <svg
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
            className="h-auto w-full rounded-[12px]"
            style={{ background: '#FFFFFF' }}
          >
            <defs>
              <marker id="rotation-arrow-small" markerWidth="6" markerHeight="6" refX="5.2" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 z" fill="#475569" />
              </marker>
              <radialGradient id="sourceGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(251,186,116,0.42)" />
                <stop offset="100%" stopColor="rgba(251,186,116,0)" />
              </radialGradient>
            </defs>

            <rect
              x={FIELD_MARGIN_X}
              y={FIELD_MARGIN_Y}
              width={FIELD_WIDTH}
              height={FIELD_HEIGHT}
              rx="8"
              fill="#FFFEFC"
              stroke="#CBD5E1"
              strokeWidth="1.1"
            />

            {showFieldSymbols && fieldSymbols.map((point, index) => (
              <FieldSymbol
                key={`${point.x}-${point.y}-${index}`}
                x={FIELD_MARGIN_X + point.x}
                y={FIELD_MARGIN_Y + point.y}
                direction={fieldDirection}
              />
            ))}

            {showCenters && (
              <g>
                {trajectories.map((trajectory, index) => {
                  const center = toSvgPoint(SOURCE_POINT, trajectory.center);
                  const active = index === highlightedIndex;
                  const labelOffset = polarOffset(18, trajectory.launchAngleDeg + 16);
                  const showLabel = centerLabelIndices.includes(index) || active;
                  return (
                    <g key={`center-${trajectory.launchAngleDeg}`} opacity={active ? 0.95 : 0.42}>
                      <circle cx={center.x} cy={center.y} r={active ? 4.2 : 3.2} fill="#FFFFFF" stroke="#64748B" strokeWidth={active ? 1.4 : 1} />
                      {showLabel && (
                        <text
                          x={center.x + labelOffset.x}
                          y={center.y - labelOffset.y}
                          fontSize={active ? 11 : 10}
                          fontWeight={active ? 700 : 600}
                          fill={active ? '#334155' : '#94A3B8'}
                        >
                          O{index + 1}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            )}

            {trajectories.map((trajectory, index) => {
              const color = TRAJECTORY_COLORS[index % TRAJECTORY_COLORS.length]!;
              const active = hoveredIndex == null ? index === highlightedIndex : index === hoveredIndex;
              const dimmed = hoveredIndex != null && !active;
              const svgPoints = trajectory.points.map((point) => toSvgPoint(SOURCE_POINT, point));
              const movingParticle = samplePathPoint(svgPoints, animationPhase);
              const arrowPoint = samplePathPoint(svgPoints, 0.54);
              const arrowNext = samplePathPoint(svgPoints, 0.62);
              return (
                <g
                  key={trajectory.launchAngleDeg}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  <path
                    d={pathFromPoints(svgPoints)}
                    fill="none"
                    stroke={color}
                    strokeWidth={active ? 3 : 2.4}
                    strokeLinecap="round"
                    opacity={dimmed ? 0.18 : active ? 0.95 : 0.8}
                  />
                  <line
                    x1={arrowPoint.x}
                    y1={arrowPoint.y}
                    x2={arrowNext.x}
                    y2={arrowNext.y}
                    stroke={color}
                    strokeWidth={active ? 2.2 : 1.6}
                    opacity={dimmed ? 0.14 : 0.82}
                    markerEnd="url(#rotation-arrow-small)"
                  />
                  {showAnimatedParticles && (
                    <circle
                      cx={movingParticle.x}
                      cy={movingParticle.y}
                      r={active ? 5.2 : 4.2}
                      fill={color}
                      opacity={dimmed ? 0.15 : 0.95}
                      stroke="#FFFFFF"
                      strokeWidth="1.2"
                    />
                  )}
                </g>
              );
            })}

            <circle cx={SOURCE_POINT.x} cy={SOURCE_POINT.y} r="26" fill="url(#sourceGlow)" />
            <circle cx={SOURCE_POINT.x} cy={SOURCE_POINT.y} r="6.8" fill="#111827" />
            <circle cx={SOURCE_POINT.x} cy={SOURCE_POINT.y} r="2.4" fill="#F59E0B" />
            <text x={SOURCE_POINT.x + 12} y={SOURCE_POINT.y - 12} fontSize="12" fontWeight="700" fill="#1F2937">
              粒子源 P
            </text>

            {highlighted && (
              <g>
                <text x={FIELD_MARGIN_X + 18} y={FIELD_MARGIN_Y - 16} fontSize="11.5" fill="#64748B">
                  高亮轨迹：{highlighted.launchAngleDeg.toFixed(0)}°，R = {orbitRadiusPhysical.toFixed(3)} m，{rotationDirectionLabel}
                </text>
              </g>
            )}

            <text x={FIELD_MARGIN_X + 18} y={SVG_HEIGHT - 28} fontSize="12.5" fill="#475569">
              同一 v₀、m、|q|、B 下，所有轨迹半径相同；不同发射方向只改变圆心位置，因此得到完整圆轨迹族。
            </text>
          </svg>
        </section>
      </main>
    </div>
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

function FieldSymbol({
  x,
  y,
  direction,
}: {
  x: number;
  y: number;
  direction: MagneticFieldDirection;
}) {
  return direction === 'into' ? (
    <g stroke="rgba(71, 85, 105, 0.34)" strokeWidth="1">
      <line x1={x - 3.6} y1={y - 3.6} x2={x + 3.6} y2={y + 3.6} />
      <line x1={x + 3.6} y1={y - 3.6} x2={x - 3.6} y2={y + 3.6} />
    </g>
  ) : (
    <g fill="rgba(71, 85, 105, 0.3)" stroke="rgba(71, 85, 105, 0.3)" strokeWidth="0.9">
      <circle cx={x} cy={y} r="3.2" fill="none" />
      <circle cx={x} cy={y} r="1" />
    </g>
  );
}
