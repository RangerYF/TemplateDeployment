import { useEffect, useMemo, useState } from 'react';
import { Select } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { COLORS, SHADOWS } from '@/styles/tokens';
import {
  buildRectFieldSymbolPositions,
  mapPhysicalRadiusToPixels,
  pathFromPoints,
  samplePathPoint,
  type MagneticFieldDirection,
} from './p08MagneticDiagramUtils';

interface Props {
  onBack: () => void;
}

interface ScalingTrack {
  radiusPhysical: number;
  radiusPx: number;
  center: { x: number; y: number };
  points: Array<{ x: number; y: number }>;
}

const SVG_WIDTH = 900;
const SVG_HEIGHT = 620;
const FIELD_MARGIN_X = 94;
const FIELD_MARGIN_Y = 72;
const FIELD_WIDTH = 712;
const FIELD_HEIGHT = 462;
const SOURCE_POINT = {
  x: FIELD_MARGIN_X + 142,
  y: FIELD_MARGIN_Y + FIELD_HEIGHT / 2,
};
const FIELD_SYMBOL_SPACING = 72;
const TRACK_COLORS = [
  '#C2410C',
  '#2563EB',
  '#0F766E',
  '#B45309',
  '#374151',
  '#0369A1',
  '#166534',
  '#9A3412',
];
const FORMULA_TEXT = 'R = m v / (|q| B)';
const FORMULA_NOTE = '同一点、同切线方向下，速度越大，轨道半径越大';

function buildScalingTracks(options: {
  fieldDirection: MagneticFieldDirection;
  chargeSign: 1 | -1;
  baseSpeed: number;
  speedSpread: number;
  chargeMagnitude: number;
  fieldMagnitude: number;
  mass: number;
  particleCount: number;
}): ScalingTrack[] {
  const {
    fieldDirection,
    chargeSign,
    baseSpeed,
    speedSpread,
    chargeMagnitude,
    fieldMagnitude,
    mass,
    particleCount,
  } = options;
  const count = Math.max(3, Math.round(particleCount));
  const minSpeed = Math.max(baseSpeed - speedSpread / 2, 0.15);
  const maxSpeed = Math.max(baseSpeed + speedSpread / 2, minSpeed);
  const signed = chargeSign * (fieldDirection === 'out' ? 1 : -1);

  return Array.from({ length: count }, (_, index) => {
    const t = count <= 1 ? 0 : index / (count - 1);
    const speed = minSpeed + (maxSpeed - minSpeed) * t;
    const radiusPhysical = (mass * speed) / Math.max(chargeMagnitude * fieldMagnitude, 1e-6);
    const radiusPx = mapPhysicalRadiusToPixels(radiusPhysical, 48, 156);
    const center = {
      x: SOURCE_POINT.x,
      y: SOURCE_POINT.y + (signed >= 0 ? -radiusPx : radiusPx),
    };
    const startAngle = Math.atan2(SOURCE_POINT.y - center.y, SOURCE_POINT.x - center.x);
    const direction = signed >= 0 ? -1 : 1;
    const endAngle = startAngle + direction * Math.PI * 1.08;
    const points = Array.from({ length: 64 }, (_, pointIndex) => {
      const ratio = pointIndex / 63;
      const angle = startAngle + (endAngle - startAngle) * ratio;
      return {
        x: center.x + Math.cos(angle) * radiusPx,
        y: center.y + Math.sin(angle) * radiusPx,
      };
    });
    return {
      radiusPhysical,
      radiusPx,
      center,
      points,
    };
  });
}

export function P08ScalingCirclePage({ onBack }: Props) {
  const [fieldDirection, setFieldDirection] = useState<MagneticFieldDirection>('into');
  const [chargeSign, setChargeSign] = useState<1 | -1>(1);
  const [baseSpeed, setBaseSpeed] = useState(2.1);
  const [speedSpread, setSpeedSpread] = useState(2.2);
  const [fieldMagnitude, setFieldMagnitude] = useState(1.0);
  const [chargeMagnitude, setChargeMagnitude] = useState(0.1);
  const [mass, setMass] = useState(0.1);
  const [particleCount, setParticleCount] = useState(5);
  const [showFieldSymbols, setShowFieldSymbols] = useState(true);
  const [showCenters, setShowCenters] = useState(true);
  const [showFormula, setShowFormula] = useState(true);
  const [showAnimatedParticles, setShowAnimatedParticles] = useState(true);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [animationPhase, setAnimationPhase] = useState(0);

  useEffect(() => {
    let frameId = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const elapsed = (now - last) / 1000;
      last = now;
      setAnimationPhase((previous) => (previous + elapsed * 0.13) % 1);
      frameId = window.requestAnimationFrame(tick);
    };
    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  const tracks = useMemo(
    () => buildScalingTracks({
      fieldDirection,
      chargeSign,
      baseSpeed,
      speedSpread,
      chargeMagnitude,
      fieldMagnitude,
      mass,
      particleCount,
    }),
    [baseSpeed, chargeMagnitude, chargeSign, fieldDirection, fieldMagnitude, mass, particleCount, speedSpread],
  );
  const fieldSymbols = useMemo(
    () => buildRectFieldSymbolPositions({
      width: FIELD_WIDTH,
      height: FIELD_HEIGHT,
      spacing: FIELD_SYMBOL_SPACING,
    }),
    [],
  );
  const radiusRange = tracks.length > 0
    ? `${Math.min(...tracks.map((track) => track.radiusPhysical)).toFixed(3)} ~ ${Math.max(...tracks.map((track) => track.radiusPhysical)).toFixed(3)} m`
    : '—';
  const highlightedIndex = hoveredIndex ?? (tracks.length > 0 ? tracks.length - 1 : 0);
  const highlighted = tracks[highlightedIndex] ?? null;

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ backgroundColor: COLORS.bgPage }}>
      <aside
        className="flex w-[336px] shrink-0 flex-col overflow-y-auto border-r px-4 py-4"
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
          放缩圆模型
        </h1>
        <p className="mt-2 text-sm leading-6" style={{ color: COLORS.textSecondary }}>
          同一点、同方向入射，只改变速度大小。所有轨迹保持同一入射切线方向，但圆半径按速度成比例放大或缩小。
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
            <SliderField label="基准速度" value={baseSpeed} unit="m/s" min={0.8} max={4} step={0.1} onChange={setBaseSpeed} />
            <SliderField label="速度跨度" value={speedSpread} unit="m/s" min={0.4} max={3} step={0.1} onChange={setSpeedSpread} />
            <SliderField label="磁感应强度 B" value={fieldMagnitude} unit="T" min={0.3} max={2.6} step={0.1} onChange={setFieldMagnitude} />
            <SliderField label="电荷量 |q|" value={chargeMagnitude} unit="C" min={0.02} max={0.2} step={0.01} onChange={setChargeMagnitude} precision={2} />
            <SliderField label="质量 m" value={mass} unit="kg" min={0.02} max={0.3} step={0.01} onChange={setMass} precision={2} />
            <SliderField label="粒子数量" value={particleCount} unit="个" min={3} max={8} step={1} onChange={(value) => setParticleCount(Math.round(value))} precision={0} />
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
            <Metric label="半径范围" value={radiusRange} />
            <Metric label="共同入射特点" value="同一点、同切线方向" />
            <Metric label="当前高亮轨迹" value={highlighted ? `R${highlightedIndex + 1} / ${highlighted.radiusPhysical.toFixed(3)} m` : '—'} />
            <Metric label="画面重点" value="速度越大，半径越大" />
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
                所有粒子从同一点射入，起始切线方向一致。区别只体现在速度和半径上，所以课堂上可以直接用外扩圆族讲几何关系。
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
              <marker id="scaling-arrow-small" markerWidth="6" markerHeight="6" refX="5.2" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 z" fill="#475569" />
              </marker>
              <radialGradient id="scaling-sourceGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(251,186,116,0.42)" />
                <stop offset="100%" stopColor="rgba(251,186,116,0)" />
              </radialGradient>
            </defs>

            <rect x={FIELD_MARGIN_X} y={FIELD_MARGIN_Y} width={FIELD_WIDTH} height={FIELD_HEIGHT} rx="10" fill="#FFFEFC" stroke="#CBD5E1" strokeWidth="1.1" />

            {showFieldSymbols && fieldSymbols.map((point, index) => (
              <FieldSymbol
                key={`${point.x}-${point.y}-${index}`}
                x={FIELD_MARGIN_X + point.x}
                y={FIELD_MARGIN_Y + point.y}
                direction={fieldDirection}
              />
            ))}

            {tracks.map((track, index) => {
              const color = TRACK_COLORS[index % TRACK_COLORS.length]!;
              const active = index === highlightedIndex;
              const movingPoint = samplePathPoint(track.points, (animationPhase + index * 0.08) % 1);
              const arrowPoint = samplePathPoint(track.points, 0.52);
              const arrowNext = samplePathPoint(track.points, 0.60);
              return (
                <g
                  key={`scale-track-${index}`}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  <path
                    d={pathFromPoints(track.points)}
                    fill="none"
                    stroke={color}
                    strokeWidth={active ? 3 : 2.4}
                    strokeLinecap="round"
                    opacity={active ? 0.95 : 0.8}
                  />
                  <line
                    x1={arrowPoint.x}
                    y1={arrowPoint.y}
                    x2={arrowNext.x}
                    y2={arrowNext.y}
                    stroke={color}
                    strokeWidth={active ? 2.2 : 1.6}
                    opacity={active ? 0.82 : 0.68}
                    markerEnd="url(#scaling-arrow-small)"
                  />
                  {showAnimatedParticles && (
                    <circle
                      cx={movingPoint.x}
                      cy={movingPoint.y}
                      r={active ? 5.2 : 4.2}
                      fill={color}
                      stroke="#FFFFFF"
                      strokeWidth="1.3"
                    />
                  )}
                  {showCenters && (
                    <g opacity="0.54">
                      <circle cx={track.center.x} cy={track.center.y} r="4" fill="#FFFFFF" stroke="#64748B" strokeWidth="1.3" />
                      <text x={track.center.x + 8} y={track.center.y - 6} fontSize="10.5" fontWeight="600" fill="#64748B">
                        O{index + 1}
                      </text>
                    </g>
                  )}
                  <text x={track.points[Math.min(track.points.length - 1, 18)]!.x + 6} y={track.points[Math.min(track.points.length - 1, 18)]!.y - 8} fontSize="11" fill={color}>
                    R{index + 1}
                  </text>
                </g>
              );
            })}

            <circle cx={SOURCE_POINT.x} cy={SOURCE_POINT.y} r="26" fill="url(#scaling-sourceGlow)" />
            <circle cx={SOURCE_POINT.x} cy={SOURCE_POINT.y} r="6.6" fill="#111827" />
            <text x={SOURCE_POINT.x + 12} y={SOURCE_POINT.y - 10} fontSize="12" fontWeight="700" fill="#1F2937">
              同一点 P
            </text>
            <line x1={SOURCE_POINT.x - 56} y1={SOURCE_POINT.y} x2={SOURCE_POINT.x + 18} y2={SOURCE_POINT.y} stroke="#64748B" strokeWidth="1.8" strokeDasharray="6 4" />
            <text x={SOURCE_POINT.x - 60} y={SOURCE_POINT.y - 10} fontSize="11.5" fill="#64748B" textAnchor="end">
              共同入射切线方向
            </text>

            <text x={FIELD_MARGIN_X + 18} y={SVG_HEIGHT - 34} fontSize="12.5" fill="#475569">
              课堂结论：入射点和方向保持不变时，轨迹圆只按半径放缩；半径大小由速度决定，速度越大，圆越“外扩”。
            </text>
            {highlighted && (
              <text x={FIELD_MARGIN_X + 18} y={FIELD_MARGIN_Y - 16} fontSize="11.5" fill="#64748B">
                高亮轨迹：R{highlightedIndex + 1}，半径 = {highlighted.radiusPhysical.toFixed(3)} m
              </text>
            )}
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
