import { useRef, useState, useCallback } from 'react';
import { useHistoryStore } from '@/editor';
import type { Command } from '@/editor/commands/types';
import { useDemoEntityStore } from '@/editor/demo/demoEntityStore';
import { useDemoSelectionStore } from '@/editor/demo/demoSelectionStore';
import {
  UpdateVectorPropsCmd, MovePointCmd, LoadDemoSnapshotCmd,
  CreateVecOpCmd, DeleteVecOpCmd, DeleteVectorCmd, UpdateVecOpCmd,
  BindPointsCmd, UnbindPointsCmd,
} from '@/editor/demo/demoCommands';
import type { DemoPoint, DemoVector, DemoVecOp, DemoBinding } from '@/editor/demo/demoTypes';
import { DEMO_COLORS } from '@/editor/demo/demoTypes';
import { COLORS, RADIUS } from '@/styles/tokens';
import { mag2D, add2D, sub2D, scale2D, dot2D, evalSqrtExpr, fmtSurd } from '@/engine/vectorMath';
import type { Vec2D } from '@/editor/entities/types';

// ─── PanelSection（折叠/展开，匹配 visual_template LeftPanel 样式）───

function PanelSection({
  title, defaultOpen = true, children, style,
}: {
  title: string; defaultOpen?: boolean; children: React.ReactNode; style?: React.CSSProperties;
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

// ─── 颜色圆点选择器（rounded-full）───

function ColorPicker({ current, onChange }: { current: string; onChange: (c: string) => void }) {
  return (
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
            border: current === c ? `2px solid ${COLORS.primary}` : '2px solid transparent',
            boxSizing: 'border-box',
          }} />
        </div>
      ))}
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

  const selectedEntity = selectedId ? entities[selectedId] : null;

  const vectors = Object.values(entities).filter((e): e is DemoVector => e.type === 'demoVector');
  const ops = Object.values(entities).filter((e): e is DemoVecOp => e.type === 'demoVecOp');

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
          <NoSelectionInspector vectors={vectors} ops={ops} entities={entities} execute={execute} />
        )}
        {selectedEntity?.type === 'demoVector' && (
          <VectorInspector
            vec={selectedEntity as DemoVector}
            entities={entities}
            execute={execute}
            nextEntityId={nextEntityId}
            getVecComponents={getVecComponents}
            onDelete={() => select(null)}
          />
        )}
        {selectedEntity?.type === 'demoPoint' && (
          <PointInspector pt={selectedEntity as DemoPoint} execute={execute} />
        )}
        {selectedEntity?.type === 'demoVecOp' && (
          <OpInspector op={selectedEntity as DemoVecOp} entities={entities} execute={execute} onDelete={() => select(null)} />
        )}
      </div>

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

// ─── 无选中：显示实体列表（可展开编辑）───

function NoSelectionInspector({
  vectors, ops, entities, execute,
}: {
  vectors: DemoVector[];
  ops: DemoVecOp[];
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
    const before = { x: endPt.x, y: endPt.y };
    const after = { x: startPt.x + newDx, y: startPt.y + newDy };
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
    const before = { x: endPt.x, y: endPt.y };
    const after = { x: startPt.x + newDx, y: startPt.y + newDy };
    execute(new MovePointCmd(endPt.id, before, after));
  }

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
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{v.label}</span>
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
                    <CompactInput value={parseFloat(dx.toFixed(2))} onCommit={(newDx) => commitDxDy(v, newDx, dy)} />
                    <span style={{ color: COLORS.textMuted, fontSize: 14, width: 20, marginLeft: 4 }}>dy</span>
                    <CompactInput value={parseFloat(dy.toFixed(2))} onCommit={(newDy) => commitDxDy(v, dx, newDy)} />
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
                  {l1}{l2 ? ` ${opSymbol(op.kind)} ${l2}` : ''}
                </span>
              </div>
            );
          })}
        </PanelSection>
      )}

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

  function endpointLabel(vecLabel: string, ep: 'start' | 'end'): string {
    return `${vecLabel} ${ep === 'start' ? '起点' : '终点'}`;
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
      if (v.constraint === 'fixedStart' && v.startId === ptId) return true;
      if (v.constraint === 'fixedEnd' && v.endId === ptId) return true;
    }
    return false;
  }

  /** 获取端点的约束信息（仅约束向量的自由端） */
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
                  <b>{vA?.label ?? '?'}</b> {epA} ⟷ <b>{vB?.label ?? '?'}</b> {epB}
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
  vec, entities, execute,
}: {
  vec: DemoVector;
  entities: Record<string, import('@/editor/demo/demoTypes').DemoEntity>;
  execute: (cmd: Command) => void;
}) {
  const current = vec.constraint ?? 'free';
  const [lengthText, setLengthText] = useState(() =>
    vec.constraintLength != null ? fmtSurd(vec.constraintLength) : '1',
  );

  function applyConstraint(mode: 'free' | 'fixedStart' | 'fixedEnd') {
    if (mode === 'free') {
      execute(new UpdateVectorPropsCmd(vec.id,
        { constraint: vec.constraint, constraintLength: vec.constraintLength },
        { constraint: 'free', constraintLength: undefined },
      ));
      return;
    }
    const len = evalSqrtExpr(lengthText);
    if (isNaN(len) || len <= 0) return;
    // 设置约束并调整当前端点到正确长度
    const sp = entities[vec.startId] as DemoPoint | undefined;
    const ep = entities[vec.endId] as DemoPoint | undefined;
    if (!sp || !ep) return;
    const dx = ep.x - sp.x, dy = ep.y - sp.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0.001) {
      // 调整自由端到正确距离
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
    execute(new UpdateVectorPropsCmd(vec.id,
      { constraint: vec.constraint, constraintLength: vec.constraintLength },
      { constraint: mode, constraintLength: len },
    ));
  }

  function handleLengthCommit() {
    const len = evalSqrtExpr(lengthText);
    if (isNaN(len) || len <= 0) return;
    if (current !== 'free') applyConstraint(current);
  }

  const btnStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '5px 0', fontSize: 14, fontWeight: active ? 600 : 400, cursor: 'pointer',
    borderRadius: RADIUS.sm, border: `1px solid ${active ? COLORS.primary : COLORS.border}`,
    background: active ? COLORS.primaryLight : 'transparent',
    color: active ? COLORS.primary : COLORS.textSecondary,
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        <button style={btnStyle(current === 'free')} onClick={() => applyConstraint('free')}>自由</button>
        <button style={btnStyle(current === 'fixedStart')} onClick={() => applyConstraint('fixedStart')}>定起点</button>
        <button style={btnStyle(current === 'fixedEnd')} onClick={() => applyConstraint('fixedEnd')}>定终点</button>
      </div>
      {current !== 'free' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14, color: COLORS.textMuted }}>模长</span>
          <SqrtInput
            value={lengthText}
            onChange={setLengthText}
            onCommit={handleLengthCommit}
            placeholder="如 1、√2、1+√3"
          />
        </div>
      )}
    </div>
  );
}

// ─── 向量 Inspector（对齐 visual_template 样式）───

function VectorInspector({
  vec, entities, execute, nextEntityId, getVecComponents, onDelete,
}: {
  vec: DemoVector;
  entities: Record<string, import('@/editor/demo/demoTypes').DemoEntity>;
  execute: (cmd: Command) => void;
  nextEntityId: () => string;
  getVecComponents: (v: DemoVector) => { dx: number; dy: number; mag: number } | null;
  onDelete: () => void;
}) {
  const comps = getVecComponents(vec);

  function handleColorChange(color: string) {
    execute(new UpdateVectorPropsCmd(vec.id, { color: vec.color }, { color }));
  }

  function handleLabelChange(label: string) {
    execute(new UpdateVectorPropsCmd(vec.id, { label: vec.label }, { label }));
  }

  function handleShowLabelToggle() {
    execute(new UpdateVectorPropsCmd(vec.id, { showLabel: vec.showLabel }, { showLabel: !vec.showLabel }));
  }

  function commitDxDy(newDx: number, newDy: number) {
    const startPt = entities[vec.startId] as DemoPoint | undefined;
    const endPt = entities[vec.endId] as DemoPoint | undefined;
    if (!startPt || !endPt) return;
    execute(new MovePointCmd(endPt.id, { x: endPt.x, y: endPt.y }, { x: startPt.x + newDx, y: startPt.y + newDy }));
  }

  function commitAngle(newAngleDeg: number) {
    if (!comps) return;
    const startPt = entities[vec.startId] as DemoPoint | undefined;
    const endPt = entities[vec.endId] as DemoPoint | undefined;
    if (!startPt || !endPt) return;
    const thetaRad = toRad(newAngleDeg);
    const newDx = comps.mag * Math.cos(thetaRad);
    const newDy = comps.mag * Math.sin(thetaRad);
    execute(new MovePointCmd(endPt.id, { x: endPt.x, y: endPt.y }, { x: startPt.x + newDx, y: startPt.y + newDy }));
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

  function handleStartChange(axis: 'x' | 'y', val: number) {
    if (!startPt) return;
    const endPt = entities[vec.endId] as DemoPoint | undefined;
    if (!endPt) return;
    const oldDx = endPt.x - startPt.x;
    const oldDy = endPt.y - startPt.y;
    const newSx = axis === 'x' ? val : startPt.x;
    const newSy = axis === 'y' ? val : startPt.y;
    // 移动起点，同时移动终点保持向量不变
    execute(new MovePointCmd(startPt.id, { x: startPt.x, y: startPt.y }, { x: newSx, y: newSy }));
    execute(new MovePointCmd(endPt.id, { x: endPt.x, y: endPt.y }, { x: newSx + oldDx, y: newSy + oldDy }));
  }

  return (
    <div>
      <PanelSection title={`向量 ${vec.label}`}>
        {comps && (
          <InfoBlock>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: COLORS.textMuted, fontSize: 14, width: 20 }}>dx</span>
              <CompactInput value={parseFloat(comps.dx.toFixed(2))} onCommit={(newDx) => commitDxDy(newDx, comps.dy)} />
              <span style={{ color: COLORS.textMuted, fontSize: 14, width: 20, marginLeft: 4 }}>dy</span>
              <CompactInput value={parseFloat(comps.dy.toFixed(2))} onCommit={(newDy) => commitDxDy(comps.dx, newDy)} />
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
              <CompactInput value={parseFloat(startPt.x.toFixed(2))} onCommit={(v) => handleStartChange('x', v)} />
              <span style={{ color: COLORS.textMuted, fontSize: 14, width: 14, marginLeft: 4 }}>y</span>
              <CompactInput value={parseFloat(startPt.y.toFixed(2))} onCommit={(v) => handleStartChange('y', v)} />
            </div>
          </InfoBlock>
        </PanelSection>
      )}

      <PanelSection title="约束模式">
        <ConstraintEditor vec={vec} entities={entities} execute={execute} />
      </PanelSection>

      <PanelSection title="标签">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <input
            type="text"
            value={vec.label}
            maxLength={8}
            onChange={(e) => handleLabelChange(e.target.value)}
            style={{
              flex: 1, padding: '4px 8px', borderRadius: RADIUS.sm,
              border: `1px solid ${COLORS.border}`, fontSize: 14, color: COLORS.text,
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
      </PanelSection>

      <PanelSection title="颜色">
        <ColorPicker current={vec.color} onChange={handleColorChange} />
      </PanelSection>

      <PanelSection title="操作">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <ActionBtn onClick={handleScale} variant="primary">创建 k·{vec.label}…</ActionBtn>
          <ActionBtn onClick={handleDelete} variant="danger">🗑 删除向量</ActionBtn>
        </div>
      </PanelSection>
    </div>
  );
}

// ─── 点 Inspector ───

function PointInspector({
  pt, execute,
}: {
  pt: DemoPoint;
  execute: (cmd: Command) => void;
}) {
  function handleCoordChange(axis: 'x' | 'y', val: string) {
    const num = parseFloat(val);
    if (isNaN(num)) return;
    execute(new MovePointCmd(pt.id, { x: pt.x, y: pt.y }, { x: axis === 'x' ? num : pt.x, y: axis === 'y' ? num : pt.y }));
  }

  return (
    <PanelSection title="端点坐标">
      <div style={{ display: 'flex', gap: 8 }}>
        <LabeledInput label="x" value={pt.x} onChange={(v) => handleCoordChange('x', v)} />
        <LabeledInput label="y" value={pt.y} onChange={(v) => handleCoordChange('y', v)} />
      </div>
    </PanelSection>
  );
}

// ─── 运算 Inspector（增加起点编辑）───

function OpInspector({
  op, entities, execute, onDelete,
}: {
  op: DemoVecOp;
  entities: Record<string, import('@/editor/demo/demoTypes').DemoEntity>;
  execute: (cmd: Command) => void;
  onDelete: () => void;
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

  function handleKChange(val: string) {
    const k = parseFloat(val);
    if (isNaN(k)) return;
    execute(new UpdateVecOpCmd(op.id, { scalarK: op.scalarK }, { scalarK: k }));
  }

  function handleOriginChange(axis: 'x' | 'y', val: number) {
    if (axis === 'x') {
      execute(new UpdateVecOpCmd(op.id, { originX: op.originX }, { originX: val }));
    } else {
      execute(new UpdateVecOpCmd(op.id, { originY: op.originY }, { originY: val }));
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
          <LabeledInput label="k" value={op.scalarK ?? 1} onChange={handleKChange} />
        </PanelSection>
      )}

      {op.kind !== 'dotProduct' && (
        <PanelSection title="结果起点">
          <InfoBlock>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: COLORS.textMuted, fontSize: 14, width: 14 }}>x</span>
              <CompactInput value={parseFloat(curOriginX.toFixed(2))} onCommit={(v) => handleOriginChange('x', v)} />
              <span style={{ color: COLORS.textMuted, fontSize: 14, width: 14, marginLeft: 4 }}>y</span>
              <CompactInput value={parseFloat(curOriginY.toFixed(2))} onCommit={(v) => handleOriginChange('y', v)} />
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
