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
