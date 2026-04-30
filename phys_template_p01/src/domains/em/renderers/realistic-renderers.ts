/**
 * 实物图渲染函数集合
 *
 * 为 5 种核心电路元件提供逼真外观绘制，模拟实验桌面上的真实器件。
 * 由 circuit-viewport 在 viewMode='realistic' 时调用。
 */

import { worldToScreen, worldLengthToScreen } from '@/renderer/coordinate';
import { drawTextLabel } from '@/renderer/primitives/text-label';
import type { Entity, CoordinateTransform } from '@/core/types';

// ─── 颜色常量 ───

const BATTERY_BODY = '#4A5568';
const BATTERY_POS = '#E53E3E';
const BATTERY_NEG = '#3182CE';
const RESISTOR_BODY = '#D2B48C';
const RESISTOR_BAND_COLORS = ['#A0522D', '#2F4F4F', '#FF6347', '#FFD700'];
const SWITCH_METAL = '#718096';
const SWITCH_BASE = '#2D3748';
const METER_BODY = '#F7FAFC';
const METER_FRAME = '#2D3748';
const AMMETER_ACCENT = '#3182CE';
const VOLTMETER_ACCENT = '#805AD5';
const TERMINAL_COLOR = '#C53030';
const WIRE_COLOR = '#2D3748';

// ─── 公共辅助 ───

function drawTerminal(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
): void {
  // 接线柱：金属螺丝外观
  c.fillStyle = TERMINAL_COLOR;
  c.beginPath();
  c.arc(x, y, radius, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#7B341E';
  c.lineWidth = 1;
  c.stroke();

  // 十字槽
  c.strokeStyle = '#FED7D7';
  c.lineWidth = 1;
  const r2 = radius * 0.5;
  c.beginPath();
  c.moveTo(x - r2, y); c.lineTo(x + r2, y);
  c.moveTo(x, y - r2); c.lineTo(x, y + r2);
  c.stroke();
}

// ─── 1. 干电池 ───

export function drawRealisticBattery(
  c: CanvasRenderingContext2D,
  entity: Entity,
  transform: CoordinateTransform,
): void {
  const pos = entity.transform.position;
  const w = (entity.properties.width as number) ?? 0.8;
  const h = (entity.properties.height as number) ?? 0.5;
  const emf = (entity.properties.emf as number) ?? 6;

  const center = worldToScreen({ x: pos.x + w / 2, y: pos.y + h / 2 }, transform);
  const sw = worldLengthToScreen(w, transform);
  const sh = worldLengthToScreen(h, transform);

  const bodyW = sw * 0.7;
  const bodyH = sh * 1.2;

  c.save();

  // 电池圆柱体（简化为圆角矩形）
  c.fillStyle = BATTERY_BODY;
  c.beginPath();
  c.roundRect(center.x - bodyW / 2, center.y - bodyH / 2, bodyW, bodyH, 4);
  c.fill();

  // 正极凸起
  const capW = bodyW * 0.3;
  const capH = 6;
  c.fillStyle = BATTERY_POS;
  c.fillRect(center.x - capW / 2, center.y - bodyH / 2 - capH, capW, capH);

  // 标签区域
  c.fillStyle = '#EDF2F7';
  c.fillRect(center.x - bodyW / 2 + 4, center.y - 10, bodyW - 8, 20);

  // 电压标注
  c.fillStyle = BATTERY_BODY;
  c.font = 'bold 10px Inter, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(`${emf}V`, center.x, center.y);

  // + - 标记
  c.font = 'bold 12px Inter, sans-serif';
  c.fillStyle = BATTERY_POS;
  c.fillText('+', center.x, center.y - bodyH / 2 - capH - 8);
  c.fillStyle = BATTERY_NEG;
  c.fillText('−', center.x, center.y + bodyH / 2 + 10);

  // 接线柱
  drawTerminal(c, center.x, center.y - bodyH / 2 - capH - 2, 3);
  drawTerminal(c, center.x, center.y + bodyH / 2 + 2, 3);

  c.restore();
}

// ─── 2. 色环电阻 ───

export function drawRealisticResistor(
  c: CanvasRenderingContext2D,
  entity: Entity,
  transform: CoordinateTransform,
): void {
  const pos = entity.transform.position;
  const w = (entity.properties.width as number) ?? 0.8;
  const h = (entity.properties.height as number) ?? 0.4;
  const resistance = (entity.properties.resistance as number) ?? 10;

  const center = worldToScreen({ x: pos.x + w / 2, y: pos.y + h / 2 }, transform);
  const sw = worldLengthToScreen(w, transform);
  const sh = worldLengthToScreen(h, transform);

  c.save();

  // 引线
  c.strokeStyle = WIRE_COLOR;
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(center.x - sw / 2, center.y);
  c.lineTo(center.x - sw * 0.3, center.y);
  c.moveTo(center.x + sw * 0.3, center.y);
  c.lineTo(center.x + sw / 2, center.y);
  c.stroke();

  // 电阻体（椭圆形）
  const bodyW = sw * 0.6;
  const bodyH = sh * 0.8;
  c.fillStyle = RESISTOR_BODY;
  c.beginPath();
  c.ellipse(center.x, center.y, bodyW / 2, bodyH / 2, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#8B7355';
  c.lineWidth = 1;
  c.stroke();

  // 色环
  const bandW = 3;
  const bandSpacing = bodyW / 6;
  for (let i = 0; i < 4; i++) {
    const bx = center.x - bodyW / 3 + i * bandSpacing;
    c.fillStyle = RESISTOR_BAND_COLORS[i]!;
    c.fillRect(bx, center.y - bodyH / 2 + 2, bandW, bodyH - 4);
  }

  // 阻值标注
  drawTextLabel(c, `${resistance}Ω`, { x: center.x, y: center.y + bodyH / 2 + 12 }, {
    color: '#555', fontSize: 10, align: 'center',
  });

  // 接线柱
  drawTerminal(c, center.x - sw / 2, center.y, 3);
  drawTerminal(c, center.x + sw / 2, center.y, 3);

  c.restore();
}

// ─── 3. 刀闸开关 ───

export function drawRealisticSwitch(
  c: CanvasRenderingContext2D,
  entity: Entity,
  transform: CoordinateTransform,
): void {
  const pos = entity.transform.position;
  const w = (entity.properties.width as number) ?? 0.6;
  const h = (entity.properties.height as number) ?? 0.3;
  const closed = (entity.properties.closed as boolean) ?? true;

  const center = worldToScreen({ x: pos.x + w / 2, y: pos.y + h / 2 }, transform);
  const sw = worldLengthToScreen(w, transform);

  c.save();

  // 底座
  const baseW = sw * 0.9;
  const baseH = 12;
  c.fillStyle = SWITCH_BASE;
  c.beginPath();
  c.roundRect(center.x - baseW / 2, center.y + 2, baseW, baseH, 3);
  c.fill();

  // 左侧固定触点
  c.fillStyle = SWITCH_METAL;
  c.fillRect(center.x - sw * 0.35, center.y - 4, 8, 10);

  // 右侧固定触点
  c.fillRect(center.x + sw * 0.35 - 8, center.y - 4, 8, 10);

  // 刀片
  c.strokeStyle = SWITCH_METAL;
  c.lineWidth = 3;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(center.x - sw * 0.3, center.y);
  if (closed) {
    c.lineTo(center.x + sw * 0.3, center.y);
  } else {
    c.lineTo(center.x + sw * 0.15, center.y - sw * 0.35);
  }
  c.stroke();

  // 手柄
  const handleX = closed ? center.x + sw * 0.3 : center.x + sw * 0.15;
  const handleY = closed ? center.y : center.y - sw * 0.35;
  c.fillStyle = '#E53E3E';
  c.beginPath();
  c.arc(handleX, handleY, 5, 0, Math.PI * 2);
  c.fill();

  // 标签
  drawTextLabel(c, closed ? '闭合' : '断开', { x: center.x, y: center.y + baseH + 14 }, {
    color: closed ? '#38A169' : '#999', fontSize: 10, align: 'center',
  });

  // 接线柱
  drawTerminal(c, center.x - sw * 0.4, center.y + 8, 3);
  drawTerminal(c, center.x + sw * 0.4, center.y + 8, 3);

  c.restore();
}

// ─── 4. 表盘式电流表 ───

export function drawRealisticAmmeter(
  c: CanvasRenderingContext2D,
  entity: Entity,
  transform: CoordinateTransform,
): void {
  drawRealisticMeter(c, entity, transform, 'A', AMMETER_ACCENT);
}

// ─── 5. 表盘式电压表 ───

export function drawRealisticVoltmeter(
  c: CanvasRenderingContext2D,
  entity: Entity,
  transform: CoordinateTransform,
): void {
  drawRealisticMeter(c, entity, transform, 'V', VOLTMETER_ACCENT);
}

/**
 * 通用表盘式仪表（电流表/电压表共用）
 */
function drawRealisticMeter(
  c: CanvasRenderingContext2D,
  entity: Entity,
  transform: CoordinateTransform,
  symbol: string,
  accentColor: string,
): void {
  const pos = entity.transform.position;
  const radius = (entity.properties.radius as number) ?? 0.3;
  const reading = (entity.properties.reading as number) ?? 0;
  const range = (entity.properties.range as number) ?? 1;
  const overRange = (entity.properties.overRange as boolean) ?? false;

  const center = worldToScreen(pos, transform);
  const screenR = worldLengthToScreen(radius, transform);

  c.save();

  // 外壳（方形圆角）
  const boxSize = screenR * 2.4;
  c.fillStyle = METER_BODY;
  c.strokeStyle = METER_FRAME;
  c.lineWidth = 2;
  c.beginPath();
  c.roundRect(center.x - boxSize / 2, center.y - boxSize / 2, boxSize, boxSize, 6);
  c.fill();
  c.stroke();

  // 表盘弧（半圆）
  const dialR = screenR * 0.85;
  const dialCenterY = center.y + dialR * 0.2;

  c.strokeStyle = '#CBD5E0';
  c.lineWidth = 1;
  c.beginPath();
  c.arc(center.x, dialCenterY, dialR, Math.PI, 0);
  c.stroke();

  // 刻度线
  const tickCount = 10;
  for (let i = 0; i <= tickCount; i++) {
    const angle = Math.PI + (i / tickCount) * Math.PI;
    const isMain = i % 5 === 0;
    const innerR = dialR * (isMain ? 0.8 : 0.88);
    c.strokeStyle = isMain ? METER_FRAME : '#A0AEC0';
    c.lineWidth = isMain ? 1.5 : 0.8;
    c.beginPath();
    c.moveTo(center.x + dialR * Math.cos(angle), dialCenterY + dialR * Math.sin(angle));
    c.lineTo(center.x + innerR * Math.cos(angle), dialCenterY + innerR * Math.sin(angle));
    c.stroke();
  }

  // 指针
  const deflection = Math.min(1, Math.max(0, Math.abs(reading) / range));
  const needleAngle = Math.PI + deflection * Math.PI;
  const needleLen = dialR * 0.9;

  c.strokeStyle = overRange ? '#E53E3E' : '#1A202C';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(center.x, dialCenterY);
  c.lineTo(
    center.x + needleLen * Math.cos(needleAngle),
    dialCenterY + needleLen * Math.sin(needleAngle),
  );
  c.stroke();

  // 指针轴心
  c.fillStyle = '#1A202C';
  c.beginPath();
  c.arc(center.x, dialCenterY, 3, 0, Math.PI * 2);
  c.fill();

  // 符号
  c.fillStyle = accentColor;
  c.font = `bold ${Math.max(12, screenR * 0.45)}px Inter, sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(symbol, center.x, dialCenterY + dialR * 0.45);

  // 读数
  const readingText = `${reading.toFixed(3)} ${symbol === 'A' ? 'A' : 'V'}`;
  drawTextLabel(c, readingText, { x: center.x, y: center.y + boxSize / 2 + 12 }, {
    color: overRange ? '#E53E3E' : accentColor,
    fontSize: 10,
    align: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    padding: 2,
  });

  // 接线柱（底部左右）
  drawTerminal(c, center.x - boxSize * 0.25, center.y + boxSize / 2 - 2, 3);
  drawTerminal(c, center.x + boxSize * 0.25, center.y + boxSize / 2 - 2, 3);

  // 超量程
  if (overRange) {
    drawTextLabel(c, '⚠ 超量程', { x: center.x, y: center.y - boxSize / 2 - 8 }, {
      color: '#E53E3E', fontSize: 10, align: 'center',
      backgroundColor: 'rgba(254,215,215,0.9)', padding: 2,
    });
  }

  c.restore();
}

// ─── 导出：根据实体类型选择绘制函数 ───

const REALISTIC_RENDERERS: Record<string, (c: CanvasRenderingContext2D, e: Entity, t: CoordinateTransform) => void> = {
  'dc-source': drawRealisticBattery,
  'fixed-resistor': drawRealisticResistor,
  'slide-rheostat': drawRealisticResistor, // 复用电阻外观
  'resistance-box': drawRealisticResistor,
  'switch': drawRealisticSwitch,
  'ammeter': drawRealisticAmmeter,
  'voltmeter': drawRealisticVoltmeter,
};

/**
 * 判断一个实体类型是否有实物图渲染器
 */
export function hasRealisticRenderer(entityType: string): boolean {
  return entityType in REALISTIC_RENDERERS;
}

/**
 * 用实物图风格绘制一个实体
 */
export function drawRealisticEntity(
  c: CanvasRenderingContext2D,
  entity: Entity,
  transform: CoordinateTransform,
): void {
  const renderer = REALISTIC_RENDERERS[entity.type];
  if (renderer) {
    renderer(c, entity, transform);
  }
}
