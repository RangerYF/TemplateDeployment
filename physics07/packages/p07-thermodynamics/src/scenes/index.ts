import type { SceneModule, SceneName } from '../types';
import { gasParticlesScene } from './gasParticles';
import { gasLawsScene } from './gasLaws';
import { liquidColumnScene } from './liquidColumn';
import { pistonCylinderScene } from './pistonCylinder';
import { brownianScene } from './brownian';

export const sceneRegistry: Record<SceneName, SceneModule> = {
  '气体分子微观模拟': gasParticlesScene,
  '三种气体实验': gasLawsScene,
  '液柱密封模型': liquidColumnScene,
  '气缸/双活塞模型': pistonCylinderScene,
  '布朗运动': brownianScene,
};
