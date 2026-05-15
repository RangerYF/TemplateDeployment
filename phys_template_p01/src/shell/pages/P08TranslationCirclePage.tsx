import { useEffect, useMemo, useState } from 'react';
import { Select } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { COLORS, SHADOWS } from '@/styles/tokens';
import {
  buildRectFieldSymbolPositions,
  computeOrbitRadius,
  mapPhysicalRadiusToPixels,
  pathFromPoints,
  samplePathPoint,
  type MagneticFieldDirection,
  type MagneticSharedParams,
} from './p08MagneticDiagramUtils';

interface Props {
  onBack: () => void;
}

interface TranslationTrack {
  entry: { x: number; y: number };
  center: { x: number; y: number };
  points: Array<{ x: number; y: number }>;
}

const SVG_WIDTH = 900;
const SVG_HEIGHT = 620;
const FIELD_MARGIN_X = 94;
const FIELD_MARGIN_Y = 72;
const FIELD_WIDTH = 712;
const FIELD_HEIGHT = 462;
const ENTRY_LINE_X = FIELD_MARGIN_X + 62;
const TRACK_COLORS = ['#E85D04', '#2563EB', '#0F766E', '#C2410C', '#7C3AED', '#0891B2', '#B45309', '#166534'];

function buildTranslationTracks(options: {
  orbitRadius: number;
  particleCount: number;
  entrySpacing: number;
  params: MagneticSharedParams;
}): TranslationTrack[] {
  const { orbitRadius, particleCount, entrySpacing, params } = options;
  const count = Math.max(2, Math.round(particleCount));
  const centerY = FIELD_MARGIN_Y + FIELD_HEIGHT / 2;
  const totalSpan = entrySpacing * Math.max(count - 1, 1);
  const startY = centerY - totalSpan / 2;
  const signed = params.chargeSign * (params.fieldDirection === 'out' ? 1 : -1);
  const centerOffsetY = signed >= 0 ? -orbitRadius : orbitRadius;

  return Array.from({ length: count }, (_, index) => {
    const entryY = startY + index * entrySpacing;
    const entry = { x: ENTRY_LINE_X, y: entryY };
    const center = { x: entry.x, y: entry.y + centerOffsetY };
    const startAngle = Math.atan2(entry.y - center.y, entry.x - center.x);
    const direction = signed >= 0 ? -1 : 1;
    const endAngle = startAngle + direction * Math.PI * 1.12;
    const segments = 64;
    const points = Array.from({ length: segments + 1 }, (_, pointIndex) => {
      const t = pointIndex / segments;
      const angle = startAngle + (endAngle - startAngle) * t;
      return {
        x: center.x + Math.cos(angle) * orbitRadius,
        y: center.y + Math.sin(angle) * orbitRadius,
      };
    });
    return { entry, center, points };
  });
}

export function P08TranslationCirclePage({ onBack }: Props) {
  const [fieldDirection, setFieldDirection] = useState<MagneticFieldDirection>('into');
  const [chargeSign, setChargeSign] = useState<1 | -1>(1);
  const [speed, setSpeed] = useState(2);
  const [fieldMagnitude, setFieldMagnitude] = useState(1);
  const [chargeMagnitude, setChargeMagnitude] = useState(0.1);
  const [mass, setMass] = useState(0.1);
  const [particleCount, setParticleCount] = useState(6);
  const [entrySpacing, setEntrySpacing] = useState(58);
  const [showFieldSymbols, setShowFieldSymbols] = useState(true);
  const [showCenters, setShowCenters] = useState(true);
  const [showAnimatedParticles, setShowAnimatedParticles] = useState(true);
  const [animationPhase, setAnimationPhase] = useState(0);

  useEffect(() => {
    let frameId = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const elapsed = (now - last) / 1000;
      last = now;
      setAnimationPhase((previous) => (previous + elapsed * 0.14) % 1);
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
    () => mapPhysicalRadiusToPixels(orbitRadiusPhysical, 64, 142),
    [orbitRadiusPhysical],
  );
  const tracks = useMemo(
    () => buildTranslationTracks({
      orbitRadius: orbitRadiusPx,
      particleCount,
      entrySpacing,
      params: magneticParams,
    }),
    [entrySpacing, magneticParams, orbitRadiusPx, particleCount],
  );
  const fieldSymbols = useMemo(
    () => buildRectFieldSymbolPositions({
      width: FIELD_WIDTH,
      height: FIELD_HEIGHT,
      spacing: 72,
    }),
    [],
  );
  const directionLabel = chargeSign * (fieldDirection === 'out' ? 1 : -1) > 0 ? '顺时针偏转' : '逆时针偏转';

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
          平移圆模型
        </h1>
        <p className="mt-2 text-sm leading-6" style={{ color: COLORS.textSecondary }}>
          所有粒子统一从左侧竖直边界入射，速度大小一致，只有入射点上下平移。这样课堂上更容易直接看出“等半径、整体平移”的几何结构。
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
            <SliderField label="共同速度 v" value={speed} unit="m/s" min={0.8} max={4.8} step={0.1} onChange={setSpeed} />
            <SliderField label="磁感应强度 B" value={fieldMagnitude} unit="T" min={0.3} max={2.6} step={0.1} onChange={setFieldMagnitude} />
            <SliderField label="电荷量 |q|" value={chargeMagnitude} unit="C" min={0.02} max={0.2} step={0.01} onChange={setChargeMagnitude} precision={2} />
            <SliderField label="质量 m" value={mass} unit="kg" min={0.02} max={0.3} step={0.01} onChange={setMass} precision={2} />
            <SliderField label="粒子数量" value={particleCount} unit="个" min={3} max={8} step={1} onChange={(value) => setParticleCount(Math.round(value))} precision={0} />
            <SliderField label="入射点间距" value={entrySpacing} unit="px" min={42} max={78} step={2} onChange={setEntrySpacing} precision={0} />
          </div>
        </section>

        <section className="mt-4 rounded-3xl border p-4" style={{ borderColor: COLORS.border, boxShadow: SHADOWS.sm }}>
          <h2 className="text-sm font-semibold" style={{ color: COLORS.text }}>显示选项</h2>
          <div className="mt-4 space-y-3">
            <ToggleRow label="显示磁场符号" checked={showFieldSymbols} onChange={setShowFieldSymbols} />
            <ToggleRow label="显示轨道圆心" checked={showCenters} onChange={setShowCenters} />
            <ToggleRow label="显示动画粒子" checked={showAnimatedParticles} onChange={setShowAnimatedParticles} />
          </div>
        </section>

        <section className="mt-4 rounded-3xl border p-4" style={{ borderColor: COLORS.border, boxShadow: SHADOWS.sm }}>
          <h2 className="text-sm font-semibold" style={{ color: COLORS.text }}>结果解读</h2>
          <div className="mt-3 space-y-2 text-sm" style={{ color: COLORS.textSecondary }}>
            <Metric label="共同轨道半径 R" value={`${orbitRadiusPhysical.toFixed(3)} m`} />
            <Metric label="偏转方向" value={directionLabel} />
            <Metric label="画面重点" value="同半径，只平移不变形" />
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
                左侧统一入射边界保留下来，让“圆是平移过去的”这一点能被第一眼看出来。每条轨迹只改变入射高度，不改变半径。
              </p>
            </div>
            <div
              className="rounded-xl px-4 py-3"
              style={{
                color: '#7C2D12',
                backgroundColor: '#FFFBEB',
                border: '1px solid #FCD34D',
                minWidth: 220,
              }}
            >
              <div className="text-sm font-semibold">R = m v / (|q| B)</div>
              <div className="mt-1 text-[11px]" style={{ color: '#9A3412' }}>速度、质量、荷量和 B 相同，所以所有圆半径相同。</div>
            </div>
          </div>

          <svg
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
            className="h-auto w-full rounded-[12px]"
            style={{ background: '#FFFFFF' }}
          >
            <rect x={FIELD_MARGIN_X} y={FIELD_MARGIN_Y} width={FIELD_WIDTH} height={FIELD_HEIGHT} rx="10" fill="#FFFEFC" stroke="#CBD5E1" strokeWidth="1.1" />
            <line x1={ENTRY_LINE_X} y1={FIELD_MARGIN_Y - 28} x2={ENTRY_LINE_X} y2={FIELD_MARGIN_Y + FIELD_HEIGHT + 28} stroke="#64748B" strokeWidth="2.3" strokeDasharray="8 7" />
            <text x={ENTRY_LINE_X - 12} y={FIELD_MARGIN_Y - 38} fontSize="12" fontWeight="700" fill="#334155" textAnchor="end">
              统一入射边界
            </text>

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
              const movingPoint = samplePathPoint(track.points, (animationPhase + index * 0.09) % 1);
              return (
                <g key={`track-${index}`}>
                  <path
                    d={pathFromPoints(track.points)}
                    fill="none"
                    stroke={color}
                    strokeWidth="2.8"
                    strokeLinecap="round"
                    opacity={0.9}
                  />
                  <line x1={ENTRY_LINE_X - 42} y1={track.entry.y} x2={track.entry.x} y2={track.entry.y} stroke={color} strokeWidth="2.1" strokeDasharray="6 4" />
                  {showAnimatedParticles && (
                    <circle
                      cx={movingPoint.x}
                      cy={movingPoint.y}
                      r="5.2"
                      fill={color}
                      stroke="#FFFFFF"
                      strokeWidth="1.3"
                    />
                  )}
                  {showCenters && (
                    <g opacity="0.58">
                      <circle cx={track.center.x} cy={track.center.y} r="4" fill="#FFFFFF" stroke="#64748B" strokeWidth="1.3" />
                      <text x={track.center.x + 8} y={track.center.y - 6} fontSize="10.5" fontWeight="600" fill="#64748B">
                        O{index + 1}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            <text x={FIELD_MARGIN_X + 18} y={SVG_HEIGHT - 34} fontSize="12.5" fill="#475569">
              课堂结论：同速度、同荷质比、同磁场下，只要从同一竖直边界不同位置入射，就会形成一组彼此平移的等半径圆弧。
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
