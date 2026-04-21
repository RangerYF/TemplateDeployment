import { presetRegistry } from '@/core/registries/preset-registry';
import { registerPointChargeEntity } from './entities/point-charge';
import { registerUniformBFieldEntity } from './entities/uniform-bfield';
import { registerWireFrameEntity } from './entities/wire-frame';
import { registerDCSourceEntity } from './entities/dc-source';
import { registerFixedResistorEntity } from './entities/fixed-resistor';
import { registerSlideRheostatEntity } from './entities/slide-rheostat';
import { registerSwitchEntity } from './entities/switch';
import { registerAmmeterEntity } from './entities/ammeter';
import { registerVoltmeterEntity } from './entities/voltmeter';
import { registerCoulombForceSolver } from './solvers/coulomb-force';
import { registerChargedParticleInBFieldSolver } from './solvers/charged-particle-in-bfield';
import { registerWireFrameInductionSolver } from './solvers/wire-frame-induction';
import { registerVoltammetryInternalSolver } from './solvers/voltammetry-internal';
import { registerVoltammetryExternalSolver } from './solvers/voltammetry-external';
import { registerMeasureEmfRSolver } from './solvers/measure-emf-r';
import { registerPointChargeRenderer } from './renderers/point-charge-renderer';
import { registerUniformBFieldRenderer } from './renderers/uniform-bfield-renderer';
import { registerWireFrameRenderer } from './renderers/wire-frame-renderer';
import { registerDCSourceRenderer } from './renderers/dc-source-renderer';
import { registerFixedResistorRenderer } from './renderers/fixed-resistor-renderer';
import { registerSlideRheostatRenderer } from './renderers/slide-rheostat-renderer';
import { registerSwitchRenderer } from './renderers/switch-renderer';
import { registerAmmeterRenderer } from './renderers/ammeter-renderer';
import { registerVoltmeterRenderer } from './renderers/voltmeter-renderer';
import { registerFieldViewport } from './viewports/field-viewport';
import { registerMotionViewport } from './viewports/motion-viewport';
import { registerCircuitViewport } from './viewports/circuit-viewport';
import twoChargesPreset from './presets/two-charges-coulomb.json';
import basicBFieldPreset from './presets/basic-bfield.json';
import cyclotronMotionPreset from './presets/cyclotron-motion.json';
import emfInductionPreset from './presets/emf-induction.json';
import voltammetryInternalPreset from './presets/voltammetry-internal.json';
import voltammetryExternalPreset from './presets/voltammetry-external.json';
import measureEmfRPreset from './presets/measure-emf-r.json';
import type { PresetData } from '@/core/types';

export function registerEmDomain(): void {
  // 实体
  registerPointChargeEntity();
  registerUniformBFieldEntity();
  registerWireFrameEntity();
  registerDCSourceEntity();
  registerFixedResistorEntity();
  registerSlideRheostatEntity();
  registerSwitchEntity();
  registerAmmeterEntity();
  registerVoltmeterEntity();
  // 求解器
  registerCoulombForceSolver();
  registerChargedParticleInBFieldSolver();
  registerWireFrameInductionSolver();
  registerVoltammetryInternalSolver();
  registerVoltammetryExternalSolver();
  registerMeasureEmfRSolver();
  // 渲染器
  registerPointChargeRenderer();
  registerUniformBFieldRenderer();
  registerWireFrameRenderer();
  registerDCSourceRenderer();
  registerFixedResistorRenderer();
  registerSlideRheostatRenderer();
  registerSwitchRenderer();
  registerAmmeterRenderer();
  registerVoltmeterRenderer();
  // 视角
  registerFieldViewport();
  registerMotionViewport();
  registerCircuitViewport();
  // 预设
  presetRegistry.register(twoChargesPreset as unknown as PresetData);
  presetRegistry.register(basicBFieldPreset as unknown as PresetData);
  presetRegistry.register(cyclotronMotionPreset as unknown as PresetData);
  presetRegistry.register(emfInductionPreset as unknown as PresetData);
  presetRegistry.register(voltammetryInternalPreset as unknown as PresetData);
  presetRegistry.register(voltammetryExternalPreset as unknown as PresetData);
  presetRegistry.register(measureEmfRPreset as unknown as PresetData);
}
