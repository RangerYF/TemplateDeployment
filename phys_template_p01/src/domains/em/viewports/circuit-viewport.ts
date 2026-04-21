import { rendererRegistry } from '@/core/registries/renderer-registry';
import { worldToScreen, worldLengthToScreen } from '@/renderer/coordinate';
import { drawArrow } from '@/renderer/primitives/arrow';
import { drawTextLabel } from '@/renderer/primitives/text-label';
import type { ViewportRenderer } from '@/core/registries/renderer-registry';
import { FORCE_COLORS } from '@/core/visual-constants';

/** EMF 标注颜色 */
const EMF_COLOR = '#F59E0B';
/** 电流标注颜色 */
const CURRENT_COLOR = '#10B981';
/** 磁通量标注颜色 */
const FLUX_COLOR = '#6366F1';

/**
 * 电路视角渲染器（circuit viewport）
 *
 * 用于电磁感应场景，在线框上方实时标注：
 * 1. 感应电动势 ε (V)
 * 2. 感应电流 I (A)
 * 3. 磁通量 Φ (Wb)
 * 4. 安培力箭头（从实体中心沿力方向）
 */
const circuitViewportRenderer: ViewportRenderer = (data, entities, ctx) => {
  if (data.type !== 'circuit') return;

  const { coordinateTransform } = ctx;
  const c = ctx.ctx;

  // 检测是否为电路实验场景（含 dc-source）
  let hasCircuitScene = false;
  for (const entity of entities.values()) {
    if (entity.type === 'dc-source') {
      hasCircuitScene = true;
      break;
    }
  }

  if (hasCircuitScene) {
    renderCircuitExperiment(entities, ctx);
    return;
  }

  // 原有逻辑：遍历所有 wire-frame 实体，读取运行时 properties 中的 emf/current/flux
  for (const entity of entities.values()) {
    if (entity.type !== 'wire-frame') continue;

    const pos = entity.transform.position;
    const width = (entity.properties.width as number) ?? 1;
    const height = (entity.properties.height as number) ?? 0.8;
    const emf = (entity.properties.emf as number) ?? 0;
    const current = (entity.properties.current as number) ?? 0;
    const flux = (entity.properties.flux as number) ?? 0;

    // 线框中心的屏幕坐标
    const centerScreen = worldToScreen(
      { x: pos.x + width / 2, y: pos.y + height / 2 },
      coordinateTransform,
    );

    // 线框顶部屏幕坐标（标注区域）
    const topScreen = worldToScreen(
      { x: pos.x + width / 2, y: pos.y + height },
      coordinateTransform,
    );

    // 1. EMF 标注
    const emfText = `ε = ${Math.abs(emf) > 0.001 ? emf.toFixed(3) : '0'} V`;
    drawTextLabel(c, emfText, { x: topScreen.x, y: topScreen.y - 36 }, {
      color: EMF_COLOR,
      fontSize: 13,
      align: 'center',
      backgroundColor: 'rgba(255,255,255,0.85)',
      padding: 4,
    });

    // 2. 电流标注
    const currentText = `I = ${Math.abs(current) > 0.001 ? current.toFixed(3) : '0'} A`;
    drawTextLabel(c, currentText, { x: topScreen.x, y: topScreen.y - 18 }, {
      color: CURRENT_COLOR,
      fontSize: 13,
      align: 'center',
      backgroundColor: 'rgba(255,255,255,0.85)',
      padding: 4,
    });

    // 3. 磁通量标注
    const fluxText = `Φ = ${Math.abs(flux) > 0.0001 ? flux.toFixed(4) : '0'} Wb`;
    drawTextLabel(c, fluxText, { x: topScreen.x, y: topScreen.y - 0 }, {
      color: FLUX_COLOR,
      fontSize: 11,
      align: 'center',
    });

    // 4. 安培力箭头（有电流时绘制）
    if (Math.abs(current) > 1e-6) {
      const velocity = entity.properties.initialVelocity as { x: number; y: number } | undefined;
      if (velocity) {
        const speed = Math.hypot(velocity.x, velocity.y);
        if (speed > 1e-6) {
          // 安培力方向与速度反向（楞次定律）
          const forceDir = { x: -velocity.x / speed, y: -velocity.y / speed };

          // 从线框中心出发
          const screenW = worldLengthToScreen(width, coordinateTransform);
          const arrowLen = Math.min(60, Math.abs(current) * 80 + 20);

          const screenFrom = {
            x: centerScreen.x + forceDir.x * (screenW / 2 + 5),
            y: centerScreen.y - forceDir.y * (screenW / 2 + 5),
          };
          const screenTo = {
            x: screenFrom.x + forceDir.x * arrowLen,
            y: screenFrom.y - forceDir.y * arrowLen,
          };

          drawArrow(c, screenFrom, screenTo, {
            color: FORCE_COLORS.ampere,
            lineWidth: 2.5,
            arrowHeadSize: 10,
          });

          // 安培力数值标注
          drawTextLabel(c, 'F安', {
            x: screenTo.x + forceDir.x * 10,
            y: screenTo.y - forceDir.y * 10,
          }, {
            color: FORCE_COLORS.ampere,
            fontSize: 11,
            align: 'center',
          });
        }
      }
    }
  }
};

/**
 * 电路实验场景的视角渲染
 *
 * 在电路场景中绘制：
 * 1. 元件间的导线连接
 * 2. 电源参数标注（端电压、总电流）
 * 3. 测量结果标注（R_测、相对误差）
 */
function renderCircuitExperiment(
  entities: Map<string, import('@/core/types').Entity>,
  ctx: import('@/core/types').RenderContext,
): void {
  const { coordinateTransform } = ctx;
  const c = ctx.ctx;

  // 收集所有元件的屏幕坐标，用于绘制导线
  const components: Array<{
    type: string;
    screenX: number;
    screenY: number;
    screenW: number;
    screenH: number;
  }> = [];

  for (const entity of entities.values()) {
    const pos = entity.transform.position;
    const w = (entity.properties.width as number) ?? (entity.properties.radius as number) ?? 0.5;
    const h = (entity.properties.height as number) ?? w;

    let centerX: number, centerY: number;
    if (entity.type === 'ammeter' || entity.type === 'voltmeter') {
      // 圆形仪表的 position 是圆心
      centerX = pos.x;
      centerY = pos.y;
    } else {
      // 矩形元件的 position 是左下角
      centerX = pos.x + w / 2;
      centerY = pos.y + h / 2;
    }

    const screenCenter = worldToScreen({ x: centerX, y: centerY }, coordinateTransform);
    const screenW = worldLengthToScreen(w, coordinateTransform);
    const screenH = worldLengthToScreen(h, coordinateTransform);

    components.push({
      type: entity.type,
      screenX: screenCenter.x,
      screenY: screenCenter.y,
      screenW,
      screenH,
    });
  }

  // 绘制导线（用灰色细线连接相邻元件）
  c.save();
  c.strokeStyle = '#888';
  c.lineWidth = 1.5;
  c.setLineDash([6, 3]);

  // 简化：按类型顺序连线
  const sortedComponents = components
    .filter((comp) => comp.type !== 'voltmeter')
    .sort((a, b) => a.screenX - b.screenX);

  for (let i = 0; i < sortedComponents.length - 1; i++) {
    const from = sortedComponents[i]!;
    const to = sortedComponents[i + 1]!;
    c.beginPath();
    c.moveTo(from.screenX + from.screenW / 2 + 2, from.screenY);
    c.lineTo(to.screenX - to.screenW / 2 - 2, to.screenY);
    c.stroke();
  }
  c.setLineDash([]);
  c.restore();

  // 绘制电源相关标注
  for (const entity of entities.values()) {
    if (entity.type !== 'dc-source') continue;

    const terminalV = entity.properties.terminalVoltage as number | undefined;
    const totalI = entity.properties.totalCurrent as number | undefined;
    const measuredR = entity.properties.measuredR as number | undefined;
    const trueR = entity.properties.trueR as number | undefined;
    const error = entity.properties.error as number | undefined;

    const pos = entity.transform.position;
    const w = (entity.properties.width as number) ?? 0.8;
    const h = (entity.properties.height as number) ?? 0.5;

    const topScreen = worldToScreen(
      { x: pos.x + w / 2, y: pos.y + h },
      coordinateTransform,
    );

    let yOffset = topScreen.y - 20;

    if (terminalV !== undefined) {
      drawTextLabel(c, `U端=${terminalV.toFixed(3)}V`, { x: topScreen.x, y: yOffset }, {
        color: EMF_COLOR,
        fontSize: 12,
        align: 'center',
        backgroundColor: 'rgba(255,255,255,0.85)',
        padding: 3,
      });
      yOffset -= 18;
    }

    if (totalI !== undefined) {
      drawTextLabel(c, `I总=${totalI.toFixed(3)}A`, { x: topScreen.x, y: yOffset }, {
        color: CURRENT_COLOR,
        fontSize: 12,
        align: 'center',
        backgroundColor: 'rgba(255,255,255,0.85)',
        padding: 3,
      });
      yOffset -= 18;
    }

    if (measuredR !== undefined && trueR !== undefined && error !== undefined) {
      drawTextLabel(
        c,
        `R测=${measuredR.toFixed(2)}Ω  R真=${trueR.toFixed(2)}Ω`,
        { x: topScreen.x, y: yOffset },
        {
          color: '#E74C3C',
          fontSize: 12,
          align: 'center',
          backgroundColor: 'rgba(255,255,255,0.85)',
          padding: 3,
        },
      );
      yOffset -= 18;

      const errorPercent = (error * 100).toFixed(2);
      const errorSign = error > 0 ? '偏大' : '偏小';
      drawTextLabel(
        c,
        `误差=${errorPercent}%（${errorSign}）`,
        { x: topScreen.x, y: yOffset },
        { color: '#E74C3C', fontSize: 11, align: 'center' },
      );
    }
  }
}

export function registerCircuitViewport(): void {
  rendererRegistry.registerViewport('circuit', circuitViewportRenderer);
}
