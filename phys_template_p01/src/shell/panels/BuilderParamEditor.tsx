import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import type { Entity, InputParamSchema, ParamSchema, SliderParamSchema } from '@/core/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { COLORS } from '@/styles/tokens';

export type BuilderParamEditorVariant = 'panel' | 'popup';

interface BuilderEntityParamFieldsProps {
  entity: Entity;
  schemas: ParamSchema[];
  onUpdate: (key: string, value: number | boolean | string) => void;
  variant?: BuilderParamEditorVariant;
}

interface BuilderEntityParamFieldProps {
  entity: Entity;
  schema: ParamSchema;
  onUpdate: (key: string, value: number | boolean | string) => void;
  variant?: BuilderParamEditorVariant;
}

const SHARED_INPUT_CLASS_NAME = 'h-8 px-2 py-1 text-right text-xs tabular-nums';

export function filterEntitySchemasForTemplate(params: {
  familyId: string | null;
  entity: Entity;
  schemas: ParamSchema[];
}): ParamSchema[] {
  if (params.familyId !== 'meter-conversion') {
    return params.schemas;
  }

  switch (params.entity.type) {
    case 'dc-source':
      return [];
    case 'ammeter':
    case 'voltmeter':
      return params.schemas.filter((schema) => schema.key === 'range');
    case 'galvanometer':
      return params.schemas.filter((schema) => schema.key === 'range' || schema.key === 'internalResistance');
    case 'fixed-resistor':
      return params.schemas.filter((schema) => schema.key === 'resistance');
    default:
      return params.schemas;
  }
}

export function getTemplateSpecificEntityNote(
  familyId: string | null,
  entity: Entity,
): string | null {
  if (familyId !== 'meter-conversion') return null;

  switch (entity.type) {
    case 'dc-source':
      return '该元件在电表改装模板里只承担结构示意，不读取这里的电动势或内阻参数。';
    case 'ammeter':
      return '这里的改装后电流表只把“目标量程”当作输入；等效内阻由表头 G 和分流电阻 Rs 自动计算。';
    case 'voltmeter':
      return '这里的改装后电压表只把“目标量程”当作输入；输入电阻由表头 G 和分压电阻 Rv 自动计算。';
    default:
      return null;
  }
}

export function BuilderEntityParamFields({
  entity,
  schemas,
  onUpdate,
  variant = 'panel',
}: BuilderEntityParamFieldsProps) {
  if (schemas.length === 0) return null;

  return (
    <>
      {schemas.map((schema) => (
        <BuilderEntityParamField
          key={schema.key}
          entity={entity}
          schema={schema}
          onUpdate={onUpdate}
          variant={variant}
        />
      ))}
    </>
  );
}

export function BuilderEntityParamField({
  entity,
  schema,
  onUpdate,
  variant = 'panel',
}: BuilderEntityParamFieldProps) {
  const currentValue = entity.properties[schema.key];
  const labelClassName = variant === 'popup' ? 'text-[11px]' : 'text-xs';

  if (schema.type === 'slider' || schema.type === 'input') {
    const numericValue = typeof currentValue === 'number' ? currentValue : schema.default;

    return (
      <NumericParamField
        schema={schema}
        labelClassName={labelClassName}
        value={numericValue}
        variant={variant}
        onCommit={(nextValue) => onUpdate(schema.key, nextValue)}
      />
    );
  }

  if (schema.type === 'toggle') {
    const boolValue = typeof currentValue === 'boolean' ? currentValue : schema.default;

    return (
      <div className="flex items-center justify-between gap-3">
        <Label className={labelClassName} style={{ color: COLORS.textSecondary }}>
          {schema.label}
        </Label>
        <div className="flex items-center gap-2">
          <span className="text-[10px]" style={{ color: COLORS.textMuted }}>
            {boolValue ? (schema.labelOn ?? '开') : (schema.labelOff ?? '关')}
          </span>
          <Switch
            checked={boolValue}
            onCheckedChange={(checked) => onUpdate(schema.key, checked)}
          />
        </div>
      </div>
    );
  }

  const selectValue = String(currentValue ?? schema.default);

  return (
    <div className="space-y-1">
      <Label className={labelClassName} style={{ color: COLORS.textSecondary }}>
        {schema.label}
      </Label>
      <Select
        value={selectValue}
        onChange={(event) => onUpdate(schema.key, event.target.value)}
        options={schema.options}
        className="h-8 text-xs"
        style={{ borderColor: COLORS.border, color: COLORS.text }}
      />
    </div>
  );
}

function NumericParamField({
  schema,
  value,
  labelClassName,
  variant,
  onCommit,
}: {
  schema: SliderParamSchema | InputParamSchema;
  value: number;
  labelClassName: string;
  variant: BuilderParamEditorVariant;
  onCommit: (value: number) => void;
}) {
  const precision = getSchemaPrecision(schema);
  const [draft, setDraft] = useState(() => formatNumberForInput(value, precision));
  const [isEditing, setIsEditing] = useState(false);
  const shouldSkipNextBlurCommitRef = useRef(false);

  useEffect(() => {
    if (!isEditing) {
      setDraft(formatNumberForInput(value, precision));
    }
  }, [isEditing, precision, value]);

  const validation = validateNumericDraft(schema, draft);
  const inputStyle = resolveNumericInputStyle(validation.isInvalid, isEditing);
  const sliderValue = schema.type === 'slider'
    ? Math.max(schema.min, Math.min(schema.max, value))
    : null;

  const commitDraft = () => {
    if (!validation.valueIsValid || validation.value == null) {
      setDraft(formatNumberForInput(value, precision));
      return;
    }

    onCommit(validation.value);
    setDraft(formatNumberForInput(validation.value, precision));
  };

  const handleChange = (nextDraft: string) => {
    setDraft(nextDraft);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.currentTarget.blur();
      return;
    }

    if (event.key === 'Escape') {
      shouldSkipNextBlurCommitRef.current = true;
      setDraft(formatNumberForInput(value, precision));
      setIsEditing(false);
      event.currentTarget.blur();
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className={labelClassName} style={{ color: COLORS.textSecondary }}>
          {schema.label}
        </Label>
        <div className="flex items-center gap-1">
          <Input
            type="text"
            inputMode="decimal"
            value={draft}
            onFocus={() => setIsEditing(true)}
            onChange={(event) => handleChange(event.target.value)}
            onBlur={() => {
              setIsEditing(false);
              if (shouldSkipNextBlurCommitRef.current) {
                shouldSkipNextBlurCommitRef.current = false;
                return;
              }
              commitDraft();
            }}
            onKeyDown={handleKeyDown}
            className={`${variant === 'popup' ? 'w-20' : 'w-16'} ${SHARED_INPUT_CLASS_NAME}`}
            style={inputStyle}
            aria-invalid={validation.isInvalid}
          />
          {schema.unit ? (
            <span className="text-[10px]" style={{ color: COLORS.textMuted }}>
              {schema.unit}
            </span>
          ) : null}
        </div>
      </div>
      {schema.type === 'slider' && sliderValue != null && (
        <Slider
          min={schema.min}
          max={schema.max}
          step={schema.step}
          value={[sliderValue]}
          onValueChange={([nextValue]) => {
            if (nextValue !== undefined) onCommit(nextValue);
          }}
        />
      )}
    </div>
  );
}

function validateNumericDraft(
  schema: SliderParamSchema | InputParamSchema,
  draft: string,
): { value: number | null; valueIsValid: boolean; isInvalid: boolean } {
  const trimmed = draft.trim();

  if (trimmed === '' || trimmed === '-' || trimmed === '.' || trimmed === '-.') {
    return { value: null, valueIsValid: false, isInvalid: false };
  }

  if (!/^[-+]?(?:\d+\.?\d*|\.\d+)$/.test(trimmed)) {
    return { value: null, valueIsValid: false, isInvalid: true };
  }

  const numericValue = Number(trimmed);
  const normalizedValue = normalizeNumericValue(schema, numericValue);

  return {
    value: normalizedValue,
    valueIsValid: normalizedValue != null,
    isInvalid: normalizedValue == null,
  };
}

function normalizeNumericValue(
  schema: SliderParamSchema | InputParamSchema,
  value: number,
): number | null {
  if (!Number.isFinite(value)) return null;

  const min = schema.type === 'slider' ? schema.min : schema.min ?? -Infinity;
  const max = schema.type === 'slider' ? schema.inputMax ?? schema.max : schema.max ?? Infinity;
  if (value < min || value > max) return null;

  const precision = getSchemaPrecision(schema);
  const normalized = precision == null ? value : roundToPrecision(value, precision);
  if (precision != null && !numbersEqual(normalized, value, precision)) return null;

  if (schema.type === 'slider' && !isStepAligned(normalized, schema.min, schema.step)) {
    return null;
  }

  return normalized;
}

function getSchemaPrecision(schema: SliderParamSchema | InputParamSchema): number | undefined {
  if (schema.precision !== undefined) return schema.precision;
  if (schema.type === 'slider') return getStepPrecision(schema.step);
  return undefined;
}

function getStepPrecision(step: number): number {
  const text = String(step).toLowerCase();
  if (text.includes('e-')) {
    const exponent = Number(text.split('e-')[1]);
    return Number.isFinite(exponent) ? exponent : 0;
  }

  const decimalPart = text.split('.')[1];
  return decimalPart ? decimalPart.length : 0;
}

function roundToPrecision(value: number, precision: number): number {
  if (precision <= 0) return Math.round(value);
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function numbersEqual(valueA: number, valueB: number, precision?: number): boolean {
  const tolerance = precision == null ? 1e-9 : 1 / 10 ** (precision + 2);
  return Math.abs(valueA - valueB) <= tolerance;
}

function isStepAligned(value: number, min: number, step: number): boolean {
  const normalized = (value - min) / step;
  const tolerance = 1 / 10 ** (getStepPrecision(step) + 2);
  return Math.abs(normalized - Math.round(normalized)) <= tolerance;
}

function formatNumberForInput(value: number, precision?: number): string {
  if (!Number.isFinite(value)) return '';
  const normalized = precision == null ? value : roundToPrecision(value, precision);
  return trimTrailingZeros(String(normalized));
}

function trimTrailingZeros(text: string): string {
  if (!text.includes('.') || text.includes('e') || text.includes('E')) {
    return text;
  }

  return text
    .replace(/(\.\d*?[1-9])0+$/u, '$1')
    .replace(/\.0+$/u, '')
    .replace(/\.$/u, '');
}

function resolveNumericInputStyle(isInvalid: boolean, isEditing: boolean): CSSProperties {
  if (!isInvalid) {
    return { borderColor: COLORS.border, color: COLORS.text };
  }

  return {
    borderColor: COLORS.warning,
    color: COLORS.text,
    boxShadow: isEditing ? `0 0 0 3px ${COLORS.warning}22` : 'none',
  };
}
