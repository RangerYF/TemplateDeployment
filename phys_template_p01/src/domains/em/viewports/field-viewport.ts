import { rendererRegistry } from '@/core/registries/renderer-registry';
import { worldToScreen, worldLengthToScreen } from '@/renderer/coordinate';
import { drawTextLabel } from '@/renderer/primitives/text-label';
import type { ViewportRenderer } from '@/core/registries/renderer-registry';

/** 场信息标注颜色 */
const FIELD_LABEL_COLOR = '#9B59B6';

/**
 * 场视角渲染器（field viewport）
 *
 * 功能：在场视角下为场实体叠加信息标注层，包括：
 * - 场类型与物理量标注（B=0.5T 向内）
 * - 场方向指示（磁场用 ×/· 已由实体渲染器绘制，
 *   此处补充场强数值、方向文字和区域边界高亮）
 * - 后续扩展：电场线方向箭头、等势线等
 *
 * 设计思路：
 * - 实体渲染器（uniform-bfield-renderer）负责绘制场区域的基础外观（边框 + ×/· 阵列）
 * - 视角渲染器（本文件）在 field 视角激活时叠加额外信息标注
 * - 两者职责分离：切换到其他视角时，实体渲染器仍绘制场区域，但视角标注层不显示
 */
const fieldViewportRenderer: ViewportRenderer = (data, entities, ctx) => {
  if (data.type !== 'field') return;

  const { fieldEntities } = data.data;
  const { coordinateTransform } = ctx;
  const c = ctx.ctx;

  for (const fieldInfo of fieldEntities) {
    const entity = entities.get(fieldInfo.entityId);
    if (!entity) continue;

    const { region } = fieldInfo;

    // 区域右下角标注场强信息
    const bottomRight = worldToScreen(
      { x: region.x + region.width, y: region.y },
      coordinateTransform,
    );

    // 场强标注
    let infoText: string;
    if (fieldInfo.fieldType === 'magnetic') {
      const dirText = entity.properties.direction === 'out' ? '向外' : '向内';
      infoText = `B = ${fieldInfo.magnitude} T  ${dirText}`;
    } else if (fieldInfo.fieldType === 'electric') {
      infoText = `E = ${fieldInfo.magnitude} V/m`;
    } else {
      infoText = `${fieldInfo.fieldType}: ${fieldInfo.magnitude}`;
    }

    drawTextLabel(c, infoText, { x: bottomRight.x - 4, y: bottomRight.y + 16 }, {
      color: FIELD_LABEL_COLOR,
      fontSize: 13,
      align: 'right',
    });

    // 场视角下加粗边框强调
    const screenTopLeft = worldToScreen(
      { x: region.x, y: region.y + region.height },
      coordinateTransform,
    );
    const screenW = worldLengthToScreen(region.width, coordinateTransform);
    const screenH = worldLengthToScreen(region.height, coordinateTransform);

    c.save();
    c.strokeStyle = FIELD_LABEL_COLOR;
    c.lineWidth = 2.5;
    c.setLineDash([8, 4]);
    c.strokeRect(screenTopLeft.x, screenTopLeft.y, screenW, screenH);
    c.setLineDash([]);
    c.restore();
  }
};

export function registerFieldViewport(): void {
  rendererRegistry.registerViewport('field', fieldViewportRenderer);
}
