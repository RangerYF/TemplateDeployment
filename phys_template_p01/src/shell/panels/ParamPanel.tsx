import { useEffect, useState } from 'react';
import type { ParamSchema, ParamValues, ParamVisibilityRule } from '@/core/types';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { COLORS, SHADOWS } from '@/styles/tokens';
import { getP08PanelSurfaceStyle, getP08SceneTheme, toAlpha } from '@/shell/p08/p08Theme';

export interface ParamPanelProps {
  schemas: ParamSchema[];
  values: ParamValues;
  onValueChange: (key: string, value: number | boolean | string) => void;
  onBack?: () => void;
  presetId?: string;
  /** 'aside' = 旧左栏(自带 aside/头部);'sidebar' = P09 右栏内裸渲染(无 aside/无卡片 chrome)。 */
  variant?: 'aside' | 'sidebar';
}

/**
 * 参数面板 — schema 驱动渲染。
 * 根据 ParamSchema 的类型自动选择控件，并为磁场实验补充方向/电性提示。
 */
export function ParamPanel({ schemas, values, onValueChange, onBack, presetId, variant = 'aside' }: ParamPanelProps) {
  const groups = groupSchemas(schemas, values);
  const theme = presetId ? getP08SceneTheme(presetId) : null;
  const shellStyle = presetId ? getP08PanelSurfaceStyle(presetId) : null;
  const sidebar = variant === 'sidebar';

  const body = (
    <>
      {groups.length === 0 && (
        <div className="px-2 py-8 text-center text-xs" style={{ color: 'var(--theme-text-muted)' }}>
          暂无参数
        </div>
      )}

      {groups.map((group) => (
        <div key={group.label} className="mb-3">
          {group.label && (
            <div
              className="mb-2 px-1 text-xs font-medium"
              style={{ color: sidebar ? 'var(--theme-text-secondary)' : (theme?.accentStrong ?? COLORS.textSecondary) }}
            >
              {group.label}
            </div>
          )}
          <div className={sidebar ? 'space-y-2.5' : 'space-y-3'}>
            {group.schemas.map((schema) => (
              <ParamControl
                key={schema.key}
                schema={schema}
                value={values[schema.key] ?? getParamDefaultValue(schema)}
                onChange={(nextValue) => onValueChange(schema.key, nextValue)}
                variant={variant}
              />
            ))}
          </div>
        </div>
      ))}
    </>
  );

  if (sidebar) {
    return <div className="space-y-1">{body}</div>;
  }

  return (
    <aside
      className="flex h-full flex-col"
      style={{
        width: 260,
        minWidth: 240,
        maxWidth: 280,
        borderRight: presetId ? 'none' : `1px solid ${COLORS.border}`,
        backgroundColor: COLORS.bg,
        ...(shellStyle ?? {}),
      }}
    >
      <div
        className="flex items-center gap-2 px-4 py-3 text-sm font-semibold"
        style={{
          color: COLORS.text,
          borderBottom: `1px solid ${theme?.border ?? COLORS.border}`,
          background: theme
            ? `linear-gradient(180deg, ${toAlpha(theme.accent, 0.1)} 0%, rgba(255,255,255,0) 100%)`
            : undefined,
        }}
      >
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center text-xs font-normal transition-colors hover:opacity-70"
            style={{ color: COLORS.textSecondary }}
          >
            ← 返回
          </button>
        )}
        <span className="flex-1">参数设置</span>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto p-3">{body}</div>
    </aside>
  );
}

interface ParamControlProps {
  schema: ParamSchema;
  value: number | boolean | string;
  onChange: (value: number | boolean | string) => void;
  variant?: 'aside' | 'sidebar';
}

function ParamControl({ schema, value, onChange, variant = 'aside' }: ParamControlProps) {
  const sidebar = variant === 'sidebar';
  // 旧 aside 下保留圆角卡片;P09 sidebar 下去掉卡片 chrome,改用扁平行。
  const cardClass = sidebar ? 'space-y-1.5' : 'space-y-1 rounded-2xl px-2.5 py-2';
  const cardStyle = sidebar ? undefined : { backgroundColor: '#FFFFFF99', boxShadow: SHADOWS.sm };
  const mutedColor = sidebar ? 'var(--theme-text-muted)' : COLORS.textMuted;

  switch (schema.type) {
    case 'slider': {
      const numericValue = typeof value === 'number' ? value : schema.default;

      return (
        <div className={cardClass} style={cardStyle}>
          <div className="flex items-center justify-between">
            <Label className="text-xs">{schema.label}</Label>
            <span className="text-xs tabular-nums" style={{ color: mutedColor }}>
              {formatSliderValue(numericValue, schema.precision ?? 1)}
              {schema.unit}
            </span>
          </div>
          <Slider
            value={[numericValue]}
            onValueChange={([nextValue]) => {
              if (nextValue !== undefined) onChange(nextValue);
            }}
            min={schema.min}
            max={schema.max}
            step={schema.step}
          />
          {sidebar && (
            <NumberField
              value={numericValue}
              min={schema.min}
              max={schema.max}
              precision={schema.precision ?? 1}
              onCommit={(n) => onChange(n)}
            />
          )}
          {schema.key === 'theta' && <AnglePreview angleDeg={numericValue} />}
          {schema.key === 'charge' && <ChargeHint charge={numericValue} />}
        </div>
      );
    }

    case 'input':
      return (
        <div className={cardClass} style={cardStyle}>
          <Label className="text-xs">{schema.label}</Label>
          <div className="flex items-center gap-1">
            <Input
              type="number"
              value={typeof value === 'number' ? value : schema.default}
              onChange={(e) => onChange(Number(e.target.value))}
              min={schema.min}
              max={schema.max}
              className="h-8 text-xs"
            />
            <span className="text-xs" style={{ color: mutedColor }}>
              {schema.unit}
            </span>
          </div>
        </div>
      );

    case 'toggle':
      return (
        <div
          className={sidebar ? 'flex items-center justify-between py-1' : 'flex items-center justify-between rounded-2xl px-2.5 py-2'}
          style={cardStyle}
        >
          <Label className="text-xs">{schema.label}</Label>
          <Switch
            checked={typeof value === 'boolean' ? value : schema.default}
            onCheckedChange={(checked) => onChange(checked)}
          />
        </div>
      );

    case 'select':
      return (
        <div className={cardClass} style={cardStyle}>
          <Label className="text-xs">{schema.label}</Label>
          <Select
            value={typeof value === 'string' ? value : String(value ?? schema.default)}
            onChange={(e) => {
              const raw = e.target.value;
              const numeric = Number(raw);
              onChange(Number.isNaN(numeric) ? raw : numeric);
            }}
            options={schema.options}
          />
        </div>
      );

    case 'button':
      return (
        <div className={sidebar ? 'space-y-1.5' : 'space-y-1.5 rounded-2xl px-2.5 py-2'} style={cardStyle}>
          <Label className="text-xs">{schema.label}</Label>
          <Button
            size="sm"
            variant={schema.variant ?? 'secondary'}
            onClick={() => onChange('__button_click__')}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {schema.buttonText ?? schema.label}
          </Button>
        </div>
      );
  }
}

/** P09 风格滑块下方的可编辑数字框:失焦/回车提交并 clamp,双向同步。 */
function NumberField({
  value,
  min,
  max,
  precision,
  onCommit,
}: {
  value: number;
  min: number;
  max: number;
  precision: number;
  onCommit: (n: number) => void;
}) {
  const [draft, setDraft] = useState(() => formatSliderValue(value, precision));

  useEffect(() => {
    setDraft(formatSliderValue(value, precision));
  }, [value, precision]);

  const commit = () => {
    const parsed = Number(draft);
    if (Number.isFinite(parsed)) {
      const clamped = Math.min(max, Math.max(min, parsed));
      onCommit(clamped);
      setDraft(formatSliderValue(clamped, precision));
    } else {
      setDraft(formatSliderValue(value, precision));
    }
  };

  return (
    <input
      type="number"
      value={draft}
      min={min}
      max={max}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = 'var(--theme-border)';
        e.currentTarget.style.boxShadow = 'none';
        commit();
      }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      className="h-7 w-full px-2 text-xs tabular-nums outline-none"
      style={{
        border: '1px solid var(--theme-border)',
        borderRadius: 14,
        background: 'var(--theme-surface-hover)',
        color: 'var(--theme-text)',
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = 'var(--accent-green)';
        e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-green-focus)';
      }}
    />
  );
}

interface SchemaGroup {
  label: string;
  schemas: ParamSchema[];
}

function groupSchemas(schemas: ParamSchema[], values: ParamValues): SchemaGroup[] {
  const groups = new Map<string, ParamSchema[]>();

  for (const schema of schemas) {
    if (!isSchemaVisible(schema, schemas, values)) continue;

    const groupKey = schema.group ?? '';
    const existing = groups.get(groupKey);
    if (existing) {
      existing.push(schema);
    } else {
      groups.set(groupKey, [schema]);
    }
  }

  return Array.from(groups.entries()).map(([label, groupSchemas]) => ({
    label,
    schemas: groupSchemas,
  }));
}

function isSchemaVisible(
  schema: ParamSchema,
  schemas: ParamSchema[],
  values: ParamValues,
): boolean {
  const rules = schema.visibleWhen;
  if (!rules || rules.length === 0) return true;

  return rules.every((rule) => matchesVisibilityRule(rule, schemas, values));
}

function matchesVisibilityRule(
  rule: ParamVisibilityRule,
  schemas: ParamSchema[],
  values: ParamValues,
): boolean {
  const currentValue = resolveParamValue(rule.key, schemas, values);

  if (rule.equals !== undefined && currentValue !== rule.equals) {
    return false;
  }

  if (rule.notEquals !== undefined && currentValue === rule.notEquals) {
    return false;
  }

  return true;
}

function resolveParamValue(
  key: string,
  schemas: ParamSchema[],
  values: ParamValues,
): ParamValues[string] | undefined {
  if (key in values) {
    return values[key];
  }

  const schema = schemas.find((entry) => entry.key === key);
  return schema ? getParamDefaultValue(schema) : undefined;
}

function getParamDefaultValue(schema: ParamSchema): ParamValues[string] {
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

function formatSliderValue(value: number, precision: number): string {
  if (Math.abs(value) >= 1e4 || (Math.abs(value) > 0 && Math.abs(value) < 1e-2)) {
    return value.toExponential(2);
  }
  return value.toFixed(precision);
}

function AnglePreview({ angleDeg }: { angleDeg: number }) {
  const radians = (angleDeg * Math.PI) / 180;
  const centerX = 24;
  const centerY = 24;
  const tipX = centerX + Math.cos(radians) * 14;
  const tipY = centerY - Math.sin(radians) * 14;

  const leftWingX = tipX - 4 * Math.cos(radians - Math.PI / 6);
  const leftWingY = tipY + 4 * Math.sin(radians - Math.PI / 6);
  const rightWingX = tipX - 4 * Math.cos(radians + Math.PI / 6);
  const rightWingY = tipY + 4 * Math.sin(radians + Math.PI / 6);

  return (
    <div
      className="mt-2 flex items-center gap-2 rounded-md px-2 py-1.5"
      style={{ backgroundColor: COLORS.bgMuted }}
    >
      <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">
        <circle cx={centerX} cy={centerY} r="18" fill="none" stroke={COLORS.border} strokeWidth="1.5" />
        <path
          d={`M ${centerX} ${centerY} L ${tipX} ${tipY}`}
          stroke={COLORS.primary}
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d={`M ${tipX} ${tipY} L ${leftWingX} ${leftWingY} L ${rightWingX} ${rightWingY} Z`}
          fill={COLORS.primary}
        />
      </svg>
      <div className="text-xs" style={{ color: COLORS.textSecondary }}>
        方向预览按数学角度定义：`0°` 向右，`90°` 向上。
      </div>
    </div>
  );
}

function ChargeHint({ charge }: { charge: number }) {
  let label = '当前为零电荷';
  let color: string = COLORS.textMuted;

  if (charge > 0) {
    label = '当前为正电荷';
    color = '#DC2626';
  } else if (charge < 0) {
    label = '当前为负电荷';
    color = '#2563EB';
  }

  return (
    <div className="mt-2 text-xs font-medium" style={{ color }}>
      {label}
    </div>
  );
}
