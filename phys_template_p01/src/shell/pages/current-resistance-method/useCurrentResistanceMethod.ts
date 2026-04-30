import { useMemo, useState } from 'react';
import {
  computeCurrentResistanceMethod,
  type CurrentResistanceMethodParams,
} from '@/domains/em/logic/current-resistance-method';

export const DEFAULT_CURRENT_RESISTANCE_METHOD_PARAMS: CurrentResistanceMethodParams = {
  emf: 6,
  knownResistance: 10,
  unknownResistance: 30,
  ammeterResistance: 1.2,
  meterMode: 'real',
  measurementTarget: 'known',
  sampleCount: 81,
};

export function useCurrentResistanceMethod(
  initialParams?: Partial<CurrentResistanceMethodParams>,
) {
  const [params, setParams] = useState<CurrentResistanceMethodParams>({
    ...DEFAULT_CURRENT_RESISTANCE_METHOD_PARAMS,
    ...initialParams,
  });

  const result = useMemo(
    () => computeCurrentResistanceMethod(params),
    [params],
  );

  const setParam = <Key extends keyof CurrentResistanceMethodParams>(
    key: Key,
    value: CurrentResistanceMethodParams[Key],
  ) => {
    setParams((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const applyParams = (partial: Partial<CurrentResistanceMethodParams>) => {
    setParams((prev) => ({
      ...prev,
      ...partial,
    }));
  };

  const resetParams = () => {
    setParams(DEFAULT_CURRENT_RESISTANCE_METHOD_PARAMS);
  };

  return {
    params,
    result,
    setParam,
    applyParams,
    resetParams,
  };
}
