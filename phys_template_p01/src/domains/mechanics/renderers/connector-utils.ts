import type { Entity, Vec2 } from '@/core/types';

const EDGE_GAP = 0.02;

/**
 * 获取物块的几何中心（与 force-viewport 中力箭头起点计算一致）
 * 物块 position = 底边中心，center = position + 旋转后的半高向量
 */
export function getBlockCenter(entity: Entity): Vec2 {
  const pos = entity.transform.position;
  const h = (entity.properties.height as number) ?? 0;
  const rot = entity.transform.rotation ?? 0;
  return {
    x: pos.x + (-Math.sin(rot)) * (h / 2),
    y: pos.y + Math.cos(rot) * (h / 2),
  };
}

/**
 * 获取连接件在物块边缘的连接点
 * 与 force-viewport 的 getEdgeStart 使用完全相同的逻辑，
 * 确保绳/杆端点与张力箭头起点完全重合
 *
 * @param blockEntity 物块实体
 * @param pivotPos pivot 位置（用于计算方向）
 */
export function getConnectorAttachPoint(blockEntity: Entity, pivotPos: Vec2): Vec2 {
  const center = getBlockCenter(blockEntity);

  // 方向：从物块中心指向 pivot（与张力方向一致）
  const dx = pivotPos.x - center.x;
  const dy = pivotPos.y - center.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return center;

  const dirX = dx / len;
  const dirY = dy / len;

  const radius = blockEntity.properties.radius as number | undefined;
  const width = blockEntity.properties.width as number | undefined;
  const height = blockEntity.properties.height as number | undefined;

  let offset: number;

  if (radius != null && radius > 0) {
    offset = radius + EDGE_GAP;
  } else if (width != null && height != null && width > 0 && height > 0) {
    // 将方向旋转到物块局部坐标系
    const rot = blockEntity.transform.rotation ?? 0;
    let localDx = dirX;
    let localDy = dirY;
    if (Math.abs(rot) > 1e-6) {
      const cosR = Math.cos(-rot);
      const sinR = Math.sin(-rot);
      localDx = dirX * cosR - dirY * sinR;
      localDy = dirX * sinR + dirY * cosR;
    }

    const halfW = width / 2;
    const halfH = height / 2;
    const absLocalDx = Math.abs(localDx);
    const absLocalDy = Math.abs(localDy);
    const tX = absLocalDx > 1e-9 ? halfW / absLocalDx : Infinity;
    const tY = absLocalDy > 1e-9 ? halfH / absLocalDy : Infinity;
    offset = Math.min(tX, tY) + EDGE_GAP;
  } else {
    return center;
  }

  return {
    x: center.x + dirX * offset,
    y: center.y + dirY * offset,
  };
}
