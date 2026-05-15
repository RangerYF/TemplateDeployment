interface P13ResistorBodyProps {
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
}

const DEFAULT_RESISTOR_STROKE = '#B96A16';
const DEFAULT_RESISTOR_FILL = '#FFF4E8';

export function scaleArrowLength(
  value: number,
  maxMagnitude: number,
  minLength: number,
  maxLength: number,
  zeroThreshold = 1e-6,
): number {
  const magnitude = Math.abs(value);
  if (magnitude <= zeroThreshold) return 0;
  if (maxMagnitude <= zeroThreshold) return minLength;
  const ratio = Math.max(0, Math.min(1, magnitude / maxMagnitude));
  return minLength + ((maxLength - minLength) * ratio);
}

export function maxAbs(...values: number[]): number {
  return values.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
}

export function P13VerticalResistorBody({
  centerX,
  topY,
  width = 24,
  height = 52,
  stroke = DEFAULT_RESISTOR_STROKE,
  fill = DEFAULT_RESISTOR_FILL,
  strokeWidth = 3,
}: P13ResistorBodyProps & {
  centerX: number;
  topY: number;
  width?: number;
  height?: number;
}) {
  return (
    <rect
      x={centerX - (width / 2)}
      y={topY}
      width={width}
      height={height}
      rx={Math.min(width, height) * 0.22}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
    />
  );
}

export function P13HorizontalResistorBody({
  leftX,
  centerY,
  width = 88,
  height = 22,
  stroke = DEFAULT_RESISTOR_STROKE,
  fill = DEFAULT_RESISTOR_FILL,
  strokeWidth = 3,
}: P13ResistorBodyProps & {
  leftX: number;
  centerY: number;
  width?: number;
  height?: number;
}) {
  return (
    <rect
      x={leftX}
      y={centerY - (height / 2)}
      width={width}
      height={height}
      rx={Math.min(width, height) * 0.22}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
    />
  );
}
