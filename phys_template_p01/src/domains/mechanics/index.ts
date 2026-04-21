import { presetRegistry } from '@/core/registries/preset-registry';
import { rendererRegistry } from '@/core/registries/renderer-registry';
import { registerBlockEntity } from './entities/block';
import { registerSurfaceEntity } from './entities/surface';
import { registerSlopeEntity } from './entities/slope';
import { registerPivotEntity } from './entities/pivot';
import { registerRopeEntity } from './entities/rope';
import { registerRodEntity } from './entities/rod';
import { registerSpringEntity } from './entities/spring';
import { registerHorizontalSurfaceSolver } from './solvers/horizontal-surface';
import { registerBlockOnSlopeSolver } from './solvers/block-on-slope';
import { registerSingleRopeSuspensionSolver } from './solvers/single-rope-suspension';
import { registerDoubleRopeSuspensionSolver } from './solvers/double-rope-suspension';
import { registerRopeRodSuspensionSolver } from './solvers/rope-rod-suspension';
import { registerRopeConnectedHorizontalSolver } from './solvers/rope-connected-horizontal';
import { registerRopeConnectedInclineSolver } from './solvers/rope-connected-incline';
import { registerSpringVerticalSolver } from './solvers/spring-vertical';
import { registerSpringHorizontalWallSolver } from './solvers/spring-horizontal-wall';
import { registerSpringConnectedHorizontalSolver } from './solvers/spring-connected-horizontal';
import { registerBlockRenderer } from './renderers/block-renderer';
import { registerSurfaceRenderer } from './renderers/surface-renderer';
import { registerSlopeRenderer } from './renderers/slope-renderer';
import { registerPivotRenderer } from './renderers/pivot-renderer';
import { registerRopeRenderer } from './renderers/rope-renderer';
import { registerRodRenderer } from './renderers/rod-renderer';
import { registerSpringRenderer } from './renderers/spring-renderer';
import { registerForceViewport } from './viewports/force-viewport';
import { registerMotionViewport } from './viewports/motion-viewport';
import { registerForceInteraction } from './interactions/force-interaction-handler';
import { ForcePopover } from './components/ForcePopover';
import { EntityPopover } from './components/EntityPopover';
import horizontalSurfacePreset from './presets/horizontal-surface.json';
import inclinedSurfacePreset from './presets/inclined-surface.json';
import singleRopeSuspensionPreset from './presets/single-rope-suspension.json';
import doubleRopeSuspensionPreset from './presets/double-rope-suspension.json';
import ropeRodSuspensionPreset from './presets/rope-rod-suspension.json';
import ropeConnectedHorizontalPreset from './presets/rope-connected-horizontal.json';
import ropeConnectedInclinePreset from './presets/rope-connected-incline.json';
import springVerticalPreset from './presets/spring-vertical.json';
import springWallPreset from './presets/spring-wall.json';
import springConnectedHorizontalPreset from './presets/spring-connected-horizontal.json';
import type { PresetData } from '@/core/types';

export function registerMechanicsDomain(): void {
  // 实体
  registerBlockEntity();
  registerSurfaceEntity();
  registerSlopeEntity();
  registerPivotEntity();
  registerRopeEntity();
  registerRodEntity();
  registerSpringEntity();
  // 求解器
  registerHorizontalSurfaceSolver();
  registerBlockOnSlopeSolver();
  registerSingleRopeSuspensionSolver();
  registerDoubleRopeSuspensionSolver();
  registerRopeRodSuspensionSolver();
  registerRopeConnectedHorizontalSolver();
  registerRopeConnectedInclineSolver();
  registerSpringVerticalSolver();
  registerSpringHorizontalWallSolver();
  registerSpringConnectedHorizontalSolver();
  // 渲染器
  registerBlockRenderer();
  registerSurfaceRenderer();
  registerSlopeRenderer();
  registerPivotRenderer();
  registerRopeRenderer();
  registerRodRenderer();
  registerSpringRenderer();
  // 视角
  registerForceViewport();
  registerMotionViewport();
  // 交互
  registerForceInteraction();
  rendererRegistry.registerFloatingComponent('force-popover', ForcePopover);
  rendererRegistry.registerFloatingComponent('entity-popover', EntityPopover);
  // 预设 — 水平面
  presetRegistry.register(horizontalSurfacePreset as unknown as PresetData);
  // 预设 — 斜面
  presetRegistry.register(inclinedSurfacePreset as unknown as PresetData);
  // 预设 — 悬挂
  presetRegistry.register(singleRopeSuspensionPreset as unknown as PresetData);
  presetRegistry.register(doubleRopeSuspensionPreset as unknown as PresetData);
  presetRegistry.register(ropeRodSuspensionPreset as unknown as PresetData);
  // 预设 — 连接体
  presetRegistry.register(ropeConnectedHorizontalPreset as unknown as PresetData);
  presetRegistry.register(ropeConnectedInclinePreset as unknown as PresetData);
  // 预设 — 弹簧
  presetRegistry.register(springVerticalPreset as unknown as PresetData);
  presetRegistry.register(springWallPreset as unknown as PresetData);
  presetRegistry.register(springConnectedHorizontalPreset as unknown as PresetData);
}
