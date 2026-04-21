import { useState } from 'react';
import { Eye, EyeOff, Trash2, Plus, ChevronDown } from 'lucide-react';
import { useEntityStore } from '@/editor/store/entityStore';
import type { DisplayOptions } from '@/editor/store/entityStore';
import { createEntity } from '@/editor/entities/types';
import { createLine } from '@/editor/entities/line';
import { createImplicitCurve } from '@/editor/entities/implicitCurve';
import { parseImplicitEquation } from '@/engine/implicitCurveEngine';
import { AddEntityCommand } from '@/editor/commands/AddEntityCommand';
import { RemoveEntityCommand } from '@/editor/commands/RemoveEntityCommand';
import { executeM03Command } from '@/editor/commands/m03Execute';
import type { ConicType } from '@/types';
import { ENTITY_COLORS } from '@/types';
import { formatEquationDisplay } from '@/engine/lineExpressionEngine';
import { COLORS } from '@/styles/colors';
import { btnHover, dangerHover, rowHover } from '@/styles/interactionStyles';
import { Switch } from '@/components/ui/switch';

// ─── Conic type specs ─────────────────────────────────────────────────────────

interface ConicSpec {
  type:          ConicType;
  label:         string;
  defaultParams: Record<string, number | string>;
}

const CONIC_SPECS: ConicSpec[] = [
  { type: 'ellipse',   label: '椭圆',     defaultParams: { a: 5, b: 3, cx: 0, cy: 0 } },
  { type: 'hyperbola', label: '双曲线',   defaultParams: { a: 3, b: 4, cx: 0, cy: 0 } },
  { type: 'parabola',  label: '抛物线 →', defaultParams: { p: 2, cx: 0, cy: 0, orientation: 'h' } },
  { type: 'parabola',  label: '抛物线 ↑', defaultParams: { p: 2, cx: 0, cy: 0, orientation: 'v' } },
  { type: 'circle',    label: '圆',       defaultParams: { r: 4, cx: 0, cy: 0 } },
];

const TYPE_NAMES: Record<string, string> = {
  ellipse:          '椭圆',
  hyperbola:        '双曲线',
  parabola:         '抛物线',
  circle:           '圆',
  line:             '直线',
  'implicit-curve': '自定义曲线',
  'movable-point':  '动点',
};

const DISPLAY_OPTS: Array<[keyof DisplayOptions, string]> = [
  ['showGrid',            '网格'],
  ['showFoci',            '焦点'],
  ['showVertices',        '顶点'],
  ['showDirectrices',     '准线'],
  ['showAsymptotes',      '渐近线'],
  ['showAxesOfSymmetry',  '对称轴'],
  ['showLabels',          '方程标签'],
  ['showIntersections',   '交点 (直线)'],
  ['showTangent',         '切线 (动点)'],
  ['showNormal',          '法线 (动点)'],
  ['showFocalChord',      '焦点弦 (动点)'],
];

// ─── Component ────────────────────────────────────────────────────────────────

export function EntityListPanel() {
  const entities       = useEntityStore((s) => s.entities);
  const activeEntityId = useEntityStore((s) => s.activeEntityId);
  const setActiveId    = useEntityStore((s) => s.setActiveEntityId);
  const displayOptions = useEntityStore((s) => s.displayOptions);
  const setDisplayOpt  = useEntityStore((s) => s.setDisplayOption);

  const [showAddMenu, setShowAddMenu] = useState(false);

  const handleAdd = (spec: ConicSpec) => {
    setShowAddMenu(false);
    const color  = ENTITY_COLORS[entities.length % ENTITY_COLORS.length];
    const entity = createEntity(spec.type, spec.defaultParams as never, { color });
    executeM03Command(new AddEntityCommand(entity));
    useEntityStore.getState().setActiveEntityId(entity.id);
  };

  const handleAddLine = () => {
    setShowAddMenu(false);
    const color  = ENTITY_COLORS[entities.length % ENTITY_COLORS.length];
    const entity = createLine({ k: 1, b: 0, vertical: false, x: 0 }, { color });
    executeM03Command(new AddEntityCommand(entity));
    useEntityStore.getState().setActiveEntityId(entity.id);
  };

  const handleAddImplicit = () => {
    setShowAddMenu(false);
    const color = ENTITY_COLORS[entities.length % ENTITY_COLORS.length];
    const defaultExpr = 'x^2 + y^2 - 25';
    const parsed = parseImplicitEquation(defaultExpr, []);
    const entity = createImplicitCurve(
      parsed?.exprStr ?? defaultExpr,
      parsed?.namedParams ?? [],
      { color },
    );
    executeM03Command(new AddEntityCommand(entity));
    useEntityStore.getState().setActiveEntityId(entity.id);
  };

  const handleRemove = (ev: React.MouseEvent, id: string) => {
    ev.stopPropagation();
    const entity = useEntityStore.getState().entities.find((e) => e.id === id);
    if (!entity) return;
    executeM03Command(new RemoveEntityCommand(entity));
  };

  const handleToggleVisible = (ev: React.MouseEvent, id: string) => {
    ev.stopPropagation();
    const store  = useEntityStore.getState();
    const entity = store.entities.find((e) => e.id === id);
    if (!entity) return;
    store.updateEntity(id, { ...entity, visible: !entity.visible } as typeof entity);
  };

  const entityLabel = (entity: typeof entities[number], index: number): string => {
    if (entity.label) return entity.label;
    const typeName = TYPE_NAMES[entity.type] ?? entity.type;
    if (entity.type === 'line') {
      if (entity.equationStr) return formatEquationDisplay(entity.equationStr);
      const { k, b, vertical, x } = entity.params;
      if (vertical) return `x = ${x.toFixed(1)}`;
      return `y = ${k.toFixed(1)}x ${b >= 0 ? '+' : '−'} ${Math.abs(b).toFixed(1)}`;
    }
    if (entity.type === 'implicit-curve') {
      return entity.params.exprStr.replace(/\*/g, '·').slice(0, 24);
    }
    if (entity.type === 'movable-point') {
      return `动点 P${index + 1}`;
    }
    return `${typeName} ${index + 1}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px', flexShrink: 0,
      }}>
        <span style={{
          fontSize: '13px', fontWeight: 600, color: COLORS.textPrimary,
          letterSpacing: '0.02em',
        }}>
          曲线列表
        </span>

        {/* Add dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowAddMenu((v) => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '5px 10px', fontSize: '11px', fontWeight: 600,
              background: COLORS.primary, color: COLORS.white,
              border: 'none', borderRadius: '9999px', cursor: 'pointer',
              boxShadow: '0 1px 4px rgba(0,192,107,0.25)',
              transition: 'background 150ms',
            }}
            {...btnHover(COLORS.primaryHover, COLORS.primary)}
          >
            <Plus size={12} strokeWidth={2.5} />
            添加
            <ChevronDown size={10} />
          </button>

          {showAddMenu && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                onClick={() => setShowAddMenu(false)}
              />
              <div style={{
                position: 'absolute', right: 0, top: '100%', marginTop: '6px',
                background: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.10)',
                overflow: 'hidden', zIndex: 100, minWidth: '140px',
                padding: '4px',
              }}>
                {CONIC_SPECS.map((spec, i) => (
                  <MenuItem key={`${spec.type}-${i}`} onClick={() => handleAdd(spec)}>
                    {spec.label}
                  </MenuItem>
                ))}
                <div style={{ borderTop: `1px solid ${COLORS.border}`, margin: '4px 8px' }} />
                <MenuItem onClick={handleAddLine}>直线 (y=kx+b)</MenuItem>
                <MenuItem onClick={handleAddImplicit}>自定义曲线 f(x,y)=0</MenuItem>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Entity list ───────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
        {entities.length === 0 ? (
          <div style={{ padding: '32px 12px', textAlign: 'center' }}>
            <p style={{ fontSize: '12px', color: COLORS.neutral, lineHeight: 1.8 }}>
              暂无曲线<br />点击上方"添加"按钮创建
            </p>
          </div>
        ) : (
          entities.map((entity, index) => {
            const isActive = entity.id === activeEntityId;
            const label    = entityLabel(entity, index);

            return (
              <div
                key={entity.id}
                onClick={() => setActiveId(entity.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '8px 10px', marginBottom: '2px',
                  background: isActive ? COLORS.primaryLight : 'transparent',
                  borderRadius: '8px',
                  border: isActive ? `1px solid ${COLORS.primary}33` : '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 120ms',
                }}
                {...rowHover(isActive)}
              >
                {/* Active indicator dot */}
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: isActive ? COLORS.primary : COLORS.borderMuted,
                  flexShrink: 0, transition: 'background 120ms',
                }} />

                {/* Label */}
                <span style={{
                  flex: 1, fontSize: '12px',
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? COLORS.textPrimary : COLORS.textSecondary,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {label}
                </span>

                {/* Visibility */}
                <button
                  onClick={(ev) => handleToggleVisible(ev, entity.id)}
                  title={entity.visible ? '隐藏' : '显示'}
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    padding: '2px', flexShrink: 0,
                    color: entity.visible ? COLORS.neutral : COLORS.textSecondary,
                    transition: 'color 120ms',
                  }}
                >
                  {entity.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                </button>

                {/* Delete */}
                <button
                  onClick={(ev) => handleRemove(ev, entity.id)}
                  title="删除"
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    padding: '2px', flexShrink: 0,
                    color: COLORS.neutral,
                    transition: 'color 120ms',
                  }}
                  {...dangerHover(COLORS.neutral)}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* ── Display options ───────────────────────────────────────────── */}
      <div style={{
        padding: '10px 14px',
        borderTop: `1px solid ${COLORS.border}`,
        flexShrink: 0,
      }}>
        <p style={{
          fontSize: 13, fontWeight: 600, color: COLORS.textSecondary,
          marginBottom: 8,
        }}>
          显示
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {DISPLAY_OPTS.map(([key, label], index) => (
            <div key={key}>
              {/* Separator between groups: after 网格(0), after 渐近线(4), after 方程标签(6) */}
              {(index === 1 || index === 5 || index === 7) && (
                <div style={{
                  borderTop: `1px solid ${COLORS.border}`,
                  margin: '6px 0',
                }} />
              )}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '4px 0',
              }}>
                <span style={{
                  fontSize: 13, fontWeight: 500,
                  color: displayOptions[key] ? COLORS.textPrimary : COLORS.textSecondary,
                  transition: 'color 120ms',
                }}>
                  {label}
                </span>
                <Switch
                  checked={displayOptions[key]}
                  onCheckedChange={(v) => setDisplayOpt(key, v)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── MenuItem ────────────────────────────────────────────────────────────────

function MenuItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block', width: '100%', padding: '7px 12px',
        textAlign: 'left', fontSize: '12px', color: COLORS.textPrimary,
        background: 'transparent', border: 'none', cursor: 'pointer',
        borderRadius: '8px',
        transition: 'background 100ms',
      }}
      {...btnHover(COLORS.surfaceAlt)}
    >
      {children}
    </button>
  );
}
