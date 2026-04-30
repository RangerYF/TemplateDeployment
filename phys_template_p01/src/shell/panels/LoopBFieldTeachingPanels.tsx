import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Entity } from '@/core/types';
import { simulator } from '@/core/engine/simulator';
import { Slider } from '@/components/ui/slider';
import { useSimulationStore } from '@/store';
import { COLORS, RADIUS } from '@/styles/tokens';
import {
  getLoopCurrentDirection,
  getLoopCurrentDirectionLabel,
} from '@/domains/em/logic/current-direction';
import {
  computeLoopCenterField,
  getLoopCurrentViewpointHint,
  getLoopFrontAxisLabel,
  getLoopTopFieldLabel,
  getLoopViewLabel,
  getLoopViewMode,
  getLoopVisualStrength,
} from '@/domains/em/logic/loop-current-teaching';
import {
  LOOP_CAMERA_DEFAULT_PITCH_DEG,
  LOOP_CAMERA_DEFAULT_YAW_DEG,
  getLoopCameraState,
  getLoopShowAuxiliaryLabels,
} from '@/domains/em/logic/loop-current-3d';
import { LoopBFieldExperimentalStage, type LoopDisplayMode } from './LoopBFieldExperimentalStage';

interface LoopBFieldControlPanelProps {
  onBack: () => void;
  onValueChange: (key: string, value: number | boolean | string) => void;
}

interface LoopBFieldTeachingWorkspaceProps extends LoopBFieldControlPanelProps {}

interface LoopBFieldControlContentProps extends LoopBFieldControlPanelProps {
  displayMode: LoopDisplayMode;
  onDisplayModeChange: (mode: LoopDisplayMode) => void;
  onResetCamera: () => void;
}

interface LoopBFieldInfoContentProps {
  displayMode: LoopDisplayMode;
}

const TEXTBOOK_FONT = '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif';
const PAPER_BG = 'linear-gradient(180deg, rgba(245,250,255,0.98) 0%, rgba(255,255,255,0.96) 20%, rgba(248,251,253,0.98) 100%)';
const PAPER_SURFACE = 'rgba(255,255,255,0.96)';
const PAPER_SURFACE_SOFT = 'rgba(246,250,255,0.92)';
const PAPER_BORDER = 'rgba(117, 148, 177, 0.22)';
const PAPER_BLUE = '#2DABF8';
const PAPER_BLUE_SOFT = 'rgba(45, 171, 248, 0.08)';
const PAPER_WARM = '#FF8C57';
const PAPER_MUTED = '#69829A';

const LOOP_DISPLAY_MODE_OPTIONS: Array<{
  key: LoopDisplayMode;
  label: string;
  detail: string;
}> = [
  { key: 'textbook', label: '教材图', detail: '清晰主结构，先看整体偶极磁场。' },
  { key: 'observation', label: '3D观察', detail: '突出空间连续场线与局部环绕提示。' },
  { key: 'direction', label: '方向', detail: '同步对照电流方向、中心 B 和右手定则。' },
  { key: 'intensity', label: '强度', detail: '突出中心强、外围弱与轴线分布。' },
];

const PANEL_CARD_STYLE: CSSProperties = {
  border: `1px solid ${PAPER_BORDER}`,
  borderRadius: '24px',
  background: 'linear-gradient(180deg, rgba(248,252,255,0.98) 0%, rgba(255,255,255,0.96) 100%)',
  boxShadow: '0 18px 44px rgba(27, 56, 84, 0.08)',
  backdropFilter: 'blur(16px)',
};

const TEACHING_SURFACE_STYLE: CSSProperties = {
  border: `1px solid ${PAPER_BORDER}`,
  borderRadius: '24px',
  background: 'linear-gradient(180deg, rgba(248,252,255,0.98) 0%, rgba(255,255,255,0.96) 100%)',
  boxShadow: '0 18px 44px rgba(27, 56, 84, 0.08)',
  backdropFilter: 'blur(16px)',
};

function findLoopWire(entities: Map<string, Entity>): Entity | undefined {
  return Array.from(entities.values()).find(
    (entity) =>
      entity.type === 'current-wire' &&
      ((entity.properties.wireShape as string | undefined) ?? 'straight') === 'loop',
  );
}

function syncStoreFromSimulatorScene(): void {
  const store = useSimulationStore.getState();
  const simState = simulator.getState();
  store.setParamValues({ ...simState.scene.paramValues });
}

function applyLoopTeachingParam(key: string, value: number | boolean | string): void {
  simulator.updateParam(key, value);
  syncStoreFromSimulatorScene();
}

function resetLoopCamera(onValueChange?: (key: string, value: number | boolean | string) => void): void {
  const apply = onValueChange ?? applyLoopTeachingParam;
  apply('loopViewMode', 'isometric');
  apply('loopCameraYawDeg', LOOP_CAMERA_DEFAULT_YAW_DEG);
  apply('loopCameraPitchDeg', LOOP_CAMERA_DEFAULT_PITCH_DEG);
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

function useAnimatedNumber(target: number, durationMs = 240): number {
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

function DirectionChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '10px 12px',
        borderRadius: RADIUS.pill,
        border: `1px solid ${active ? 'rgba(45, 171, 248, 0.3)' : PAPER_BORDER}`,
        background: active ? PAPER_BLUE_SOFT : PAPER_SURFACE,
        color: active ? PAPER_BLUE : COLORS.textSecondary,
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.16s ease',
      }}
    >
      {label}
    </button>
  );
}

function ViewModeButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        minWidth: 0,
        padding: '10px 12px',
        border: `1px solid ${active ? 'rgba(45, 171, 248, 0.28)' : 'transparent'}`,
        borderRadius: RADIUS.pill,
        background: active ? PAPER_SURFACE : 'transparent',
        color: active ? COLORS.text : PAPER_MUTED,
        fontSize: 12,
        fontWeight: active ? 700 : 500,
        cursor: 'pointer',
        transition: 'all 0.16s ease',
      }}
    >
      {label}
    </button>
  );
}

function DisplayModeButton({
  active,
  label,
  detail,
  onClick,
}: {
  active: boolean;
  label: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: 'left',
        padding: '10px 12px',
        borderRadius: '10px',
        border: `1px solid ${active ? 'rgba(45, 171, 248, 0.28)' : PAPER_BORDER}`,
        background: active ? PAPER_BLUE_SOFT : PAPER_SURFACE,
        cursor: 'pointer',
        transition: 'all 0.16s ease',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: active ? PAPER_BLUE : COLORS.text }}>
        {label}
      </div>
      <div style={{ marginTop: 4, fontSize: 11, lineHeight: 1.55, color: PAPER_MUTED }}>
        {detail}
      </div>
    </button>
  );
}

function StrengthBar({ progress }: { progress: number }) {
  return (
    <div
      style={{
        height: 10,
        borderRadius: RADIUS.full,
        border: `1px solid ${PAPER_BORDER}`,
        backgroundColor: PAPER_SURFACE_SOFT,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${Math.max(progress * 100, 8)}%`,
          height: '100%',
          borderRadius: RADIUS.full,
          background: 'rgba(45, 171, 248, 0.78)',
          transition: 'width 0.16s ease',
        }}
      />
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
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
      <span style={{ fontSize: 12, color: COLORS.textMuted }}>{label}</span>
      <span style={{ fontSize: 12, color: COLORS.text, fontWeight: 600, textAlign: 'right' }}>
        {value}
      </span>
    </div>
  );
}

function ControlLabel({
  title,
  description,
  value,
}: {
  title: string;
  description?: string;
  value?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.text }}>{title}</div>
        {description && (
          <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.65, color: COLORS.textMuted }}>
            {description}
          </div>
        )}
      </div>
      {value && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: '10px',
            border: `1px solid ${PAPER_BORDER}`,
            backgroundColor: PAPER_SURFACE_SOFT,
            color: PAPER_BLUE,
            fontSize: 13,
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
        >
          {value}
        </div>
      )}
    </div>
  );
}

function TeachingCard({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
}) {
  return (
    <section style={{ ...PANEL_CARD_STYLE, padding: 16 }}>
      {eyebrow && (
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: PAPER_MUTED }}>
          {eyebrow}
        </div>
      )}
      <div style={{ marginTop: eyebrow ? 8 : 0, fontSize: 14, fontWeight: 700, color: COLORS.text }}>
        {title}
      </div>
      <div style={{ marginTop: 12 }}>{children}</div>
    </section>
  );
}

function SnapshotMetric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        padding: '12px 13px',
        borderRadius: '10px',
        border: accent ? '1px solid rgba(45, 171, 248, 0.22)' : `1px solid ${PAPER_BORDER}`,
        background: accent ? PAPER_BLUE_SOFT : PAPER_SURFACE,
      }}
    >
      <div style={{ fontSize: 11, color: COLORS.textMuted }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 15, fontWeight: 700, color: COLORS.text }}>{value}</div>
    </div>
  );
}

function getDisplayModeSummary(displayMode: LoopDisplayMode): string {
  if (displayMode === 'observation') {
    return '自由旋转观察圆电流环的偶极磁场，主图始终强调“穿过中心 + 外部回弯闭合”的整体结构。';
  }
  if (displayMode === 'direction') {
    return '突出线圈电流方向、中心磁场翻转，以及悬停局部后的右手定则来源。';
  }
  if (displayMode === 'intensity') {
    return '用轴线采样和中心剖面强调中心附近磁场更强、远处更弱。';
  }
  return '保留长直导线页那种清晰、直观的讲解方式，但主图始终是圆电流环的偶极磁场。';
}

function getDisplayModeFocus(displayMode: LoopDisplayMode): string {
  if (displayMode === 'observation') return '空间结构';
  if (displayMode === 'direction') return '方向判定';
  if (displayMode === 'intensity') return '强弱分布';
  return '教材对应';
}

function getDisplayModeLabel(displayMode: LoopDisplayMode): string {
  return LOOP_DISPLAY_MODE_OPTIONS.find((option) => option.key === displayMode)?.label ?? '教材图';
}

function OverlayInfoCard({
  current,
  radius,
  centerB,
}: {
  current: number;
  radius: number;
  centerB: number;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 18,
        top: 58,
        width: 150,
        padding: '10px 12px',
        borderRadius: '10px',
        border: `1px solid ${PAPER_BORDER}`,
        background: 'rgba(255, 255, 255, 0.94)',
        color: COLORS.text,
        fontSize: 12,
        lineHeight: 1.55,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ color: PAPER_MUTED }}>I</span>
        <span style={{ fontWeight: 700 }}>{formatCurrent(current)}</span>
      </div>
      <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ color: PAPER_MUTED }}>R</span>
        <span style={{ fontWeight: 700 }}>{formatRadius(radius)}</span>
      </div>
      <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ color: PAPER_MUTED }}>B₀</span>
        <span style={{ fontWeight: 700 }}>{formatFieldValue(centerB)}</span>
      </div>
    </div>
  );
}

function OverlayToolbarButton({
  active,
  label,
  onClick,
}: {
  active?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      onMouseDown={(event) => event.stopPropagation()}
      style={{
        padding: '8px 12px',
        borderRadius: '999px',
        border: active ? '1px solid rgba(45, 171, 248, 0.26)' : `1px solid ${PAPER_BORDER}`,
        background: active ? PAPER_BLUE_SOFT : PAPER_SURFACE,
        color: active ? PAPER_BLUE : COLORS.text,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function LoopBFieldControlContent({
  onBack,
  onValueChange,
  displayMode,
  onDisplayModeChange,
  onResetCamera,
}: LoopBFieldControlContentProps) {
  const entities = useSimulationStore((s) => s.simulationState.scene.entities);
  const paramValues = useSimulationStore((s) => s.paramValues);
  const loop = findLoopWire(entities);
  const current = typeof paramValues.current === 'number'
    ? paramValues.current
    : Math.abs((loop?.properties.current as number) ?? 5);
  const radius = typeof paramValues.loopRadius === 'number'
    ? paramValues.loopRadius
    : ((loop?.properties.loopRadius as number) ?? 1);
  const direction = loop ? getLoopCurrentDirection(loop) : 'counterclockwise';
  const viewMode = getLoopViewMode(paramValues);
  const strength = getLoopVisualStrength(current, radius);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <TeachingCard title="视图与模式" eyebrow="MODEL">
        <button
          onClick={onBack}
          className="text-xs transition-colors hover:opacity-70"
          style={{ color: COLORS.textSecondary }}
        >
          ← 返回
        </button>
        <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.7, color: PAPER_MUTED }}>
          只保留必要控制。3D 视角支持阻尼旋转，俯视和侧视用于直接判定中心磁场与整体偶极结构。
        </div>
        <div style={{ marginTop: 14 }}>
          <ControlLabel title="视角" description="教材判定和 3D 观察可快速切换。" />
        </div>
        <div
          style={{
            marginTop: 10,
            display: 'flex',
            gap: 4,
            padding: 4,
            borderRadius: RADIUS.full,
            border: `1px solid ${PAPER_BORDER}`,
            background: PAPER_SURFACE_SOFT,
          }}
        >
          <ViewModeButton
            active={viewMode === 'isometric'}
            label="3D视角"
            onClick={() => onValueChange('loopViewMode', 'isometric')}
          />
          <ViewModeButton
            active={viewMode === 'top'}
            label="俯视图"
            onClick={() => onValueChange('loopViewMode', 'top')}
          />
          <ViewModeButton
            active={viewMode === 'front'}
            label="侧视图"
            onClick={() => onValueChange('loopViewMode', 'front')}
          />
        </div>

        <div style={{ marginTop: 16 }}>
          <ControlLabel title="显示模式" description="同一组物理参数切换不同教学重点。" />
          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
            {LOOP_DISPLAY_MODE_OPTIONS.map((option) => (
              <DisplayModeButton
                key={option.key}
                active={displayMode === option.key}
                label={option.label}
                detail={option.detail}
                onClick={() => onDisplayModeChange(option.key)}
              />
            ))}
          </div>
        </div>

        <button
          onClick={onResetCamera}
          style={{
            marginTop: 14,
            width: '100%',
            padding: '10px 12px',
            borderRadius: '10px',
            border: `1px solid ${PAPER_BORDER}`,
            background: PAPER_SURFACE,
            color: COLORS.text,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          重置 3D 角度
        </button>
      </TeachingCard>

      <TeachingCard title="参数" eyebrow="PARAMS">
        <ControlLabel
          title="电流大小"
          description="I 增大时，中心轴线附近磁场更强，主图中的磁感线疏密也更明显。"
          value={formatCurrent(current)}
        />
        <div style={{ marginTop: 12 }}>
          <Slider
            value={[current]}
            onValueChange={([next]) => {
              if (next !== undefined) onValueChange('current', next);
            }}
            min={0.5}
            max={20}
            step={0.5}
          />
        </div>
        <div style={{ marginTop: 8 }}>
          <StrengthBar progress={strength.currentNormalized} />
        </div>

        <div style={{ marginTop: 16 }}>
          <ControlLabel title="电流方向" description="切换后主图箭头、中心 B 和右手定则说明会同步翻转。" />
          <div style={{ marginTop: 10, display: 'flex', gap: 10 }}>
            <DirectionChip
              active={direction === 'counterclockwise'}
              label="逆时针"
              onClick={() => onValueChange('currentDirectionMode', 'counterclockwise')}
            />
            <DirectionChip
              active={direction === 'clockwise'}
              label="顺时针"
              onClick={() => onValueChange('currentDirectionMode', 'clockwise')}
            />
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <ControlLabel
            title="线圈半径"
            description="R 减小时，中心轴线附近磁场更集中；R 增大时外部回弯区域更展开。"
            value={formatRadius(radius)}
          />
          <div style={{ marginTop: 12 }}>
            <Slider
              value={[radius]}
              onValueChange={([next]) => {
                if (next !== undefined) onValueChange('loopRadius', next);
              }}
              min={0.5}
              max={3}
              step={0.1}
            />
          </div>
          <div style={{ marginTop: 8 }}>
            <StrengthBar progress={strength.centerNormalized} />
          </div>
        </div>
      </TeachingCard>
    </div>
  );
}

function LoopBFieldInfoContent({
  displayMode,
}: LoopBFieldInfoContentProps) {
  const entities = useSimulationStore((s) => s.simulationState.scene.entities);
  const paramValues = useSimulationStore((s) => s.paramValues);
  const loop = findLoopWire(entities);
  const current = typeof paramValues.current === 'number'
    ? paramValues.current
    : Math.abs((loop?.properties.current as number) ?? 5);
  const radius = typeof paramValues.loopRadius === 'number'
    ? paramValues.loopRadius
    : ((loop?.properties.loopRadius as number) ?? 1);
  const direction = loop ? getLoopCurrentDirection(loop) : 'counterclockwise';
  const viewMode = getLoopViewMode(paramValues);
  const centerB = computeLoopCenterField(current, radius);
  const animatedB = useAnimatedNumber(centerB);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <TeachingCard title="核心公式" eyebrow="FORMULA">
        <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.text, fontFamily: TEXTBOOK_FONT }}>
          B₀ = μ₀ I / 2R
        </div>
        <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.7, color: PAPER_MUTED }}>
          圆形电流的磁场是所有电流元叠加形成的整体磁场，中心沿轴线方向最强，整体分布类似磁偶极子。
        </div>
        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
          <SnapshotMetric label="I" value={formatCurrent(current)} />
          <SnapshotMetric label="R" value={formatRadius(radius)} />
          <SnapshotMetric label="B₀" value={formatFieldValue(animatedB)} accent />
        </div>
      </TeachingCard>

      <TeachingCard title="关键信息" eyebrow="STATUS">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <InfoRow label="当前视图" value={getLoopViewLabel(viewMode)} />
          <InfoRow label="电流方向" value={getLoopCurrentDirectionLabel(loop ?? buildFallbackLoop(direction))} />
          <InfoRow
            label="中心磁场方向"
            value={viewMode === 'top' ? getLoopTopFieldLabel(direction) : `轴线${getLoopFrontAxisLabel(direction)}`}
          />
          <InfoRow label="俯视判定" value={getLoopTopFieldLabel(direction)} />
          <InfoRow label="模式焦点" value={getDisplayModeFocus(displayMode)} />
        </div>
      </TeachingCard>

      <TeachingCard title="模式说明" eyebrow="MODE">
        <div style={{ fontSize: 12, lineHeight: 1.75, color: COLORS.textSecondary }}>
          {getDisplayModeSummary(displayMode)}
        </div>
        <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.75, color: COLORS.textSecondary }}>
          {getLoopCurrentViewpointHint(direction)}。右手四指沿电流方向弯曲时，拇指所指就是线圈中心轴线磁场方向。
        </div>
      </TeachingCard>
    </div>
  );
}

export function LoopBFieldControlPanel({
  onBack,
  onValueChange,
}: LoopBFieldControlPanelProps) {
  const [displayMode, setDisplayMode] = useState<LoopDisplayMode>('textbook');
  const [, setCameraResetVersion] = useState(0);

  return (
    <aside
      className="flex h-full flex-col overflow-y-auto"
      style={{
        width: 320,
        minWidth: 300,
        borderRight: `1px solid ${PAPER_BORDER}`,
        background: PAPER_BG,
        padding: 16,
      }}
    >
      <LoopBFieldControlContent
        onBack={onBack}
        onValueChange={onValueChange}
        displayMode={displayMode}
        onDisplayModeChange={setDisplayMode}
        onResetCamera={() => setCameraResetVersion((value) => value + 1)}
      />
    </aside>
  );
}

export function LoopBFieldInfoPanel() {
  const [displayMode] = useState<LoopDisplayMode>('textbook');
  return (
    <aside
      className="flex h-full flex-col overflow-y-auto"
      style={{
        width: 320,
        minWidth: 300,
        borderLeft: `1px solid ${PAPER_BORDER}`,
        background: PAPER_BG,
        padding: 16,
      }}
    >
      <LoopBFieldInfoContent displayMode={displayMode} />
    </aside>
  );
}

export function LoopBFieldTeachingWorkspace({
  onBack,
  onValueChange,
}: LoopBFieldTeachingWorkspaceProps) {
  const [displayMode, setDisplayMode] = useState<LoopDisplayMode>('textbook');
  const [cameraResetVersion, setCameraResetVersion] = useState(0);

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: '20px 22px',
        background: PAPER_BG,
        fontFamily: TEXTBOOK_FONT,
      }}
    >
      <div
        style={{
          maxWidth: 1580,
          height: 'calc(100vh - 40px)',
          margin: '0 auto',
          display: 'grid',
          gridTemplateRows: 'auto minmax(0, 1fr)',
          gap: 18,
        }}
      >
        <div
          style={{
            ...TEACHING_SURFACE_STYLE,
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 18,
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: PAPER_MUTED }}>
              P-08 · MAGNETIC LAB
            </div>
            <div style={{ marginTop: 6, fontSize: 30, fontWeight: 700, color: COLORS.text, fontFamily: TEXTBOOK_FONT }}>
              圆形电流磁场
            </div>
            <div style={{ marginTop: 4, fontSize: 13, lineHeight: 1.7, color: PAPER_MUTED }}>
              借用长直导线页的清晰表达，但主图始终保持圆电流环的偶极磁场，不把它误画成整圈环绕场。
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <div
                style={{
                  padding: '6px 10px',
                  borderRadius: '999px',
                  border: `1px solid ${PAPER_BORDER}`,
                  background: PAPER_SURFACE,
                  color: PAPER_BLUE,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                平滑 3D 旋转
              </div>
              <div
                style={{
                  padding: '6px 10px',
                  borderRadius: '999px',
                  border: `1px solid ${PAPER_BORDER}`,
                  background: PAPER_SURFACE,
                  color: PAPER_WARM,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                局部环绕提示
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: '280px minmax(0, 2.45fr) 280px',
            gap: 16,
          }}
        >
          <div style={{ minHeight: 0, overflowY: 'auto', paddingRight: 2 }}>
            <LoopBFieldControlContent
              onBack={onBack}
              onValueChange={onValueChange}
              displayMode={displayMode}
              onDisplayModeChange={setDisplayMode}
              onResetCamera={() => setCameraResetVersion((value) => value + 1)}
            />
          </div>

          <div
            style={{
              ...TEACHING_SURFACE_STYLE,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '14px 18px 12px',
                borderBottom: `1px solid ${PAPER_BORDER}`,
                display: 'flex',
                justifyContent: 'space-between',
                gap: 16,
                alignItems: 'flex-end',
              }}
            >
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: PAPER_MUTED }}>
                  MAIN STAGE
                </div>
                <div style={{ marginTop: 6, fontSize: 18, fontWeight: 700, color: COLORS.text }}>
                  通电线圈与空间磁场
                </div>
              </div>
              <div style={{ fontSize: 12, color: PAPER_MUTED, textAlign: 'right', lineHeight: 1.75 }}>
                {getDisplayModeLabel(displayMode)}：{getDisplayModeSummary(displayMode)}
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0, padding: 12, display: 'flex' }}>
              <div
                style={{
                  position: 'relative',
                  display: 'flex',
                  flex: 1,
                  minHeight: 0,
                  overflow: 'hidden',
                  borderRadius: '12px',
                  border: `1px solid ${PAPER_BORDER}`,
                  background: PAPER_SURFACE_SOFT,
                }}
              >
                <LoopBFieldExperimentalStage
                  displayMode={displayMode}
                  cameraResetVersion={cameraResetVersion}
                />
              </div>
            </div>
          </div>

          <div style={{ minHeight: 0, overflowY: 'auto', paddingLeft: 2 }}>
            <LoopBFieldInfoContent displayMode={displayMode} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function LoopBFieldCanvasOverlay() {
  const entities = useSimulationStore((s) => s.simulationState.scene.entities);
  const paramValues = useSimulationStore((s) => s.paramValues);
  const loop = findLoopWire(entities);
  const current = typeof paramValues.current === 'number'
    ? paramValues.current
    : Math.abs((loop?.properties.current as number) ?? 5);
  const radius = typeof paramValues.loopRadius === 'number'
    ? paramValues.loopRadius
    : ((loop?.properties.loopRadius as number) ?? 1);
  const viewMode = getLoopViewMode(paramValues);
  const centerB = computeLoopCenterField(current, radius);
  const animatedB = useAnimatedNumber(centerB);
  const showAuxiliaryLabels = getLoopShowAuxiliaryLabels(paramValues);
  const camera = getLoopCameraState(paramValues);
  const [hintVisible, setHintVisible] = useState(viewMode === 'isometric');

  useEffect(() => {
    if (viewMode !== 'isometric') {
      setHintVisible(false);
      return;
    }
    setHintVisible(true);
    const timer = window.setTimeout(() => setHintVisible(false), 4200);
    return () => window.clearTimeout(timer);
  }, [viewMode]);

  useEffect(() => {
    if (!hintVisible || viewMode !== 'isometric') return;
    if (
      Math.abs(camera.yawDeg - LOOP_CAMERA_DEFAULT_YAW_DEG) > 3 ||
      Math.abs(camera.pitchDeg - LOOP_CAMERA_DEFAULT_PITCH_DEG) > 3
    ) {
      setHintVisible(false);
    }
  }, [camera.pitchDeg, camera.yawDeg, hintVisible, viewMode]);

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 30, pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          left: 18,
          top: 18,
          padding: '8px 12px',
          borderRadius: '999px',
          background: 'rgba(17, 31, 28, 0.56)',
          color: '#F8FBF9',
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.04em',
          backdropFilter: 'blur(10px)',
        }}
      >
        {getLoopViewLabel(viewMode)}
      </div>

      <div
        style={{
          position: 'absolute',
          right: 18,
          top: 18,
          display: 'flex',
          gap: 8,
          pointerEvents: 'auto',
        }}
      >
        <OverlayToolbarButton
          active={showAuxiliaryLabels}
          label={showAuxiliaryLabels ? '辅助标注 开' : '辅助标注 关'}
          onClick={() => applyLoopTeachingParam('loopShowAuxiliaryLabels', !showAuxiliaryLabels)}
        />
        {viewMode === 'isometric' && (
          <OverlayToolbarButton
            label="重置视角"
            onClick={() => resetLoopCamera()}
          />
        )}
      </div>

      {hintVisible && viewMode === 'isometric' && (
        <div
          style={{
            position: 'absolute',
            left: 18,
            top: 58,
            maxWidth: 320,
            padding: '12px 14px',
            borderRadius: '18px',
            background: 'rgba(17, 31, 28, 0.62)',
            color: 'rgba(245,250,247,0.94)',
            fontSize: 12,
            lineHeight: 1.7,
            backdropFilter: 'blur(10px)',
            opacity: hintVisible ? 1 : 0,
            transition: 'opacity 0.28s ease',
          }}
        >
          拖拽可旋转视角。滚轮可缩放。点击右上角“重置视角”可恢复默认教材角度。
        </div>
      )}

      {showAuxiliaryLabels && !hintVisible && (
        <OverlayInfoCard current={current} radius={radius} centerB={animatedB} />
      )}
    </div>
  );
}

function buildFallbackLoop(direction: 'clockwise' | 'counterclockwise'): Entity {
  return {
    id: 'loop-wire-fallback',
    type: 'current-wire',
    category: 'field',
    transform: { position: { x: 0, y: 0 }, rotation: 0 },
    properties: {
      currentDirectionMode: direction,
      wireShape: 'loop',
    },
  };
}
