import type { SimulationType, SimulationParams, SimulationResult } from '../../types/simulation';

export interface SimulationEntity {
  id: string;
  type: SimulationType;
  params: SimulationParams;
  result: SimulationResult | null;
  isRunning: boolean;
  visible: boolean;
}
