import { presetRegistry } from '@/core/registries/preset-registry';
import { registerBlockEntity } from './entities/block';
import { registerSurfaceEntity } from './entities/surface';
import { registerSlopeEntity } from './entities/slope';
import { registerBlockOnSurfaceSolver } from './solvers/block-on-surface';
import { registerFrictionDecelerationSolver } from './solvers/block-friction-deceleration';
import { registerBlockWithAppliedForceSolver } from './solvers/block-with-applied-force';
import { registerFrictionAccelerationSolver } from './solvers/block-friction-acceleration';
import { registerBlockOnSlopeSolvers } from './solvers/block-on-slope';
import { registerBlockRenderer } from './renderers/block-renderer';
import { registerSurfaceRenderer } from './renderers/surface-renderer';
import { registerSlopeRenderer } from './renderers/slope-renderer';
import { registerForceViewport } from './viewports/force-viewport';
import horizontalBlockPreset from './presets/horizontal-block.json';
import frictionDecelerationPreset from './presets/friction-deceleration.json';
import horizontalWithForcePreset from './presets/horizontal-with-force.json';
import frictionAccelerationPreset from './presets/friction-acceleration.json';
import slopeStaticPreset from './presets/slope-static.json';
import slopeSlidingDownPreset from './presets/slope-sliding-down.json';
import slopeSlidingUpPreset from './presets/slope-sliding-up.json';
import slopeSmoothPreset from './presets/slope-smooth.json';
import type { PresetData } from '@/core/types';

export function registerMechanicsDomain(): void {
  // 实体
  registerBlockEntity();
  registerSurfaceEntity();
  registerSlopeEntity();
  // 求解器
  registerBlockOnSurfaceSolver();
  registerFrictionDecelerationSolver();
  registerBlockWithAppliedForceSolver();
  registerFrictionAccelerationSolver();
  registerBlockOnSlopeSolvers();
  // 渲染器
  registerBlockRenderer();
  registerSurfaceRenderer();
  registerSlopeRenderer();
  // 视角
  registerForceViewport();
  // 预设 — 水平面
  presetRegistry.register(horizontalBlockPreset as unknown as PresetData);
  presetRegistry.register(frictionDecelerationPreset as unknown as PresetData);
  presetRegistry.register(horizontalWithForcePreset as unknown as PresetData);
  presetRegistry.register(frictionAccelerationPreset as unknown as PresetData);
  // 预设 — 斜面
  presetRegistry.register(slopeStaticPreset as unknown as PresetData);
  presetRegistry.register(slopeSlidingDownPreset as unknown as PresetData);
  presetRegistry.register(slopeSlidingUpPreset as unknown as PresetData);
  presetRegistry.register(slopeSmoothPreset as unknown as PresetData);
}
