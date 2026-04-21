import type { Entity } from '@/editor/entities/types';
import { registerRenderer } from './index';

/**
 * GeometryEntityRenderer
 * - 多面体：不渲染（顶点/棱线/面由子实体 Renderer 负责）
 * - 曲面体：不渲染（线/面已 Entity 化，由 Segment/Face Renderer 负责）
 */
function GeometryEntityRenderer({ entity: _entity }: { entity: Entity }) {
  return null;
}

registerRenderer('geometry', GeometryEntityRenderer);

export { GeometryEntityRenderer };
