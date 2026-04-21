import type { Command } from './types';
import type { SimulationParams } from '../../types/simulation';
import { useSimulationStore } from '../store/simulationStore';

export class UpdateParamsCommand implements Command {
  type = 'updateParams';
  label: string;
  private oldParams: Partial<SimulationParams>;

  constructor(
    private simId: string,
    private newParams: Partial<SimulationParams>,
  ) {
    this.label = `更新参数: ${Object.keys(newParams).join(', ')}`;
    const sim = useSimulationStore.getState().simulations[simId];
    this.oldParams = sim ? { ...sim.params } : {};
  }

  execute(): void {
    useSimulationStore.getState().updateParams(this.simId, this.newParams);
  }

  undo(): void {
    useSimulationStore.getState().updateParams(this.simId, this.oldParams);
  }
}
