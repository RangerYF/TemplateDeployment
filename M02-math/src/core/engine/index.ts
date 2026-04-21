/**
 * Core shared engine utilities — used across all skill modules.
 */
export {
  startAnimation,
  startMultiAnimation,
  startMultiAnimationControlled,
  easeInOut,
  easeOut,
  linear,
  easeIn,
  spring,
  bounce,
  EASING_MAP,
  EASING_LABELS,
} from '@/engine/animationEngine';
export type { EasingFn, EasingName, AnimationConfig, AnimationControl } from '@/engine/animationEngine';
