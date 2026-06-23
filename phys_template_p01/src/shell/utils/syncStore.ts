import { simulator } from '@/core/engine/simulator';
import { useSimulationStore } from '@/store';

export function syncStoreFromSimulator(): void {
  const simState = simulator.getState();
  const result = simulator.getCurrentResult();
  const store = useSimulationStore.getState();

  store.setParamValues({ ...simState.scene.paramValues });
  store.setSimulationState({
    status: simState.status,
    timeline: simState.timeline,
    scene: simState.scene,
    currentResult: result,
    resultHistory: simState.resultHistory,
  });
}
