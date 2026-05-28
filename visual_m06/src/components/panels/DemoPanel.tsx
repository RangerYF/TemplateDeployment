import { useRef, useState, useCallback, useMemo } from 'react';
import { useHistoryStore } from '@/editor';
import type { Command } from '@/editor/commands/types';
import { useDemoEntityStore } from '@/editor/demo/demoEntityStore';
import { useDemoSelectionStore } from '@/editor/demo/demoSelectionStore';
import {
  UpdateVectorPropsCmd, MovePointCmd, LoadDemoSnapshotCmd,
  CreateVecOpCmd, DeleteVecOpCmd, DeleteVectorCmd, UpdateVecOpCmd,
  BindPointsCmd, UnbindPointsCmd,
  DeleteMarkerCmd, UpdateMarkerCmd,
  DeleteGenericCmd, UpdateGenericCmd, UpdateTextCmd,
  CreateMarkerCmd, CreateConstructionCmd,
} from '@/editor/demo/demoCommands';
import { parseEquation } from '@/engine/algebraParser';
import type {
  DemoPoint, DemoVector, DemoVecOp, DemoBinding, DemoEntity,
  DemoMarker, DemoSegment, DemoCircle, DemoText, DemoAngleMark, DemoDistanceMark,
  DemoLine, DemoRay, DemoPolygon, DemoSlider, MotionPath,
} from '@/editor/demo/demoTypes';
import { DEMO_COLORS } from '@/editor/demo/demoTypes';
import { COLORS, RADIUS } from '@/styles/tokens';
import { mag2D, add2D, sub2D, scale2D, dot2D, fmtSurd } from '@/engine/vectorMath';
import { evalExact, evalExactScoped, buildSliderScope } from '@/engine/exactMath';
import { useTraceStore } from '@/editor/demo/traceStore';
import { useConstraintStore } from '@/editor/demo/constraintStore';
import type { Vec2D } from '@/editor/entities/types';
import { Eye, EyeOff } from 'lucide-react';
import { InlineLatex } from '@/components/shared/InlineLatex';
import { toVecLatex } from '@/lib/vecLatex';
import { findLabelConflict } from '@/engine/labelUtils';
import { validateVecExpr, isVecExpression } from '@/engine/vecExprParser';

// ─── PanelSection（折叠/展开，匹配 visual_template LeftPanel 样式）───

function PanelSection({
  title, defaultOpen = true, children, style,
}: {
  title: React.ReactNode; defaultOpen?: boolean; children: React.ReactNode; style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={style}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: '10px 16px', border: 'none', background: 'transparent',
          cursor: 'pointer', fontSize: 14, fontWeight: 600, letterSpacing: '0.04em',
          color: COLORS.text, userSelect: 'none',
        }}
      >
        <span>{title}</span>
        <span style={{
          fontSize: 14, transition: 'transform 0.15s',
          transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
        }}>▼</span>
      </button>
      {open && <div style={{ padding: '0 16px 10px' }}>{children}</div>}
    </div>
  );
}

// ─── 信息块（rounded-md p-2 space-y-1 text-xs, bg bgMuted）───

function InfoBlock({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      borderRadius: RADIUS.sm, padding: 8, background: COLORS.bgMuted,
      display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14,
      marginBottom: 6,
    }}>
      {children}
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
      <span style={{ color: COLORS.textMuted }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{children}</span>
    </div>
  );
}

// ─── 紧凑输入框 ───

function CompactInput({ value, onCommit, width = 56 }: {
  value: number; onCommit: (v: number) => void; width?: number;
}) {
  return (
    <input
      type="number"
      step={0.5}
      defaultValue={value}
      key={value}
      onBlur={(e) => {
        const n = parseFloat(e.target.value);
        if (!isNaN(n)) onCommit(n);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          const n = parseFloat((e.target as HTMLInputElement).value);
          if (!isNaN(n)) onCommit(n);
        }
      }}
      style={{
        width, fontSize: 14, textAlign: 'center', borderRadius: RADIUS.sm,
        border: `1px solid ${COLORS.border}`, padding: '4px 6px', color: COLORS.text,
      }}
    />
  );
}

function LabeledInput({ label, value, onChange }: {
  label: string; value: number; onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 14, color: COLORS.textMuted }}>{label}:</span>
      <input
        type="number"
        step={0.5}
        defaultValue={value}
        key={value}
        onBlur={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onChange((e.target as HTMLInputElement).value); }}
        style={{
          width: 60, padding: '4px 6px', borderRadius: RADIUS.sm,
          border: `1px solid ${COLORS.border}`, fontSize: 14, color: COLORS.text,
        }}
      />
    </div>
  );
}

// ─── 表达式紧凑输入框（支持 √ 根号表达式）───

function shouldStoreExpr(raw: string, numVal: number): string | undefined {
  const trimmed = raw.trim();
  const asFloat = parseFloat(trimmed);
  if (!isNaN(asFloat) && Math.abs(asFloat - numVal) < 1e-12) return undefined;
  return trimmed;
}

function ExprCompactInput({ value, expr, onCommit, width = 72, scope }: {
  value: number; expr?: string; onCommit: (v: number, expr?: string) => void; width?: number;
  scope?: Record<string, number>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() => expr ?? fmtSurd(value));
  const [valid, setValid] = useState(true);
  const [prevValue, setPrevValue] = useState(value);
  const [prevExpr, setPrevExpr] = useState(expr);

  if (expr !== prevExpr) {
    setPrevExpr(expr);
    setPrevValue(value);
    setText(expr ?? fmtSurd(value));
    setValid(true);
  } else if (Math.abs(value - prevValue) > 0.0001) {
    setPrevValue(value);
    setText(expr ?? fmtSurd(value));
    setValid(true);
  }

  const commit = useCallback((raw: string) => {
    const v = scope ? evalExactScoped(raw, scope) : evalExact(raw);
    if (!isNaN(v)) {
      setValid(true);
      setPrevValue(v);
      const stored = shouldStoreExpr(raw, v);
      setPrevExpr(stored);
      onCommit(v, stored);
    } else {
      setValid(false);
    }
  }, [onCommit, scope]);

  const insertSqrt = useCallback(() => {
    const el = inputRef.current;
    if (!el) { const n = text + '√'; setText(n); return; }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const sel = text.slice(start, end);
    const ins = sel ? `√(${sel})` : '√';
    const newText = text.slice(0, start) + ins + text.slice(end);
    setText(newText);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + ins.length;
      el.setSelectionRange(pos, pos);
    });
  }, [text]);

  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => { setText(e.target.value); setValid(true); }}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') commit((e.target as HTMLInputElement).value); }}
        title="支持根号表达式，如 √2、1+√3、√(2)/2"
        style={{
          width, fontSize: 14, textAlign: 'center', borderRadius: RADIUS.sm,
          border: `1px solid ${valid ? COLORS.border : '#e53e3e'}`, padding: '4px 6px', color: COLORS.text,
        }}
      />
      <button
        onClick={insertSqrt}
        title="插入根号 √"
        style={{
          width: 22, height: 22, borderRadius: RADIUS.sm,
          border: `1px solid ${COLORS.border}`, background: COLORS.bgMuted,
          cursor: 'pointer', fontSize: 13, color: COLORS.text, padding: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >√</button>
    </div>
  );
}

function ExprLabeledInput({ label, value, expr, onCommit, scope }: {
  label: string; value: number; expr?: string; onCommit: (v: number, expr?: string) => void;
  scope?: Record<string, number>;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 14, color: COLORS.textMuted }}>{label}:</span>
      <ExprCompactInput value={value} expr={expr} onCommit={onCommit} width={68} scope={scope} />
    </div>
  );
}

// ─── HSL 工具函数 ───

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, Math.round(l * 100)];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) / 6
    : max === g ? ((b - r) / d + 2) / 6
    : ((r - g) / d + 4) / 6;
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h: number, s: number, l: number): string {
  const s1 = s / 100, l1 = l / 100;
  const c = (1 - Math.abs(2 * l1 - 1)) * s1;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l1 - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function findClosestBase(hex: string): string {
  const [h, s] = hexToHsl(hex);
  let best: string = DEMO_COLORS[0];
  let bestDist = Infinity;
  for (const c of DEMO_COLORS) {
    const [ch, cs] = hexToHsl(c);
    const dh = Math.min(Math.abs(ch - h), 360 - Math.abs(ch - h));
    const dist = dh + Math.abs(cs - s) * 0.5;
    if (dist < bestDist) { bestDist = dist; best = c; }
  }
  return best;
}

// ─── 颜色圆点选择器（rounded-full + 明度滑块）───

function ColorPicker({ current, onChange }: { current: string; onChange: (c: string) => void }) {
  const [, , curL] = hexToHsl(current);
  const [baseH, baseS] = hexToHsl(findClosestBase(current));

  return (
    <div>
      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {DEMO_COLORS.map((c) => (
          <div
            key={c}
            onClick={() => onChange(c)}
            style={{
              width: 36, height: 36, borderRadius: '50%', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxSizing: 'border-box',
            }}
          >
            <div style={{
              width: 20, height: 20, borderRadius: '50%', background: c,
              border: current === c || findClosestBase(current) === c ? `2px solid ${COLORS.primary}` : '2px solid transparent',
              boxSizing: 'border-box',
            }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
        <span style={{ fontSize: 12, color: COLORS.textMuted, flexShrink: 0 }}>明暗</span>
        <input
          type="range" min={15} max={85} value={curL}
          onChange={(e) => {
            const l = parseInt(e.target.value);
            onChange(hslToHex(baseH, baseS, l));
          }}
          style={{ flex: 1, minWidth: 0 }}
        />
        <span style={{ fontSize: 12, color: COLORS.textMuted, flexShrink: 0, width: 30, textAlign: 'right' }}>
          {curL}%
        </span>
      </div>
    </div>
  );
}

// ─── 可见性 + 透明度控制 ───

function VisibilityOpacityControl({ entity, onUpdate }: {
  entity: { visible?: boolean; opacity?: number };
  onUpdate: (patch: { visible?: boolean; opacity?: number }) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button
        onClick={() => onUpdate({ visible: entity.visible === false ? true : false })}
        style={{
          border: 'none', background: 'transparent', cursor: 'pointer',
          color: entity.visible === false ? COLORS.textMuted : COLORS.text,
          padding: 2, display: 'flex', alignItems: 'center',
        }}
        title={entity.visible === false ? '显示' : '隐藏'}
      >
        {entity.visible === false ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
      <span style={{ fontSize: 12, color: COLORS.textMuted, flexShrink: 0 }}>透明度</span>
      <input
        type="range" min={0} max={1} step={0.1}
        value={entity.opacity ?? 1}
        onChange={(e) => onUpdate({ opacity: parseFloat(e.target.value) })}
        style={{ flex: 1, minWidth: 0 }}
      />
      <span style={{ fontSize: 12, color: COLORS.textMuted, flexShrink: 0, width: 30, textAlign: 'right' }}>
        {Math.round((entity.opacity ?? 1) * 100)}%
      </span>
    </div>
  );
}

// ─── 操作按钮（匹配 visual_template DataIOPanel / InspectorCommon 样式）───

function ActionBtn({ onClick, children, variant = 'default' }: {
  onClick: () => void; children: React.ReactNode; variant?: 'default' | 'primary' | 'danger';
}) {
  const styles: Record<string, React.CSSProperties> = {
    default: {
      flex: 1, padding: '6px 12px', borderRadius: RADIUS.sm, border: `1px solid ${COLORS.border}`,
      fontSize: 14, fontWeight: 500, color: COLORS.textSecondary, background: COLORS.bgMuted, cursor: 'pointer',
    },
    primary: {
      flex: 1, padding: '6px 12px', borderRadius: RADIUS.sm, border: `1px solid ${COLORS.primary}`,
      fontSize: 14, fontWeight: 600, color: COLORS.primary, background: COLORS.primaryLight, cursor: 'pointer',
    },
    danger: {
      flex: 1, padding: '6px 12px', borderRadius: RADIUS.sm, border: `1px solid ${COLORS.error}`,
      fontSize: 14, fontWeight: 500, color: COLORS.error, background: 'transparent', cursor: 'pointer',
    },
  };
  return <button onClick={onClick} style={styles[variant]}>{children}</button>;
}

// ─── 切换按钮（用于 boolean 开关）───

function ToggleBtn({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 8px', borderRadius: RADIUS.sm, border: `1px solid ${COLORS.border}`,
        fontSize: 14, color: active ? COLORS.primary : COLORS.textMuted,
        background: active ? COLORS.primaryLight : COLORS.bgMuted, cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

// ─── 角度/弧度转换 ───

function toDeg(rad: number): number { return rad * 180 / Math.PI; }
function toRad(deg: number): number { return deg * Math.PI / 180; }

// ─── 主面板 ───

export function DemoPanel() {
  const { selectedId, select } = useDemoSelectionStore();
  const entities = useDemoEntityStore((s) => s.entities);
  const nextEntityId = useDemoEntityStore((s) => s.nextEntityId);
  const { execute } = useHistoryStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sliderScope = useMemo(() => buildSliderScope(entities), [entities]);

  const selectedEntity = selectedId ? entities[selectedId] : null;

  const vectors = Object.values(entities).filter((e): e is DemoVector => e.type === 'demoVector');
  const ops = Object.values(entities).filter((e): e is DemoVecOp => e.type === 'demoVecOp');
  const markers = Object.values(entities).filter((e): e is DemoMarker => e.type === 'demoMarker');
  const segments = Object.values(entities).filter((e): e is DemoSegment => e.type === 'demoSegment');
  const circles = Object.values(entities).filter((e): e is DemoCircle => e.type === 'demoCircle');
  const texts = Object.values(entities).filter((e): e is DemoText => e.type === 'demoText');

  function getVecComponents(vec: DemoVector): { dx: number; dy: number; mag: number } | null {
    const startPt = entities[vec.startId] as DemoPoint | undefined;
    const endPt = entities[vec.endId] as DemoPoint | undefined;
    if (!startPt || !endPt) return null;
    const dx = endPt.x - startPt.x;
    const dy = endPt.y - startPt.y;
    return { dx, dy, mag: mag2D([dx, dy] as Vec2D) };
  }

  // ─── 导出 ───
  function handleExport() {
    const snap = useDemoEntityStore.getState().getSnapshot();
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'demo-stage.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── 导入 ───
  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const snap = JSON.parse(ev.target?.result as string);
        const before = useDemoEntityStore.getState().getSnapshot();
        execute(new LoadDemoSnapshotCmd(before, snap));
        select(null);
      } catch {
        alert('JSON 解析失败，请检查文件格式');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div
      style={{
        width: 280,
        minWidth: 280,
        height: '100%',
        background: COLORS.bg,
        borderLeft: `1px solid ${COLORS.border}`,
        display: 'flex',
        flexDirection: 'column',
        fontSize: 14,
        color: COLORS.text,
        overflow: 'hidden',
      }}
    >
      {/* Inspector */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {!selectedEntity && (
          <NoSelectionInspector
            vectors={vectors} ops={ops} markers={markers}
            segments={segments} circles={circles} texts={texts}
            entities={entities} execute={execute}
          />
        )}
        {selectedEntity?.type === 'demoVector' && (
          <VectorInspector
            vec={selectedEntity as DemoVector}
            entities={entities}
            execute={execute}
            nextEntityId={nextEntityId}
            getVecComponents={getVecComponents}
            onDelete={() => select(null)}
            scope={sliderScope}
          />
        )}
        {selectedEntity?.type === 'demoPoint' && (
          <PointInspector pt={selectedEntity as DemoPoint} execute={execute} scope={sliderScope} />
        )}
        {selectedEntity?.type === 'demoVecOp' && (
          <OpInspector op={selectedEntity as DemoVecOp} entities={entities} execute={execute} onDelete={() => select(null)} scope={sliderScope} />
        )}
        {selectedEntity?.type === 'demoMarker' && (
          <MarkerInspector marker={selectedEntity as DemoMarker} entities={entities} execute={execute} onDelete={() => select(null)} scope={sliderScope} />
        )}
        {selectedEntity?.type === 'demoSegment' && (
          <SegmentInspector seg={selectedEntity as DemoSegment} entities={entities} execute={execute} onDelete={() => select(null)} />
        )}
        {selectedEntity?.type === 'demoCircle' && (
          <CircleInspector circle={selectedEntity as DemoCircle} entities={entities} execute={execute} onDelete={() => select(null)} />
        )}
        {selectedEntity?.type === 'demoText' && (
          <TextInspector text={selectedEntity as DemoText} execute={execute} onDelete={() => select(null)} scope={sliderScope} />
        )}
        {selectedEntity?.type === 'demoAngleMark' && (
          <AngleMarkInspector angle={selectedEntity as DemoAngleMark} entities={entities} execute={execute} onDelete={() => select(null)} />
        )}
        {selectedEntity?.type === 'demoDistanceMark' && (
          <DistanceMarkInspector dist={selectedEntity as DemoDistanceMark} entities={entities} execute={execute} onDelete={() => select(null)} />
        )}
        {selectedEntity?.type === 'demoLine' && (
          <LineInspector line={selectedEntity as DemoLine} entities={entities} execute={execute} onDelete={() => select(null)} />
        )}
        {selectedEntity?.type === 'demoRay' && (
          <RayInspector ray={selectedEntity as DemoRay} entities={entities} execute={execute} onDelete={() => select(null)} />
        )}
        {selectedEntity?.type === 'demoPolygon' && (
          <PolygonInspector polygon={selectedEntity as DemoPolygon} entities={entities} execute={execute} onDelete={() => select(null)} />
        )}
        {selectedEntity?.type === 'demoSlider' && (
          <SliderInspector slider={selectedEntity as DemoSlider} entities={entities} execute={execute} onDelete={() => select(null)} />
        )}
      </div>

      {/* 约束轨迹 */}
      <ConstraintSection entities={entities} />

      {/* 导入/导出 */}
      <PanelSection title="场景管理" defaultOpen={true} style={{ borderTop: `1px solid ${COLORS.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <ActionBtn onClick={handleExport}>↓ 导出 JSON</ActionBtn>
          <ActionBtn onClick={() => fileInputRef.current?.click()} variant="primary">↑ 导入 JSON</ActionBtn>
        </div>
        <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
        <ActionBtn
          onClick={() => {
            const before = useDemoEntityStore.getState().getSnapshot();
            execute(new LoadDemoSnapshotCmd(before, { entities: {}, bindings: [], nextId: 1 }));
            select(null);
          }}
          variant="danger"
        >
          🗑 清空场景
        </ActionBtn>
      </PanelSection>
    </div>
  );
}

// ═══════════════════════════════════════════
// MarkerInspector
// ═══════════════════════════════════════════

function MarkerInspector({
  marker, entities, execute, onDelete, scope,
}: {
  marker: DemoMarker;
  entities: Record<string, DemoEntity>;
  execute: (cmd: Command) => void;
  onDelete: () => void;
  scope?: Record<string, number>;
}) {
  const [mrkLabelDraft, setMrkLabelDraft] = useState(marker.label);
  const [mrkLabelError, setMrkLabelError] = useState<string | null>(null);
  const [prevMrkId, setPrevMrkId] = useState(marker.id);
  if (prevMrkId !== marker.id) { setPrevMrkId(marker.id); setMrkLabelDraft(marker.label); setMrkLabelError(null); }

  function handleCoordChange(axis: 'x' | 'y', val: number, expr?: string) {
    const before = axis === 'x' ? { x: marker.x, xExpr: marker.xExpr } : { y: marker.y, yExpr: marker.yExpr };
    const after = axis === 'x' ? { x: val, xExpr: expr } : { y: val, yExpr: expr };
    execute(new UpdateMarkerCmd(marker.id, before, after));
  }

  function handleLabelChange(label: string) {
    setMrkLabelDraft(label);
    if (!label.trim()) { setMrkLabelError('名称不能为空'); return; }
    const conflict = findLabelConflict(label, entities, marker.id);
    if (conflict) { setMrkLabelError(`名称已被${conflict}使用`); return; }
    setMrkLabelError(null);
    execute(new UpdateMarkerCmd(marker.id, { label: marker.label }, { label }));
  }

  function handleColorChange(color: string) {
    execute(new UpdateMarkerCmd(marker.id, { color: marker.color }, { color }));
  }

  function handleShowCoordToggle() {
    execute(new UpdateMarkerCmd(marker.id, { showCoord: marker.showCoord }, { showCoord: !marker.showCoord }));
  }

  function handleDelete() {
    const current = useDemoEntityStore.getState().entities[marker.id] as DemoMarker;
    execute(new DeleteMarkerCmd(current));
    onDelete();
  }

  return (
    <div>
      <PanelSection title={`标记点 ${marker.label}`}>
        <InfoBlock>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: COLORS.textMuted, fontSize: 14, width: 14 }}>x</span>
            <ExprCompactInput value={marker.x} expr={marker.xExpr} onCommit={(v, e) => handleCoordChange('x', v, e)} scope={scope} />
            <span style={{ color: COLORS.textMuted, fontSize: 14, width: 14, marginLeft: 4 }}>y</span>
            <ExprCompactInput value={marker.y} expr={marker.yExpr} onCommit={(v, e) => handleCoordChange('y', v, e)} scope={scope} />
          </div>
        </InfoBlock>
      </PanelSection>

      <PanelSection title="标签">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: mrkLabelError ? 0 : 6 }}>
          <input
            type="text"
            value={mrkLabelDraft}
            maxLength={8}
            onChange={(e) => handleLabelChange(e.target.value)}
            style={{
              flex: 1, padding: '4px 8px', borderRadius: RADIUS.sm,
              border: `1px solid ${mrkLabelError ? '#e53e3e' : COLORS.border}`, fontSize: 14, color: COLORS.text,
            }}
          />
          <ToggleBtn active={marker.showCoord} onClick={handleShowCoordToggle}>
            {marker.showCoord ? '显示坐标' : '隐藏坐标'}
          </ToggleBtn>
        </div>
        {mrkLabelError && (
          <div style={{ fontSize: 11, color: '#e53e3e', marginTop: 2, marginBottom: 6 }}>{mrkLabelError}</div>
        )}
      </PanelSection>

      <PanelSection title="颜色">
        <ColorPicker current={marker.color} onChange={handleColorChange} />
      </PanelSection>

      <PanelSection title="显示">
        <VisibilityOpacityControl
          entity={marker}
          onUpdate={(patch) => execute(new UpdateMarkerCmd(marker.id,
            { visible: marker.visible, opacity: marker.opacity },
            patch,
          ))}
        />
      </PanelSection>

      <PanelSection title="操作">
        <ActionBtn onClick={handleDelete} variant="danger">🗑 删除标记点</ActionBtn>
      </PanelSection>
    </div>
  );
}

// ═══════════════════════════════════════════
// SegmentInspector
// ═══════════════════════════════════════════

function SegmentInspector({
  seg, entities, execute, onDelete,
}: {
  seg: DemoSegment;
  entities: Record<string, import('@/editor/demo/demoTypes').DemoEntity>;
  execute: (cmd: Command) => void;
  onDelete: () => void;
}) {
  const startPt = entities[seg.startId] as DemoMarker | undefined;
  const endPt = entities[seg.endId] as DemoMarker | undefined;
  const dx = (endPt?.x ?? 0) - (startPt?.x ?? 0);
  const dy = (endPt?.y ?? 0) - (startPt?.y ?? 0);
  const length = mag2D([dx, dy] as Vec2D);

  function handleStyleToggle() {
    const newStyle = seg.style === 'solid' ? 'dashed' : 'solid';
    execute(new UpdateGenericCmd(seg.id, { style: seg.style }, { style: newStyle }));
  }

  function handleShowLengthToggle() {
    execute(new UpdateGenericCmd(seg.id, { showLength: seg.showLength }, { showLength: !seg.showLength }));
  }

  function handleColorChange(color: string) {
    execute(new UpdateGenericCmd(seg.id, { color: seg.color }, { color }));
  }

  function handleDelete() {
    const current = useDemoEntityStore.getState().entities[seg.id];
    execute(new DeleteGenericCmd(current, '删除线段'));
    onDelete();
  }

  return (
    <div>
      <PanelSection title="线段">
        <InfoBlock>
          <InfoRow label="起点">{startPt?.label ?? '?'}</InfoRow>
          <InfoRow label="终点">{endPt?.label ?? '?'}</InfoRow>
          <InfoRow label="长度">{length.toFixed(3)}</InfoRow>
        </InfoBlock>
      </PanelSection>

      <PanelSection title="样式">
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <ToggleBtn active={seg.style === 'solid'} onClick={handleStyleToggle}>
            实线
          </ToggleBtn>
          <ToggleBtn active={seg.style === 'dashed'} onClick={handleStyleToggle}>
            虚线
          </ToggleBtn>
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <ToggleBtn active={seg.showLength} onClick={handleShowLengthToggle}>
            {seg.showLength ? '显示长度' : '隐藏长度'}
          </ToggleBtn>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
          <input type="checkbox" checked={!!seg.showSlope}
            onChange={(e) => execute(new UpdateGenericCmd(seg.id, { showSlope: seg.showSlope }, { showSlope: e.target.checked }))}
          />
          显示斜率
        </label>
      </PanelSection>

      <PanelSection title="颜色">
        <ColorPicker current={seg.color} onChange={handleColorChange} />
      </PanelSection>

      <PanelSection title="显示">
        <VisibilityOpacityControl
          entity={seg}
          onUpdate={(patch) => execute(new UpdateGenericCmd(seg.id,
            { visible: seg.visible, opacity: seg.opacity },
            patch,
          ))}
        />
      </PanelSection>

      <PanelSection title="操作">
        <ActionBtn onClick={handleDelete} variant="danger">🗑 删除线段</ActionBtn>
      </PanelSection>
    </div>
  );
}

// ═══════════════════════════════════════════
// CircleInspector
// ═══════════════════════════════════════════

function CircleInspector({
  circle, entities, execute, onDelete,
}: {
  circle: DemoCircle;
  entities: Record<string, import('@/editor/demo/demoTypes').DemoEntity>;
  execute: (cmd: Command) => void;
  onDelete: () => void;
}) {
  const center = entities[circle.centerId] as DemoMarker | undefined;
  const radiusPt = entities[circle.radiusPointId] as DemoMarker | undefined;
  const dx = (radiusPt?.x ?? 0) - (center?.x ?? 0);
  const dy = (radiusPt?.y ?? 0) - (center?.y ?? 0);
  const radius = mag2D([dx, dy] as Vec2D);

  function handleStyleToggle() {
    const newStyle = circle.style === 'solid' ? 'dashed' : 'solid';
    execute(new UpdateGenericCmd(circle.id, { style: circle.style }, { style: newStyle }));
  }

  function handleFillToggle() {
    execute(new UpdateGenericCmd(circle.id, { fill: circle.fill }, { fill: !circle.fill }));
  }

  function handleColorChange(color: string) {
    execute(new UpdateGenericCmd(circle.id, { color: circle.color }, { color }));
  }

  function handleDelete() {
    const current = useDemoEntityStore.getState().entities[circle.id];
    execute(new DeleteGenericCmd(current, '删除圆'));
    onDelete();
  }

  return (
    <div>
      <PanelSection title="圆">
        <InfoBlock>
          <InfoRow label="圆心">{center?.label ?? '?'}</InfoRow>
          <InfoRow label="半径">{radius.toFixed(3)}</InfoRow>
        </InfoBlock>
      </PanelSection>

      <PanelSection title="样式">
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <ToggleBtn active={circle.style === 'solid'} onClick={handleStyleToggle}>
            实线
          </ToggleBtn>
          <ToggleBtn active={circle.style === 'dashed'} onClick={handleStyleToggle}>
            虚线
          </ToggleBtn>
        </div>
        <div>
          <ToggleBtn active={circle.fill} onClick={handleFillToggle}>
            {circle.fill ? '填充' : '无填充'}
          </ToggleBtn>
        </div>
      </PanelSection>

      <PanelSection title="颜色">
        <ColorPicker current={circle.color} onChange={handleColorChange} />
      </PanelSection>

      <PanelSection title="显示">
        <VisibilityOpacityControl
          entity={circle}
          onUpdate={(patch) => execute(new UpdateGenericCmd(circle.id,
            { visible: circle.visible, opacity: circle.opacity },
            patch,
          ))}
        />
      </PanelSection>

      <PanelSection title="操作">
        <ActionBtn onClick={handleDelete} variant="danger">🗑 删除圆</ActionBtn>
      </PanelSection>
    </div>
  );
}

// ═══════════════════════════════════════════
// TextInspector
// ═══════════════════════════════════════════

function TextInspector({
  text, execute, onDelete, scope,
}: {
  text: DemoText;
  execute: (cmd: Command) => void;
  onDelete: () => void;
  scope?: Record<string, number>;
}) {
  function handleTextChange(newText: string) {
    execute(new UpdateTextCmd(text.id, { text: text.text }, { text: newText }));
  }

  function handleFontSizeChange(val: string) {
    const n = parseFloat(val);
    if (isNaN(n) || n <= 0) return;
    execute(new UpdateTextCmd(text.id, { fontSize: text.fontSize }, { fontSize: n }));
  }

  function handleColorChange(color: string) {
    execute(new UpdateTextCmd(text.id, { color: text.color }, { color }));
  }

  function handleCoordChange(axis: 'x' | 'y', val: number, expr?: string) {
    const before = axis === 'x' ? { x: text.x, xExpr: text.xExpr } : { y: text.y, yExpr: text.yExpr };
    const after = axis === 'x' ? { x: val, xExpr: expr } : { y: val, yExpr: expr };
    execute(new UpdateTextCmd(text.id, before, after));
  }

  function handleDelete() {
    const current = useDemoEntityStore.getState().entities[text.id];
    execute(new DeleteGenericCmd(current, '删除文字'));
    onDelete();
  }

  return (
    <div>
      <PanelSection title="文字">
        <textarea
          value={text.text}
          onChange={(e) => handleTextChange(e.target.value)}
          rows={3}
          style={{
            width: '100%', padding: '6px 8px', borderRadius: RADIUS.sm,
            border: `1px solid ${COLORS.border}`, fontSize: 14, color: COLORS.text,
            resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box',
          }}
        />
      </PanelSection>

      <PanelSection title="字号">
        <LabeledInput label="px" value={text.fontSize} onChange={handleFontSizeChange} />
      </PanelSection>

      <PanelSection title="位置">
        <InfoBlock>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: COLORS.textMuted, fontSize: 14, width: 14 }}>x</span>
            <ExprCompactInput value={text.x} expr={text.xExpr} onCommit={(v, e) => handleCoordChange('x', v, e)} scope={scope} />
            <span style={{ color: COLORS.textMuted, fontSize: 14, width: 14, marginLeft: 4 }}>y</span>
            <ExprCompactInput value={text.y} expr={text.yExpr} onCommit={(v, e) => handleCoordChange('y', v, e)} scope={scope} />
          </div>
        </InfoBlock>
      </PanelSection>

      <PanelSection title="渲染">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
          <input type="checkbox" checked={!!text.latex}
            onChange={(e) => execute(new UpdateTextCmd(text.id, { latex: text.latex }, { latex: e.target.checked }))}
          />
          LaTeX 渲染
        </label>
      </PanelSection>

      <PanelSection title="颜色">
        <ColorPicker current={text.color} onChange={handleColorChange} />
      </PanelSection>

      <PanelSection title="显示">
        <VisibilityOpacityControl
          entity={text}
          onUpdate={(patch) => execute(new UpdateTextCmd(text.id,
            { visible: text.visible, opacity: text.opacity },
            patch,
          ))}
        />
      </PanelSection>

      <PanelSection title="操作">
        <ActionBtn onClick={handleDelete} variant="danger">🗑 删除文字</ActionBtn>
      </PanelSection>
    </div>
  );
}

// ═══════════════════════════════════════════
// AngleMarkInspector
// ═══════════════════════════════════════════

function AngleMarkInspector({
  angle, entities, execute, onDelete,
}: {
  angle: DemoAngleMark;
  entities: Record<string, import('@/editor/demo/demoTypes').DemoEntity>;
  execute: (cmd: Command) => void;
  onDelete: () => void;
}) {
  const ptA = entities[angle.pointAId] as DemoMarker | undefined;
  const vertex = entities[angle.vertexId] as DemoMarker | undefined;
  const ptC = entities[angle.pointCId] as DemoMarker | undefined;

  // 计算角度值
  let angleDeg = 0;
  if (ptA && vertex && ptC) {
    const v1x = ptA.x - vertex.x;
    const v1y = ptA.y - vertex.y;
    const v2x = ptC.x - vertex.x;
    const v2y = ptC.y - vertex.y;
    const dot = v1x * v2x + v1y * v2y;
    const m1 = Math.sqrt(v1x * v1x + v1y * v1y);
    const m2 = Math.sqrt(v2x * v2x + v2y * v2y);
    if (m1 > 0 && m2 > 0) {
      const cosVal = Math.max(-1, Math.min(1, dot / (m1 * m2)));
      angleDeg = toDeg(Math.acos(cosVal));
    }
  }

  function handleShowValueToggle() {
    execute(new UpdateGenericCmd(angle.id, { showValue: angle.showValue }, { showValue: !angle.showValue }));
  }

  function handleColorChange(color: string) {
    execute(new UpdateGenericCmd(angle.id, { color: angle.color }, { color }));
  }

  function handleDelete() {
    const current = useDemoEntityStore.getState().entities[angle.id];
    execute(new DeleteGenericCmd(current, '删除角度标注'));
    onDelete();
  }

  return (
    <div>
      <PanelSection title="角度标注">
        <InfoBlock>
          <InfoRow label="点 A">{ptA?.label ?? '?'}</InfoRow>
          <InfoRow label="顶点 B">{vertex?.label ?? '?'}</InfoRow>
          <InfoRow label="点 C">{ptC?.label ?? '?'}</InfoRow>
          <InfoRow label="角度">{angleDeg.toFixed(2)}°</InfoRow>
        </InfoBlock>
      </PanelSection>

      <PanelSection title="显示">
        <ToggleBtn active={angle.showValue} onClick={handleShowValueToggle}>
          {angle.showValue ? '显示角度值' : '隐藏角度值'}
        </ToggleBtn>
      </PanelSection>

      <PanelSection title="颜色">
        <ColorPicker current={angle.color} onChange={handleColorChange} />
      </PanelSection>

      <PanelSection title="显示">
        <VisibilityOpacityControl
          entity={angle}
          onUpdate={(patch) => execute(new UpdateGenericCmd(angle.id,
            { visible: angle.visible, opacity: angle.opacity },
            patch,
          ))}
        />
      </PanelSection>

      <PanelSection title="操作">
        <ActionBtn onClick={handleDelete} variant="danger">🗑 删除角度标注</ActionBtn>
      </PanelSection>
    </div>
  );
}

// ═══════════════════════════════════════════
// DistanceMarkInspector
// ═══════════════════════════════════════════

function DistanceMarkInspector({
  dist, entities, execute, onDelete,
}: {
  dist: DemoDistanceMark;
  entities: Record<string, import('@/editor/demo/demoTypes').DemoEntity>;
  execute: (cmd: Command) => void;
  onDelete: () => void;
}) {
  const ptA = entities[dist.pointAId] as DemoMarker | undefined;
  const ptB = entities[dist.pointBId] as DemoMarker | undefined;
  const dx = (ptB?.x ?? 0) - (ptA?.x ?? 0);
  const dy = (ptB?.y ?? 0) - (ptA?.y ?? 0);
  const distance = mag2D([dx, dy] as Vec2D);

  function handleOffsetChange(val: number) {
    execute(new UpdateGenericCmd(dist.id, { offset: dist.offset }, { offset: val }));
  }

  function handleColorChange(color: string) {
    execute(new UpdateGenericCmd(dist.id, { color: dist.color }, { color }));
  }

  function handleDelete() {
    const current = useDemoEntityStore.getState().entities[dist.id];
    execute(new DeleteGenericCmd(current, '删除距离标注'));
    onDelete();
  }

  return (
    <div>
      <PanelSection title="距离标注">
        <InfoBlock>
          <InfoRow label="点 A">{ptA?.label ?? '?'}</InfoRow>
          <InfoRow label="点 B">{ptB?.label ?? '?'}</InfoRow>
          <InfoRow label="距离">{distance.toFixed(3)}</InfoRow>
        </InfoBlock>
      </PanelSection>

      <PanelSection title="偏移量">
        <InfoBlock>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: COLORS.textMuted, fontSize: 14 }}>offset</span>
            <CompactInput value={parseFloat(dist.offset.toFixed(2))} onCommit={handleOffsetChange} />
          </div>
        </InfoBlock>
      </PanelSection>

      <PanelSection title="颜色">
        <ColorPicker current={dist.color} onChange={handleColorChange} />
      </PanelSection>

      <PanelSection title="显示">
        <VisibilityOpacityControl
          entity={dist}
          onUpdate={(patch) => execute(new UpdateGenericCmd(dist.id,
            { visible: dist.visible, opacity: dist.opacity },
            patch,
          ))}
        />
      </PanelSection>

      <PanelSection title="操作">
        <ActionBtn onClick={handleDelete} variant="danger">🗑 删除距离标注</ActionBtn>
      </PanelSection>
    </div>
  );
}

// ═══════════════════════════════════════════
// LineInspector
// ═══════════════════════════════════════════

function LineInspector({
  line, entities, execute, onDelete,
}: {
  line: DemoLine;
  entities: Record<string, import('@/editor/demo/demoTypes').DemoEntity>;
  execute: (cmd: Command) => void;
  onDelete: () => void;
}) {
  const pt1 = entities[line.point1Id] as DemoMarker | undefined;
  const pt2 = entities[line.point2Id] as DemoMarker | undefined;

  function handleStyleToggle() {
    const newStyle = line.style === 'solid' ? 'dashed' : 'solid';
    execute(new UpdateGenericCmd(line.id, { style: line.style }, { style: newStyle }));
  }

  function handleColorChange(color: string) {
    execute(new UpdateGenericCmd(line.id, { color: line.color }, { color }));
  }

  function handleDelete() {
    const current = useDemoEntityStore.getState().entities[line.id];
    execute(new DeleteGenericCmd(current, '删除直线'));
    onDelete();
  }

  return (
    <div>
      <PanelSection title="直线">
        <InfoBlock>
          <InfoRow label="点 1">{pt1 ? `${pt1.label} (${pt1.x.toFixed(1)}, ${pt1.y.toFixed(1)})` : '?'}</InfoRow>
          <InfoRow label="点 2">{pt2 ? `${pt2.label} (${pt2.x.toFixed(1)}, ${pt2.y.toFixed(1)})` : '?'}</InfoRow>
        </InfoBlock>
      </PanelSection>

      <PanelSection title="样式">
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <ToggleBtn active={line.style === 'solid'} onClick={handleStyleToggle}>
            实线
          </ToggleBtn>
          <ToggleBtn active={line.style === 'dashed'} onClick={handleStyleToggle}>
            虚线
          </ToggleBtn>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
          <input type="checkbox" checked={line.showSlope}
            onChange={(e) => execute(new UpdateGenericCmd(line.id, { showSlope: line.showSlope }, { showSlope: e.target.checked }))}
          />
          显示斜率
        </label>
      </PanelSection>

      <PanelSection title="颜色">
        <ColorPicker current={line.color} onChange={handleColorChange} />
      </PanelSection>

      <PanelSection title="显示">
        <VisibilityOpacityControl
          entity={line}
          onUpdate={(patch) => execute(new UpdateGenericCmd(line.id,
            { visible: line.visible, opacity: line.opacity },
            patch,
          ))}
        />
      </PanelSection>

      <PanelSection title="操作">
        <ActionBtn onClick={handleDelete} variant="danger">🗑 删除直线</ActionBtn>
      </PanelSection>
    </div>
  );
}

// ═══════════════════════════════════════════
// RayInspector
// ═══════════════════════════════════════════

function RayInspector({
  ray, entities, execute, onDelete,
}: {
  ray: DemoRay;
  entities: Record<string, import('@/editor/demo/demoTypes').DemoEntity>;
  execute: (cmd: Command) => void;
  onDelete: () => void;
}) {
  const origin = entities[ray.originId] as DemoMarker | undefined;
  const through = entities[ray.throughId] as DemoMarker | undefined;

  function handleStyleToggle() {
    const newStyle = ray.style === 'solid' ? 'dashed' : 'solid';
    execute(new UpdateGenericCmd(ray.id, { style: ray.style }, { style: newStyle }));
  }

  function handleColorChange(color: string) {
    execute(new UpdateGenericCmd(ray.id, { color: ray.color }, { color }));
  }

  function handleDelete() {
    const current = useDemoEntityStore.getState().entities[ray.id];
    execute(new DeleteGenericCmd(current, '删除射线'));
    onDelete();
  }

  return (
    <div>
      <PanelSection title="射线">
        <InfoBlock>
          <InfoRow label="起点">{origin ? `${origin.label} (${origin.x.toFixed(1)}, ${origin.y.toFixed(1)})` : '?'}</InfoRow>
          <InfoRow label="方向点">{through ? `${through.label} (${through.x.toFixed(1)}, ${through.y.toFixed(1)})` : '?'}</InfoRow>
        </InfoBlock>
      </PanelSection>

      <PanelSection title="样式">
        <div style={{ display: 'flex', gap: 6 }}>
          <ToggleBtn active={ray.style === 'solid'} onClick={handleStyleToggle}>
            实线
          </ToggleBtn>
          <ToggleBtn active={ray.style === 'dashed'} onClick={handleStyleToggle}>
            虚线
          </ToggleBtn>
        </div>
      </PanelSection>

      <PanelSection title="颜色">
        <ColorPicker current={ray.color} onChange={handleColorChange} />
      </PanelSection>

      <PanelSection title="显示">
        <VisibilityOpacityControl
          entity={ray}
          onUpdate={(patch) => execute(new UpdateGenericCmd(ray.id,
            { visible: ray.visible, opacity: ray.opacity },
            patch,
          ))}
        />
      </PanelSection>

      <PanelSection title="操作">
        <ActionBtn onClick={handleDelete} variant="danger">🗑 删除射线</ActionBtn>
      </PanelSection>
    </div>
  );
}

// ═══════════════════════════════════════════
// PolygonInspector
// ═══════════════════════════════════════════

function PolygonInspector({
  polygon, entities, execute, onDelete,
}: {
  polygon: DemoPolygon;
  entities: Record<string, import('@/editor/demo/demoTypes').DemoEntity>;
  execute: (cmd: Command) => void;
  onDelete: () => void;
}) {
  const vertices = polygon.vertexIds.map((vid) => entities[vid] as DemoMarker | undefined);

  function handleColorChange(color: string) {
    execute(new UpdateGenericCmd(polygon.id, { color: polygon.color }, { color }));
  }

  function handleFillToggle() {
    execute(new UpdateGenericCmd(polygon.id, { fill: polygon.fill }, { fill: !polygon.fill }));
  }

  function handleShowAreaToggle() {
    execute(new UpdateGenericCmd(polygon.id, { showArea: polygon.showArea }, { showArea: !polygon.showArea }));
  }

  function handleDelete() {
    const current = useDemoEntityStore.getState().entities[polygon.id];
    execute(new DeleteGenericCmd(current, '删除多边形'));
    onDelete();
  }

  return (
    <div>
      <PanelSection title="多边形">
        <InfoBlock>
          <InfoRow label="顶点数">{polygon.vertexIds.length}</InfoRow>
          {vertices.map((v, i) => (
            <InfoRow key={polygon.vertexIds[i]} label={`顶点 ${i + 1}`}>
              {v ? `${v.label} (${v.x.toFixed(1)}, ${v.y.toFixed(1)})` : '?'}
            </InfoRow>
          ))}
        </InfoBlock>
      </PanelSection>

      <PanelSection title="样式">
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <ToggleBtn active={polygon.fill} onClick={handleFillToggle}>
            {polygon.fill ? '填充' : '无填充'}
          </ToggleBtn>
        </div>
        <div>
          <ToggleBtn active={polygon.showArea} onClick={handleShowAreaToggle}>
            {polygon.showArea ? '显示面积' : '隐藏面积'}
          </ToggleBtn>
        </div>
      </PanelSection>

      <PanelSection title="颜色">
        <ColorPicker current={polygon.color} onChange={handleColorChange} />
      </PanelSection>

      <PanelSection title="显示">
        <VisibilityOpacityControl
          entity={polygon}
          onUpdate={(patch) => execute(new UpdateGenericCmd(polygon.id,
            { visible: polygon.visible, opacity: polygon.opacity },
            patch,
          ))}
        />
      </PanelSection>

      <PanelSection title="操作">
        <ActionBtn onClick={handleDelete} variant="danger">🗑 删除多边形</ActionBtn>
      </PanelSection>
    </div>
  );
}

// ═══════════════════════════════════════════
// SliderInspector
// ═══════════════════════════════════════════

const RESERVED_SLIDER_NAMES = new Set([
  'pi', 'e', 'i', 'Infinity', 'NaN', 'sqrt', 'sin', 'cos', 'tan', 'abs',
  'log', 'ln', 'exp', 'ceil', 'floor', 'round', 'min', 'max', 'mod',
  'asin', 'acos', 'atan', 'atan2', 'frac',
]);

function isValidSliderLabel(label: string): boolean {
  if (!label || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(label)) return false;
  return !RESERVED_SLIDER_NAMES.has(label);
}

function SliderInspector({
  slider, entities, execute, onDelete,
}: {
  slider: DemoSlider;
  entities: Record<string, DemoEntity>;
  execute: (cmd: Command) => void;
  onDelete: () => void;
}) {
  const [labelDraft, setLabelDraft] = useState(slider.label);
  const [sliderLabelError, setSliderLabelError] = useState<string | null>(null);

  function handleLabelChange(label: string) {
    setLabelDraft(label);
    if (!isValidSliderLabel(label)) {
      setSliderLabelError('仅限字母/数字组合（字母开头），不可用 pi、sqrt 等保留名');
      return;
    }
    const conflict = findLabelConflict(label, entities, slider.id);
    if (conflict) {
      setSliderLabelError(`名称已被${conflict}使用`);
      return;
    }
    setSliderLabelError(null);
    execute(new UpdateGenericCmd(slider.id, { label: slider.label }, { label }));
  }

  function handleMinChange(val: string) {
    const n = parseFloat(val);
    if (isNaN(n)) return;
    execute(new UpdateGenericCmd(slider.id, { min: slider.min }, { min: n }));
  }

  function handleMaxChange(val: string) {
    const n = parseFloat(val);
    if (isNaN(n)) return;
    execute(new UpdateGenericCmd(slider.id, { max: slider.max }, { max: n }));
  }

  function handleStepChange(val: string) {
    const n = parseFloat(val);
    if (isNaN(n) || n <= 0) return;
    execute(new UpdateGenericCmd(slider.id, { step: slider.step }, { step: n }));
  }

  function handleValueChange(val: number) {
    execute(new UpdateGenericCmd(slider.id, { value: slider.value }, { value: val }));
  }

  function handleWidthChange(val: string) {
    const n = parseFloat(val);
    if (isNaN(n) || n <= 0) return;
    execute(new UpdateGenericCmd(slider.id, { width: slider.width }, { width: n }));
  }

  function handleColorChange(color: string) {
    execute(new UpdateGenericCmd(slider.id, { color: slider.color }, { color }));
  }

  function handleDelete() {
    const current = useDemoEntityStore.getState().entities[slider.id];
    execute(new DeleteGenericCmd(current, '删除滑块'));
    onDelete();
  }

  return (
    <div>
      <PanelSection title="滑块">
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 14, color: COLORS.textMuted, marginRight: 6 }}>标签</span>
          <input
            type="text"
            value={labelDraft}
            maxLength={16}
            placeholder="字母开头，如 k、t1"
            onChange={(e) => handleLabelChange(e.target.value)}
            style={{
              flex: 1, padding: '4px 8px', borderRadius: RADIUS.sm,
              border: `1px solid ${sliderLabelError ? '#e53e3e' : COLORS.border}`, fontSize: 14, color: COLORS.text,
            }}
          />
          {sliderLabelError && (
            <div style={{ fontSize: 11, color: '#e53e3e', marginTop: 2 }}>
              {sliderLabelError}
            </div>
          )}
        </div>
        <InfoBlock>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <LabeledInput label="min" value={slider.min} onChange={handleMinChange} />
            <LabeledInput label="max" value={slider.max} onChange={handleMaxChange} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <LabeledInput label="step" value={slider.step} onChange={handleStepChange} />
            <LabeledInput label="宽度" value={slider.width} onChange={handleWidthChange} />
          </div>
        </InfoBlock>
      </PanelSection>

      <PanelSection title="当前值">
        <InfoBlock>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="range"
              min={slider.min} max={slider.max} step={slider.step}
              value={slider.value}
              onChange={(e) => handleValueChange(parseFloat(e.target.value))}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: 14, fontWeight: 600, minWidth: 40, textAlign: 'right' }}>
              {slider.value}
            </span>
          </div>
        </InfoBlock>
      </PanelSection>

      <PanelSection title="颜色">
        <ColorPicker current={slider.color} onChange={handleColorChange} />
      </PanelSection>

      <PanelSection title="显示">
        <VisibilityOpacityControl
          entity={slider}
          onUpdate={(patch) => execute(new UpdateGenericCmd(slider.id,
            { visible: slider.visible, opacity: slider.opacity },
            patch,
          ))}
        />
      </PanelSection>

      <PanelSection title="操作">
        <ActionBtn onClick={handleDelete} variant="danger">🗑 删除滑块</ActionBtn>
      </PanelSection>
    </div>
  );
}

// ─── 无选中：显示实体列表（可展开编辑）───

function NoSelectionInspector({
  vectors, ops, markers, segments, circles, texts, entities, execute,
}: {
  vectors: DemoVector[];
  ops: DemoVecOp[];
  markers: DemoMarker[];
  segments: DemoSegment[];
  circles: DemoCircle[];
  texts: DemoText[];
  entities: Record<string, import('@/editor/demo/demoTypes').DemoEntity>;
  execute: (cmd: Command) => void;
}) {
  const { select } = useDemoSelectionStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const bindings = useDemoEntityStore((s) => s.bindings);
  const nextEntityId = useDemoEntityStore((s) => s.nextEntityId);

  function handleToggleExpand(vecId: string) {
    setExpandedId((prev) => prev === vecId ? null : vecId);
  }

  function commitDxDy(vec: DemoVector, newDx: number, newDy: number) {
    const startPt = entities[vec.startId] as DemoPoint | undefined;
    const endPt = entities[vec.endId] as DemoPoint | undefined;
    if (!startPt || !endPt) return;
    const before = { x: endPt.x, y: endPt.y, xExpr: endPt.xExpr, yExpr: endPt.yExpr };
    const after = { x: startPt.x + newDx, y: startPt.y + newDy, xExpr: undefined as string | undefined, yExpr: undefined as string | undefined };
    execute(new MovePointCmd(endPt.id, before, after));
  }

  function commitAngle(vec: DemoVector, newAngleDeg: number) {
    const startPt = entities[vec.startId] as DemoPoint | undefined;
    const endPt = entities[vec.endId] as DemoPoint | undefined;
    if (!startPt || !endPt) return;
    const dx = endPt.x - startPt.x;
    const dy = endPt.y - startPt.y;
    const m = mag2D([dx, dy] as Vec2D);
    const thetaRad = toRad(newAngleDeg);
    const newDx = m * Math.cos(thetaRad);
    const newDy = m * Math.sin(thetaRad);
    const before = { x: endPt.x, y: endPt.y, xExpr: endPt.xExpr, yExpr: endPt.yExpr };
    const after = { x: startPt.x + newDx, y: startPt.y + newDy, xExpr: undefined as string | undefined, yExpr: undefined as string | undefined };
    execute(new MovePointCmd(endPt.id, before, after));
  }

  // ─── 列表项样式 ───
  const listItemStyle: React.CSSProperties = {
    padding: '6px 8px', marginBottom: 4, borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.border}`, cursor: 'pointer',
    background: COLORS.bgMuted, fontSize: 14,
    display: 'flex', alignItems: 'center', gap: 6,
  };

  return (
    <div>
      <PanelSection title="向量列表">
        {vectors.length === 0 && (
          <div style={{ color: COLORS.textMuted, fontSize: 14, marginBottom: 8 }}>
            暂无向量 — 使用"创建向量"工具
          </div>
        )}
        {vectors.map((v) => {
          const sp = entities[v.startId] as DemoPoint | undefined;
          const ep = entities[v.endId] as DemoPoint | undefined;
          const dx = ep && sp ? ep.x - sp.x : 0;
          const dy = ep && sp ? ep.y - sp.y : 0;
          const m = mag2D([dx, dy] as Vec2D);
          const angleDeg = toDeg(Math.atan2(dy, dx));
          const isExpanded = expandedId === v.id;
          return (
            <div key={v.id} style={{ marginBottom: 4 }}>
              <div
                style={{
                  padding: '6px 8px', borderRadius: RADIUS.sm,
                  border: `1px solid ${COLORS.border}`, cursor: 'pointer',
                  background: isExpanded ? COLORS.primaryLight : COLORS.bgMuted,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {/* 颜色圆点 → 点击选中进入 VectorInspector */}
                <div
                  onClick={(e) => { e.stopPropagation(); select(v.id); }}
                  style={{
                    width: 14, height: 14, borderRadius: '50%', background: v.color, flexShrink: 0,
                    border: '2px solid transparent', boxSizing: 'border-box', cursor: 'pointer',
                  }}
                  title="选中此向量"
                />
                {/* 向量信息行 → 点击展开/收起 */}
                <div
                  onClick={() => handleToggleExpand(v.id)}
                  style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <span style={{ fontWeight: 600, fontSize: 14 }}>
                    {toVecLatex(v.label) ? <InlineLatex latex={toVecLatex(v.label)!} /> : v.label}
                  </span>
                  <span style={{ color: COLORS.textMuted, fontSize: 14 }}>
                    ({dx.toFixed(1)}, {dy.toFixed(1)}) |{m.toFixed(2)}|
                  </span>
                </div>
                <span style={{
                  fontSize: 14, color: COLORS.textMuted, transition: 'transform 0.15s',
                  transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                }}>▼</span>
              </div>
              {/* 展开编辑区 */}
              {isExpanded && (
                <InfoBlock>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: COLORS.textMuted, fontSize: 14, width: 20 }}>dx</span>
                    <ExprCompactInput value={dx} onCommit={(newDx) => commitDxDy(v, newDx, dy)} />
                    <span style={{ color: COLORS.textMuted, fontSize: 14, width: 20, marginLeft: 4 }}>dy</span>
                    <ExprCompactInput value={dy} onCommit={(newDy) => commitDxDy(v, dx, newDy)} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: COLORS.textMuted, fontSize: 14, width: 20 }}>θ°</span>
                    <CompactInput value={parseFloat(angleDeg.toFixed(1))} onCommit={(newAngle) => commitAngle(v, newAngle)} />
                    <span style={{ color: COLORS.textMuted, fontSize: 14, marginLeft: 8 }}>|v| = {m.toFixed(3)}</span>
                  </div>
                </InfoBlock>
              )}
            </div>
          );
        })}
      </PanelSection>

      {ops.length > 0 && (
        <PanelSection title="运算列表">
          {ops.map((op) => {
            const l1 = entityLabel(op.vec1Id, entities);
            const l2 = op.vec2Id ? entityLabel(op.vec2Id, entities) : undefined;
            return (
              <div
                key={op.id}
                onClick={() => select(op.id)}
                style={{
                  padding: '6px 8px', marginBottom: 4, borderRadius: RADIUS.sm,
                  border: `1px solid ${COLORS.border}`, cursor: 'pointer',
                  background: COLORS.bgMuted, fontSize: 14,
                }}
              >
                <span style={{ fontWeight: 600 }}>{opKindText(op.kind)}</span>
                <span style={{ color: COLORS.textMuted, marginLeft: 4 }}>
                  {toVecLatex(l1) ? <InlineLatex latex={toVecLatex(l1)!} /> : l1}
                  {l2 ? <> {opSymbol(op.kind)} {toVecLatex(l2) ? <InlineLatex latex={toVecLatex(l2)!} /> : l2}</> : ''}
                </span>
              </div>
            );
          })}
        </PanelSection>
      )}

      {markers.length > 0 && (
        <PanelSection title="标记点列表">
          {markers.map((mk) => (
            <div
              key={mk.id}
              onClick={() => select(mk.id)}
              style={listItemStyle}
            >
              <div style={{
                width: 10, height: 10, borderRadius: '50%', background: mk.color, flexShrink: 0,
              }} />
              <span style={{ fontWeight: 600 }}>{mk.label}</span>
              <span style={{ color: COLORS.textMuted }}>
                ({mk.x.toFixed(1)}, {mk.y.toFixed(1)})
              </span>
            </div>
          ))}
        </PanelSection>
      )}

      {segments.length > 0 && (
        <PanelSection title="线段列表">
          {segments.map((seg) => {
            const sp = entities[seg.startId] as DemoMarker | undefined;
            const ep = entities[seg.endId] as DemoMarker | undefined;
            return (
              <div
                key={seg.id}
                onClick={() => select(seg.id)}
                style={listItemStyle}
              >
                <div style={{
                  width: 10, height: 10, borderRadius: '50%', background: seg.color, flexShrink: 0,
                }} />
                <span style={{ fontWeight: 600 }}>{sp?.label ?? '?'} — {ep?.label ?? '?'}</span>
                <span style={{ color: COLORS.textMuted, fontSize: 12 }}>
                  {seg.style === 'dashed' ? '虚线' : '实线'}
                </span>
              </div>
            );
          })}
        </PanelSection>
      )}

      {circles.length > 0 && (
        <PanelSection title="圆列表">
          {circles.map((c) => {
            const center = entities[c.centerId] as DemoMarker | undefined;
            const rPt = entities[c.radiusPointId] as DemoMarker | undefined;
            const cdx = (rPt?.x ?? 0) - (center?.x ?? 0);
            const cdy = (rPt?.y ?? 0) - (center?.y ?? 0);
            const r = mag2D([cdx, cdy] as Vec2D);
            return (
              <div
                key={c.id}
                onClick={() => select(c.id)}
                style={listItemStyle}
              >
                <div style={{
                  width: 10, height: 10, borderRadius: '50%', background: c.color, flexShrink: 0,
                }} />
                <span style={{ fontWeight: 600 }}>{center?.label ?? '?'}</span>
                <span style={{ color: COLORS.textMuted }}>r={r.toFixed(2)}</span>
              </div>
            );
          })}
        </PanelSection>
      )}

      {texts.length > 0 && (
        <PanelSection title="文字列表">
          {texts.map((t) => (
            <div
              key={t.id}
              onClick={() => select(t.id)}
              style={listItemStyle}
            >
              <div style={{
                width: 10, height: 10, borderRadius: '50%', background: t.color, flexShrink: 0,
              }} />
              <span style={{
                fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160,
              }}>
                {t.text || '(空)'}
              </span>
            </div>
          ))}
        </PanelSection>
      )}

      <AlgebraSection execute={execute} nextEntityId={nextEntityId} />

      <BindingSection
        vectors={vectors}
        entities={entities}
        bindings={bindings}
        execute={execute}
        nextEntityId={nextEntityId}
      />
    </div>
  );
}

// ─── 代数输入 section ───

function AlgebraSection({ execute, nextEntityId }: {
  execute: (cmd: Command) => void;
  nextEntityId: () => string;
}) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = useCallback(() => {
    if (!value.trim()) return;
    const parsed = parseEquation(value.trim());
    if (!parsed) { setError('无法识别的格式'); return; }

    if (parsed.kind === 'point') {
      const id = nextEntityId();
      execute(new CreateMarkerCmd({ id, type: 'demoMarker', x: parsed.x, y: parsed.y, label: 'P', color: DEMO_COLORS[0], showCoord: true }));
    } else if (parsed.kind === 'line' || parsed.kind === 'verticalLine') {
      let x1: number, y1: number, x2: number, y2: number;
      if (parsed.kind === 'verticalLine') {
        x1 = parsed.x; y1 = -8; x2 = parsed.x; y2 = 8;
      } else {
        x1 = -8; y1 = parsed.slope * -8 + parsed.intercept;
        x2 = 8; y2 = parsed.slope * 8 + parsed.intercept;
      }
      const id1 = nextEntityId();
      const id2 = nextEntityId();
      const lineId = nextEntityId();
      execute(new CreateConstructionCmd('代数创建直线', [
        { id: id1, type: 'demoMarker', x: x1, y: y1, label: '', color: '#999', showCoord: false },
        { id: id2, type: 'demoMarker', x: x2, y: y2, label: '', color: '#999', showCoord: false },
        { id: lineId, type: 'demoLine', point1Id: id1, point2Id: id2, color: DEMO_COLORS[5], style: 'solid', showSlope: true },
      ] as DemoEntity[]));
    } else if (parsed.kind === 'circle') {
      const centerId = nextEntityId();
      const radiusId = nextEntityId();
      const circleId = nextEntityId();
      execute(new CreateConstructionCmd('代数创建圆', [
        { id: centerId, type: 'demoMarker', x: parsed.cx, y: parsed.cy, label: 'O', color: '#999', showCoord: true },
        { id: radiusId, type: 'demoMarker', x: parsed.cx + parsed.r, y: parsed.cy, label: '', color: '#999', showCoord: false },
        { id: circleId, type: 'demoCircle', centerId, radiusPointId: radiusId, color: DEMO_COLORS[4], style: 'solid', fill: false },
      ] as DemoEntity[]));
    }

    setValue('');
    setError('');
  }, [value, execute, nextEntityId]);

  return (
    <PanelSection title="代数输入">
      <div style={{ display: 'flex', gap: 4 }}>
        <input
          type="text"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
          placeholder="y=2x+1, x=3, (2,3)"
          style={{
            flex: 1, padding: '4px 8px', fontSize: 13,
            border: `1px solid ${error ? COLORS.error : COLORS.border}`,
            borderRadius: RADIUS.sm, outline: 'none',
            background: COLORS.bgMuted, color: COLORS.text,
            minWidth: 0,
          }}
        />
        <button
          onClick={handleSubmit}
          style={{
            padding: '4px 10px', fontSize: 13, cursor: 'pointer',
            borderRadius: RADIUS.sm, border: `1px solid ${COLORS.primary}`,
            background: COLORS.primaryLight, color: COLORS.primary,
            fontWeight: 600, flexShrink: 0,
          }}
        >
          添加
        </button>
      </div>
      {error && <span style={{ fontSize: 11, color: COLORS.error, marginTop: 2 }}>{error}</span>}
      <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4 }}>
        支持：y=mx+b, x=c, (x-a)²+(y-b)²=r², (x,y)
      </div>
    </PanelSection>
  );
}

// ─── 绑定端点 ───

function BindingSection({
  vectors, entities, bindings, execute, nextEntityId,
}: {
  vectors: DemoVector[];
  entities: Record<string, import('@/editor/demo/demoTypes').DemoEntity>;
  bindings: DemoBinding[];
  execute: (cmd: Command) => void;
  nextEntityId: () => string;
}) {
  const [pickState, setPickState] = useState<{
    vecId: string;
    endpoint: 'start' | 'end';
  } | null>(null);

  function endpointLabel(vecLabel: string, ep: 'start' | 'end'): React.ReactNode {
    const latex = toVecLatex(vecLabel);
    const suffix = ep === 'start' ? '起点' : '终点';
    if (latex) return <><InlineLatex latex={latex} /> {suffix}</>;
    return `${vecLabel} ${suffix}`;
  }

  function findVecForPoint(ptId: string): DemoVector | undefined {
    return vectors.find((v) => v.startId === ptId || v.endId === ptId);
  }

  function isPointBound(ptId: string): boolean {
    return bindings.some((b) => b.pointA === ptId || b.pointB === ptId);
  }

  /** 端点是否为约束向量的锚点（不可移动） */
  function isAnchorPoint(ptId: string): boolean {
    for (const v of vectors) {
      if (!v.constraint || v.constraint === 'free') continue;
      const locksStart = v.constraint === 'fixedStart' || v.constraint === 'lineEnd' || v.constraint === 'regionEnd';
      const locksEnd = v.constraint === 'fixedEnd' || v.constraint === 'lineStart' || v.constraint === 'regionStart';
      if ((locksStart && v.startId === ptId) || (locksEnd && v.endId === ptId)) return true;
    }
    return false;
  }

  /** 获取端点的约束信息（仅约束向量的自由端，圆约束） */
  function getConstraint(ptId: string): { anchorId: string; length: number } | null {
    for (const v of vectors) {
      if (!v.constraint || v.constraint === 'free' || !v.constraintLength) continue;
      if (v.constraint === 'fixedStart' && v.endId === ptId)
        return { anchorId: v.startId, length: v.constraintLength };
      if (v.constraint === 'fixedEnd' && v.startId === ptId)
        return { anchorId: v.endId, length: v.constraintLength };
    }
    return null;
  }

  /** 检测两端点绑定是否矛盾 */
  function checkConflict(ptIdA: string, ptIdB: string): string | null {
    const anchorA = isAnchorPoint(ptIdA);
    const anchorB = isAnchorPoint(ptIdB);
    // 两个锚点都不可移动
    if (anchorA && anchorB) return '两个锚点均不可移动';
    // 一个锚点 + 另一个也是锚点的情况已覆盖；一个锚点 + 自由端 → 自由端必须能到达锚点位置
    if (anchorA || anchorB) {
      const anchorPtId = anchorA ? ptIdA : ptIdB;
      const freePtId = anchorA ? ptIdB : ptIdA;
      const freeConst = getConstraint(freePtId);
      if (freeConst) {
        // 自由端有约束：检查锚点是否在约束圆上
        const anchorPt = entities[anchorPtId] as DemoPoint | undefined;
        const circleCenter = entities[freeConst.anchorId] as DemoPoint | undefined;
        if (anchorPt && circleCenter) {
          const d = Math.sqrt((anchorPt.x - circleCenter.x) ** 2 + (anchorPt.y - circleCenter.y) ** 2);
          if (Math.abs(d - freeConst.length) > 0.1)
            return '锚点不在约束圆上，无法满足';
        }
      }
      return null;
    }
    // 两个都是约束自由端 → 检查两圆是否相交
    const cA = getConstraint(ptIdA);
    const cB = getConstraint(ptIdB);
    if (cA && cB) {
      const centerA = entities[cA.anchorId] as DemoPoint | undefined;
      const centerB = entities[cB.anchorId] as DemoPoint | undefined;
      if (centerA && centerB) {
        const d = Math.sqrt((centerA.x - centerB.x) ** 2 + (centerA.y - centerB.y) ** 2);
        if (d > cA.length + cB.length + 0.01)
          return '两约束圆不相交，无法满足';
        if (d + 0.01 < Math.abs(cA.length - cB.length))
          return '一约束圆被另一个包含且不相交';
      }
    }
    return null;
  }

  function handleSelect(vecId: string, ep: 'start' | 'end') {
    const vec = entities[vecId] as DemoVector | undefined;
    if (!vec) return;
    const ptId = ep === 'start' ? vec.startId : vec.endId;

    if (!pickState) {
      if (isPointBound(ptId)) return;
      setPickState({ vecId, endpoint: ep });
      return;
    }

    if (vecId === pickState.vecId) return;
    const firstVec = entities[pickState.vecId] as DemoVector | undefined;
    if (!firstVec) { setPickState(null); return; }
    const firstPtId = pickState.endpoint === 'start' ? firstVec.startId : firstVec.endId;
    if (isPointBound(ptId)) { setPickState(null); return; }

    const ptA = entities[firstPtId] as DemoPoint | undefined;
    const ptB = entities[ptId] as DemoPoint | undefined;
    if (!ptA || !ptB) { setPickState(null); return; }

    // 创建绑定：移动 B 到 A 的位置（若 A 是锚则 B 去 A；否则 B 去 A 再投影）
    let targetX = ptA.x, targetY = ptA.y;
    // 若 B 有约束，投影到 B 的约束圆上
    const constB = getConstraint(ptId);
    if (constB) {
      const center = entities[constB.anchorId] as DemoPoint | undefined;
      if (center) {
        const dx = targetX - center.x, dy = targetY - center.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0.001) {
          targetX = center.x + dx / dist * constB.length;
          targetY = center.y + dy / dist * constB.length;
        }
      }
    }
    // 若 A 有约束且不是锚，A 也需要投影到约束圆（保持一致）
    const constA = getConstraint(firstPtId);
    if (constA && !isAnchorPoint(firstPtId)) {
      const center = entities[constA.anchorId] as DemoPoint | undefined;
      if (center) {
        const dx = targetX - center.x, dy = targetY - center.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0.001) {
          targetX = center.x + dx / dist * constA.length;
          targetY = center.y + dy / dist * constA.length;
        }
      }
    }

    const bindingId = nextEntityId();
    const binding: DemoBinding = { id: bindingId, pointA: firstPtId, pointB: ptId };
    execute(new BindPointsCmd(binding, { x: ptB.x, y: ptB.y }, { x: targetX, y: targetY }));
    // 同时移动 A 到目标位置（若 A 不是锚且位置变化）
    if (!isAnchorPoint(firstPtId) && (ptA.x !== targetX || ptA.y !== targetY)) {
      execute(new MovePointCmd(firstPtId, { x: ptA.x, y: ptA.y }, { x: targetX, y: targetY }));
    }
    setPickState(null);
  }

  function handleUnbind(binding: DemoBinding) {
    execute(new UnbindPointsCmd(binding));
  }

  // 构建端点选项
  const endpointOptions: { vecId: string; vecLabel: string; ep: 'start' | 'end'; ptId: string }[] = [];
  for (const v of vectors) {
    endpointOptions.push({ vecId: v.id, vecLabel: v.label, ep: 'start', ptId: v.startId });
    endpointOptions.push({ vecId: v.id, vecLabel: v.label, ep: 'end', ptId: v.endId });
  }

  return (
    <PanelSection title="绑定端点">
      {vectors.length < 2 && (
        <div style={{ fontSize: 14, color: COLORS.textMuted, marginBottom: 6 }}>
          至少需要两个向量才能绑定端点
        </div>
      )}

      {vectors.length >= 2 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 14, color: COLORS.textMuted, marginBottom: 6 }}>
            {!pickState ? '选择第一个端点：' : '选择第二个端点（不同向量）：'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {endpointOptions.map(({ vecId, vecLabel, ep, ptId }) => {
              const bound = isPointBound(ptId);
              const anchor = isAnchorPoint(ptId);
              const isFirst = pickState && pickState.vecId === vecId && pickState.endpoint === ep;
              // 禁用条件
              let disabled = bound || (pickState ? vecId === pickState.vecId : false);
              let tooltip = '';
              if (anchor && !pickState) {
                // 锚点作为第一选择时不禁用（另一端可能是自由端来到它）
              }
              // 第二步：检查矛盾
              if (pickState && !disabled && !isFirst) {
                const firstVec = entities[pickState.vecId] as DemoVector | undefined;
                if (firstVec) {
                  const firstPtId = pickState.endpoint === 'start' ? firstVec.startId : firstVec.endId;
                  const conflict = checkConflict(firstPtId, ptId);
                  if (conflict) {
                    disabled = true;
                    tooltip = conflict;
                  }
                }
              }
              return (
                <button
                  key={ptId}
                  onClick={() => !disabled && handleSelect(vecId, ep)}
                  title={tooltip || (anchor ? '锚点（固定）' : undefined)}
                  style={{
                    padding: '4px 8px', fontSize: 14, borderRadius: RADIUS.sm,
                    border: `1px solid ${isFirst ? COLORS.primary : COLORS.border}`,
                    background: isFirst ? COLORS.primaryLight : disabled ? COLORS.bgMuted : 'transparent',
                    color: isFirst ? COLORS.primary : disabled ? COLORS.textMuted : COLORS.text,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    fontWeight: isFirst ? 600 : 400,
                    opacity: disabled && !isFirst ? 0.5 : 1,
                  }}
                >
                  {endpointLabel(vecLabel, ep)}{anchor ? ' 🔒' : ''}
                </button>
              );
            })}
          </div>
          {pickState && (
            <button
              onClick={() => setPickState(null)}
              style={{
                marginTop: 4, padding: '2px 8px', fontSize: 14, color: COLORS.textMuted,
                border: 'none', background: 'transparent', cursor: 'pointer',
              }}
            >
              取消
            </button>
          )}
        </div>
      )}

      {/* 已有绑定列表 */}
      {bindings.length > 0 && (
        <div>
          <div style={{ fontSize: 14, color: COLORS.textMuted, marginBottom: 4 }}>已绑定：</div>
          {bindings.map((b) => {
            const vA = findVecForPoint(b.pointA);
            const vB = findVecForPoint(b.pointB);
            const epA = vA ? (vA.startId === b.pointA ? '起点' : '终点') : '?';
            const epB = vB ? (vB.startId === b.pointB ? '起点' : '终点') : '?';
            return (
              <div key={b.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '4px 8px', marginBottom: 4, borderRadius: RADIUS.sm,
                border: `1px solid ${COLORS.border}`, background: COLORS.bgMuted, fontSize: 14,
              }}>
                <span>
                  <b>{vA?.label && toVecLatex(vA.label) ? <InlineLatex latex={toVecLatex(vA.label)!} /> : (vA?.label ?? '?')}</b> {epA} ⟷ <b>{vB?.label && toVecLatex(vB.label) ? <InlineLatex latex={toVecLatex(vB.label)!} /> : (vB?.label ?? '?')}</b> {epB}
                </span>
                <button
                  onClick={() => handleUnbind(b)}
                  style={{
                    padding: '2px 6px', fontSize: 14, border: `1px solid ${COLORS.error}`,
                    borderRadius: RADIUS.sm, color: COLORS.error, background: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  解绑
                </button>
              </div>
            );
          })}
        </div>
      )}
    </PanelSection>
  );
}

// ─── 带 √ 按钮的文本输入框 ───

function SqrtInput({ value, onChange, onCommit, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  placeholder?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const insertSqrt = useCallback(() => {
    const el = inputRef.current;
    if (!el) { onChange(value + '√()'); return; }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const newVal = before + '√(' + after + ')';
    onChange(newVal);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + 2; // 光标放在 √( 后
      el.setSelectionRange(cursor, cursor);
    });
  }, [value, onChange]);

  return (
    <div style={{ display: 'flex', flex: 1, gap: 4 }}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => { if (e.key === 'Enter') onCommit(); }}
        style={{
          flex: 1, padding: '4px 8px', borderRadius: RADIUS.sm,
          border: `1px solid ${COLORS.border}`, fontSize: 14, color: COLORS.text,
          fontFamily: 'Inter, monospace',
        }}
        placeholder={placeholder}
      />
      <button
        onClick={insertSqrt}
        title="插入根号 √()"
        style={{
          padding: '4px 8px', borderRadius: RADIUS.sm, border: `1px solid ${COLORS.border}`,
          fontSize: 14, fontWeight: 700, color: COLORS.primary, background: COLORS.primaryLight,
          cursor: 'pointer', flexShrink: 0,
        }}
      >
        √
      </button>
    </div>
  );
}

// ─── 约束模式编辑器 ───

function ConstraintEditor({
  vec, entities, execute, scope,
}: {
  vec: DemoVector;
  entities: Record<string, import('@/editor/demo/demoTypes').DemoEntity>;
  execute: (cmd: Command) => void;
  scope?: Record<string, number>;
}) {
  const current = vec.constraint ?? 'free';
  const [lengthText, setLengthText] = useState(() =>
    vec.constraintLengthExpr ?? (vec.constraintLength != null ? fmtSurd(vec.constraintLength) : '1'),
  );

  const sp = entities[vec.startId] as DemoPoint | undefined;
  const ep = entities[vec.endId] as DemoPoint | undefined;

  const [lp1x, setLp1x] = useState(() => vec.constraintLineP1 ? String(vec.constraintLineP1.x) : sp ? String(sp.x - 2) : '-2');
  const [lp1y, setLp1y] = useState(() => vec.constraintLineP1 ? String(vec.constraintLineP1.y) : sp ? String(sp.y) : '0');
  const [lp2x, setLp2x] = useState(() => vec.constraintLineP2 ? String(vec.constraintLineP2.x) : sp ? String(sp.x + 2) : '2');
  const [lp2y, setLp2y] = useState(() => vec.constraintLineP2 ? String(vec.constraintLineP2.y) : sp ? String(sp.y) : '0');

  const [rMinX, setRMinX] = useState(() => vec.constraintRegionMin ? String(vec.constraintRegionMin.x) : sp ? String(sp.x - 2) : '-2');
  const [rMinY, setRMinY] = useState(() => vec.constraintRegionMin ? String(vec.constraintRegionMin.y) : sp ? String(sp.y - 2) : '-2');
  const [rMaxX, setRMaxX] = useState(() => vec.constraintRegionMax ? String(vec.constraintRegionMax.x) : sp ? String(sp.x + 2) : '2');
  const [rMaxY, setRMaxY] = useState(() => vec.constraintRegionMax ? String(vec.constraintRegionMax.y) : sp ? String(sp.y + 2) : '2');

  type ConstraintMode = typeof current;

  function applyConstraint(mode: ConstraintMode) {
    const before = {
      constraint: vec.constraint, constraintLength: vec.constraintLength, constraintLengthExpr: vec.constraintLengthExpr,
      constraintLineP1: vec.constraintLineP1, constraintLineP2: vec.constraintLineP2,
      constraintRegionMin: vec.constraintRegionMin, constraintRegionMax: vec.constraintRegionMax,
    };
    if (mode === 'free') {
      execute(new UpdateVectorPropsCmd(vec.id, before, {
        constraint: 'free', constraintLength: undefined, constraintLengthExpr: undefined,
        constraintLineP1: undefined, constraintLineP2: undefined,
        constraintRegionMin: undefined, constraintRegionMax: undefined,
      }));
      return;
    }
    if (mode === 'fixedStart' || mode === 'fixedEnd') {
      const ev = (s: string) => scope ? evalExactScoped(s, scope) : evalExact(s);
      const len = ev(lengthText);
      if (isNaN(len) || len <= 0) return;
      if (sp && ep) {
        const anchor = mode === 'fixedStart' ? sp : ep;
        const free = mode === 'fixedStart' ? ep : sp;
        const fdx = free.x - anchor.x, fdy = free.y - anchor.y;
        const fDist = Math.sqrt(fdx * fdx + fdy * fdy);
        if (fDist > 0.001) {
          const nx = anchor.x + fdx / fDist * len;
          const ny = anchor.y + fdy / fDist * len;
          execute(new MovePointCmd(free.id, { x: free.x, y: free.y }, { x: nx, y: ny }));
        }
      }
      execute(new UpdateVectorPropsCmd(vec.id, before, {
        constraint: mode, constraintLength: len, constraintLengthExpr: shouldStoreExpr(lengthText, len),
        constraintLineP1: undefined, constraintLineP2: undefined,
        constraintRegionMin: undefined, constraintRegionMax: undefined,
      }));
      return;
    }
    if (mode === 'lineStart' || mode === 'lineEnd') {
      const ev2 = (s: string) => scope ? evalExactScoped(s, scope) : evalExact(s);
      const p1 = { x: ev2(lp1x), y: ev2(lp1y) };
      const p2 = { x: ev2(lp2x), y: ev2(lp2y) };
      if ([p1.x, p1.y, p2.x, p2.y].some(isNaN)) return;
      execute(new UpdateVectorPropsCmd(vec.id, before, {
        constraint: mode, constraintLength: undefined,
        constraintLineP1: p1, constraintLineP2: p2,
        constraintRegionMin: undefined, constraintRegionMax: undefined,
      }));
      return;
    }
    if (mode === 'regionStart' || mode === 'regionEnd') {
      const ev3 = (s: string) => scope ? evalExactScoped(s, scope) : evalExact(s);
      const min = { x: ev3(rMinX), y: ev3(rMinY) };
      const max = { x: ev3(rMaxX), y: ev3(rMaxY) };
      if ([min.x, min.y, max.x, max.y].some(isNaN)) return;
      execute(new UpdateVectorPropsCmd(vec.id, before, {
        constraint: mode, constraintLength: undefined,
        constraintLineP1: undefined, constraintLineP2: undefined,
        constraintRegionMin: min, constraintRegionMax: max,
      }));
    }
  }

  function handleLengthCommit() {
    const len = scope ? evalExactScoped(lengthText, scope) : evalExact(lengthText);
    if (isNaN(len) || len <= 0) return;
    if (current === 'fixedStart' || current === 'fixedEnd') applyConstraint(current);
  }

  function handleLineCommit() {
    if (current === 'lineStart' || current === 'lineEnd') applyConstraint(current);
  }

  function handleRegionCommit() {
    if (current === 'regionStart' || current === 'regionEnd') applyConstraint(current);
  }

  const btnStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '5px 0', fontSize: 12, fontWeight: active ? 600 : 400, cursor: 'pointer',
    borderRadius: RADIUS.sm, border: `1px solid ${active ? COLORS.primary : COLORS.border}`,
    background: active ? COLORS.primaryLight : 'transparent',
    color: active ? COLORS.primary : COLORS.textSecondary,
  });

  const paramLabel: React.CSSProperties = { fontSize: 12, color: COLORS.textMuted, whiteSpace: 'nowrap' };
  const paramInput: React.CSSProperties = {
    width: 48, padding: '2px 4px', fontSize: 12, borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.border}`, background: 'transparent', color: COLORS.text,
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        <button style={btnStyle(current === 'free')} onClick={() => applyConstraint('free')}>自由</button>
        <button style={btnStyle(current === 'fixedStart')} onClick={() => applyConstraint('fixedStart')}>定起点</button>
        <button style={btnStyle(current === 'fixedEnd')} onClick={() => applyConstraint('fixedEnd')}>定终点</button>
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        <button style={btnStyle(current === 'lineStart')} onClick={() => applyConstraint('lineStart')}>直线(起)</button>
        <button style={btnStyle(current === 'lineEnd')} onClick={() => applyConstraint('lineEnd')}>直线(终)</button>
        <button style={btnStyle(current === 'regionStart')} onClick={() => applyConstraint('regionStart')}>区域(起)</button>
        <button style={btnStyle(current === 'regionEnd')} onClick={() => applyConstraint('regionEnd')}>区域(终)</button>
      </div>
      {(current === 'fixedStart' || current === 'fixedEnd') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={paramLabel}>模长</span>
          <SqrtInput value={lengthText} onChange={setLengthText} onCommit={handleLengthCommit} placeholder="如 1、√2" />
        </div>
      )}
      {(current === 'lineStart' || current === 'lineEnd') && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
          <span style={paramLabel}>点1</span>
          <input style={paramInput} value={lp1x} onChange={e => setLp1x(e.target.value)} onBlur={handleLineCommit} />
          <input style={paramInput} value={lp1y} onChange={e => setLp1y(e.target.value)} onBlur={handleLineCommit} />
          <span style={paramLabel}>点2</span>
          <input style={paramInput} value={lp2x} onChange={e => setLp2x(e.target.value)} onBlur={handleLineCommit} />
          <input style={paramInput} value={lp2y} onChange={e => setLp2y(e.target.value)} onBlur={handleLineCommit} />
        </div>
      )}
      {(current === 'regionStart' || current === 'regionEnd') && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
          <span style={paramLabel}>最小</span>
          <input style={paramInput} value={rMinX} onChange={e => setRMinX(e.target.value)} onBlur={handleRegionCommit} />
          <input style={paramInput} value={rMinY} onChange={e => setRMinY(e.target.value)} onBlur={handleRegionCommit} />
          <span style={paramLabel}>最大</span>
          <input style={paramInput} value={rMaxX} onChange={e => setRMaxX(e.target.value)} onBlur={handleRegionCommit} />
          <input style={paramInput} value={rMaxY} onChange={e => setRMaxY(e.target.value)} onBlur={handleRegionCommit} />
        </div>
      )}
    </div>
  );
}

// ─── 向量 Inspector（对齐 visual_template 样式）───

function VectorInspector({
  vec, entities, execute, nextEntityId, getVecComponents, onDelete, scope,
}: {
  vec: DemoVector;
  entities: Record<string, import('@/editor/demo/demoTypes').DemoEntity>;
  execute: (cmd: Command) => void;
  nextEntityId: () => string;
  getVecComponents: (v: DemoVector) => { dx: number; dy: number; mag: number } | null;
  onDelete: () => void;
  scope?: Record<string, number>;
}) {
  const comps = getVecComponents(vec);
  const [vecLabelDraft, setVecLabelDraft] = useState(vec.label);
  const [vecLabelError, setVecLabelError] = useState<string | null>(null);
  const [prevVecId, setPrevVecId] = useState(vec.id);
  if (prevVecId !== vec.id) { setPrevVecId(vec.id); setVecLabelDraft(vec.label); setVecLabelError(null); }

  function handleColorChange(color: string) {
    execute(new UpdateVectorPropsCmd(vec.id, { color: vec.color }, { color }));
  }

  function handleLabelChange(label: string) {
    setVecLabelDraft(label);
    if (!label.trim()) { setVecLabelError('名称不能为空'); return; }
    const conflict = findLabelConflict(label, entities, vec.id);
    if (conflict) { setVecLabelError(`名称已被${conflict}使用`); return; }
    setVecLabelError(null);
    execute(new UpdateVectorPropsCmd(vec.id, { label: vec.label }, { label }));
  }

  function handleShowLabelToggle() {
    execute(new UpdateVectorPropsCmd(vec.id, { showLabel: vec.showLabel }, { showLabel: !vec.showLabel }));
  }

  function commitDxDy(newDx: number, newDy: number) {
    const startPt = entities[vec.startId] as DemoPoint | undefined;
    const endPt = entities[vec.endId] as DemoPoint | undefined;
    if (!startPt || !endPt) return;
    execute(new MovePointCmd(endPt.id,
      { x: endPt.x, y: endPt.y, xExpr: endPt.xExpr, yExpr: endPt.yExpr },
      { x: startPt.x + newDx, y: startPt.y + newDy, xExpr: undefined, yExpr: undefined }));
  }

  function commitAngle(newAngleDeg: number) {
    if (!comps) return;
    const startPt = entities[vec.startId] as DemoPoint | undefined;
    const endPt = entities[vec.endId] as DemoPoint | undefined;
    if (!startPt || !endPt) return;
    const thetaRad = toRad(newAngleDeg);
    const newDx = comps.mag * Math.cos(thetaRad);
    const newDy = comps.mag * Math.sin(thetaRad);
    execute(new MovePointCmd(endPt.id,
      { x: endPt.x, y: endPt.y, xExpr: endPt.xExpr, yExpr: endPt.yExpr },
      { x: startPt.x + newDx, y: startPt.y + newDy, xExpr: undefined, yExpr: undefined }));
  }

  function handleScale() {
    const kStr = prompt('输入数乘系数 k:', '2');
    if (kStr === null) return;
    const k = parseFloat(kStr);
    if (isNaN(k)) return;
    const opId = nextEntityId();
    const op: DemoVecOp = { id: opId, type: 'demoVecOp', kind: 'scale', vec1Id: vec.id, scalarK: k };
    execute(new CreateVecOpCmd(op));
  }

  function handleDelete() {
    const allEntities = useDemoEntityStore.getState().entities;
    const sp = allEntities[vec.startId] as DemoPoint;
    const ep = allEntities[vec.endId] as DemoPoint;
    const orphanOps = Object.values(allEntities).filter(
      (en): en is DemoVecOp => en.type === 'demoVecOp' && (en.vec1Id === vec.id || en.vec2Id === vec.id),
    );
    execute(new DeleteVectorCmd(vec, sp, ep, orphanOps));
    onDelete();
  }

  const angleDeg = comps ? toDeg(Math.atan2(comps.dy, comps.dx)) : 0;
  const startPt = entities[vec.startId] as DemoPoint | undefined;

  function handleStartChange(axis: 'x' | 'y', val: number, expr?: string) {
    if (!startPt) return;
    const endPt = entities[vec.endId] as DemoPoint | undefined;
    if (!endPt) return;
    const oldDx = endPt.x - startPt.x;
    const oldDy = endPt.y - startPt.y;
    const newSx = axis === 'x' ? val : startPt.x;
    const newSy = axis === 'y' ? val : startPt.y;
    execute(new MovePointCmd(startPt.id,
      { x: startPt.x, y: startPt.y, xExpr: startPt.xExpr, yExpr: startPt.yExpr },
      { x: newSx, y: newSy, xExpr: axis === 'x' ? expr : startPt.xExpr, yExpr: axis === 'y' ? expr : startPt.yExpr }));
    execute(new MovePointCmd(endPt.id,
      { x: endPt.x, y: endPt.y, xExpr: endPt.xExpr, yExpr: endPt.yExpr },
      { x: newSx + oldDx, y: newSy + oldDy, xExpr: undefined, yExpr: undefined }));
  }

  return (
    <div>
      <PanelSection title={toVecLatex(vec.label) ? <>向量 <InlineLatex latex={toVecLatex(vec.label)!} /></> : `向量 ${vec.label}`}>
        {comps && (
          <InfoBlock>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: COLORS.textMuted, fontSize: 14, width: 20 }}>dx</span>
              <ExprCompactInput value={comps.dx} onCommit={(newDx) => commitDxDy(newDx, comps.dy)} />
              <span style={{ color: COLORS.textMuted, fontSize: 14, width: 20, marginLeft: 4 }}>dy</span>
              <ExprCompactInput value={comps.dy} onCommit={(newDy) => commitDxDy(comps.dx, newDy)} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: COLORS.textMuted, fontSize: 14, width: 20 }}>θ°</span>
              <CompactInput value={parseFloat(angleDeg.toFixed(1))} onCommit={commitAngle} />
              <span style={{ color: COLORS.textMuted, fontSize: 14, marginLeft: 8 }}>|v| = {comps.mag.toFixed(3)}</span>
            </div>
          </InfoBlock>
        )}
      </PanelSection>

      {startPt && (
        <PanelSection title="起点">
          <InfoBlock>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: COLORS.textMuted, fontSize: 14, width: 14 }}>x</span>
              <ExprCompactInput value={startPt.x} expr={startPt.xExpr} onCommit={(v, e) => handleStartChange('x', v, e)} scope={scope} />
              <span style={{ color: COLORS.textMuted, fontSize: 14, width: 14, marginLeft: 4 }}>y</span>
              <ExprCompactInput value={startPt.y} expr={startPt.yExpr} onCommit={(v, e) => handleStartChange('y', v, e)} scope={scope} />
            </div>
          </InfoBlock>
        </PanelSection>
      )}

      <PanelSection title="约束模式">
        <ConstraintEditor vec={vec} entities={entities} execute={execute} scope={scope} />
      </PanelSection>

      <PanelSection title="标签">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: vecLabelError ? 0 : 6 }}>
          <input
            type="text"
            value={vecLabelDraft}
            maxLength={8}
            onChange={(e) => handleLabelChange(e.target.value)}
            style={{
              flex: 1, padding: '4px 8px', borderRadius: RADIUS.sm,
              border: `1px solid ${vecLabelError ? '#e53e3e' : COLORS.border}`, fontSize: 14, color: COLORS.text,
            }}
          />
          <button
            onClick={handleShowLabelToggle}
            style={{
              padding: '4px 8px', borderRadius: RADIUS.sm, border: `1px solid ${COLORS.border}`,
              fontSize: 14, color: vec.showLabel ? COLORS.primary : COLORS.textMuted,
              background: vec.showLabel ? COLORS.primaryLight : COLORS.bgMuted, cursor: 'pointer',
            }}
          >
            {vec.showLabel ? '显示' : '隐藏'}
          </button>
        </div>
        {vecLabelError && (
          <div style={{ fontSize: 11, color: '#e53e3e', marginTop: 2, marginBottom: 6 }}>{vecLabelError}</div>
        )}
      </PanelSection>

      <PanelSection title="颜色">
        <ColorPicker current={vec.color} onChange={handleColorChange} />
      </PanelSection>

      <PanelSection title="显示">
        <VisibilityOpacityControl
          entity={vec}
          onUpdate={(patch) => execute(new UpdateVectorPropsCmd(vec.id,
            { visible: vec.visible, opacity: vec.opacity },
            patch,
          ))}
        />
      </PanelSection>

      <PanelSection title="操作">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <ActionBtn onClick={handleScale} variant="primary">
            创建 {toVecLatex(vec.label) ? <><InlineLatex latex={`k\\cdot ${toVecLatex(vec.label)}`} /></> : `k·${vec.label}`}…
          </ActionBtn>
          <ActionBtn onClick={handleDelete} variant="danger">🗑 删除向量</ActionBtn>
        </div>
      </PanelSection>
    </div>
  );
}

// ─── 点 Inspector ───

function PointInspector({
  pt, execute, scope,
}: {
  pt: DemoPoint;
  execute: (cmd: Command) => void;
  scope?: Record<string, number>;
}) {
  function handleCoordChange(axis: 'x' | 'y', val: number, expr?: string) {
    const before = { x: pt.x, y: pt.y, xExpr: pt.xExpr, yExpr: pt.yExpr };
    const after = axis === 'x'
      ? { x: val, y: pt.y, xExpr: expr, yExpr: pt.yExpr }
      : { x: pt.x, y: val, xExpr: pt.xExpr, yExpr: expr };
    execute(new MovePointCmd(pt.id, before, after));
  }

  return (
    <>
      <PanelSection title="端点坐标">
        <div style={{ display: 'flex', gap: 8 }}>
          <ExprLabeledInput label="x" value={pt.x} expr={pt.xExpr} onCommit={(v, e) => handleCoordChange('x', v, e)} scope={scope} />
          <ExprLabeledInput label="y" value={pt.y} expr={pt.yExpr} onCommit={(v, e) => handleCoordChange('y', v, e)} scope={scope} />
        </div>
      </PanelSection>
      <PanelSection title="运动路径">
        <MotionEditor pt={pt} execute={execute} scope={scope} />
        {pt.motion && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ToggleBtn active={!!pt.showLocus} onClick={() => execute(new UpdateGenericCmd(pt.id, { showLocus: pt.showLocus }, { showLocus: !pt.showLocus }))}>
                轨迹线
              </ToggleBtn>
              <span style={{ fontSize: 12, color: COLORS.textMuted }}>显示完整运动路径</span>
            </div>
            <TraceToggle pointId={pt.id} />
          </div>
        )}
      </PanelSection>
    </>
  );
}

function TraceToggle({ pointId }: { pointId: string }) {
  const traceEnabled = useTraceStore((s) => s.traceEnabled[pointId] ?? false);
  const setTraceEnabled = useTraceStore((s) => s.setTraceEnabled);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
      <ToggleBtn active={traceEnabled} onClick={() => setTraceEnabled(pointId, !traceEnabled)}>
        轨迹追踪
      </ToggleBtn>
      <span style={{ fontSize: 12, color: COLORS.textMuted }}>播放动画时描绘运动轨迹</span>
    </div>
  );
}

function MotionEditor({ pt, execute, scope }: { pt: DemoPoint; execute: (cmd: Command) => void; scope?: Record<string, number> }) {
  const motionKind = pt.motion?.kind ?? 'none';
  const [saved, setSaved] = useState(false);

  const [cx, setCx] = useState(() => pt.motion?.kind === 'circular' ? String(pt.motion.cx) : String(pt.x));
  const [cy, setCy] = useState(() => pt.motion?.kind === 'circular' ? String(pt.motion.cy) : String(pt.y));
  const [radius, setRadius] = useState(() => pt.motion?.kind === 'circular' ? String(pt.motion.radius) : '2');
  const [cSpeed, setCSpeed] = useState(() => pt.motion?.kind === 'circular' ? String(pt.motion.speed) : '1');
  const [cDir, setCDir] = useState<1 | -1>(() => pt.motion?.kind === 'circular' ? pt.motion.direction : 1);

  const [lx1, setLx1] = useState(() => pt.motion?.kind === 'linear' ? String(pt.motion.x1) : String(pt.x - 2));
  const [ly1, setLy1] = useState(() => pt.motion?.kind === 'linear' ? String(pt.motion.y1) : String(pt.y));
  const [lx2, setLx2] = useState(() => pt.motion?.kind === 'linear' ? String(pt.motion.x2) : String(pt.x + 2));
  const [ly2, setLy2] = useState(() => pt.motion?.kind === 'linear' ? String(pt.motion.y2) : String(pt.y));
  const [lSpeed, setLSpeed] = useState(() => pt.motion?.kind === 'linear' ? String(pt.motion.speed) : '0.5');
  const [bounce, setBounce] = useState(() => pt.motion?.kind === 'linear' ? pt.motion.bounce : true);

  function setMotion(m: MotionPath | undefined) {
    execute(new UpdateGenericCmd(pt.id, { motion: pt.motion }, { motion: m }));
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  }

  function applyCircular(dirOverride?: 1 | -1) {
    const ev = (s: string) => scope ? evalExactScoped(s, scope) : evalExact(s);
    const vals = [cx, cy, radius, cSpeed].map(ev);
    if (vals.some(isNaN) || vals[2] <= 0) {
      console.warn('[MotionEditor] Invalid circular params:', { cx, cy, radius, cSpeed, vals });
      return;
    }
    const startAngle = Math.atan2(pt.y - vals[1], pt.x - vals[0]);
    setMotion({ kind: 'circular', cx: vals[0], cy: vals[1], radius: vals[2], startAngle, speed: vals[3], direction: dirOverride ?? cDir });
  }

  function applyLinear(bounceOverride?: boolean) {
    const ev = (s: string) => scope ? evalExactScoped(s, scope) : evalExact(s);
    const vals = [lx1, ly1, lx2, ly2, lSpeed].map(ev);
    if (vals.some(isNaN)) {
      console.warn('[MotionEditor] Invalid linear params:', { lx1, ly1, lx2, ly2, lSpeed, vals });
      return;
    }
    setMotion({ kind: 'linear', x1: vals[0], y1: vals[1], x2: vals[2], y2: vals[3], speed: vals[4], bounce: bounceOverride ?? bounce });
  }

  function handleKindChange(kind: 'none' | 'circular' | 'linear') {
    if (kind === 'none') { setMotion(undefined); return; }
    if (kind === 'circular') applyCircular();
    if (kind === 'linear') applyLinear();
  }

  const btnStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '4px 0', fontSize: 12, fontWeight: active ? 600 : 400, cursor: 'pointer',
    borderRadius: RADIUS.sm, border: `1px solid ${active ? COLORS.primary : COLORS.border}`,
    background: active ? COLORS.primaryLight : 'transparent',
    color: active ? COLORS.primary : COLORS.textSecondary,
  });
  const paramLabel: React.CSSProperties = { fontSize: 12, color: COLORS.textMuted, whiteSpace: 'nowrap' };
  const paramInput: React.CSSProperties = {
    width: 44, padding: '2px 4px', fontSize: 12, borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.border}`, background: 'transparent', color: COLORS.text,
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        <button style={btnStyle(motionKind === 'none')} onClick={() => handleKindChange('none')}>无</button>
        <button style={btnStyle(motionKind === 'circular')} onClick={() => handleKindChange('circular')}>圆形</button>
        <button style={btnStyle(motionKind === 'linear')} onClick={() => handleKindChange('linear')}>直线</button>
      </div>
      {motionKind === 'circular' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
          <span style={paramLabel}>圆心</span>
          <input style={paramInput} value={cx} onChange={e => setCx(e.target.value)} onBlur={() => applyCircular()} />
          <input style={paramInput} value={cy} onChange={e => setCy(e.target.value)} onBlur={() => applyCircular()} />
          <span style={paramLabel}>半径</span>
          <input style={paramInput} value={radius} onChange={e => setRadius(e.target.value)} onBlur={() => applyCircular()} />
          <span style={paramLabel}>速度</span>
          <input style={{ ...paramInput, width: 36 }} value={cSpeed} onChange={e => setCSpeed(e.target.value)} onBlur={() => applyCircular()} />
          <span style={paramLabel}>rad/s</span>
          <button style={{ ...btnStyle(cDir === 1), flex: 'none', padding: '2px 8px' }} onClick={() => { setCDir(1); applyCircular(1); }}>逆时针</button>
          <button style={{ ...btnStyle(cDir === -1), flex: 'none', padding: '2px 8px' }} onClick={() => { setCDir(-1); applyCircular(-1); }}>顺时针</button>
        </div>
      )}
      {motionKind === 'linear' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
          <span style={paramLabel}>起点</span>
          <input style={paramInput} value={lx1} onChange={e => setLx1(e.target.value)} onBlur={() => applyLinear()} />
          <input style={paramInput} value={ly1} onChange={e => setLy1(e.target.value)} onBlur={() => applyLinear()} />
          <span style={paramLabel}>终点</span>
          <input style={paramInput} value={lx2} onChange={e => setLx2(e.target.value)} onBlur={() => applyLinear()} />
          <input style={paramInput} value={ly2} onChange={e => setLy2(e.target.value)} onBlur={() => applyLinear()} />
          <span style={paramLabel}>速度</span>
          <input style={{ ...paramInput, width: 36 }} value={lSpeed} onChange={e => setLSpeed(e.target.value)} onBlur={() => applyLinear()} />
          <span style={paramLabel}>次/s</span>
          <button style={{ ...btnStyle(bounce), flex: 'none', padding: '2px 8px' }} onClick={() => { setBounce(!bounce); applyLinear(!bounce); }}>
            {bounce ? '往返' : '循环'}
          </button>
        </div>
      )}
      {motionKind !== 'none' && (
        <button
          style={{
            width: '100%', marginTop: 8, padding: '5px 0', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', borderRadius: RADIUS.sm,
            border: `1px solid ${COLORS.primary}`, background: COLORS.primary, color: '#fff',
          }}
          onClick={() => motionKind === 'circular' ? applyCircular() : applyLinear()}
        >
          {saved ? '已保存' : '保存运动路径'}
        </button>
      )}
    </div>
  );
}

// ─── 运算 Inspector（增加起点编辑）───

function OpInspector({
  op, entities, execute, onDelete, scope,
}: {
  op: DemoVecOp;
  entities: Record<string, import('@/editor/demo/demoTypes').DemoEntity>;
  execute: (cmd: Command) => void;
  onDelete: () => void;
  scope?: Record<string, number>;
}) {
  // 递归解析向量
  function rvec(id: string, depth = 0): Vec2D | null {
    if (depth > 10) return null;
    const en = entities[id];
    if (!en) return null;
    if (en.type === 'demoVector') {
      const v = en as DemoVector;
      const sp = entities[v.startId] as DemoPoint | undefined;
      const ep = entities[v.endId] as DemoPoint | undefined;
      if (!sp || !ep) return null;
      return [ep.x - sp.x, ep.y - sp.y];
    }
    if (en.type === 'demoVecOp') {
      const o = en as DemoVecOp;
      const v1 = rvec(o.vec1Id, depth + 1);
      if (!v1) return null;
      if (o.kind === 'scale') return scale2D(v1, o.scalarK ?? 2);
      if (o.kind === 'dotProduct') return null;
      if (!o.vec2Id) return null;
      const v2 = rvec(o.vec2Id, depth + 1);
      if (!v2) return null;
      return o.kind === 'add' ? add2D(v1, v2) : sub2D(v1, v2);
    }
    return null;
  }

  // 操作数标签
  function opLabel(id: string, depth = 0): string {
    if (depth > 10) return '?';
    const en = entities[id];
    if (!en) return '?';
    if (en.type === 'demoVector') return (en as DemoVector).label;
    if (en.type === 'demoVecOp') {
      const o = en as DemoVecOp;
      const l1 = opLabel(o.vec1Id, depth + 1);
      if (o.kind === 'scale') {
        const kStr = Number.isInteger(o.scalarK ?? 2) ? String(o.scalarK ?? 2) : (o.scalarK ?? 2).toFixed(2);
        return `${kStr}${l1}`;
      }
      if (!o.vec2Id) return l1;
      const l2 = opLabel(o.vec2Id, depth + 1);
      const sym = o.kind === 'add' ? '+' : o.kind === 'subtract' ? '−' : '·';
      return `${l1}${sym}${l2}`;
    }
    return '?';
  }

  function getDefaultOrigin(): { x: number; y: number } {
    const src = entities[op.vec1Id];
    if (!src) return { x: 0, y: 0 };
    if (src.type === 'demoVector') {
      const sp = entities[(src as DemoVector).startId] as DemoPoint | undefined;
      return sp ? { x: sp.x, y: sp.y } : { x: 0, y: 0 };
    }
    return { x: 0, y: 0 };
  }

  function getResultDesc(): string {
    if (op.kind === 'dotProduct') {
      const v1 = rvec(op.vec1Id);
      const v2 = op.vec2Id ? rvec(op.vec2Id) : null;
      if (!v1 || !v2) return '—';
      return `${dot2D(v1, v2).toFixed(3)}（标量）`;
    }
    const r = rvec(op.id);
    if (!r) return '—';
    return `(${r[0].toFixed(2)}, ${r[1].toFixed(2)}) |${mag2D(r).toFixed(3)}|`;
  }

  function handleKChange(k: number, expr?: string) {
    execute(new UpdateVecOpCmd(op.id,
      { scalarK: op.scalarK, scalarKExpr: op.scalarKExpr },
      { scalarK: k, scalarKExpr: expr }));
  }

  function handleOriginChange(axis: 'x' | 'y', val: number, expr?: string) {
    if (axis === 'x') {
      execute(new UpdateVecOpCmd(op.id, { originX: op.originX, originXExpr: op.originXExpr }, { originX: val, originXExpr: expr }));
    } else {
      execute(new UpdateVecOpCmd(op.id, { originY: op.originY, originYExpr: op.originYExpr }, { originY: val, originYExpr: expr }));
    }
  }

  function handleDelete() {
    execute(new DeleteVecOpCmd(op));
    onDelete();
  }

  const defOrigin = getDefaultOrigin();
  const curOriginX = op.originX ?? defOrigin.x;
  const curOriginY = op.originY ?? defOrigin.y;

  return (
    <div>
      <PanelSection title="向量运算">
        <InfoBlock>
          <InfoRow label="类型">{opKindText(op.kind)}</InfoRow>
          <InfoRow label="操作数 1">{opLabel(op.vec1Id)}</InfoRow>
          {op.vec2Id && <InfoRow label="操作数 2">{opLabel(op.vec2Id)}</InfoRow>}
          <InfoRow label="结果">{getResultDesc()}</InfoRow>
        </InfoBlock>
      </PanelSection>

      {op.kind === 'scale' && (
        <PanelSection title="系数 k">
          <ExprCompactInput value={op.scalarK ?? 1} expr={op.scalarKExpr} onCommit={handleKChange} scope={scope} />
        </PanelSection>
      )}

      {op.kind !== 'dotProduct' && (
        <PanelSection title="结果起点">
          <InfoBlock>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: COLORS.textMuted, fontSize: 14, width: 14 }}>x</span>
              <ExprCompactInput value={curOriginX} expr={op.originXExpr} onCommit={(v, e) => handleOriginChange('x', v, e)} scope={scope} />
              <span style={{ color: COLORS.textMuted, fontSize: 14, width: 14, marginLeft: 4 }}>y</span>
              <ExprCompactInput value={curOriginY} expr={op.originYExpr} onCommit={(v, e) => handleOriginChange('y', v, e)} scope={scope} />
            </div>
          </InfoBlock>
        </PanelSection>
      )}

      <div style={{ padding: '0 16px 10px' }}>
        <ActionBtn onClick={handleDelete} variant="danger">🗑 删除运算</ActionBtn>
      </div>
    </div>
  );
}

// ─── 约束轨迹区域 ───

const CONSTRAINT_TEMPLATES = [
  { label: '选择模板...', value: '', group: '' },
  { label: '圆: dist(P,A) = r', value: 'dist(P,A) = 3', group: '点约束' },
  { label: '模长: mag(P) = r', value: 'mag(P) = 4', group: '点约束' },
  { label: '夹角: angle(A,P,B) = θ', value: 'angle(A,P,B) = 90', group: '点约束' },
  { label: '点积: dot(P,A) = k', value: 'dot(P,A) = 0', group: '点约束' },
  { label: '直线距离: distLine(P,A,B) = d', value: 'distLine(P,A,B) = 2', group: '点约束' },
  { label: '向量模长: |⃗a| = r', value: '|\\vec{a}|=1', group: '向量约束' },
  { label: '向量点积: ⃗a·⃗b = k', value: '\\vec{a}\\cdot\\vec{b}=0', group: '向量约束' },
  { label: '向量差模: |⃗a-⃗b| = k', value: '|\\vec{a}-\\vec{b}|=2', group: '向量约束' },
  { label: '混合约束', value: '|\\vec{a}-\\vec{b}|+2\\sqrt{3}\\vec{a}\\cdot\\vec{b}=0', group: '向量约束' },
];

function ConstraintSection({ entities }: { entities: Record<string, DemoEntity> }) {
  const [input, setInput] = useState('');
  const [inputError, setInputError] = useState('');
  const constraints = useConstraintStore((s) => s.constraints);
  const addConstraint = useConstraintStore((s) => s.addConstraint);
  const removeConstraint = useConstraintStore((s) => s.removeConstraint);
  const updateConstraint = useConstraintStore((s) => s.updateConstraint);
  const clearAll = useConstraintStore((s) => s.clearAll);
  const objectiveExpr = useConstraintStore((s) => s.objectiveExpr);
  const setObjectiveExpr = useConstraintStore((s) => s.setObjectiveExpr);
  const objectiveExtrema = useConstraintStore((s) => s.objectiveExtrema);
  const list = Object.values(constraints);

  const vecLabels = useMemo(() => {
    const labels: string[] = [];
    for (const e of Object.values(entities)) {
      if (e.type === 'demoVector' && (e as DemoVector).label) labels.push((e as DemoVector).label);
    }
    return labels;
  }, [entities]);

  const handleAdd = () => {
    const val = input.trim();
    if (!val) return;
    if (isVecExpression(val)) {
      const missing = validateVecExpr(val, new Set(vecLabels));
      if (missing.length > 0) {
        setInputError(`请先创建向量 ${missing.join(', ')}`);
        return;
      }
    } else {
      const refNames = (val.match(/[A-Z][a-zA-Z0-9]*/g) ?? []).filter((n) => n !== 'O');
      const entityLabels = new Set(
        Object.values(entities).filter((e) => 'label' in e).map((e) => (e as { label: string }).label),
      );
      const missingPts = refNames.filter((n) => !entityLabels.has(n));
      if (missingPts.length > 0) {
        setInputError(`请先创建标记点 ${[...new Set(missingPts)].join(', ')}`);
        return;
      }
    }
    addConstraint(val);
    setInput('');
    setInputError('');
  };

  return (
    <PanelSection title="约束轨迹" defaultOpen={list.length > 0} style={{ borderTop: `1px solid ${COLORS.border}`, flexShrink: 0 }}>
      {/* 模板下拉 */}
      <select
        style={{
          width: '100%', padding: '4px 8px', fontSize: 11, marginBottom: 6,
          border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.sm,
          background: COLORS.white, color: COLORS.textMuted, cursor: 'pointer',
        }}
        value=""
        onChange={(e) => { if (e.target.value) { setInput(e.target.value); setInputError(''); } }}
      >
        {CONSTRAINT_TEMPLATES.map((t, i) => (
          <option key={i} value={t.value}>{t.label}</option>
        ))}
      </select>

      {/* 输入框 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: inputError ? 2 : 6 }}>
        <input
          style={{
            flex: 1, padding: '4px 8px', fontSize: 12,
            border: `1px solid ${inputError ? '#ef4444' : COLORS.border}`, borderRadius: RADIUS.sm,
            background: COLORS.white, color: COLORS.text,
          }}
          placeholder="例: |\\vec{a}|=1  或  dist(P,A)=3"
          value={input}
          onChange={(e) => { setInput(e.target.value); setInputError(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
        />
        <button
          style={{
            padding: '4px 10px', fontSize: 13, cursor: 'pointer',
            borderRadius: RADIUS.sm, border: `1px solid ${COLORS.border}`,
            background: COLORS.primary, color: COLORS.white,
          }}
          onClick={handleAdd}
        >+</button>
      </div>
      {inputError && (
        <div style={{ fontSize: 10, color: '#ef4444', marginBottom: 4 }}>{inputError}</div>
      )}

      {/* 约束列表 */}
      {list.map((c) => (
        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
          <div
            style={{ width: 12, height: 12, borderRadius: '50%', background: c.color, cursor: 'pointer', flexShrink: 0 }}
            onClick={() => {
              const idx = DEMO_COLORS.indexOf(c.color as typeof DEMO_COLORS[number]);
              const next = DEMO_COLORS[(idx + 1) % DEMO_COLORS.length];
              updateConstraint(c.id, { color: next });
            }}
          />
          <span
            style={{
              flex: 1, fontSize: 11, color: c.visible ? COLORS.text : COLORS.textMuted,
              cursor: 'pointer', textDecoration: c.visible ? 'none' : 'line-through',
              overflow: 'hidden',
            }}
            onClick={() => updateConstraint(c.id, { visible: !c.visible })}
          >
            {isVecExpression(c.expression)
              ? <InlineLatex latex={c.expression} style={{ fontSize: 11 }} />
              : c.expression}
          </span>
          <button
            style={{
              padding: '1px 5px', fontSize: 11, cursor: 'pointer',
              border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.sm,
              background: 'transparent', color: COLORS.textMuted,
            }}
            onClick={() => removeConstraint(c.id)}
          >x</button>
        </div>
      ))}
      {list.length > 1 && (
        <button
          style={{
            padding: '2px 8px', fontSize: 11, cursor: 'pointer',
            border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.sm,
            background: 'transparent', color: COLORS.textMuted, marginTop: 4,
          }}
          onClick={clearAll}
        >清空全部</button>
      )}
      <div style={{ marginTop: 6, fontSize: 10, color: COLORS.textMuted, lineHeight: 1.5 }}>
        <strong>点约束:</strong> P 为自由点（需先创建），O 为原点，其他为已有标记点<br />
        dist(P,A) mag(P) dot(P,A) angle(A,P,B) distLine(P,A,B)<br />
        <strong>向量约束:</strong> {'\\vec{a}'} 标记向量<br />
        {'|\\vec{a}|  \\vec{a}\\cdot\\vec{b}  |\\vec{a}-\\vec{b}|'}<br />
        支持 {'\\sqrt{}  \\pi  \\frac{}{}'}；也支持 mag(a) dot(a,b)
      </div>

      {list.length > 0 && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${COLORS.border}` }}>
          <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 4, fontWeight: 600 }}>
            目标函数（可选）
          </div>
          <input
            style={{
              width: '100%', padding: '4px 8px', fontSize: 12,
              border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.sm,
              background: COLORS.white, color: COLORS.text, boxSizing: 'border-box',
            }}
            placeholder="例: dist(P,A)  或  |\\vec{a}-\\vec{b}|"
            value={objectiveExpr}
            onChange={(e) => setObjectiveExpr(e.target.value)}
          />
          {objectiveExtrema && (
            <div style={{ marginTop: 4, fontSize: 11, lineHeight: 1.6 }}>
              {objectiveExtrema.min && (
                <div style={{ color: '#2563eb' }}>
                  最小值: {objectiveExtrema.min.value.toFixed(3)} @ ({objectiveExtrema.min.x.toFixed(2)}, {objectiveExtrema.min.y.toFixed(2)})
                </div>
              )}
              {objectiveExtrema.max && (
                <div style={{ color: '#dc2626' }}>
                  最大值: {objectiveExtrema.max.value.toFixed(3)} @ ({objectiveExtrema.max.x.toFixed(2)}, {objectiveExtrema.max.y.toFixed(2)})
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </PanelSection>
  );
}

// ─── 工具函数 ───

/** 递归获取实体标签（向量名 or 运算表达式） */
function entityLabel(id: string, entities: Record<string, import('@/editor/demo/demoTypes').DemoEntity>, depth = 0): string {
  if (depth > 10) return '?';
  const en = entities[id];
  if (!en) return '?';
  if (en.type === 'demoVector') return (en as DemoVector).label;
  if (en.type === 'demoVecOp') {
    const o = en as DemoVecOp;
    const l1 = entityLabel(o.vec1Id, entities, depth + 1);
    if (o.kind === 'scale') {
      const kStr = Number.isInteger(o.scalarK ?? 2) ? String(o.scalarK ?? 2) : (o.scalarK ?? 2).toFixed(2);
      return `${kStr}${l1}`;
    }
    if (!o.vec2Id) return l1;
    const l2 = entityLabel(o.vec2Id, entities, depth + 1);
    const sym = o.kind === 'add' ? '+' : o.kind === 'subtract' ? '−' : '·';
    return `${l1}${sym}${l2}`;
  }
  return '?';
}

function opKindText(kind: string): string {
  switch (kind) {
    case 'add': return '向量加法';
    case 'subtract': return '向量减法';
    case 'dotProduct': return '数量积';
    case 'scale': return '数乘';
    default: return kind;
  }
}

function opSymbol(kind: string): string {
  switch (kind) {
    case 'add': return '+';
    case 'subtract': return '−';
    case 'dotProduct': return '·';
    case 'scale': return '×';
    default: return kind;
  }
}
