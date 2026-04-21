import type { CylinderParams } from '@/types/geometry';
import type { Vec2 } from './cuboidUnfold';

/** 圆柱展开结果 */
export interface CylinderUnfoldResult {
  kind: 'cylinder';
  /** 侧面矩形 */
  rect: {
    x: number;
    y: number;
    width: number;  // = 2πr
    height: number; // = h
  };
  /** 顶面圆 */
  topCircle: {
    center: Vec2;
    radius: number;
    label: { position: Vec2; text: string };
  };
  /** 底面圆 */
  bottomCircle: {
    center: Vec2;
    radius: number;
    label: { position: Vec2; text: string };
  };
  /** 包围盒宽高 */
  width: number;
  height: number;
}

/**
 * 圆柱展开图
 *
 * 侧面展开为矩形：宽 = 2πr，高 = h
 * 顶面圆放在矩形上方，底面圆放在矩形下方
 *
 * 手算验证：圆柱 (r=1.5, h=2)
 * → 矩形宽 = 2π×1.5 = 3π ≈ 9.42，高 = 2
 */
export function cylinderUnfold(params: CylinderParams): CylinderUnfoldResult {
  const { radius: r, height: h } = params;

  const rectWidth = 2 * Math.PI * r;
  const gap = r * 0.4; // 圆与矩形间距

  // 布局：从上到下 → 顶面圆、间距、矩形、间距、底面圆
  const topCircleCY = r; // 顶面圆心 Y
  const rectY = topCircleCY + r + gap; // 矩形顶边 Y
  const bottomCircleCY = rectY + h + gap + r; // 底面圆心 Y

  // 水平居中：矩形宽 = 2πr，圆直径 = 2r
  // 矩形更宽，以矩形为基准居中
  const rectX = 0;
  const circleCX = rectWidth / 2; // 圆心 X 在矩形中央

  // 包围盒
  const totalWidth = rectWidth;
  const totalHeight = bottomCircleCY + r;

  return {
    kind: 'cylinder',
    rect: {
      x: rectX,
      y: rectY,
      width: rectWidth,
      height: h,
    },
    topCircle: {
      center: [circleCX, topCircleCY],
      radius: r,
      label: { position: [circleCX, topCircleCY], text: 'O₁' },
    },
    bottomCircle: {
      center: [circleCX, bottomCircleCY],
      radius: r,
      label: { position: [circleCX, bottomCircleCY], text: 'O' },
    },
    width: totalWidth,
    height: totalHeight,
  };
}
