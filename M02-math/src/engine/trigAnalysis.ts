import type { FnType, TrigTransform } from '@/types';
import { formatPiLabel } from '@/engine/piAxisEngine';

export interface TrigAnalysisItem {
  label: string;
  values: string[];
}

function fmt(value: number): string {
  return formatPiLabel(value);
}

function fmtScalar(value: number, digits = 1): string {
  if (Math.abs(value) < 1e-10) return '0';
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(digits).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
}

function buildGeneralFormula(fnType: FnType, transform: TrigTransform): string {
  const { A, omega, phi, k } = transform;
  const aStr =
    A === 1 ? ''
    : A === -1 ? '-'
    : fmtScalar(A);

  const omegaStr =
    omega === 1 ? 'x'
    : omega === -1 ? '-x'
    : `${fmtScalar(omega)}x`;

  const phiStr = fmt(phi);
  const argStr =
    phiStr === '0'
      ? omegaStr
      : phiStr.startsWith('-')
        ? `${omegaStr} ${phiStr}`
        : `${omegaStr} + ${phiStr}`;

  const kStr =
    k === 0
      ? ''
      : k > 0
        ? ` + ${fmtScalar(k)}`
        : ` - ${fmtScalar(Math.abs(k))}`;

  return `y = ${aStr}${fnType}(${argStr})${kStr}`;
}

function fmtPeriod(omega: number): string {
  const period = (2 * Math.PI) / omega;
  return `${fmt(period)} ≈ ${period.toFixed(2)}`;
}

export function buildTrigAnalysis(
  fnType: FnType,
  transform: TrigTransform,
): TrigAnalysisItem[] {
  const { A, omega, phi, k } = transform;
  const period = (2 * Math.PI) / omega;
  const halfPeriod = period / 2;

  const items: TrigAnalysisItem[] = [
    { label: '通式', values: [buildGeneralFormula(fnType, transform)] },
    { label: '周期', values: [fmtPeriod(omega)] },
  ];

  if (fnType === 'sin') {
    const centerX = (-phi) / omega;
    items.push(
      { label: '对称中心', values: [`(${fmt(centerX)}, ${k.toFixed(2)}) + n·${fmt(halfPeriod)}`] },
      { label: '零点', values: [`x = ${fmt((-phi) / omega)} + n·${fmt(halfPeriod)}`] },
      { label: '对称轴', values: [
        `极大轴: x = ${fmt((Math.PI / 2 - phi) / omega)} + n·${fmt(period)}`,
        `极小轴: x = ${fmt((3 * Math.PI / 2 - phi) / omega)} + n·${fmt(period)}`,
      ] },
      { label: '单调区间', values: A * omega >= 0
        ? [
            `增: (${fmt((-Math.PI / 2 - phi) / omega)}, ${fmt((Math.PI / 2 - phi) / omega)}) + n·${fmt(period)}`,
            `减: (${fmt((Math.PI / 2 - phi) / omega)}, ${fmt((3 * Math.PI / 2 - phi) / omega)}) + n·${fmt(period)}`,
          ]
        : [
            `减: (${fmt((-Math.PI / 2 - phi) / omega)}, ${fmt((Math.PI / 2 - phi) / omega)}) + n·${fmt(period)}`,
            `增: (${fmt((Math.PI / 2 - phi) / omega)}, ${fmt((3 * Math.PI / 2 - phi) / omega)}) + n·${fmt(period)}`,
          ] },
    );
  } else if (fnType === 'cos') {
    const centerX = (Math.PI / 2 - phi) / omega;
    items.push(
      { label: '对称中心', values: [`(${fmt(centerX)}, ${k.toFixed(2)}) + n·${fmt(halfPeriod)}`] },
      { label: '零点', values: [`x = ${fmt((Math.PI / 2 - phi) / omega)} + n·${fmt(halfPeriod)}`] },
      { label: '对称轴', values: [
        `极大轴: x = ${fmt((-phi) / omega)} + n·${fmt(period)}`,
        `极小轴: x = ${fmt((Math.PI - phi) / omega)} + n·${fmt(period)}`,
      ] },
      { label: '单调区间', values: A * omega >= 0
        ? [
            `减: (${fmt((-phi) / omega)}, ${fmt((Math.PI - phi) / omega)}) + n·${fmt(period)}`,
            `增: (${fmt((Math.PI - phi) / omega)}, ${fmt((2 * Math.PI - phi) / omega)}) + n·${fmt(period)}`,
          ]
        : [
            `增: (${fmt((-phi) / omega)}, ${fmt((Math.PI - phi) / omega)}) + n·${fmt(period)}`,
            `减: (${fmt((Math.PI - phi) / omega)}, ${fmt((2 * Math.PI - phi) / omega)}) + n·${fmt(period)}`,
          ] },
    );
  } else {
    items.push(
      { label: '对称中心', values: [`(${fmt((-phi) / omega)}, ${k.toFixed(2)}) + n·${fmt(period / 2)}`] },
      { label: '零点', values: [`x = ${fmt((-phi) / omega)} + n·${fmt(Math.PI / omega)}`] },
      { label: '单调区间', values: [
        `增/减由每个分支分别判断，分界: x = ${fmt((Math.PI / 2 - phi) / omega)} + n·${fmt(Math.PI / omega)}`,
      ] },
    );
  }

  items.push({
    label: '值域',
    values: fnType === 'tan'
      ? ['(-∞, +∞)']
      : [`[${Math.min(k - Math.abs(A), k + Math.abs(A)).toFixed(2)}, ${Math.max(k - Math.abs(A), k + Math.abs(A)).toFixed(2)}]`],
  });

  items.push({
    label: '参数影响',
    values: [
      'A 控制振幅与翻折',
      'ω 控制周期长短',
      'φ 控制左右相移',
      'k 控制上下平移',
    ],
  });

  return items;
}
