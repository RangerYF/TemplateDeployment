import type { Command } from './types';
import type { SimulationParams, SimulationResult, SimulationType } from '../../types/simulation';
import { runSimulationWithParams } from '../../engine/simulationRunner';
import { useSimulationStore } from '../store/simulationStore';

export class RunSimulationCommand implements Command {
  type = 'runSimulation';
  label: string;
  private oldResult: SimulationResult | null;
  private newResult: SimulationResult | null = null;

  constructor(
    private simId: string,
    private simType: SimulationType,
    private params: SimulationParams,
  ) {
    this.label = `运行模拟: ${simType}`;
    const sim = useSimulationStore.getState().simulations[simId];
    this.oldResult = sim?.result ?? null;
  }

  execute(): void {
    if (!this.newResult) {
      this.newResult = runSimulationWithParams(this.simType, this.params);
    }
    useSimulationStore.getState().setResult(this.simId, this.newResult);
  }

  undo(): void {
    if (this.oldResult) {
      useSimulationStore.getState().setResult(this.simId, this.oldResult);
    } else {
      useSimulationStore.getState().resetResult(this.simId);
    }
  }
}
