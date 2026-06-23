import type { Entity, ParamSchema, ParamValues, ViewportType } from '@/core/types';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { COLORS, SHADOWS } from '@/styles/tokens';
import {
  P08_FIELD_BUILDER_PALETTE,
  getEntityDisplayName,
  getEntityMetaText,
} from '@/domains/em/builder/p08-field-builder-scene';

export interface P08BuilderSidebarProps {
  viewport: ViewportType;
  selectedEntity: Entity | undefined;
  schemas: ParamSchema[];
  values: ParamValues;
  entities: Entity[];
  onSwitchViewport: (viewport: ViewportType) => void;
  onSelectEntity: (id: string | null) => void;
  onAddEntity: (kind: typeof P08_FIELD_BUILDER_PALETTE[number]['kind']) => void;
  onDeleteEntity: (entityId: string) => void;
  onValueChange: (key: string, value: number | boolean | string) => void;
}

export function P08BuilderSidebar({
  viewport,
  selectedEntity,
  schemas,
  values,
  entities,
  onSwitchViewport,
  onSelectEntity,
  onAddEntity,
  onDeleteEntity,
  onValueChange,
}: P08BuilderSidebarProps) {
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <CardSection title="视角">
          <div className="flex gap-2">
            {([
              { key: 'field', label: '场' },
              { key: 'motion', label: '运动' },
              { key: 'force', label: '受力' },
            ] as const).map((item) => {
              const active = viewport === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => onSwitchViewport(item.key)}
                  className="rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{
                    color: active ? COLORS.primary : COLORS.textSecondary,
                    backgroundColor: active ? COLORS.primaryLight : COLORS.bgMuted,
                    border: `1px solid ${active ? COLORS.primary : COLORS.border}`,
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </CardSection>

        <CardSection title="添加实体">
          <div className="grid gap-2 sm:grid-cols-2">
            {P08_FIELD_BUILDER_PALETTE.map((item) => (
              <button
                key={item.kind}
                onClick={() => onAddEntity(item.kind)}
                className="rounded-xl border px-3 py-2 text-left transition-all hover:-translate-y-0.5"
                style={{
                  borderColor: COLORS.border,
                  backgroundColor: COLORS.bgMuted,
                }}
              >
                <div className="text-sm font-semibold" style={{ color: COLORS.text }}>
                  {item.label}
                </div>
                <div className="mt-1 text-[11px] leading-5" style={{ color: COLORS.textMuted }}>
                  {item.description}
                </div>
              </button>
            ))}
          </div>
        </CardSection>

        <CardSection title={`场景实体（${entities.length}）`}>
          {entities.length === 0 ? (
            <div className="text-xs" style={{ color: COLORS.textMuted }}>
              先从上方添加实体。静电场、匀强场、长直导线、圆形电流、螺线管和带电粒子都可独立拖拽。
            </div>
          ) : (
            <div className="space-y-2">
              {entities.map((entity) => {
                const selected = selectedEntity?.id === entity.id;
                return (
                  <div
                    key={entity.id}
                    className="rounded-xl border px-3 py-2"
                    style={{
                      borderColor: selected ? COLORS.primary : COLORS.border,
                      backgroundColor: selected ? COLORS.primaryLight : COLORS.bg,
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        onClick={() => onSelectEntity(entity.id)}
                        className="flex-1 text-left"
                      >
                        <div className="text-sm font-semibold" style={{ color: COLORS.text }}>
                          {getEntityDisplayName(entity)}
                        </div>
                        <div className="mt-1 text-[11px]" style={{ color: COLORS.textMuted }}>
                          {getEntityMetaText(entity)}
                        </div>
                      </button>
                      <button
                        onClick={() => onDeleteEntity(entity.id)}
                        className="rounded px-2 py-1 text-[11px]"
                        style={{ color: '#B42318', backgroundColor: '#FEE4E2' }}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardSection>

        <CardSection title="选中对象">
          {!selectedEntity ? (
            <div className="text-xs" style={{ color: COLORS.textMuted }}>
              点击左侧列表或画布中的实体后，这里会显示可调参数。拖拽实体可直接改位置。
            </div>
          ) : (
            <div className="space-y-3">
              <div
                className="rounded-xl px-3 py-2"
                style={{ backgroundColor: COLORS.bgMuted }}
              >
                <div className="text-sm font-semibold" style={{ color: COLORS.text }}>
                  {getEntityDisplayName(selectedEntity)}
                </div>
                <div className="mt-1 text-[11px]" style={{ color: COLORS.textMuted }}>
                  {getEntityMetaText(selectedEntity)}
                </div>
              </div>
              {schemas.length === 0 ? (
                <div className="text-xs" style={{ color: COLORS.textMuted }}>
                  当前实体没有可调参数。
                </div>
              ) : (
                schemas.filter((schema) => isSchemaVisible(schema, values)).map((schema) => (
                  <BuilderParamControl
                    key={schema.key}
                    schema={schema}
                    value={values[schema.key] ?? getBuilderSchemaDefaultValue(schema)}
                    onChange={(value) => onValueChange(schema.key, value)}
                  />
                ))
              )}
            </div>
          )}
        </CardSection>
      </div>
    </div>
  );
}

function getBuilderSchemaDefaultValue(schema: ParamSchema): ParamValues[string] {
  switch (schema.type) {
    case 'slider':
    case 'input':
    case 'toggle':
    case 'select':
      return schema.default;
    case 'button':
    default:
      return '__button__';
  }
}

function CardSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      className="rounded-2xl border p-3"
      style={{
        borderColor: COLORS.border,
        backgroundColor: COLORS.bg,
        boxShadow: SHADOWS.sm,
      }}
    >
      <div className="mb-3 text-xs font-semibold" style={{ color: COLORS.textSecondary }}>
        {title}
      </div>
      {children}
    </section>
  );
}

function BuilderParamControl({
  schema,
  value,
  onChange,
}: {
  schema: ParamSchema;
  value: number | boolean | string;
  onChange: (value: number | boolean | string) => void;
}) {
  if (schema.type === 'slider') {
    const numericValue = typeof value === 'number' ? value : schema.default;
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <Label className="text-xs">{schema.label}</Label>
          <span className="text-xs" style={{ color: COLORS.textMuted }}>
            {formatSliderValue(numericValue, schema.precision ?? 1)}
            {schema.unit}
          </span>
        </div>
        <Slider
          value={[numericValue]}
          min={schema.min}
          max={schema.max}
          step={schema.step}
          onValueChange={([nextValue]) => {
            if (nextValue != null) onChange(nextValue);
          }}
        />
      </div>
    );
  }

  if (schema.type === 'select') {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs">{schema.label}</Label>
        <Select
          value={typeof value === 'string' ? value : String(value)}
          options={schema.options}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    );
  }

  if (schema.type === 'toggle') {
    return (
      <div className="flex items-center justify-between gap-3">
        <Label className="text-xs">{schema.label}</Label>
        <Switch
          checked={typeof value === 'boolean' ? value : schema.default}
          onCheckedChange={(checked) => onChange(checked)}
        />
      </div>
    );
  }

  return null;
}

function isSchemaVisible(schema: ParamSchema, values: ParamValues): boolean {
  if (!schema.visibleWhen || schema.visibleWhen.length === 0) {
    return true;
  }
  return schema.visibleWhen.every((rule) => {
    const currentValue = values[rule.key];
    if (rule.equals !== undefined) {
      return currentValue === rule.equals;
    }
    if (rule.notEquals !== undefined) {
      return currentValue !== rule.notEquals;
    }
    return true;
  });
}

function formatSliderValue(value: number, precision: number): string {
  if (Math.abs(value) >= 1e4 || (Math.abs(value) > 0 && Math.abs(value) < 1e-2)) {
    return value.toExponential(2);
  }
  return value.toFixed(precision);
}
