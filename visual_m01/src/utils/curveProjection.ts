import type { Vec3 } from '@/engine/types';

/**
 * 将 3D 点投影到离散折线上，返回归一化弧长参数 t (0~1)
 *
 * 算法：遍历分段，找距离最近的段，计算该段内的局部 t，
 * 再映射为全局弧长归一化 t。
 */
export function projectPointToCurve(
  hitX: number,
  hitY: number,
  hitZ: number,
  curvePoints: Vec3[],
): number {
  if (curvePoints.length < 2) return 0;

  // 预计算累积弧长
  const cumLen = [0];
  for (let i = 1; i < curvePoints.length; i++) {
    const dx = curvePoints[i][0] - curvePoints[i - 1][0];
    const dy = curvePoints[i][1] - curvePoints[i - 1][1];
    const dz = curvePoints[i][2] - curvePoints[i - 1][2];
    cumLen.push(cumLen[i - 1] + Math.sqrt(dx * dx + dy * dy + dz * dz));
  }
  const totalLen = cumLen[curvePoints.length - 1];
  if (totalLen === 0) return 0;

  let bestDist = Infinity;
  let bestT = 0;

  for (let i = 0; i < curvePoints.length - 1; i++) {
    const [ax, ay, az] = curvePoints[i];
    const [bx, by, bz] = curvePoints[i + 1];

    // 线段方向
    const segX = bx - ax;
    const segY = by - ay;
    const segZ = bz - az;
    const segLenSq = segX * segX + segY * segY + segZ * segZ;

    let localT = 0;
    if (segLenSq > 0) {
      // 投影到线段
      const toHitX = hitX - ax;
      const toHitY = hitY - ay;
      const toHitZ = hitZ - az;
      localT = (toHitX * segX + toHitY * segY + toHitZ * segZ) / segLenSq;
      localT = Math.max(0, Math.min(1, localT));
    }

    // 最近点
    const closestX = ax + localT * segX;
    const closestY = ay + localT * segY;
    const closestZ = az + localT * segZ;
    const dx = hitX - closestX;
    const dy = hitY - closestY;
    const dz = hitZ - closestZ;
    const dist = dx * dx + dy * dy + dz * dz; // 用平方距离避免 sqrt

    if (dist < bestDist) {
      bestDist = dist;
      const segLen = Math.sqrt(segLenSq);
      bestT = (cumLen[i] + localT * segLen) / totalLen;
    }
  }

  return Math.max(0, Math.min(1, bestT));
}

/**
 * 根据归一化弧长参数 t (0~1) 计算曲线上的 3D 坐标
 */
export function evaluateCurveAtT(curvePoints: Vec3[], t: number): Vec3 {
  if (curvePoints.length === 0) return [0, 0, 0];
  if (curvePoints.length === 1) return curvePoints[0];

  const clampedT = Math.max(0, Math.min(1, t));

  // 预计算累积弧长
  const cumLen = [0];
  for (let i = 1; i < curvePoints.length; i++) {
    const dx = curvePoints[i][0] - curvePoints[i - 1][0];
    const dy = curvePoints[i][1] - curvePoints[i - 1][1];
    const dz = curvePoints[i][2] - curvePoints[i - 1][2];
    cumLen.push(cumLen[i - 1] + Math.sqrt(dx * dx + dy * dy + dz * dz));
  }
  const totalLen = cumLen[curvePoints.length - 1];
  if (totalLen === 0) return curvePoints[0];

  const targetLen = clampedT * totalLen;

  // 找到 targetLen 所在的分段
  for (let i = 0; i < curvePoints.length - 1; i++) {
    if (cumLen[i + 1] >= targetLen) {
      const segLen = cumLen[i + 1] - cumLen[i];
      const localT = segLen > 0 ? (targetLen - cumLen[i]) / segLen : 0;

      const [ax, ay, az] = curvePoints[i];
      const [bx, by, bz] = curvePoints[i + 1];
      return [
        ax + localT * (bx - ax),
        ay + localT * (by - ay),
        az + localT * (bz - az),
      ];
    }
  }

  // fallback: 返回最后一个点
  return curvePoints[curvePoints.length - 1];
}
