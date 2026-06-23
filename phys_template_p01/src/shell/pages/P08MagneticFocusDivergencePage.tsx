import { useEffect, useMemo, useState } from 'react';
import { Select } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { COLORS, SHADOWS } from '@/styles/tokens';
import { registerPageSnapshotAdapter } from '@/snapshotPageRegistry';
import {
  buildCircleFieldSymbolPositions,
  buildDivergenceGeometry,
  buildFocusingGeometry,
  computeOrbitRadius,
  pathFromPoints,
  samplePathPoint,
  toSvgPoint,
  type MagneticFieldDirection,
  type MagneticSharedParams,
} from './p08MagneticDiagramUtils';
import { AppLayout } from '@/shell/layout/AppLayout';
import { useP08SpecialPageNav } from '@/shell/hooks/useP08SpecialPageNav';

interface Props {
  onSelectPreset: (id: string) => void;
}

const PRESET_ID = 'P02-EMF033-magnetic-focusing';

const PAGE_WIDTH = 1340;
const PAGE_HEIGHT = 660;
const CARD_WIDTH = 600;
const CARD_HEIGHT = 520;
const CARD_PADDING = 24;
const DIAGRAM_RADIUS = 168;
const CARD_LEFT = { x: 44, y: 88 };
const CARD_RIGHT = { x: 696, y: 88 };
const SYMBOL_SPACING = 30;
const TRAJECTORY_COLORS = ['#DC2626', '#2563EB', '#D97706', '#0F766E', '#7C3AED', '#0891B2', '#BE185D', '#0EA5E9'];

export function P08MagneticFocusDivergencePage({ onSelectPreset }: Props) {
  const { tabs, handleSelectTab, moduleSelector } = useP08SpecialPageNav(PRESET_ID, onSelectPreset);
  const [fieldDirection, setFieldDirection] = useState<MagneticFieldDirection>('into');
  const [chargeSign, setChargeSign] = useState<1 | -1>(1);
  const [particleCount, setParticleCount] = useState(7);
  const [showFieldSymbols, setShowFieldSymbols] = useState(true);
  const [showCenters, setShowCenters] = useState(true);
  const [showFormula, setShowFormula] = useState(true);
  const [showAnimatedParticles, setShowAnimatedParticles] = useState(true);
  const [animationPhase, setAnimationPhase] = useState(0);

  useEffect(() => registerPageSnapshotAdapter('p08-magnetic-focus-divergence', {
    getSnapshot: () => ({
      fieldDirection,
      chargeSign,
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
        particleCount: number;
        showFieldSymbols: boolean;
        showCenters: boolean;
        showFormula: boolean;
        showAnimatedParticles: boolean;
      }>;
      if (value.fieldDirection) setFieldDirection(value.fieldDirection);
      if (value.chargeSign === 1 || value.chargeSign === -1) setChargeSign(value.chargeSign);
      if (typeof value.particleCount === 'number') setParticleCount(value.particleCount);
      if (typeof value.showFieldSymbols === 'boolean') setShowFieldSymbols(value.showFieldSymbols);
      if (typeof value.showCenters === 'boolean') setShowCenters(value.showCenters);
      if (typeof value.showFormula === 'boolean') setShowFormula(value.showFormula);
      if (typeof value.showAnimatedParticles === 'boolean') setShowAnimatedParticles(value.showAnimatedParticles);
      setAnimationPhase(0);
    },
  }), [
    chargeSign,
    fieldDirection,
    particleCount,
    showAnimatedParticles,
    showCenters,
    showFieldSymbols,
    showFormula,
  ]);

  useEffect(() => {
    let frameId = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const elapsed = (now - last) / 1000;
      last = now;
      setAnimationPhase((previous) => (previous + elapsed * 0.18) % 1);
      frameId = window.requestAnimationFrame(tick);
    };
    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  const magneticParams = useMemo<MagneticSharedParams>(() => ({
    fieldDirection,
    chargeSign,
    chargeMagnitude: 0.1,
    mass: 0.1,
    speed: 2.0,
    fieldMagnitude: 1.0,
  }), [chargeSign, fieldDirection]);

  const orbitRadiusPhysical = useMemo(() => computeOrbitRadius(magneticParams), [magneticParams]);
  const fieldRadius = DIAGRAM_RADIUS;

  const focusingGeometry = useMemo(
    () => buildFocusingGeometry({
      fieldRadius,
      particleCount,
      params: magneticParams,
      spreadRatio: 0.52,
      outsideLengthRatio: 0.86,
    }),
    [fieldRadius, magneticParams, particleCount],
  );

  const divergenceGeometry = useMemo(
    () => buildDivergenceGeometry({
      fieldRadius,
      particleCount,
      params: magneticParams,
      spreadRatio: 0.52,
      outsideLengthRatio: 0.86,
    }),
    [fieldRadius, magneticParams, particleCount],
  );

  const fieldSymbols = useMemo(
    () => buildCircleFieldSymbolPositions({ radius: fieldRadius, spacing: SYMBOL_SPACING }),
    [fieldRadius],
  );

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
              <SliderField label="粒子数量" value={particleCount} unit="条" min={4} max={10} step={1} onChange={(value) => setParticleCount(Math.round(value))} precision={0} />
            </div>
          </section>
          <section className="border-b p-4" style={{ borderColor: 'var(--theme-border)' }}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)', letterSpacing: '0.05em' }}>显示选项</h2>
            <div className="space-y-3">
              <ToggleRow label="显示磁场符号" checked={showFieldSymbols} onChange={setShowFieldSymbols} />
              <ToggleRow label="显示圆心" checked={showCenters} onChange={setShowCenters} />
              <ToggleRow label="显示公式" checked={showFormula} onChange={setShowFormula} />
              <ToggleRow label="显示动画粒子" checked={showAnimatedParticles} onChange={setShowAnimatedParticles} />
            </div>
          </section>
          <section className="p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)', letterSpacing: '0.05em' }}>几何约束</h2>
            <div className="space-y-2 text-sm" style={{ color: COLORS.textSecondary }}>
              <Metric label="参考半径 R" value={`${orbitRadiusPhysical.toFixed(3)} m`} />
              <Metric label="场区半径" value="固定与轨道半径一致" />
              <Metric label="画面重点" value="一点发散成平行 / 平行入射会聚一点" />
            </div>
          </section>
        </div>
      }
    >
      <div className="flex-1 overflow-auto p-5">
        <section className="rounded-[28px] border p-5" style={{ borderColor: COLORS.border, backgroundColor: COLORS.bg, boxShadow: SHADOWS.md }}>
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold" style={{ color: COLORS.text }}>
                磁聚焦和磁发散
              </h2>
              <p className="mt-1 text-sm leading-6" style={{ color: COLORS.textSecondary }}>
                左侧固定展示"一点发散成平行"，右侧固定展示"平行入射，会聚于一点"。为了保证课堂图形清楚，本页直接把"回旋半径 = 场区半径"作为约束，不再展示额外参数。
              </p>
            </div>
            {showFormula && (
              <div
                className="rounded-2xl px-4 py-3 text-sm font-semibold"
                style={{
                  color: '#7C2D12',
                  backgroundColor: '#FFF7ED',
                  border: '1px solid #FED7AA',
                }}
              >
                R轨 = R场
              </div>
            )}
          </div>

          <svg
            viewBox={`0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}`}
            className="h-auto w-full rounded-[24px]"
            style={{ background: 'linear-gradient(180deg, #FCFBFF 0%, #FFFFFF 100%)' }}
          >
            <defs>
              <marker id="focus-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 z" fill="#475569" />
              </marker>
            </defs>

            <DiagramCardFrame x={CARD_LEFT.x} y={CARD_LEFT.y} title="磁发散" subtitle="一点发散成平行" />
            <DiagramCardFrame x={CARD_RIGHT.x} y={CARD_RIGHT.y} title="磁聚焦" subtitle="平行入射，会聚于一点" />

            <DivergenceDiagram
              origin={CARD_LEFT}
              geometry={divergenceGeometry}
              fieldDirection={fieldDirection}
              fieldSymbols={fieldSymbols}
              showFieldSymbols={showFieldSymbols}
              showCenters={showCenters}
              showAnimatedParticles={showAnimatedParticles}
              animationPhase={animationPhase}
            />

            <FocusingDiagram
              origin={CARD_RIGHT}
              geometry={focusingGeometry}
              fieldDirection={fieldDirection}
              fieldSymbols={fieldSymbols}
              showFieldSymbols={showFieldSymbols}
              showCenters={showCenters}
              showAnimatedParticles={showAnimatedParticles}
              animationPhase={animationPhase}
            />
          </svg>
        </section>
      </div>
    </AppLayout>
  );
}

function DiagramCardFrame({
  x,
  y,
  title,
  subtitle,
}: {
  x: number;
  y: number;
  title: string;
  subtitle: string;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={CARD_WIDTH}
        height={CARD_HEIGHT}
        rx="28"
        fill="#FFFFFF"
        stroke="#E5E7EB"
        strokeWidth="1.5"
      />
      <text x={x + CARD_PADDING} y={y + 30} fontSize="18" fontWeight="700" fill={COLORS.text}>
        {title}
      </text>
      <text x={x + CARD_PADDING} y={y + 54} fontSize="13" fill={COLORS.textSecondary}>
        {subtitle}
      </text>
    </g>
  );
}

function FocusingDiagram({
  origin,
  geometry,
  fieldDirection,
  fieldSymbols,
  showFieldSymbols,
  showCenters,
  showAnimatedParticles,
  animationPhase,
}: {
  origin: { x: number; y: number };
  geometry: ReturnType<typeof buildFocusingGeometry>;
  fieldDirection: MagneticFieldDirection;
  fieldSymbols: Array<{ x: number; y: number }>;
  showFieldSymbols: boolean;
  showCenters: boolean;
  showAnimatedParticles: boolean;
  animationPhase: number;
}) {
  const circleCenter = { x: origin.x + (CARD_WIDTH * 0.50), y: origin.y + (CARD_HEIGHT * 0.54) };
  return (
    <g>
      <circle
        cx={circleCenter.x}
        cy={circleCenter.y}
        r={geometry.fieldRadius}
        fill="rgba(155, 89, 182, 0.07)"
        stroke="#B794F4"
        strokeWidth="1.6"
      />

      {showFieldSymbols && fieldSymbols.map((point, index) => {
        const svgPoint = toSvgPoint(circleCenter, point);
        return (
          <FieldSymbol
            key={`focus-${index}`}
            x={svgPoint.x}
            y={svgPoint.y}
            direction={fieldDirection}
          />
        );
      })}

      {geometry.trajectories.map((trajectory, index) => {
        const color = TRAJECTORY_COLORS[index % TRAJECTORY_COLORS.length]!;
        const incomingStart = toSvgPoint(circleCenter, trajectory.incomingStart);
        const entry = toSvgPoint(circleCenter, trajectory.entry);
        const arcPoints = trajectory.arcPoints.map((point) => toSvgPoint(circleCenter, point));
        const exit = toSvgPoint(circleCenter, trajectory.exit);
        const focusPoint = toSvgPoint(circleCenter, geometry.focusPoint);
        const fullTrack = [incomingStart, ...arcPoints.slice(1, -1), exit, focusPoint];
        const movingPoint = samplePathPoint(
          fullTrack,
          (animationPhase + (index / Math.max(geometry.trajectories.length, 1))) % 1,
        );

        return (
          <g key={`focus-track-${index}`}>
            <line x1={incomingStart.x} y1={incomingStart.y} x2={entry.x} y2={entry.y} stroke={color} strokeWidth="2.8" markerEnd="url(#focus-arrow)" />
            <path d={pathFromPoints(arcPoints)} fill="none" stroke={color} strokeWidth="3.4" markerEnd="url(#focus-arrow)" />
            <line x1={exit.x} y1={exit.y} x2={focusPoint.x} y2={focusPoint.y} stroke={color} strokeWidth="2.8" markerEnd="url(#focus-arrow)" />
            {showAnimatedParticles && (
              <circle cx={movingPoint.x} cy={movingPoint.y} r="5.2" fill={color} stroke="#FFFFFF" strokeWidth="1.4" />
            )}
          </g>
        );
      })}

      <circle cx={toSvgPoint(circleCenter, geometry.focusPoint).x} cy={toSvgPoint(circleCenter, geometry.focusPoint).y} r="6" fill="#FFFFFF" stroke="#0F766E" strokeWidth="2" />
      <text x={toSvgPoint(circleCenter, geometry.focusPoint).x + 10} y={toSvgPoint(circleCenter, geometry.focusPoint).y - 10} fontSize="13" fontWeight="700" fill="#0F766E">
        F
      </text>

      {showCenters && geometry.trajectories.slice(0, 4).map((trajectory, index) => {
        const center = toSvgPoint(circleCenter, trajectory.center);
        return (
          <g key={`focus-center-${index}`}>
            <circle cx={center.x} cy={center.y} r="4.2" fill="#FFFFFF" stroke="#7C3AED" strokeWidth="1.6" />
            <text x={center.x + 8} y={center.y - 7} fontSize="11" fontWeight="600" fill="#7C3AED">O{index + 1}</text>
          </g>
        );
      })}

      <text x={origin.x + CARD_PADDING} y={origin.y + CARD_HEIGHT - 22} fontSize="12.5" fill="#475569">
        平行入射，会聚于一点
      </text>
    </g>
  );
}

function DivergenceDiagram({
  origin,
  geometry,
  fieldDirection,
  fieldSymbols,
  showFieldSymbols,
  showCenters,
  showAnimatedParticles,
  animationPhase,
}: {
  origin: { x: number; y: number };
  geometry: ReturnType<typeof buildDivergenceGeometry>;
  fieldDirection: MagneticFieldDirection;
  fieldSymbols: Array<{ x: number; y: number }>;
  showFieldSymbols: boolean;
  showCenters: boolean;
  showAnimatedParticles: boolean;
  animationPhase: number;
}) {
  const circleCenter = { x: origin.x + (CARD_WIDTH * 0.50), y: origin.y + (CARD_HEIGHT * 0.54) };
  const sourcePoint = toSvgPoint(circleCenter, geometry.sourcePoint);

  return (
    <g>
      <circle
        cx={circleCenter.x}
        cy={circleCenter.y}
        r={geometry.fieldRadius}
        fill="rgba(155, 89, 182, 0.07)"
        stroke="#B794F4"
        strokeWidth="1.6"
      />

      {showFieldSymbols && fieldSymbols.map((point, index) => {
        const svgPoint = toSvgPoint(circleCenter, point);
        return (
          <FieldSymbol
            key={`div-${index}`}
            x={svgPoint.x}
            y={svgPoint.y}
            direction={fieldDirection}
          />
        );
      })}

      {geometry.trajectories.map((trajectory, index) => {
        const color = TRAJECTORY_COLORS[index % TRAJECTORY_COLORS.length]!;
        const entry = toSvgPoint(circleCenter, trajectory.entry);
        const arcPoints = trajectory.arcPoints.map((point) => toSvgPoint(circleCenter, point));
        const exit = toSvgPoint(circleCenter, trajectory.exit);
        const outgoingEnd = toSvgPoint(circleCenter, trajectory.outgoingEnd);
        const fullTrack = [sourcePoint, entry, ...arcPoints.slice(1, -1), exit, outgoingEnd];
        const movingPoint = samplePathPoint(
          fullTrack,
          (animationPhase + (index / Math.max(geometry.trajectories.length, 1))) % 1,
        );

        return (
          <g key={`div-track-${index}`}>
            <line x1={sourcePoint.x} y1={sourcePoint.y} x2={entry.x} y2={entry.y} stroke={color} strokeWidth="2.8" markerEnd="url(#focus-arrow)" />
            <path d={pathFromPoints(arcPoints)} fill="none" stroke={color} strokeWidth="3.4" markerEnd="url(#focus-arrow)" />
            <line x1={exit.x} y1={exit.y} x2={outgoingEnd.x} y2={outgoingEnd.y} stroke={color} strokeWidth="2.8" markerEnd="url(#focus-arrow)" />
            {showAnimatedParticles && (
              <circle cx={movingPoint.x} cy={movingPoint.y} r="5.2" fill={color} stroke="#FFFFFF" strokeWidth="1.4" />
            )}
          </g>
        );
      })}

      <circle cx={sourcePoint.x} cy={sourcePoint.y} r="7" fill="#FDBA74" stroke="#EA580C" strokeWidth="2.2" />
      <text x={sourcePoint.x - 18} y={sourcePoint.y - 12} fontSize="13" fontWeight="700" fill="#9A3412">
        Source
      </text>

      {showCenters && geometry.trajectories.slice(0, 4).map((trajectory, index) => {
        const center = toSvgPoint(circleCenter, trajectory.center);
        return (
          <g key={`div-center-${index}`}>
            <circle cx={center.x} cy={center.y} r="4.2" fill="#FFFFFF" stroke="#7C3AED" strokeWidth="1.6" />
            <text x={center.x + 8} y={center.y - 7} fontSize="11" fontWeight="600" fill="#7C3AED">O{index + 1}</text>
          </g>
        );
      })}

      <text x={origin.x + CARD_PADDING} y={origin.y + CARD_HEIGHT - 22} fontSize="12.5" fill="#475569">
        一点发散成平行
      </text>
    </g>
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
    <g stroke="#9B59B6" strokeWidth="1.3">
      <line x1={x - 5} y1={y - 5} x2={x + 5} y2={y + 5} />
      <line x1={x + 5} y1={y - 5} x2={x - 5} y2={y + 5} />
    </g>
  ) : (
    <g fill="#9B59B6" stroke="#9B59B6" strokeWidth="1.1">
      <circle cx={x} cy={y} r="4.8" fill="none" />
      <circle cx={x} cy={y} r="1.6" />
    </g>
  );
}
