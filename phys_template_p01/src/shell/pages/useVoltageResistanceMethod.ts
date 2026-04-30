import { useMemo } from 'react';
import {
  buildVoltageResistanceMethodCurve,
  computeVoltageResistanceMethod,
  type VoltageResistanceMeterMode,
  type VoltageResistanceMethodParams,
} from '@/domains/em/logic/voltage-resistance-method';

export interface VoltageResistanceMethodViewState extends VoltageResistanceMethodParams {
  meterMode: VoltageResistanceMeterMode;
}

function getNiceChartMaximum(target: number): number {
  const safeTarget = Math.max(target, 1);
  const magnitude = 10 ** Math.floor(Math.log10(safeTarget));
  const normalized = safeTarget / magnitude;

  if (normalized <= 1) return magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

export function useVoltageResistanceMethod(
  state: VoltageResistanceMethodViewState,
  pointCount = 81,
) {
  return useMemo(() => {
    const chartMaxRx = getNiceChartMaximum(
      Math.max(state.Rx * 2.4, state.R0 * 6, 200),
    );
    const result = computeVoltageResistanceMethod(state);
    const curve = buildVoltageResistanceMethodCurve(state, chartMaxRx, pointCount);
    const activeReading =
      state.meterMode === 'ideal'
        ? result.current.ideal
        : result.current.real;
    const inactiveReading =
      state.meterMode === 'ideal'
        ? result.current.real
        : result.current.ideal;

    return {
      result,
      curve,
      chartMaxRx,
      activeReading,
      inactiveReading,
    };
  }, [
    pointCount,
    state.E,
    state.R0,
    state.Rx,
    state.Rv,
    state.measurementPosition,
    state.meterMode,
  ]);
}
