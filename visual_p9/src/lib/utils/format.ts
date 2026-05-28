export function formatValue(value: number, unit = '', scientific = false): string {
  if (!Number.isFinite(value)) return '--';
  const text = scientific
    ? value.toExponential(2)
    : value.toLocaleString('zh-CN', { maximumFractionDigits: 3 });
  return unit ? `${text} ${unit}` : text;
}

export function parseNumericInput(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export interface ScientificParts {
  coefficient: number;
  exponent: number;
}

export function splitScientific(value: number): ScientificParts {
  if (value === 0) return { coefficient: 0, exponent: 0 };
  const exponent = Math.floor(Math.log10(Math.abs(value)));
  const coefficient = value / 10 ** exponent;
  return {
    coefficient: Number(coefficient.toPrecision(6)),
    exponent,
  };
}

export function joinScientific(coefficient: number, exponent: number): number {
  return coefficient * 10 ** exponent;
}
