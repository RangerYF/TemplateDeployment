import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MutableRefObject,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import type { Entity } from '@/core/types';
import { simulator } from '@/core/engine/simulator';
import { worldLengthToScreen, worldToScreen } from '@/renderer/coordinate';
import { useSimulationStore } from '@/store';
import { COLORS, RADIUS, SHADOWS } from '@/styles/tokens';
import {
  getStraightWireCurrentDirection,
  getStraightWireCurrentDirectionLabel,
} from '@/domains/em/logic/current-direction';
import {
  clampStraightWireReferenceRadius,
  computeStraightWireFieldAtRadius,
  getStraightWireFrontViewText,
  getStraightWireReferenceRadius,
  getStraightWireRightHandRuleText,
  getStraightWireRotationText,
  getStraightWireViewLabel,
  getStraightWireViewMode,
  getStraightWireVisualStrength,
  STRAIGHT_WIRE_REFERENCE_RADIUS,
  STRAIGHT_WIRE_REFERENCE_RADIUS_MAX,
  STRAIGHT_WIRE_REFERENCE_RADIUS_MIN,
  type StraightWireViewMode,
} from '@/domains/em/logic/straight-wire-teaching';

interface WireBFieldControlPanelProps {
  onBack: () => void;
  onValueChange: (key: string, value: number | boolean | string) => void;
}

interface WireBFieldCanvasOverlayProps {
  transformRef: MutableRefObject<{ scale: number; originX: number; originY: number }>;
}

const ACCENT = {
  primary: '#2DABF8',
  primaryDeep: '#0F7AD8',
  primarySoft: '#E9F6FF',
  primaryGlow: 'rgba(45, 171, 248, 0.22)',
  border: 'rgba(117, 148, 177, 0.22)',
  surface: 'rgba(255, 255, 255, 0.88)',
  surfaceStrong: 'rgba(255, 255, 255, 0.95)',
  panelBg: 'linear-gradient(180deg, rgba(248,252,255,0.98) 0%, rgba(255,255,255,0.96) 100%)',
  warm: '#FF8C57',
  warmSoft: '#FFF1E8',
  slate: '#20394F',
  muted: '#69829A',
  success: '#23A876',
} as const;

const PANEL_CARD_STYLE: CSSProperties = {
  border: `1px solid ${ACCENT.border}`,
  borderRadius: 24,
  background: ACCENT.panelBg,
  boxShadow: '0 18px 44px rgba(27, 56, 84, 0.08)',
  backdropFilter: 'blur(16px)',
};

const SNAPSHOT_CARD_STYLE: CSSProperties = {
  borderRadius: 18,
  border: `1px solid ${ACCENT.border}`,
  background: 'rgba(255,255,255,0.86)',
  boxShadow: '0 10px 24px rgba(30, 57, 82, 0.06)',
};

function findStraightWire(entities: Map<string, Entity>): Entity | undefined {
  return Array.from(entities.values()).find(
    (entity) =>
      entity.type === 'current-wire' &&
      ((entity.properties.wireShape as string | undefined) ?? 'straight') === 'straight',
  );
}

function getWireCenterWorld(entity: Entity): { x: number; y: number } {
  const width = (entity.properties.width as number) ?? 0.1;
  const height = (entity.properties.height as number) ?? (entity.properties.length as number) ?? 4;
  return {
    x: entity.transform.position.x + width / 2,
    y: entity.transform.position.y + height / 2,
  };
}

function formatCurrent(value: number): string {
  return `${value.toFixed(1)} A`;
}

function formatRadius(value: number): string {
  return `${value.toFixed(2)} m`;
}

function formatFieldValue(value: number): string {
  return `${value.toExponential(2)} T`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function syncStoreFromSimulatorScene(): void {
  const store = useSimulationStore.getState();
  const simState = simulator.getState();
  store.setParamValues({ ...simState.scene.paramValues });
}

function applyWireTeachingParam(key: string, value: number | boolean | string): void {
  simulator.updateParam(key, value);
  syncStoreFromSimulatorScene();
}

function useAnimatedNumber(target: number, durationMs = 220): number {
  const [displayValue, setDisplayValue] = useState(target);
  const valueRef = useRef(target);

  useEffect(() => {
    const startValue = valueRef.current;
    const startedAt = performance.now();
    let frameId = 0;

    function tick(now: number) {
      const progress = Math.min((now - startedAt) / durationMs, 1);
      const eased = 1 - ((1 - progress) ** 3);
      const nextValue = startValue + (target - startValue) * eased;
      valueRef.current = nextValue;
      setDisplayValue(nextValue);

      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [target, durationMs]);

  return displayValue;
}

function useAnimationClock(): number {
  const [now, setNow] = useState(() => performance.now());

  useEffect(() => {
    let frameId = 0;
    const tick = (next: number) => {
      setNow(next);
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, []);

  return now;
}

function PanelCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section style={{ ...PANEL_CARD_STYLE, padding: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', color: ACCENT.primaryDeep }}>
        {eyebrow}
      </div>
      <div style={{ marginTop: 8, fontSize: 19, fontWeight: 800, color: ACCENT.slate }}>
        {title}
      </div>
      {description && (
        <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.8, color: ACCENT.muted }}>
          {description}
        </div>
      )}
      <div style={{ marginTop: 16 }}>{children}</div>
    </section>
  );
}

function SnapshotPill({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        ...SNAPSHOT_CARD_STYLE,
        padding: '12px 14px',
        background: accent
          ? 'linear-gradient(180deg, rgba(233,246,255,0.98) 0%, rgba(255,255,255,0.94) 100%)'
          : SNAPSHOT_CARD_STYLE.background,
      }}
    >
      <div style={{ fontSize: 11, color: ACCENT.muted }}>{label}</div>
      <div
        style={{
          marginTop: 5,
          fontSize: 15,
          fontWeight: 800,
          color: accent ? ACCENT.primaryDeep : ACCENT.slate,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function SegmentedButton({
  active,
  label,
  detail,
  onClick,
}: {
  active: boolean;
  label: string;
  detail?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        minWidth: 0,
        padding: '12px 12px 11px',
        borderRadius: 18,
        border: active ? '1px solid rgba(45,171,248,0.32)' : '1px solid transparent',
        background: active
          ? 'linear-gradient(180deg, rgba(232,245,255,0.98) 0%, rgba(255,255,255,0.94) 100%)'
          : 'rgba(255,255,255,0.54)',
        boxShadow: active ? '0 12px 28px rgba(45,171,248,0.14)' : 'none',
        cursor: 'pointer',
        transition: 'all 0.18s ease',
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 800,
          color: active ? ACCENT.primaryDeep : ACCENT.slate,
        }}
      >
        {label}
      </div>
      {detail && (
        <div style={{ marginTop: 4, fontSize: 11, color: active ? ACCENT.primaryDeep : ACCENT.muted }}>
          {detail}
        </div>
      )}
    </button>
  );
}

function DirectionChip({
  active,
  label,
  hint,
  onClick,
}: {
  active: boolean;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        minWidth: 0,
        padding: '13px 14px',
        borderRadius: 18,
        border: active ? '1px solid rgba(255,140,87,0.35)' : `1px solid ${ACCENT.border}`,
        background: active
          ? 'linear-gradient(180deg, rgba(255,241,232,0.98) 0%, rgba(255,255,255,0.94) 100%)'
          : 'rgba(255,255,255,0.72)',
        boxShadow: active ? '0 12px 28px rgba(255,140,87,0.12)' : 'none',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'all 0.18s ease',
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 800, color: active ? ACCENT.warm : ACCENT.slate }}>
        {label}
      </div>
      <div style={{ marginTop: 4, fontSize: 11, lineHeight: 1.6, color: active ? '#B45A2F' : ACCENT.muted }}>
        {hint}
      </div>
    </button>
  );
}

function StrengthBar({
  progress,
  accent = 'cool',
}: {
  progress: number;
  accent?: 'cool' | 'warm';
}) {
  const gradient = accent === 'warm'
    ? 'linear-gradient(90deg, rgba(255,196,161,0.7) 0%, rgba(255,140,87,0.96) 100%)'
    : 'linear-gradient(90deg, rgba(149,220,255,0.72) 0%, rgba(45,171,248,0.96) 100%)';

  return (
    <div
      style={{
        height: 11,
        borderRadius: RADIUS.full,
        border: `1px solid ${ACCENT.border}`,
        background: 'rgba(239,245,249,0.88)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${Math.max(8, progress * 100)}%`,
          height: '100%',
          borderRadius: RADIUS.full,
          background: gradient,
          boxShadow: accent === 'warm'
            ? '0 0 18px rgba(255,140,87,0.24)'
            : '0 0 18px rgba(45,171,248,0.22)',
          transition: 'width 0.18s ease',
        }}
      />
    </div>
  );
}

function InfoRow({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <span style={{ fontSize: 12, color: ACCENT.muted }}>{label}</span>
      <span
        style={{
          fontSize: emphasis ? 14 : 12,
          fontWeight: emphasis ? 800 : 700,
          color: emphasis ? ACCENT.primaryDeep : ACCENT.slate,
          textAlign: 'right',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  accent = 'cool',
}: {
  label: string;
  value: string;
  accent?: 'cool' | 'warm' | 'neutral';
}) {
  const background = accent === 'warm'
    ? ACCENT.warmSoft
    : accent === 'cool'
      ? ACCENT.primarySoft
      : 'rgba(241,245,248,0.92)';
  const color = accent === 'warm'
    ? ACCENT.warm
    : accent === 'cool'
      ? ACCENT.primaryDeep
      : ACCENT.slate;

  return (
    <div
      style={{
        ...SNAPSHOT_CARD_STYLE,
        padding: '10px 12px',
        background,
      }}
    >
      <div style={{ fontSize: 11, color: ACCENT.muted }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 14, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function TeachingSlider({
  value,
  min,
  max,
  step,
  accent = 'cool',
  onValueChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  accent?: 'cool' | 'warm';
  onValueChange: (value: number) => void;
}) {
  const percentage = ((value - min) / (max - min)) * 100;
  const gradient = accent === 'warm'
    ? 'linear-gradient(90deg, rgba(255,205,180,0.9) 0%, rgba(255,140,87,1) 100%)'
    : 'linear-gradient(90deg, rgba(151,222,255,0.92) 0%, rgba(45,171,248,1) 100%)';
  const ringColor = accent === 'warm' ? 'rgba(255,140,87,0.18)' : 'rgba(45,171,248,0.18)';
  const thumbBorder = accent === 'warm' ? ACCENT.warm : ACCENT.primaryDeep;

  return (
    <div style={{ position: 'relative', height: 28 }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 9,
          height: 10,
          borderRadius: RADIUS.full,
          border: `1px solid ${ACCENT.border}`,
          background: 'rgba(239,245,249,0.92)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${percentage}%`,
            height: '100%',
            borderRadius: RADIUS.full,
            background: gradient,
            boxShadow: accent === 'warm'
              ? '0 0 18px rgba(255,140,87,0.24)'
              : '0 0 18px rgba(45,171,248,0.22)',
          }}
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onValueChange(Number(event.target.value))}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          cursor: 'pointer',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 2,
          left: `calc(${percentage}% - 12px)`,
          width: 24,
          height: 24,
          borderRadius: RADIUS.full,
          background: '#FFFFFF',
          border: `2px solid ${thumbBorder}`,
          boxShadow: `0 0 0 7px ${ringColor}, 0 8px 18px rgba(31, 57, 79, 0.12)`,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

function RuleIcon({ direction }: { direction: 'up' | 'down' }) {
  const counterclockwise = direction === 'up';
  const arrowPath = counterclockwise
    ? 'M10 18 A20 20 0 1 0 33 7'
    : 'M54 18 A20 20 0 1 1 31 7';
  const arrowTip = counterclockwise
    ? 'M33 7 L26 12 L35 14'
    : 'M31 7 L28 14 L37 12';

  return (
    <svg width="72" height="72" viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="wire-rule-arrow" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#88D4FF" />
          <stop offset="100%" stopColor="#2DABF8" />
        </linearGradient>
      </defs>
      <path
        d="M32 56 L32 14"
        stroke="rgba(255,140,87,0.95)"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d={direction === 'up' ? 'M32 10 L25 21 L39 21 Z' : 'M32 58 L25 47 L39 47 Z'}
        fill="rgba(255,140,87,0.95)"
      />
      <path
        d={arrowPath}
        fill="none"
        stroke="url(#wire-rule-arrow)"
        strokeWidth="4.6"
        strokeLinecap="round"
      />
      <path d={arrowTip} fill="none" stroke="#2DABF8" strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function WireBFieldControlPanel({
  onBack,
  onValueChange,
}: WireBFieldControlPanelProps) {
  const entities = useSimulationStore((s) => s.simulationState.scene.entities);
  const paramValues = useSimulationStore((s) => s.paramValues);
  const wire = findStraightWire(entities);
  const current = typeof paramValues.current === 'number'
    ? paramValues.current
    : Math.abs((wire?.properties.current as number) ?? 5);
  const direction = wire ? getStraightWireCurrentDirection(wire) : 'up';
  const viewMode = getStraightWireViewMode(paramValues);
  const referenceRadius = getStraightWireReferenceRadius(paramValues);
  const strength = getStraightWireVisualStrength(current);
  const referenceB = computeStraightWireFieldAtRadius(current, referenceRadius);
  const animatedB = useAnimatedNumber(referenceB, 220);

  return (
    <aside
      className="flex h-full flex-col overflow-y-auto"
      style={{
        width: 332,
        minWidth: 312,
        borderRight: `1px solid ${COLORS.border}`,
        background:
          'linear-gradient(180deg, rgba(245,250,255,0.98) 0%, rgba(255,255,255,0.96) 20%, rgba(248,251,253,0.98) 100%)',
      }}
    >
      <div
        style={{
          padding: '20px 18px 18px',
          borderBottom: `1px solid ${COLORS.border}`,
          background: 'linear-gradient(180deg, rgba(248,252,255,0.98) 0%, rgba(255,255,255,0.92) 100%)',
        }}
      >
        <button
          onClick={onBack}
          className="text-xs transition-colors hover:opacity-70"
          style={{ color: COLORS.textSecondary }}
        >
          ← 返回 P-08
        </button>
        <div style={{ marginTop: 12, fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', color: ACCENT.primaryDeep }}>
          P-08 · MAGNETIC LAB
        </div>
        <div style={{ marginTop: 8, fontSize: 28, fontWeight: 900, color: ACCENT.slate }}>
          长直导线磁场
        </div>
        <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.8, color: ACCENT.muted }}>
          保留示意图的清晰度，同时强化磁场强弱、右手定则和参考点 B 的教学反馈。
        </div>

        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          <SnapshotPill label="当前视图" value={getStraightWireViewLabel(viewMode)} accent />
          <SnapshotPill label="俯视环向" value={getStraightWireRotationText(direction)} />
          <SnapshotPill label="参考半径 r" value={formatRadius(referenceRadius)} />
          <SnapshotPill label="点 B 磁感应强度" value={formatFieldValue(animatedB)} />
        </div>
      </div>

      <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <PanelCard
          eyebrow="VIEW"
          title="视图切换"
          description="立体图、俯视图、正视图共享同一组参数与动效节奏，便于建立统一的方向感。"
        >
          <div
            style={{
              display: 'flex',
              gap: 8,
              padding: 6,
              borderRadius: 22,
              background: 'rgba(232,242,249,0.82)',
            }}
          >
            <SegmentedButton
              active={viewMode === 'isometric'}
              label="立体图"
              detail="空间感"
              onClick={() => onValueChange('wireViewMode', 'isometric')}
            />
            <SegmentedButton
              active={viewMode === 'top'}
              label="俯视图"
              detail="环向最直观"
              onClick={() => onValueChange('wireViewMode', 'top')}
            />
            <SegmentedButton
              active={viewMode === 'front'}
              label="正视图"
              detail="· / × 判定"
              onClick={() => onValueChange('wireViewMode', 'front')}
            />
          </div>
        </PanelCard>

        <PanelCard
          eyebrow="CURRENT"
          title="电流强度 I"
          description="增大 I 时，磁场线会更亮、更粗，并带有更明显的缓慢流动感。"
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 0.8fr',
              gap: 12,
              alignItems: 'stretch',
            }}
          >
            <div
              style={{
                ...SNAPSHOT_CARD_STYLE,
                padding: '14px 14px 12px',
                background: 'linear-gradient(180deg, rgba(233,246,255,0.98) 0%, rgba(255,255,255,0.94) 100%)',
              }}
            >
              <div style={{ fontSize: 11, color: ACCENT.muted }}>当前电流</div>
              <div style={{ marginTop: 6, fontSize: 24, fontWeight: 900, color: ACCENT.primaryDeep }}>
                {formatCurrent(current)}
              </div>
              <div style={{ marginTop: 6, fontSize: 11, color: ACCENT.muted }}>
                图形反馈与数值同步变化
              </div>
            </div>
            <MiniMetric
              label="磁场存在感"
              value={`${Math.round(strength.normalized * 100)}%`}
              accent="cool"
            />
          </div>

          <div style={{ marginTop: 14 }}>
            <TeachingSlider
              value={current}
              min={0.5}
              max={20}
              step={0.5}
              accent="cool"
              onValueChange={(next) => onValueChange('current', next)}
            />
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: ACCENT.muted }}>
              <span>0.5 A</span>
              <span>中等课堂演示</span>
              <span>20 A</span>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <StrengthBar progress={strength.normalized} />
          </div>
        </PanelCard>

        <PanelCard
          eyebrow="RULE"
          title="方向与右手定则"
          description="不要只记文字，先看图形旋转方向，再把拇指和四指对应起来。"
        >
          <div style={{ display: 'flex', gap: 10 }}>
            <DirectionChip
              active={direction === 'up'}
              label="电流向上"
              hint="俯视磁场逆时针"
              onClick={() => onValueChange('currentDirectionMode', 'up')}
            />
            <DirectionChip
              active={direction === 'down'}
              label="电流向下"
              hint="俯视磁场顺时针"
              onClick={() => onValueChange('currentDirectionMode', 'down')}
            />
          </div>

          <div
            style={{
              marginTop: 14,
              display: 'grid',
              gridTemplateColumns: '76px minmax(0, 1fr)',
              gap: 12,
              alignItems: 'center',
              padding: 14,
              borderRadius: 18,
              background: 'rgba(241,248,253,0.88)',
              border: `1px solid ${ACCENT.border}`,
            }}
          >
            <RuleIcon direction={direction} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: ACCENT.slate }}>右手定则提示</div>
              <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.8, color: ACCENT.muted }}>
                {getStraightWireRightHandRuleText(direction)}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            <MiniMetric label="俯视环向" value={getStraightWireRotationText(direction)} accent="cool" />
            <MiniMetric label="正视图判定" value={getStraightWireFrontViewText(direction)} accent="neutral" />
          </div>
        </PanelCard>

        <PanelCard
          eyebrow="POINT B"
          title="参考点 B 与半径 r"
          description="参考点 B 是当前读数的落点。调半径时，r 与 B 会实时联动。"
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            <MiniMetric label="当前半径" value={formatRadius(referenceRadius)} accent="cool" />
            <MiniMetric label="当前 B" value={formatFieldValue(animatedB)} accent="warm" />
          </div>

          <div style={{ marginTop: 14 }}>
            <TeachingSlider
              value={referenceRadius}
              min={STRAIGHT_WIRE_REFERENCE_RADIUS_MIN}
              max={STRAIGHT_WIRE_REFERENCE_RADIUS_MAX}
              step={0.05}
              accent="warm"
              onValueChange={(next) => onValueChange('wireReferenceRadius', Number(next.toFixed(2)))}
            />
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: ACCENT.muted }}>
              <span>{formatRadius(STRAIGHT_WIRE_REFERENCE_RADIUS_MIN)}</span>
              <span>默认 {formatRadius(STRAIGHT_WIRE_REFERENCE_RADIUS)}</span>
              <span>{formatRadius(STRAIGHT_WIRE_REFERENCE_RADIUS_MAX)}</span>
            </div>
          </div>

          <div
            style={{
              marginTop: 12,
              padding: '12px 14px',
              borderRadius: 16,
              background: 'rgba(255,241,232,0.72)',
              border: '1px solid rgba(255,140,87,0.16)',
              fontSize: 12,
              lineHeight: 1.8,
              color: '#B35A33',
            }}
          >
            画布中的 B 点支持直接拖动；滑块和拖动会同步更新同一组半径数据。
          </div>
        </PanelCard>
      </div>
    </aside>
  );
}

export function WireBFieldInfoPanel() {
  const entities = useSimulationStore((s) => s.simulationState.scene.entities);
  const paramValues = useSimulationStore((s) => s.paramValues);
  const wire = findStraightWire(entities);
  const current = Math.abs((wire?.properties.current as number) ?? 5);
  const direction = wire ? getStraightWireCurrentDirection(wire) : 'up';
  const viewMode = getStraightWireViewMode(paramValues);
  const referenceRadius = getStraightWireReferenceRadius(paramValues);
  const referenceB = computeStraightWireFieldAtRadius(current, referenceRadius);
  const animatedB = useAnimatedNumber(referenceB, 240);
  const strength = getStraightWireVisualStrength(current);

  return (
    <aside
      className="flex h-full flex-col overflow-y-auto"
      style={{
        width: 336,
        minWidth: 312,
        borderLeft: `1px solid ${COLORS.border}`,
        background:
          'linear-gradient(180deg, rgba(246,250,255,0.98) 0%, rgba(255,255,255,0.96) 18%, rgba(248,251,253,0.98) 100%)',
      }}
    >
      <div
        style={{
          padding: '20px 18px 18px',
          borderBottom: `1px solid ${COLORS.border}`,
          background: 'linear-gradient(180deg, rgba(248,252,255,0.98) 0%, rgba(255,255,255,0.92) 100%)',
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', color: ACCENT.primaryDeep }}>
          TEACHING INFO
        </div>
        <div style={{ marginTop: 8, fontSize: 24, fontWeight: 900, color: ACCENT.slate }}>
          教学信息
        </div>
        <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.8, color: ACCENT.muted }}>
          把公式、图像和方向判定压在同一侧，方便课堂讲解时快速对照。
        </div>
      </div>

      <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <PanelCard
          eyebrow="FORMULA"
          title="核心公式"
          description="长直导线周围磁场大小同时受电流 I 和距离 r 影响。"
        >
          <div
            style={{
              padding: '16px 16px 14px',
              borderRadius: 20,
              background: 'linear-gradient(180deg, rgba(233,246,255,0.98) 0%, rgba(255,255,255,0.94) 100%)',
              border: `1px solid ${ACCENT.border}`,
            }}
          >
            <div style={{ fontSize: 28, fontWeight: 900, color: ACCENT.slate }}>
              B = μ₀ I / (2πr)
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: ACCENT.muted }}>
              电流越大，磁场越强；离导线越远，磁场越弱。
            </div>
          </div>

          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
            <MiniMetric label="I" value={formatCurrent(current)} accent="cool" />
            <MiniMetric label="r" value={formatRadius(referenceRadius)} accent="neutral" />
            <MiniMetric label="B" value={formatFieldValue(animatedB)} accent="warm" />
          </div>
        </PanelCard>

        <PanelCard
          eyebrow="STATE"
          title="当前判定"
          description="无论怎么切换视图，方向关系始终保持一致。"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <InfoRow label="当前视图" value={getStraightWireViewLabel(viewMode)} emphasis />
            <InfoRow
              label="电流方向"
              value={getStraightWireCurrentDirectionLabel(wire ?? buildFallbackWire(direction))}
            />
            <InfoRow label="俯视磁场" value={getStraightWireRotationText(direction)} />
            <InfoRow label="正视图分布" value={getStraightWireFrontViewText(direction)} />
            <InfoRow label="右手定则" value={direction === 'up' ? '拇指向上' : '拇指向下'} />
          </div>
        </PanelCard>

        <PanelCard
          eyebrow="RELATION"
          title="变化趋势"
          description="拖动控制项时，先看图像变化，再回到公式理解因果关系。"
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            <MiniMetric label="I 增大" value="线更亮、更粗" accent="cool" />
            <MiniMetric label="r 增大" value="点 B 变弱" accent="warm" />
          </div>
          <div style={{ marginTop: 14 }}>
            <StrengthBar progress={strength.normalized} />
          </div>
          <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.8, color: ACCENT.muted }}>
            当前画面把电流对磁场的强化做成了连续视觉反馈，不再只是数字变化。
          </div>
        </PanelCard>

        <PanelCard
          eyebrow="TEACHING"
          title="讲解抓手"
          description="这部分保持信息密度高，但仍然尽量可扫读。"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 16,
                background: 'rgba(241,248,253,0.9)',
                border: `1px solid ${ACCENT.border}`,
                fontSize: 12,
                lineHeight: 1.8,
                color: ACCENT.muted,
              }}
            >
              1. 先看导线方向箭头，再看环绕箭头或 · / × 的分布。
            </div>
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 16,
                background: 'rgba(241,248,253,0.9)',
                border: `1px solid ${ACCENT.border}`,
                fontSize: 12,
                lineHeight: 1.8,
                color: ACCENT.muted,
              }}
            >
              2. 拖动 B 点改变半径，让学生直接看到 r 增大时 B 如何减小。
            </div>
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 16,
                background: 'rgba(241,248,253,0.9)',
                border: `1px solid ${ACCENT.border}`,
                fontSize: 12,
                lineHeight: 1.8,
                color: ACCENT.muted,
              }}
            >
              3. 切到正视图时，用图例解释 · 表示出屏、× 表示入屏。
              再提醒学生：越靠近导线越强，但方向判定先看左右分区。
            </div>
          </div>
        </PanelCard>
      </div>
    </aside>
  );
}

interface OverlayGeometry {
  center: { x: number; y: number };
  marker: { x: number; y: number };
  card: { x: number; y: number };
  connector: { x: number; y: number };
  radiusPx: number;
  visible: boolean;
}

function getReferenceBasis(viewMode: StraightWireViewMode): { x: number; y: number } {
  if (viewMode === 'isometric') {
    const length = Math.hypot(0.96, -0.22);
    return { x: 0.96 / length, y: -0.22 / length };
  }
  return { x: 1, y: 0 };
}

function getWireOverlayGeometry(
  wire: Entity | undefined,
  transform: { scale: number; originX: number; originY: number },
  viewMode: StraightWireViewMode,
  referenceRadius: number,
  stageWidth: number,
  stageHeight: number,
): OverlayGeometry | null {
  if (!wire || stageWidth <= 0 || stageHeight <= 0) return null;

  const center = worldToScreen(getWireCenterWorld(wire), {
    scale: transform.scale,
    origin: { x: transform.originX, y: transform.originY },
  });
  const radiusPx = worldLengthToScreen(referenceRadius, {
    scale: transform.scale,
    origin: { x: transform.originX, y: transform.originY },
  });
  const basis = getReferenceBasis(viewMode);
  const marker = {
    x: center.x + basis.x * radiusPx,
    y: center.y + basis.y * radiusPx,
  };

  const cardWidth = 286;
  const cardHeight = 136;
  const cardX = clamp(marker.x + 26, 18, Math.max(18, stageWidth - cardWidth - 18));
  const cardY = clamp(
    marker.y + (viewMode === 'isometric' ? -18 : 18),
    84,
    Math.max(84, stageHeight - cardHeight - 18),
  );
  const connector = {
    x: cardX,
    y: cardY + 38,
  };

  return {
    center,
    marker,
    card: { x: cardX, y: cardY },
    connector,
    radiusPx,
    visible:
      center.x > -240 &&
      center.x < stageWidth + 240 &&
      center.y > -240 &&
      center.y < stageHeight + 240,
  };
}

function FrontLegendCard() {
  return (
    <div
      style={{
        position: 'absolute',
        left: 18,
        bottom: 18,
        zIndex: 31,
        pointerEvents: 'none',
        width: 198,
        padding: '12px 14px',
        borderRadius: 18,
        border: `1px solid ${ACCENT.border}`,
        background: 'rgba(255,255,255,0.92)',
        boxShadow: SHADOWS.md,
        backdropFilter: 'blur(12px)',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: ACCENT.primaryDeep }}>
        FRONT VIEW LEGEND
      </div>
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: ACCENT.primaryDeep }}>·</span>
          <span style={{ fontSize: 12, color: ACCENT.muted }}>出屏，磁场指向观察者</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: ACCENT.primaryDeep }}>×</span>
          <span style={{ fontSize: 12, color: ACCENT.muted }}>入屏，磁场背向观察者</span>
        </div>
        <div style={{ fontSize: 11, lineHeight: 1.7, color: ACCENT.muted }}>
          正视图只把左右两侧的方向关系讲清楚；靠近导线会更醒目，但并不表示匀强磁场。
        </div>
      </div>
    </div>
  );
}

export function WireBFieldCanvasOverlay({ transformRef }: WireBFieldCanvasOverlayProps) {
  const entities = useSimulationStore((s) => s.simulationState.scene.entities);
  const paramValues = useSimulationStore((s) => s.paramValues);
  const wire = findStraightWire(entities);
  const current = Math.abs((wire?.properties.current as number) ?? 5);
  const direction = wire ? getStraightWireCurrentDirection(wire) : 'up';
  const viewMode = getStraightWireViewMode(paramValues);
  const referenceRadius = getStraightWireReferenceRadius(paramValues);
  const strength = getStraightWireVisualStrength(current);
  const referenceB = computeStraightWireFieldAtRadius(current, referenceRadius);
  const animatedB = useAnimatedNumber(referenceB, 180);
  const animatedRadius = useAnimatedNumber(referenceRadius, 180);
  const clock = useAnimationClock();
  const overlayRef = useRef<HTMLDivElement>(null);

  const geometry = useMemo(() => {
    const stageWidth = overlayRef.current?.clientWidth ?? 0;
    const stageHeight = overlayRef.current?.clientHeight ?? 0;
    return getWireOverlayGeometry(wire, transformRef.current, viewMode, referenceRadius, stageWidth, stageHeight);
  }, [wire, transformRef, viewMode, referenceRadius, clock]);

  const updateRadiusFromClientPoint = useCallback((clientX: number, clientY: number) => {
    const stage = overlayRef.current;
    if (!stage || !wire) return;
    const rect = stage.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const stageWidth = stage.clientWidth;
    const stageHeight = stage.clientHeight;
    const nextGeometry = getWireOverlayGeometry(
      wire,
      transformRef.current,
      viewMode,
      referenceRadius,
      stageWidth,
      stageHeight,
    );
    if (!nextGeometry) return;

    const basis = getReferenceBasis(viewMode);
    const projected = Math.max(0, (px - nextGeometry.center.x) * basis.x + (py - nextGeometry.center.y) * basis.y);
    const nextRadius = clampStraightWireReferenceRadius(projected / Math.max(transformRef.current.scale, 1e-6));
    applyWireTeachingParam('wireReferenceRadius', Number(nextRadius.toFixed(2)));
  }, [referenceRadius, transformRef, viewMode, wire]);

  const handleMarkerMouseDown = useCallback((event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    updateRadiusFromClientPoint(event.clientX, event.clientY);

    const handleMove = (moveEvent: MouseEvent) => {
      updateRadiusFromClientPoint(moveEvent.clientX, moveEvent.clientY);
    };

    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [updateRadiusFromClientPoint]);

  const pulseRadius = geometry ? 10 + Math.sin(clock * 0.006) * 2 + strength.normalized * 6 : 0;

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 30,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 50% 48%, rgba(45,171,248,0.11) 0%, rgba(45,171,248,0.05) 26%, rgba(255,255,255,0) 62%)',
          opacity: 0.95,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(64,123,169,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(64,123,169,0.04) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          maskImage: 'radial-gradient(circle at center, black 0%, transparent 72%)',
          opacity: 0.26,
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: 16,
          top: 16,
          width: 254,
          padding: '14px 16px',
          borderRadius: 20,
          border: `1px solid ${ACCENT.border}`,
          background: 'rgba(255,255,255,0.92)',
          boxShadow: '0 18px 42px rgba(24, 53, 79, 0.12)',
          backdropFilter: 'blur(14px)',
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.11em', color: ACCENT.primaryDeep }}>
          {getStraightWireViewLabel(viewMode)}
        </div>
        <div style={{ marginTop: 7, fontSize: 26, fontWeight: 900, color: ACCENT.slate }}>
          I = {formatCurrent(current)}
        </div>
        <div style={{ marginTop: 7, fontSize: 12, lineHeight: 1.7, color: ACCENT.muted }}>
          磁场会随电流大小同步增强亮度、线宽与示意强弱。
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          right: 16,
          top: 16,
          width: 284,
          padding: '14px 16px',
          borderRadius: 20,
          border: `1px solid ${ACCENT.border}`,
          background: 'rgba(255,255,255,0.92)',
          boxShadow: '0 18px 42px rgba(24, 53, 79, 0.12)',
          backdropFilter: 'blur(14px)',
          display: 'grid',
          gridTemplateColumns: '74px minmax(0, 1fr)',
          gap: 12,
          alignItems: 'center',
        }}
      >
        <RuleIcon direction={direction} />
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.11em', color: ACCENT.primaryDeep }}>
            RIGHT-HAND RULE
          </div>
          <div style={{ marginTop: 7, fontSize: 13, fontWeight: 800, color: ACCENT.slate }}>
            {direction === 'up' ? '电流向上，俯视磁场逆时针环绕' : '电流向下，俯视磁场顺时针环绕'}
          </div>
          <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.75, color: ACCENT.muted }}>
            {getStraightWireRightHandRuleText(direction)}
          </div>
        </div>
      </div>

      {viewMode === 'front' && <FrontLegendCard />}

      {geometry?.visible && (
        <>
          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${overlayRef.current?.clientWidth ?? 0} ${overlayRef.current?.clientHeight ?? 0}`}
            style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="wire-bfield-connector" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(45,171,248,0.84)" />
                <stop offset="100%" stopColor="rgba(255,140,87,0.84)" />
              </linearGradient>
            </defs>

            <path
              d={`M ${geometry.center.x} ${geometry.center.y} L ${geometry.marker.x} ${geometry.marker.y}`}
              stroke="rgba(45,171,248,0.4)"
              strokeWidth="1.4"
              strokeDasharray="5 6"
              fill="none"
            />
            <path
              d={`M ${geometry.marker.x} ${geometry.marker.y} C ${geometry.marker.x + 36} ${geometry.marker.y - 10}, ${geometry.connector.x - 20} ${geometry.connector.y - 8}, ${geometry.connector.x} ${geometry.connector.y}`}
              stroke="url(#wire-bfield-connector)"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
            <circle
              cx={geometry.marker.x}
              cy={geometry.marker.y}
              r={pulseRadius}
              fill="rgba(45,171,248,0.08)"
            />
            <circle
              cx={geometry.marker.x}
              cy={geometry.marker.y}
              r={7 + strength.normalized * 4}
              fill="rgba(45,171,248,0.18)"
              stroke="rgba(45,171,248,0.72)"
              strokeWidth="1.6"
            />
          </svg>

          <button
            onMouseDown={handleMarkerMouseDown}
            style={{
              position: 'absolute',
              left: geometry.marker.x - 13,
              top: geometry.marker.y - 13,
              width: 26,
              height: 26,
              border: 'none',
              borderRadius: RADIUS.full,
              background: 'rgba(45,171,248,0.94)',
              boxShadow: '0 0 0 10px rgba(45,171,248,0.14), 0 14px 28px rgba(27, 73, 109, 0.18)',
              cursor: 'grab',
              pointerEvents: 'auto',
            }}
            title="拖动参考点 B，实时调整半径"
          />

          <div
            style={{
              position: 'absolute',
              left: geometry.marker.x + 14,
              top: geometry.marker.y - 14,
              padding: '4px 8px',
              borderRadius: RADIUS.pill,
              background: 'rgba(32,57,79,0.84)',
              color: '#FFFFFF',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.04em',
              boxShadow: SHADOWS.sm,
            }}
          >
            Point B
          </div>

          <div
            style={{
              position: 'absolute',
              left: geometry.card.x,
              top: geometry.card.y,
              width: 286,
              padding: '14px 16px',
              borderRadius: 22,
              border: `1px solid ${ACCENT.border}`,
              background: 'rgba(255,255,255,0.94)',
              boxShadow: '0 22px 52px rgba(24, 53, 79, 0.16)',
              backdropFilter: 'blur(14px)',
              transition: 'left 0.16s ease, top 0.16s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.11em', color: ACCENT.primaryDeep }}>
                  LIVE RESULT
                </div>
                <div style={{ marginTop: 5, fontSize: 18, fontWeight: 900, color: ACCENT.slate }}>
                  参考点 B 的实时读数
                </div>
              </div>
              <div
                style={{
                  padding: '8px 10px',
                  borderRadius: 14,
                  background: ACCENT.primarySoft,
                  color: ACCENT.primaryDeep,
                  fontSize: 11,
                  fontWeight: 800,
                }}
              >
                拖动 B 点
              </div>
            </div>

            <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              <MiniMetric label="半径 r" value={formatRadius(animatedRadius)} accent="cool" />
              <MiniMetric label="磁感应强度 B" value={formatFieldValue(animatedB)} accent="warm" />
            </div>

            <div
              style={{
                marginTop: 12,
                padding: '11px 12px',
                borderRadius: 16,
                background: 'rgba(241,248,253,0.92)',
                border: `1px solid ${ACCENT.border}`,
                fontSize: 12,
                lineHeight: 1.75,
                color: ACCENT.muted,
              }}
            >
              当前关系：I 固定时，r 增大，B 立即减小；I 增大时，线条和流动感会同步增强。
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function buildFallbackWire(direction: 'up' | 'down'): Entity {
  return {
    id: 'straight-wire-fallback',
    type: 'current-wire',
    category: 'field',
    transform: { position: { x: 0, y: 0 }, rotation: 0 },
    properties: {
      currentDirectionMode: direction,
    },
  };
}
