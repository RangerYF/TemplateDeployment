import { useEffect } from 'react';
import { useSimulationStore } from './store/simulationStore';
import { setupShortcuts, teardownShortcuts } from './shortcuts';

let initialized = false;

/**
 * 编辑器核心初始化
 * 幂等：多次调用不重复执行
 */
export function initApp(): void {
  if (initialized) return;
  initialized = true;

  const store = useSimulationStore.getState();

  // Create default simulation (coinFlip)
  store.createSimulation('coinFlip');
}

/**
 * React Hook: 在应用顶层调用一次，初始化模拟器系统
 */
export function useAppInit(): void {
  useEffect(() => {
    initApp();
    setupShortcuts();
    return () => {
      teardownShortcuts();
    };
  }, []);
}
