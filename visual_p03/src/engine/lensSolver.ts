/**
 * lensSolver.ts
 * Physics solver for thin lens imaging: 1/u + 1/v = 1/f.
 * Ported from phys_template_p03/src/module-lens.tsx — math logic preserved exactly.
 */

import type { Point } from '@/data/refractionData';
import type { LensSettings } from '@/data/lensData';
import { LENS_STAGE } from '@/data/lensData';

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface LensRaySegment {
  from: Point;
  to: Point;
  color: string;
  dashed?: boolean;
  light?: boolean;
}

export interface LensRayBundle {
  key: string;
  segments: LensRaySegment[];
}

export interface LensSolveResult {
  u: number;
  f: number;
  v: number;
  m: number | null;
  imageX: number | null;
  imageHeight: number | null;
  realImage: boolean;
  virtualImage: boolean;
  screenHit: boolean;
  pathMode: string;
  imageNature: string;
  notes: string[];
  rayBundles: LensRayBundle[];
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function fmt(v: number | null | undefined, digits = 2): string {
  return typeof v === 'number' && Number.isFinite(v) ? v.toFixed(digits) : '—';
}

export function clampLensX(x: number): number {
  return clamp(x, LENS_STAGE.lensMinX, LENS_STAGE.lensMaxX);
}

export function clampSourceX(x: number, lensX: number): number {
  return clamp(x, LENS_STAGE.sourceMinX, lensX - 16);
}

export function clampScreenX(x: number, lensX: number): number {
  return clamp(x, lensX + LENS_STAGE.screenGapMin, LENS_STAGE.screenMaxX);
}

export function resolveObjectDistance(
  settings: LensSettings,
  distance: number,
): { objectX: number; objectDistance: number } {
  const lensX = clampLensX(settings.lensCenterX);
  const nextObjectX = clampSourceX(lensX - distance, lensX);
  return {
    objectX: nextObjectX,
    objectDistance: Math.round((lensX - nextObjectX) * 10) / 10,
  };
}

function extendToX(from: Point, through: Point, toX: number): Point {
  if (Math.abs(through.x - from.x) < 1e-6) return { x: toX, y: through.y };
  const t = (toX - from.x) / (through.x - from.x);
  return { x: toX, y: from.y + (through.y - from.y) * t };
}

// ---------------------------------------------------------------------------
// Lens visual height helper
// ---------------------------------------------------------------------------

export function computeLensVisualHeight(settings: LensSettings): number {
  const H = LENS_STAGE.height;
  const lensX = clampLensX(settings.lensCenterX);
  const sourceX = clampSourceX(settings.objectX, lensX);
  const minH = 184;
  if (!settings.showRays || settings.sourceType === 'parallel') return minH;
  const absF = Math.abs(settings.focalLength);
  const u = lensX - sourceX;
  const denom = u - absF;
  if (Math.abs(denom) < 1) return minH;
  const offset = settings.objectHeight * absF / Math.abs(denom);
  return Math.min(H - 40, Math.max(minH, (offset + 20) * 2));
}

// ---------------------------------------------------------------------------
// Main solver
// ---------------------------------------------------------------------------

export function solveLens(settings: LensSettings): LensSolveResult {
  const axisY = LENS_STAGE.axisY;
  const lensX = clampLensX(settings.lensCenterX);
  const sourceX = clampSourceX(settings.objectX, lensX);
  const f =
    settings.lensType === 'concave'
      ? -Math.abs(settings.focalLength)
      : Math.abs(settings.focalLength);
  const u = lensX - sourceX;
  const pointY = axisY - Math.max(18, settings.objectHeight * 0.78);
  const objectTop: Point = { x: sourceX, y: axisY - settings.objectHeight };
  const pointSource: Point = { x: sourceX, y: pointY };

  const parallelCase =
    settings.sourceType !== 'parallel' &&
    settings.lensType === 'convex' &&
    Math.abs(u - Math.abs(f)) < 0.02;
  const v =
    settings.sourceType === 'parallel'
      ? settings.lensType === 'convex'
        ? Math.abs(f)
        : -Math.abs(f)
      : parallelCase
        ? Infinity
        : 1 / (1 / f - 1 / u);
  const imageX = Number.isFinite(v) ? lensX + v : null;
  const realImage = Number.isFinite(v) && v > 0;
  const virtualImage = Number.isFinite(v) && v < 0;
  const m =
    settings.sourceType === 'parallel'
      ? null
      : parallelCase
        ? Infinity
        : -v / u;
  const imageHeight =
    settings.sourceType === 'parallel'
      ? null
      : m !== null && Number.isFinite(m)
        ? m * settings.objectHeight
        : null;
  const screenX = clampScreenX(settings.screenX, lensX);
  const screenHit =
    settings.showScreen &&
    imageX !== null &&
    realImage &&
    Math.abs(screenX - imageX) < 12;

  let imageNature = '';
  let pathMode = '';
  let notes: string[] = [];
  const absF = Math.abs(f);

  if (settings.sourceType === 'parallel') {
    if (settings.lensType === 'convex') {
      imageNature = '平行光会聚于焦点';
      pathMode = '平行光汇聚';
      notes = [
        '当前路径：平行光经过凸透镜后汇聚于焦点。',
        '焦距决定焦点到透镜的距离。',
        '焦点是平行于主光轴的光线经透镜会聚后的交点，是透镜最基本的光学特征。',
      ];
    } else {
      imageNature = '平行光发散，反向延长交于焦点';
      pathMode = '平行光发散';
      notes = [
        '当前路径：平行光经过凹透镜后发散。',
        '需要看反向延长线，交于虚焦点。',
        '凹透镜的焦点是虚焦点——实际光线并不经过该点，只有反向延长线才交于此处。',
      ];
    }
  } else if (parallelCase) {
    imageNature = 'u = f，不成像';
    pathMode = '边界条件';
    notes = [
      '当前路径：物体恰好位于焦点处（u = f）。',
      '透镜后出射光近似平行，因此不形成有限远像。',
      '这是成像从实像到虚像的临界过渡点：物距从略大于 f 向 f 靠近时，像距趋于无穷远。',
    ];
  } else if (settings.lensType === 'concave') {
    imageNature = '虚像 · 正立 · 缩小';
    pathMode = '凹透镜标准成像';
    notes = [
      '当前路径：凹透镜使出射光发散，像由反向延长线交汇形成。',
      '凹透镜对实物始终成正立、缩小的虚像，不随物距变化而改变像的性质。',
      '虚像位于物体与透镜之间，不能被屏幕接收。',
    ];
  } else if (virtualImage) {
    imageNature = '虚像 · 正立 · 放大';
    pathMode = '凸透镜虚像';
    notes = [
      '当前路径：物体位于焦距以内（u < f），透镜后光线发散。',
      '反向延长线在物体同侧交汇，形成正立放大的虚像。',
      '这就是放大镜的成像原理——眼睛透过透镜看到的是被放大的虚像。',
    ];
  } else {
    const sizeNature =
      m !== null && Number.isFinite(m)
        ? Math.abs(Math.abs(m) - 1) < 0.06
          ? '等大'
          : Math.abs(m) > 1
            ? '放大'
            : '缩小'
        : '—';
    imageNature = `实像 · 倒立 · ${sizeNature}`;
    pathMode = screenHit ? '实像落屏' : '实像未落屏';
    if (Math.abs(u - 2 * absF) < 0.5) {
      notes = [
        '当前路径：物体恰好在 2 倍焦距处（u = 2f）。',
        '像也在另一侧 2 倍焦距处，成等大倒立实像。',
        '这是实像从缩小到放大的分界点，物像等距且等大。',
      ];
    } else if (u > 2 * absF) {
      notes = [
        '当前路径：物体在 2 倍焦距以外（u > 2f）。',
        '像在另一侧 f 与 2f 之间，成倒立缩小的实像。',
        '这是照相机的成像原理——远处物体通过镜头在底片上形成缩小的实像。',
      ];
    } else {
      notes = [
        '当前路径：物体在焦点与 2 倍焦距之间（f < u < 2f）。',
        '像在另一侧 2f 以外，成倒立放大的实像。',
        '这是投影仪的成像原理——将小物体放大投射到远处屏幕上。',
      ];
    }
  }

  // -- Ray bundle construction ------------------------------------------------

  const bundles: LensRayBundle[] = [];

  if (settings.showRays) {
    if (settings.sourceType === 'parallel') {
      const ys = [axisY - 54, axisY, axisY + 54];
      ys.forEach((y, index) => {
        const hit = { x: lensX, y };
        if (settings.lensType === 'convex') {
          const focus = { x: lensX + Math.abs(f), y: axisY };
          bundles.push({
            key: `parallel-${index}`,
            segments: [
              { from: { x: LENS_STAGE.axisLeft, y }, to: hit, color: 'oklch(0.62 0.17 210)' },
              { from: hit, to: extendToX(hit, focus, LENS_STAGE.rayEndX), color: 'oklch(0.62 0.17 210)' },
            ],
          });
        } else {
          const virtualFocus = { x: lensX - Math.abs(f), y: axisY };
          const forward = extendToX(virtualFocus, hit, LENS_STAGE.rayEndX);
          bundles.push({
            key: `parallel-${index}`,
            segments: [
              { from: { x: LENS_STAGE.axisLeft, y }, to: hit, color: 'oklch(0.62 0.17 210)' },
              { from: hit, to: forward, color: 'oklch(0.62 0.17 210)' },
              { from: hit, to: virtualFocus, color: 'oklch(0.62 0.17 210)', dashed: true, light: true },
            ],
          });
        }
      });
    } else {
      const sourcePoint = settings.sourceType === 'point' ? pointSource : objectTop;
      const centerHit = { x: lensX, y: axisY };
      const topHit = { x: lensX, y: sourcePoint.y };
      const focalLeft = { x: lensX - Math.abs(f), y: axisY };
      const focalRight = { x: lensX + Math.abs(f), y: axisY };

      if (settings.lensType === 'concave') {
        const virtualImagePoint =
          imageX !== null && imageHeight !== null
            ? { x: imageX, y: axisY - imageHeight }
            : { x: focalLeft.x, y: sourcePoint.y };
        const parallelAfter = extendToX(virtualImagePoint, topHit, LENS_STAGE.rayEndX);
        const focusIn = extendToX(sourcePoint, focalRight, lensX);
        const focusAfter = { x: LENS_STAGE.rayEndX, y: focusIn.y };

        bundles.push({
          key: 'ray-parallel',
          segments: [
            { from: sourcePoint, to: topHit, color: 'oklch(0.68 0.16 24)' },
            { from: topHit, to: parallelAfter, color: 'oklch(0.68 0.16 24)' },
            { from: topHit, to: virtualImagePoint, color: 'oklch(0.68 0.16 24)', dashed: true, light: true },
          ],
        });
        bundles.push({
          key: 'ray-center',
          segments: [
            { from: sourcePoint, to: centerHit, color: 'oklch(0.60 0.15 150)' },
            { from: centerHit, to: extendToX(sourcePoint, centerHit, LENS_STAGE.rayEndX), color: 'oklch(0.60 0.15 150)' },
          ],
        });
        const lensHit3: Point = { x: lensX, y: focusIn.y };
        bundles.push({
          key: 'ray-focus',
          segments: [
            { from: sourcePoint, to: lensHit3, color: 'oklch(0.59 0.15 255)' },
            { from: lensHit3, to: focusAfter, color: 'oklch(0.59 0.15 255)' },
            { from: lensHit3, to: focalRight, color: 'oklch(0.59 0.15 255)', dashed: true, light: true },
          ],
        });
      } else {
        // convex lens, object/point source
        const rayClipX =
          realImage && imageX !== null
            ? Math.min(LENS_STAGE.rayEndX, imageX + 60)
            : LENS_STAGE.rayEndX;
        const parallelEnd = extendToX(topHit, focalRight, rayClipX);
        const throughCenterEnd = extendToX(sourcePoint, centerHit, rayClipX);
        const focusIn = extendToX(sourcePoint, focalLeft, lensX);
        const parallelAfter = { x: rayClipX, y: focusIn.y };
        const isVirtual = virtualImage && imageX !== null && imageHeight !== null;
        const virtualImagePt = isVirtual
          ? { x: imageX!, y: axisY - imageHeight! }
          : null;

        const ray1Segs: LensRaySegment[] = [
          { from: sourcePoint, to: topHit, color: 'oklch(0.68 0.16 24)' },
          { from: topHit, to: parallelEnd, color: 'oklch(0.68 0.16 24)' },
        ];
        if (isVirtual && virtualImagePt) {
          ray1Segs.push({
            from: topHit,
            to: extendToX(topHit, virtualImagePt, LENS_STAGE.axisLeft),
            color: 'oklch(0.68 0.16 24)',
            dashed: true,
            light: true,
          });
        }
        bundles.push({ key: 'ray-parallel', segments: ray1Segs });

        const ray2Segs: LensRaySegment[] = [
          { from: sourcePoint, to: centerHit, color: 'oklch(0.60 0.15 150)' },
          { from: centerHit, to: throughCenterEnd, color: 'oklch(0.60 0.15 150)' },
        ];
        if (isVirtual && virtualImagePt) {
          ray2Segs.push({
            from: centerHit,
            to: extendToX(centerHit, virtualImagePt, LENS_STAGE.axisLeft),
            color: 'oklch(0.60 0.15 150)',
            dashed: true,
            light: true,
          });
        }
        bundles.push({ key: 'ray-center', segments: ray2Segs });

        const ray3Segs: LensRaySegment[] = [
          { from: sourcePoint, to: focusIn, color: 'oklch(0.59 0.15 255)' },
          { from: focusIn, to: parallelAfter, color: 'oklch(0.59 0.15 255)' },
        ];
        if (isVirtual && virtualImagePt) {
          ray3Segs.push({
            from: focusIn,
            to: extendToX(focusIn, virtualImagePt, LENS_STAGE.axisLeft),
            color: 'oklch(0.59 0.15 255)',
            dashed: true,
            light: true,
          });
        }
        bundles.push({ key: 'ray-focus', segments: ray3Segs });
      }
    }
  }

  return {
    u,
    f,
    v,
    m,
    imageX,
    imageHeight,
    realImage,
    virtualImage,
    screenHit,
    pathMode,
    imageNature,
    notes,
    rayBundles: bundles,
  };
}
