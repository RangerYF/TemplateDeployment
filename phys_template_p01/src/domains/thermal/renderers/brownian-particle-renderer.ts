import { rendererRegistry } from '@/core/registries/renderer-registry';
import { worldToScreen, worldLengthToScreen } from '@/renderer/coordinate';
import { drawTextLabel } from '@/renderer/primitives/text-label';
import type { EntityRenderer } from '@/core/registries/renderer-registry';

/** 颜色常量 */
const PARTICLE_FILL = '#212121';
const PARTICLE_STROKE = '#000000';
const TRAJECTORY_COLOR = '#F44336';
const BG_MOLECULE_COLOR = 'rgba(158, 158, 158, 0.3)';

/**
 * 布朗运动粒子渲染器
 *
 * 绘制内容：
 * 1. 灰色背景液体分子
 * 2. 红色轨迹折线
 * 3. 黑色大圆（被观察粒子）
 * 4. 温度标注
 */
const brownianParticleRenderer: EntityRenderer = (entity, _result, ctx) => {
  const { coordinateTransform } = ctx;
  const { position } = entity.transform;
  const props = entity.properties;

  const radius = (props.radius as number) ?? 0.15;
  const temperature = (props.temperature as number) ?? 300;
  const trajectory = (props.trajectory as number[]) ?? [];
  const liquidPositions = (props.liquidPositions as number[]) ?? [];
  const containerW = (props.containerWidth as number) ?? 4;
  const containerH = (props.containerHeight as number) ?? 3;
  const currentX = (props.currentX as number) ?? 0;
  const currentY = (props.currentY as number) ?? 0;

  const c = ctx.ctx;
  c.save();

  // 1. 背景液体分子
  const moleculeR = Math.max(1.5, worldLengthToScreen(0.02, coordinateTransform));
  for (let i = 0; i < liquidPositions.length; i += 2) {
    const wx = position.x - containerW / 2 + (liquidPositions[i] ?? 0);
    const wy = position.y - containerH / 2 + (liquidPositions[i + 1] ?? 0);
    const screen = worldToScreen({ x: wx, y: wy }, coordinateTransform);

    c.fillStyle = BG_MOLECULE_COLOR;
    c.beginPath();
    c.arc(screen.x, screen.y, moleculeR, 0, Math.PI * 2);
    c.fill();
  }

  // 2. 轨迹折线
  if (trajectory.length >= 4) {
    c.strokeStyle = TRAJECTORY_COLOR;
    c.lineWidth = 1.5;
    c.setLineDash([3, 2]);
    c.beginPath();

    const first = worldToScreen(
      { x: position.x + (trajectory[0] ?? 0), y: position.y + (trajectory[1] ?? 0) },
      coordinateTransform,
    );
    c.moveTo(first.x, first.y);

    for (let i = 2; i < trajectory.length; i += 2) {
      const pt = worldToScreen(
        { x: position.x + (trajectory[i] ?? 0), y: position.y + (trajectory[i + 1] ?? 0) },
        coordinateTransform,
      );
      c.lineTo(pt.x, pt.y);
    }
    c.stroke();
    c.setLineDash([]);
  }

  // 3. 大粒子
  const particleScreen = worldToScreen(
    { x: position.x + currentX, y: position.y + currentY },
    coordinateTransform,
  );
  const screenR = worldLengthToScreen(radius, coordinateTransform);

  c.fillStyle = PARTICLE_FILL;
  c.beginPath();
  c.arc(particleScreen.x, particleScreen.y, screenR, 0, Math.PI * 2);
  c.fill();

  c.strokeStyle = PARTICLE_STROKE;
  c.lineWidth = 1.5;
  c.beginPath();
  c.arc(particleScreen.x, particleScreen.y, screenR, 0, Math.PI * 2);
  c.stroke();

  // 4. 标注
  const containerBottom = worldToScreen(
    { x: position.x, y: position.y - containerH / 2 },
    coordinateTransform,
  );
  drawTextLabel(c, `T = ${temperature.toFixed(0)} K`, {
    x: containerBottom.x,
    y: containerBottom.y + 18,
  }, {
    color: '#D32F2F',
    fontSize: 12,
    align: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: 3,
  });

  c.restore();
};

export function registerBrownianParticleRenderer(): void {
  rendererRegistry.registerEntity({
    entityType: 'brownian-particle',
    renderer: brownianParticleRenderer,
    layer: 'object',
  });
}
