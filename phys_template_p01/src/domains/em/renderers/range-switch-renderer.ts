import { rendererRegistry } from '@/core/registries/renderer-registry';
import { worldToScreen, worldLengthToScreen } from '@/renderer/coordinate';
import { drawTextLabel } from '@/renderer/primitives/text-label';
import type { EntityRenderer } from '@/core/registries/renderer-registry';

/** 颜色常量 */
const FRAME_COLOR = '#2C3E50';
const FRAME_FILL = 'rgba(44, 62, 80, 0.04)';
const SELECTED_FILL = '#E67E22';
const SELECTED_STROKE = '#D35400';
const UNSELECTED_FILL = '#E5E7EB';
const UNSELECTED_STROKE = '#9CA3AF';
const COMMON_LINE_COLOR = '#1A1A2E';
const KNOB_COLOR = '#E67E22';

interface RangeItem {
  label: string;
  resistance: number;
}

/**
 * 量程选择开关渲染器
 *
 * 绘制内容：
 * 1. 竖排 5 个电阻方块（从上到下：100kΩ → 10Ω）
 * 2. 左侧公共端竖线（连接所有电阻左端）
 * 3. 选中电阻高亮（橙色填充），未选中灰色
 * 4. 右侧输出端 + 旋钮指示器指向选中电阻
 * 5. 每个电阻标注阻值 + 量程倍率
 */
const rangeSwitchRenderer: EntityRenderer = (entity, _result, ctx) => {
  const { coordinateTransform } = ctx;
  const { position } = entity.transform;
  const width = (entity.properties.width as number) ?? 1.2;
  const height = (entity.properties.height as number) ?? 2.5;
  const ranges = (entity.properties.ranges as RangeItem[]) ?? [];
  const selectedIndex = (entity.properties.selectedIndex as number) ?? 2;

  const screenTopLeft = worldToScreen(
    { x: position.x, y: position.y + height },
    coordinateTransform,
  );
  const screenW = worldLengthToScreen(width, coordinateTransform);
  const screenH = worldLengthToScreen(height, coordinateTransform);

  const c = ctx.ctx;
  c.save();

  // 外框
  c.fillStyle = FRAME_FILL;
  c.strokeStyle = FRAME_COLOR;
  c.lineWidth = 1.5;
  const r = 6;
  c.beginPath();
  c.moveTo(screenTopLeft.x + r, screenTopLeft.y);
  c.lineTo(screenTopLeft.x + screenW - r, screenTopLeft.y);
  c.quadraticCurveTo(screenTopLeft.x + screenW, screenTopLeft.y, screenTopLeft.x + screenW, screenTopLeft.y + r);
  c.lineTo(screenTopLeft.x + screenW, screenTopLeft.y + screenH - r);
  c.quadraticCurveTo(screenTopLeft.x + screenW, screenTopLeft.y + screenH, screenTopLeft.x + screenW - r, screenTopLeft.y + screenH);
  c.lineTo(screenTopLeft.x + r, screenTopLeft.y + screenH);
  c.quadraticCurveTo(screenTopLeft.x, screenTopLeft.y + screenH, screenTopLeft.x, screenTopLeft.y + screenH - r);
  c.lineTo(screenTopLeft.x, screenTopLeft.y + r);
  c.quadraticCurveTo(screenTopLeft.x, screenTopLeft.y, screenTopLeft.x + r, screenTopLeft.y);
  c.closePath();
  c.fill();
  c.stroke();

  // 电阻排列区域（从上到下：100kΩ → 10Ω，即 ranges 倒序）
  const n = ranges.length;
  if (n === 0) { c.restore(); return; }

  const padTop = screenH * 0.08;
  const padBottom = screenH * 0.08;
  const usableH = screenH - padTop - padBottom;
  const slotH = usableH / n;

  // 各区域布局
  const commonLineX = screenTopLeft.x + screenW * 0.12; // 公共端竖线 X
  const blockLeft = screenTopLeft.x + screenW * 0.2;     // 电阻块左端
  const blockRight = screenTopLeft.x + screenW * 0.65;   // 电阻块右端
  const blockW = blockRight - blockLeft;
  const outputLineX = screenTopLeft.x + screenW * 0.88;  // 输出端 X

  // 公共端竖线
  const firstSlotY = screenTopLeft.y + padTop + slotH * 0.5;
  const lastSlotY = screenTopLeft.y + padTop + slotH * (n - 0.5);
  c.strokeStyle = COMMON_LINE_COLOR;
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(commonLineX, firstSlotY);
  c.lineTo(commonLineX, lastSlotY);
  c.stroke();

  // 绘制每个电阻（从上到下：index n-1 → 0）
  for (let i = 0; i < n; i++) {
    const rangeIdx = n - 1 - i; // 上面是大量程
    const range = ranges[rangeIdx]!;
    const isSelected = rangeIdx === selectedIndex;
    const slotCenterY = screenTopLeft.y + padTop + slotH * (i + 0.5);
    const blockH = Math.min(slotH * 0.6, 22);

    // 电阻方块
    c.fillStyle = isSelected ? SELECTED_FILL : UNSELECTED_FILL;
    c.strokeStyle = isSelected ? SELECTED_STROKE : UNSELECTED_STROKE;
    c.lineWidth = isSelected ? 2 : 1.5;
    c.beginPath();
    c.roundRect(blockLeft, slotCenterY - blockH / 2, blockW, blockH, 3);
    c.fill();
    c.stroke();

    // 公共端 → 电阻左端连线
    c.strokeStyle = COMMON_LINE_COLOR;
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(commonLineX, slotCenterY);
    c.lineTo(blockLeft, slotCenterY);
    c.stroke();

    // 选中电阻：电阻右端 → 输出端连线
    if (isSelected) {
      c.strokeStyle = SELECTED_STROKE;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(blockRight, slotCenterY);
      c.lineTo(outputLineX, slotCenterY);
      c.stroke();
    }

    // 电阻方块上标注阻值
    c.fillStyle = isSelected ? '#FFF' : '#555';
    c.font = `${isSelected ? 'bold ' : ''}${Math.max(9, Math.min(12, blockH * 0.6))}px Inter, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const resistanceLabel = formatResistance(range.resistance);
    c.fillText(resistanceLabel, blockLeft + blockW / 2, slotCenterY);

    // 右侧量程倍率标注
    c.fillStyle = isSelected ? SELECTED_FILL : '#9CA3AF';
    c.font = `${Math.max(8, Math.min(10, blockH * 0.5))}px Inter, sans-serif`;
    c.textAlign = 'left';
    c.fillText(range.label, blockRight + 4, slotCenterY);
  }

  // 旋钮指示器（在输出端位置，指向选中电阻）
  const selectedVisualIdx = n - 1 - selectedIndex;
  const knobY = screenTopLeft.y + padTop + slotH * (selectedVisualIdx + 0.5);
  const knobR = Math.min(slotH * 0.3, 8);
  c.fillStyle = KNOB_COLOR;
  c.beginPath();
  c.arc(outputLineX, knobY, knobR, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = SELECTED_STROKE;
  c.lineWidth = 2;
  c.beginPath();
  c.arc(outputLineX, knobY, knobR, 0, Math.PI * 2);
  c.stroke();

  // 输出端竖线（从旋钮向下到底部）
  c.strokeStyle = COMMON_LINE_COLOR;
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(outputLineX, knobY + knobR);
  c.lineTo(outputLineX, screenTopLeft.y + screenH);
  c.stroke();

  // 标注"公共端"和"输出端"
  c.fillStyle = '#6B7280';
  c.font = '9px Inter, sans-serif';
  c.textAlign = 'center';
  c.fillText('公共端', commonLineX, screenTopLeft.y + screenH + 12);
  c.fillText('输出端', outputLineX, screenTopLeft.y + screenH + 12);

  // 顶部标签
  const centerX = screenTopLeft.x + screenW / 2;
  drawTextLabel(
    c,
    entity.label ?? '量程开关',
    { x: centerX, y: screenTopLeft.y - 10 },
    { color: FRAME_COLOR, fontSize: 12, align: 'center' },
  );

  // 底部电压/电流标注
  const current = (entity.properties.current as number) ?? 0;
  const voltage = (entity.properties.voltage as number) ?? 0;
  if (Math.abs(current) > 1e-6) {
    drawTextLabel(
      c,
      `U=${voltage.toFixed(2)}V  I=${(current * 1e6).toFixed(1)}μA`,
      { x: centerX, y: screenTopLeft.y + screenH + 26 },
      { color: '#555', fontSize: 10, align: 'center' },
    );
  }

  c.restore();
};

/** 格式化电阻值 */
function formatResistance(r: number): string {
  if (r >= 100000) return `${r / 1000}kΩ`;
  if (r >= 1000) return `${r / 1000}kΩ`;
  return `${r}Ω`;
}

export function registerRangeSwitchRenderer(): void {
  rendererRegistry.registerEntity({
    entityType: 'range-switch',
    renderer: rangeSwitchRenderer,
    layer: 'object',
  });
}
