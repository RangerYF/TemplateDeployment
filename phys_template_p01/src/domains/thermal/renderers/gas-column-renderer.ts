import { rendererRegistry } from '@/core/registries/renderer-registry';
import { worldToScreen, worldLengthToScreen } from '@/renderer/coordinate';
import { drawTextLabel } from '@/renderer/primitives/text-label';
import type { EntityRenderer } from '@/core/registries/renderer-registry';
import { m3ToLiters, paToCmHg } from '../logic/gas-law-utils';

/** 气柱填充色 */
const GAS_FILL = 'rgba(100, 181, 246, 0.25)';
/** 气柱描边色 */
const GAS_STROKE = 'rgba(66, 165, 245, 0.5)';
/** 图表颜色 */
const CHART_COLORS = {
  axis: '#424242',
  grid: '#E0E0E0',
  line: '#1976D2',
  point: '#D32F2F',
  initial: '#4CAF50',
  text: '#616161',
};
/** 图表尺寸 */
const CHART_SIZE = 160;
const CHART_MARGIN = 25;

/**
 * 气柱渲染器
 *
 * 绘制内容：
 * 1. 浅蓝色气柱填充
 * 2. p/V/T 标注
 * 3. 右侧内联 p-V / V-T / p-T 图表
 */
const gasColumnRenderer: EntityRenderer = (entity, _result, ctx) => {
  const { coordinateTransform } = ctx;
  const { position } = entity.transform;
  const props = entity.properties;

  const pressure = (props.pressure as number) ?? 101325;
  const volume = (props.volume as number) ?? 1e-4;
  const temperature = (props.temperature as number) ?? 300;
  const length = (props.length as number) ?? 0.5;
  const crossSection = (props.crossSection as number) ?? 2e-4;
  const positionOffset = (props.positionOffset as number) ?? 0;

  const c = ctx.ctx;
  c.save();

  const center = worldToScreen(
    { x: position.x, y: position.y + positionOffset },
    coordinateTransform,
  );
  const sw = worldLengthToScreen(Math.sqrt(crossSection) * 50, coordinateTransform);
  const sh = worldLengthToScreen(length, coordinateTransform);

  // 1. 气柱填充
  c.fillStyle = GAS_FILL;
  c.strokeStyle = GAS_STROKE;
  c.lineWidth = 1;
  c.fillRect(center.x - sw / 2, center.y - sh / 2, sw, sh);
  c.strokeRect(center.x - sw / 2, center.y - sh / 2, sw, sh);

  // 2. 状态量标注
  const pCmHg = paToCmHg(pressure);
  const vLiters = m3ToLiters(volume);
  const labelLines = [
    `p = ${pCmHg.toFixed(1)} cmHg`,
    `V = ${vLiters.toFixed(2)} L`,
    `T = ${temperature.toFixed(0)} K`,
  ];
  labelLines.forEach((text, i) => {
    drawTextLabel(c, text, {
      x: center.x - sw / 2 - 8,
      y: center.y - sh / 2 + 16 + i * 16,
    }, {
      color: '#1565C0',
      fontSize: 11,
      align: 'right',
      backgroundColor: 'rgba(255,255,255,0.9)',
      padding: 2,
    });
  });

  // 3. 图表
  const chartType = (props.chartType as string) ?? 'p-V';
  const chartData = (props.chartData as Array<{ x: number; y: number }>) ?? [];
  const initialP = (props.initialPressure as number) ?? pressure;
  const initialV = (props.initialVolume as number) ?? volume;
  const initialT = (props.initialTemperature as number) ?? temperature;

  if (chartData.length > 0 || chartType) {
    const chartX = center.x + sw / 2 + 30;
    const chartY = center.y - CHART_SIZE / 2;
    drawChart(c, chartX, chartY, chartType, chartData,
      { pressure, volume, temperature },
      { pressure: initialP, volume: initialV, temperature: initialT },
    );
  }

  c.restore();
};

interface GasState {
  pressure: number;
  volume: number;
  temperature: number;
}

function drawChart(
  c: CanvasRenderingContext2D,
  x: number, y: number,
  chartType: string,
  data: Array<{ x: number; y: number }>,
  current: GasState,
  initial: GasState,
): void {
  const size = CHART_SIZE;
  const m = CHART_MARGIN;

  c.save();

  // 背景
  c.fillStyle = 'rgba(255,255,255,0.95)';
  c.strokeStyle = '#E0E0E0';
  c.lineWidth = 1;
  c.fillRect(x, y, size + m * 2, size + m * 2);
  c.strokeRect(x, y, size + m * 2, size + m * 2);

  const ox = x + m;
  const oy = y + m + size;
  const plotW = size;
  const plotH = size;

  // 坐标轴
  c.strokeStyle = CHART_COLORS.axis;
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(ox, oy);
  c.lineTo(ox + plotW, oy);
  c.moveTo(ox, oy);
  c.lineTo(ox, oy - plotH);
  c.stroke();

  // 轴标签
  let xLabel = '';
  let yLabel = '';
  let xCurrent = 0;
  let yCurrent = 0;
  let xInitial = 0;
  let yInitial = 0;

  if (chartType === 'p-V') {
    xLabel = 'V';
    yLabel = 'p';
    xCurrent = m3ToLiters(current.volume);
    yCurrent = paToCmHg(current.pressure);
    xInitial = m3ToLiters(initial.volume);
    yInitial = paToCmHg(initial.pressure);
  } else if (chartType === 'V-T') {
    xLabel = 'T';
    yLabel = 'V';
    xCurrent = current.temperature;
    yCurrent = m3ToLiters(current.volume);
    xInitial = initial.temperature;
    yInitial = m3ToLiters(initial.volume);
  } else if (chartType === 'p-T') {
    xLabel = 'T';
    yLabel = 'p';
    xCurrent = current.temperature;
    yCurrent = paToCmHg(current.pressure);
    xInitial = initial.temperature;
    yInitial = paToCmHg(initial.pressure);
  }

  drawTextLabel(c, xLabel, { x: ox + plotW + 8, y: oy + 4 }, {
    color: CHART_COLORS.text, fontSize: 12, align: 'center',
  });
  drawTextLabel(c, yLabel, { x: ox - 8, y: oy - plotH - 4 }, {
    color: CHART_COLORS.text, fontSize: 12, align: 'center',
  });

  // 计算坐标范围
  const allX = [xInitial, xCurrent, ...data.map(d => d.x)];
  const allY = [yInitial, yCurrent, ...data.map(d => d.y)];
  const xMin = 0;
  const yMin = 0;
  const xMax = Math.max(...allX) * 1.3 || 1;
  const yMax = Math.max(...allY) * 1.3 || 1;

  const toScreenX = (v: number) => ox + ((v - xMin) / (xMax - xMin)) * plotW;
  const toScreenY = (v: number) => oy - ((v - yMin) / (yMax - yMin)) * plotH;

  // 绘制数据线
  if (data.length > 1) {
    c.strokeStyle = CHART_COLORS.line;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(toScreenX(data[0]!.x), toScreenY(data[0]!.y));
    for (let i = 1; i < data.length; i++) {
      c.lineTo(toScreenX(data[i]!.x), toScreenY(data[i]!.y));
    }
    c.stroke();
  }

  // 初始态点（绿色）
  drawPoint(c, toScreenX(xInitial), toScreenY(yInitial), CHART_COLORS.initial, '1');
  // 当前态点（红色）
  drawPoint(c, toScreenX(xCurrent), toScreenY(yCurrent), CHART_COLORS.point, '2');

  c.restore();
}

function drawPoint(
  c: CanvasRenderingContext2D,
  x: number, y: number,
  color: string,
  label: string,
): void {
  c.fillStyle = color;
  c.beginPath();
  c.arc(x, y, 4, 0, Math.PI * 2);
  c.fill();

  drawTextLabel(c, label, { x: x + 8, y: y - 8 }, {
    color,
    fontSize: 10,
    align: 'left',
  });
}

export function registerGasColumnRenderer(): void {
  rendererRegistry.registerEntity({
    entityType: 'gas-column',
    renderer: gasColumnRenderer,
    layer: 'object',
  });
}
