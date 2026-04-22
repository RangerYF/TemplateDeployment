import '@physics/core/styles.css';
import {
  createLayout, ParameterPanel, defineParams, CanvasManager,
} from '@physics/core';

interface Ray { x: number; y: number; dx: number; dy: number; }
interface Surface { type: 'flat' | 'lens' | 'mirror'; x: number; y: number; angle: number; n1: number; n2: number; f?: number; h: number; }

const app = document.getElementById('app')!;
const layout = createLayout(app, 'P-03 光学实验台');

const paramDefs = defineParams([
  { key: 'scene', label: '场景', type: 'select', default: '折射定律',
    options: ['折射定律', '全反射', '薄透镜成像', '凹透镜成像', '双缝干涉', '单缝衍射', '薄膜干涉'] },
  { key: 'n1', label: '介质1折射率 n₁', unit: '', min: 1, max: 2.5, step: 0.01, default: 1, scenes: ['折射定律', '全反射'] },
  { key: 'n2', label: '介质2折射率 n₂', unit: '', min: 1, max: 2.5, step: 0.01, default: 1.5, scenes: ['折射定律', '全反射'] },
  { key: 'incidentAngle', label: '入射角 θ', unit: '°', min: 0, max: 89, step: 1, default: 30, scenes: ['折射定律', '全反射'] },
  { key: 'focalLength', label: '焦距 f', unit: 'cm', min: 1, max: 15, step: 0.5, default: 5, scenes: ['薄透镜成像'] },
  { key: 'objectDist', label: '物距 u', unit: 'cm', min: 1, max: 20, step: 0.5, default: 10, scenes: ['薄透镜成像'] },
  { key: 'concaveFocal', label: '焦距 |f|', unit: 'cm', min: 1, max: 15, step: 0.5, default: 5, scenes: ['凹透镜成像'] },
  { key: 'concaveObjDist', label: '物距 u', unit: 'cm', min: 1, max: 20, step: 0.5, default: 10, scenes: ['凹透镜成像'] },
  { key: 'slitSpacing', label: '狭缝间距 d', unit: 'mm', min: 0.1, max: 2, step: 0.01, default: 0.5, scenes: ['双缝干涉'] },
  { key: 'wavelength', label: '波长 λ', unit: 'nm', min: 380, max: 780, step: 5, default: 550, scenes: ['双缝干涉', '单缝衍射', '薄膜干涉'] },
  { key: 'slitWidth', label: '缝宽 a', unit: 'μm', min: 1, max: 100, step: 1, default: 20, scenes: ['单缝衍射'] },
  { key: 'screenDist', label: '屏距 L', unit: 'm', min: 0.5, max: 5, step: 0.1, default: 2, scenes: ['单缝衍射'] },
  { key: 'filmMode', label: '薄膜模式', type: 'select', default: '楔形薄膜',
    options: ['楔形薄膜', '牛顿环'], scenes: ['薄膜干涉'] },
  { key: 'filmRefIdx', label: '薄膜折射率 n', unit: '', min: 1.1, max: 2.5, step: 0.01, default: 1.5, scenes: ['薄膜干涉'] },
  { key: 'wedgeAngle', label: '楔角 α', unit: '′', min: 1, max: 60, step: 1, default: 10, scenes: ['薄膜干涉'] },
  { key: 'newtonR', label: '透镜曲率半径 R', unit: 'm', min: 0.5, max: 10, step: 0.1, default: 2, scenes: ['薄膜干涉'] },
  { key: 'showNormal', label: '显示法线', type: 'checkbox', default: true, scenes: ['折射定律', '全反射'] },
]);

const panel = new ParameterPanel(layout.sidebar, paramDefs);
const cm = new CanvasManager({ container: layout.canvas });
cm.setScale(30);

function updateOrigin(): void {
  cm.setOrigin(cm.getWidth() / 2, cm.getHeight() / 2);
}

// Info panel in bottom area
const infoDiv = document.createElement('div');
infoDiv.style.cssText = 'flex:1; padding:16px; color:#e2e8f0; font-size:16px; line-height:1.8; overflow-y:auto;';
layout.bottomPanel.appendChild(infoDiv);

// ── Conditional parameter visibility ──────────────────────────────────
const sceneParamMap: Record<string, string[]> = {
  '折射定律': ['n1', 'n2', 'incidentAngle', 'showNormal'],
  '全反射': ['n1', 'n2', 'incidentAngle', 'showNormal'],
  '薄透镜成像': ['focalLength', 'objectDist'],
  '凹透镜成像': ['concaveFocal', 'concaveObjDist'],
  '双缝干涉': ['slitSpacing', 'wavelength'],
  '单缝衍射': ['slitWidth', 'wavelength', 'screenDist'],
  '薄膜干涉': ['filmMode', 'wavelength', 'filmRefIdx', 'wedgeAngle', 'newtonR'],
};

// Additional conditional logic within thin-film scene
function getVisibleParams(scene: string): string[] {
  const base = sceneParamMap[scene] ?? [];
  if (scene === '薄膜干涉') {
    const mode = panel.getValue<string>('filmMode');
    if (mode === '楔形薄膜') {
      return base.filter(k => k !== 'newtonR');
    } else {
      return base.filter(k => k !== 'wedgeAngle' && k !== 'filmRefIdx');
    }
  }
  return base;
}

function updateParamVisibility(): void {
  const scene = panel.getValue<string>('scene');
  const visible = new Set(['scene', ...getVisibleParams(scene)]);
  const rows = document.querySelectorAll('.param-row');
  for (const def of paramDefs) {
    const row = document.querySelector(`[data-key="${def.key}"]`)?.closest('.param-row') as HTMLElement | null;
    if (row) {
      row.style.display = visible.has(def.key) ? '' : 'none';
    }
  }
}

function wavelengthToColor(nm: number): string {
  let r = 0, g = 0, b = 0;
  if (nm >= 380 && nm < 440) { r = -(nm - 440) / 60; b = 1; }
  else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
  else if (nm < 510) { g = 1; b = -(nm - 510) / 20; }
  else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
  else if (nm < 645) { r = 1; g = -(nm - 645) / 65; }
  else if (nm <= 780) { r = 1; }
  return `rgb(${Math.floor(r * 255)},${Math.floor(g * 255)},${Math.floor(b * 255)})`;
}

function wavelengthToRGB(nm: number): [number, number, number] {
  let r = 0, g = 0, b = 0;
  if (nm >= 380 && nm < 440) { r = -(nm - 440) / 60; b = 1; }
  else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
  else if (nm < 510) { g = 1; b = -(nm - 510) / 20; }
  else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
  else if (nm < 645) { r = 1; g = -(nm - 645) / 65; }
  else if (nm <= 780) { r = 1; }
  return [r, g, b];
}

function render(): void {
  const scene = panel.getValue<string>('scene');
  updateParamVisibility();
  updateOrigin();
  cm.clear('#070b14');
  const ctx = cm.ctx;

  switch (scene) {
    case '折射定律':
    case '全反射':
      renderRefraction(ctx);
      break;
    case '薄透镜成像':
      renderLens(ctx);
      break;
    case '凹透镜成像':
      renderConcaveLens(ctx);
      break;
    case '双缝干涉':
      renderDoubleSlit(ctx);
      break;
    case '单缝衍射':
      renderSingleSlit(ctx);
      break;
    case '薄膜干涉':
      renderThinFilm(ctx);
      break;
  }
}

// ── Refraction scene ──────────────────────────────────────────────────
function renderRefraction(ctx: CanvasRenderingContext2D): void {
  const n1 = panel.getValue<number>('n1');
  const n2 = panel.getValue<number>('n2');
  const thetaI = panel.getValue<number>('incidentAngle') * Math.PI / 180;
  const showNormal = panel.getValue<boolean>('showNormal');

  // Interface line (horizontal)
  cm.drawLine(-10, 0, 10, 0, 'rgba(255,255,255,0.4)', 2);

  // Media labels
  const [, interfaceY] = cm.toScreen(0, 0);
  ctx.fillStyle = 'rgba(96,165,250,0.15)';
  ctx.fillRect(0, 0, cm.getWidth(), interfaceY);
  ctx.fillStyle = 'rgba(74,222,128,0.1)';
  ctx.fillRect(0, interfaceY, cm.getWidth(), cm.getHeight() - interfaceY);

  cm.drawText(`n₁ = ${n1.toFixed(2)}`, -14, 4, { color: '#60a5fa', offsetX: 0, offsetY: 0 });
  cm.drawText(`n₂ = ${n2.toFixed(2)}`, -14, -4, { color: '#4ade80', offsetX: 0, offsetY: 0 });

  // Normal line
  if (showNormal) {
    cm.drawLine(0, 6, 0, -6, 'rgba(255,255,255,0.3)', 1, true);
  }

  // Incident ray
  const rayLen = 7;
  const ix = -rayLen * Math.sin(thetaI);
  const iy = rayLen * Math.cos(thetaI);
  ctx.save();
  ctx.shadowColor = '#fbbf24';
  ctx.shadowBlur = 8;
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 2.5;
  const [rx1, ry1] = cm.toScreen(ix, iy);
  const [rx2, ry2] = cm.toScreen(0, 0);
  ctx.beginPath(); ctx.moveTo(rx1, ry1); ctx.lineTo(rx2, ry2); ctx.stroke();
  ctx.restore();

  // Draw arrowhead
  drawArrow(ctx, rx1, ry1, rx2, ry2, '#fbbf24');

  // Snell's law: n1*sin(theta1) = n2*sin(theta2)
  const sinTheta2 = n1 * Math.sin(thetaI) / n2;
  const isTotalReflection = Math.abs(sinTheta2) > 1;

  // Reflected ray (always exists)
  const refX = rayLen * Math.sin(thetaI);
  const refY = rayLen * Math.cos(thetaI);
  const reflColor = isTotalReflection ? '#f87171' : 'rgba(248,113,113,0.5)';
  ctx.save();
  ctx.shadowColor = '#f87171';
  ctx.shadowBlur = isTotalReflection ? 10 : 4;
  ctx.strokeStyle = reflColor;
  ctx.lineWidth = isTotalReflection ? 2.5 : 1.5;
  const [rrx, rry] = cm.toScreen(refX, refY);
  ctx.beginPath(); ctx.moveTo(rx2, ry2); ctx.lineTo(rrx, rry); ctx.stroke();
  ctx.restore();
  drawArrow(ctx, rx2, ry2, rrx, rry, reflColor);

  if (!isTotalReflection) {
    // Refracted ray
    const theta2 = Math.asin(sinTheta2);
    const tx = rayLen * Math.sin(theta2);
    const ty = -rayLen * Math.cos(theta2);
    ctx.save();
    ctx.shadowColor = '#4ade80';
    ctx.shadowBlur = 8;
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 2.5;
    const [rtx, rty] = cm.toScreen(tx, ty);
    ctx.beginPath(); ctx.moveTo(rx2, ry2); ctx.lineTo(rtx, rty); ctx.stroke();
    ctx.restore();
    drawArrow(ctx, rx2, ry2, rtx, rty, '#4ade80');

    // Angle arcs
    drawAngleArc(ctx, 0, 0, thetaI, '#fbbf24', '入射角', true);
    drawAngleArc(ctx, 0, 0, theta2, '#4ade80', '折射角', false);

    infoDiv.innerHTML = `
      <b>Snell 定律:</b> n₁sinθ₁ = n₂sinθ₂<br>
      入射角 θ₁ = ${(thetaI * 180 / Math.PI).toFixed(1)}°<br>
      折射角 θ₂ = ${(theta2 * 180 / Math.PI).toFixed(1)}°<br>
      n₁sinθ₁ = ${(n1 * Math.sin(thetaI)).toFixed(4)}<br>
      n₂sinθ₂ = ${(n2 * Math.sin(theta2)).toFixed(4)}
    `;
  } else {
    // Total internal reflection
    const critAngle = Math.asin(n2 / n1);
    infoDiv.innerHTML = `
      <b>全反射!</b><br>
      临界角 θ_c = arcsin(n₂/n₁) = ${(critAngle * 180 / Math.PI).toFixed(1)}°<br>
      当前入射角 ${(thetaI * 180 / Math.PI).toFixed(1)}° > θ_c<br>
      条件: 从光密介质到光疏介质 (n₁=${n1.toFixed(2)} > n₂=${n2.toFixed(2)})
    `;
  }
}

// ── Convex lens (薄透镜成像) ──────────────────────────────────────────
function renderLens(ctx: CanvasRenderingContext2D): void {
  const f = panel.getValue<number>('focalLength');
  const u = panel.getValue<number>('objectDist');

  // Thin lens equation: 1/f = 1/u + 1/v
  const v = 1 / (1 / f - 1 / u);
  const m = -v / u; // magnification

  // Optical axis
  cm.drawLine(-14, 0, 14, 0, 'rgba(255,255,255,0.3)', 1);

  // Lens at origin
  ctx.strokeStyle = '#60a5fa';
  ctx.lineWidth = 3;
  const [lx, ly1] = cm.toScreen(0, 4);
  const [, ly2] = cm.toScreen(0, -4);
  ctx.beginPath(); ctx.moveTo(lx, ly1); ctx.lineTo(lx, ly2); ctx.stroke();
  // Lens arrows (convex: outward arrows)
  ctx.beginPath(); ctx.moveTo(lx - 8, ly1 + 8); ctx.lineTo(lx, ly1); ctx.lineTo(lx + 8, ly1 + 8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(lx - 8, ly2 - 8); ctx.lineTo(lx, ly2); ctx.lineTo(lx + 8, ly2 - 8); ctx.stroke();

  // Focal points
  for (const fx of [-f, f]) {
    cm.drawBall(fx, 0, 4, '#fbbf24', { label: 'F' });
  }

  // Object (arrow at -u)
  const objH = 2;
  ctx.strokeStyle = '#f87171';
  ctx.lineWidth = 3;
  const [ox1, oy1] = cm.toScreen(-u, 0);
  const [ox2, oy2] = cm.toScreen(-u, objH);
  ctx.beginPath(); ctx.moveTo(ox1, oy1); ctx.lineTo(ox2, oy2); ctx.stroke();
  drawArrow(ctx, ox1, oy1, ox2, oy2, '#f87171');

  // Image (if v is finite)
  if (isFinite(v) && Math.abs(v) < 50) {
    const imgH = objH * m;
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 3;
    if (v < 0) ctx.setLineDash([4, 4]); // virtual image
    const [ix1, iy1] = cm.toScreen(v, 0);
    const [ix2, iy2] = cm.toScreen(v, imgH);
    ctx.beginPath(); ctx.moveTo(ix1, iy1); ctx.lineTo(ix2, iy2); ctx.stroke();
    drawArrow(ctx, ix1, iy1, ix2, iy2, '#4ade80');
    ctx.setLineDash([]);

    // Three characteristic rays
    const rayColor = 'rgba(251,191,36,0.6)';
    ctx.strokeStyle = rayColor;
    ctx.lineWidth = 1.5;

    // Ray 1: parallel to axis -> through focal point
    ctx.beginPath(); ctx.moveTo(...cm.toScreen(-u, objH)); ctx.lineTo(...cm.toScreen(0, objH)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(...cm.toScreen(0, objH)); ctx.lineTo(...cm.toScreen(v, imgH)); ctx.stroke();

    // Ray 2: through center (undeviated)
    ctx.beginPath(); ctx.moveTo(...cm.toScreen(-u, objH)); ctx.lineTo(...cm.toScreen(v, imgH)); ctx.stroke();

    // Ray 3: through focal point -> parallel to axis after lens
    if (Math.abs(u - f) > 0.01) {
      const yAtLens = objH * f / (f - u);
      ctx.beginPath(); ctx.moveTo(...cm.toScreen(-u, objH)); ctx.lineTo(...cm.toScreen(0, yAtLens)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(...cm.toScreen(0, yAtLens)); ctx.lineTo(...cm.toScreen(v, yAtLens)); ctx.stroke();
    }
  }

  const imageType = v > 0 ? '实像' : '虚像';
  const orientation = m > 0 ? '正立' : '倒立';
  const sizeDesc = Math.abs(m) > 1 ? '放大' : Math.abs(m) < 1 ? '缩小' : '等大';

  infoDiv.innerHTML = `
    <b>薄透镜成像公式:</b> 1/f = 1/u + 1/v<br>
    焦距 f = ${f.toFixed(1)} cm<br>
    物距 u = ${u.toFixed(1)} cm<br>
    像距 v = ${isFinite(v) ? v.toFixed(1) : '∞'} cm<br>
    放大率 m = ${isFinite(m) ? m.toFixed(2) : '∞'}<br>
    成像性质: ${imageType}、${orientation}、${sizeDesc}
  `;
}

// ── Concave lens (凹透镜成像) ─────────────────────────────────────────
function renderConcaveLens(ctx: CanvasRenderingContext2D): void {
  const fAbs = panel.getValue<number>('concaveFocal');
  const f = -fAbs; // concave lens has negative focal length
  const u = panel.getValue<number>('concaveObjDist');

  // Thin lens equation: 1/f = 1/v - 1/u  =>  1/v = 1/f + 1/u (sign convention: u positive for real object)
  // Using 1/v = 1/f + 1/(-u) is wrong. Proper: 1/v = 1/f - 1/(-u) ... let's use standard:
  // 1/f = 1/v - 1/(-u)  --> real-is-positive convention with object on left:
  // Standard: 1/v = 1/f + 1/u  where f<0, u>0 (object distance positive)
  // Wait, the convex lens above uses: v = 1/(1/f - 1/u) i.e. 1/v = 1/f - 1/u
  // That's the same convention: 1/f = 1/v + 1/u  =>  1/v = 1/f - 1/u
  // For concave lens with f<0 and u>0, v will always be negative (virtual image on same side as object)
  const v = 1 / (1 / f - 1 / u);
  const m = -v / u; // magnification; v<0 means m>0 (upright)

  // Optical axis
  cm.drawLine(-14, 0, 14, 0, 'rgba(255,255,255,0.3)', 1);

  // Concave lens at origin (inward arrows to distinguish from convex)
  ctx.strokeStyle = '#a78bfa';
  ctx.lineWidth = 3;
  const [lx, ly1] = cm.toScreen(0, 4);
  const [, ly2] = cm.toScreen(0, -4);
  ctx.beginPath(); ctx.moveTo(lx, ly1); ctx.lineTo(lx, ly2); ctx.stroke();
  // Inward-pointing arrows (concave lens symbol)
  ctx.beginPath(); ctx.moveTo(lx - 8, ly1 - 8); ctx.lineTo(lx, ly1); ctx.lineTo(lx + 8, ly1 - 8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(lx - 8, ly2 + 8); ctx.lineTo(lx, ly2); ctx.lineTo(lx + 8, ly2 + 8); ctx.stroke();

  // Focal points
  const focalPositions = [f, -f]; // F (left, virtual), F' (right, virtual)
  const focalLabels = ['F', "F'"];
  for (let i = 0; i < 2; i++) {
    cm.drawBall(focalPositions[i], 0, 4, '#fbbf24', { label: focalLabels[i] });
  }

  // Object (arrow at -u)
  const objH = 2;
  ctx.strokeStyle = '#f87171';
  ctx.lineWidth = 3;
  const [ox1, oy1] = cm.toScreen(-u, 0);
  const [ox2, oy2] = cm.toScreen(-u, objH);
  ctx.beginPath(); ctx.moveTo(ox1, oy1); ctx.lineTo(ox2, oy2); ctx.stroke();
  drawArrow(ctx, ox1, oy1, ox2, oy2, '#f87171');

  // Image (always virtual for concave lens with real object, v < 0)
  if (isFinite(v) && Math.abs(v) < 50) {
    const imgH = objH * m;
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 4]); // virtual image shown dashed
    const [ix1, iy1] = cm.toScreen(v, 0);
    const [ix2, iy2] = cm.toScreen(v, imgH);
    ctx.beginPath(); ctx.moveTo(ix1, iy1); ctx.lineTo(ix2, iy2); ctx.stroke();
    drawArrow(ctx, ix1, iy1, ix2, iy2, '#4ade80');
    ctx.setLineDash([]);

    // Three characteristic rays for concave lens
    const rayColor = 'rgba(251,191,36,0.7)';
    const virtualColor = 'rgba(251,191,36,0.3)';

    // Ray 1: Parallel to axis -> diverges, extension passes through F (on object side, x=f<0)
    // The ray enters parallel at height objH, exits the lens and diverges.
    // The outgoing ray, when extended backward, passes through F (x=f, y=0).
    // Outgoing ray slope: from lens (0, objH) toward F (f, 0): slope = (0-objH)/(f-0) = -objH/f
    // At far right (e.g., x=14): y = objH + slope*14
    const slope1 = -objH / f; // f<0, so slope1 = -objH/(-|f|) = objH/|f| > 0 ... wait
    // slope from (0,objH) to (f,0) is (0-objH)/(f-0) = -objH/f. Since f<0: -objH/(-|f|) = objH/|f| > 0
    // That means the exit ray goes upward to the right. But for diverging lens, a parallel ray should diverge outward.
    // Actually the "virtual" focal point for diverging lens on the exit side is at x = f (which is negative, same side as object).
    // So the exit ray appears to come from F. The slope of exit ray: from (0,objH) such that backward extension hits (f,0).
    // slope = (objH - 0)/(0 - f) = objH/(-f) = objH/|f|
    // So exit ray: from (0, objH) going right with slope = (0-objH)/(f-0) ... let me just compute it properly.
    // Point on lens: (0, objH). Virtual focal point: (f, 0) where f < 0 (left of lens).
    // The exit ray goes to the right but its backward extension passes through (f, 0).
    // Direction from (f,0) to (0, objH): dx = 0-f = -f = |f|, dy = objH-0 = objH.
    // So the exit ray goes in direction (|f|, objH), normalized.
    // At x=14: y = objH + objH/|f| * 14 = objH*(1 + 14/|f|)
    const exitY1 = objH + (objH / fAbs) * 14;
    // Solid line: actual ray path from object to lens, then from lens onward
    ctx.strokeStyle = rayColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(...cm.toScreen(-u, objH)); ctx.lineTo(...cm.toScreen(0, objH)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(...cm.toScreen(0, objH)); ctx.lineTo(...cm.toScreen(14, exitY1)); ctx.stroke();
    // Dashed extension backward through F
    ctx.strokeStyle = virtualColor;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(...cm.toScreen(0, objH)); ctx.lineTo(...cm.toScreen(f, 0)); ctx.stroke();
    ctx.setLineDash([]);

    // Ray 2: Through center of lens -> straight through (undeviated)
    // From (-u, objH) through (0,0) and beyond
    const centerSlope = objH / u; // from (-u, objH) to (0,0): dy/dx = (0-objH)/(0-(-u)) = -objH/u ...
    // Actually direction: (u, -objH). At x=14: y = 0 + (-objH/u)*14 = -14*objH/u
    const exitY2far = -14 * objH / u;
    ctx.strokeStyle = rayColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(...cm.toScreen(-u, objH)); ctx.lineTo(...cm.toScreen(14, exitY2far)); ctx.stroke();

    // Ray 3: Aimed toward F' on far side (x = -f = |f|, y=0), lens makes it exit parallel
    // The incoming ray from (-u, objH) aims toward F' at (-f, 0) = (|f|, 0).
    // This ray hits the lens at some height yAtLens3.
    // Slope: from (-u, objH) to (|f|, 0): dy/dx = (0 - objH)/(|f| - (-u)) = -objH/(|f|+u)
    // At lens x=0: y = objH + slope*(0-(-u)) = objH + (-objH/(|f|+u))*u = objH*(1 - u/(|f|+u)) = objH*|f|/(|f|+u)
    const yAtLens3 = objH * fAbs / (fAbs + u);
    // After lens: exits parallel to axis at height yAtLens3
    ctx.strokeStyle = rayColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(...cm.toScreen(-u, objH)); ctx.lineTo(...cm.toScreen(0, yAtLens3)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(...cm.toScreen(0, yAtLens3)); ctx.lineTo(...cm.toScreen(14, yAtLens3)); ctx.stroke();
    // Dashed extension of incoming ray to F'
    ctx.strokeStyle = virtualColor;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(...cm.toScreen(0, yAtLens3)); ctx.lineTo(...cm.toScreen(-f, 0)); ctx.stroke();
    ctx.setLineDash([]);
  }

  const sizeDesc = Math.abs(m) > 1 ? '放大' : Math.abs(m) < 1 ? '缩小' : '等大';

  infoDiv.innerHTML = `
    <b>凹透镜 (发散透镜):</b> f < 0<br>
    焦距 f = ${f.toFixed(1)} cm<br>
    物距 u = ${u.toFixed(1)} cm<br>
    像距 v = ${isFinite(v) ? v.toFixed(1) : '∞'} cm<br>
    放大率 m = ${isFinite(m) ? m.toFixed(2) : '∞'}<br>
    成像性质: 虚像、正立、${sizeDesc}<br>
    <b>特征:</b> 凹透镜对实物总是成正立、缩小的虚像
  `;
}

// ── Double slit interference (双缝干涉) ──────────────────────────────
function renderDoubleSlit(ctx: CanvasRenderingContext2D): void {
  const d = panel.getValue<number>('slitSpacing') * 1e-3; // mm to m
  const lambda = panel.getValue<number>('wavelength') * 1e-9; // nm to m
  const color = wavelengthToColor(panel.getValue<number>('wavelength'));

  // Screen on right side
  const screenX = 8;
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(...cm.toScreen(screenX, -5));
  ctx.lineTo(...cm.toScreen(screenX, 5));
  ctx.stroke();

  // Slits
  const slitX = -3;
  ctx.fillStyle = '#64748b';
  ctx.fillRect(...cm.toScreen(slitX - 0.1, 5), 0.2 * cm.getScale(), 10 * cm.getScale());
  // Gap for slits
  const slitSep = 1.5; // visual separation
  ctx.clearRect(...cm.toScreen(slitX - 0.1, slitSep / 2 + 0.15), 0.2 * cm.getScale(), 0.3 * cm.getScale());
  ctx.clearRect(...cm.toScreen(slitX - 0.1, -slitSep / 2 + 0.15), 0.2 * cm.getScale(), 0.3 * cm.getScale());

  // Draw barrier with slits properly
  ctx.fillStyle = '#475569';
  const [bx] = cm.toScreen(slitX, 0);
  const bw = 0.2 * cm.getScale();
  ctx.fillRect(bx - bw / 2, 0, bw, cm.getHeight());
  // Cut slit openings
  ctx.fillStyle = '#070b14';
  const [, s1y] = cm.toScreen(0, slitSep / 2);
  const [, s2y] = cm.toScreen(0, -slitSep / 2);
  const slitH = 0.3 * cm.getScale();
  ctx.fillRect(bx - bw / 2, s1y - slitH / 2, bw, slitH);
  ctx.fillRect(bx - bw / 2, s2y - slitH / 2, bw, slitH);

  // Light source
  cm.drawBall(-8, 0, 6, color, { label: '光源', glow: true });

  // Rays from source to slits
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(...cm.toScreen(-8, 0)); ctx.lineTo(...cm.toScreen(slitX, slitSep / 2)); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(...cm.toScreen(-8, 0)); ctx.lineTo(...cm.toScreen(slitX, -slitSep / 2)); ctx.stroke();
  ctx.globalAlpha = 1;

  // Interference pattern on screen
  const L = (screenX - slitX); // screen distance in world units
  const numPoints = 200;
  const screenHalf = 5; // world units
  for (let i = 0; i < numPoints; i++) {
    const y = (i / numPoints - 0.5) * screenHalf * 2;
    const theta = Math.atan2(y, L);
    const sinTheta = Math.sin(theta);
    const phi = 2 * Math.PI * d * sinTheta / lambda;
    const intensity = Math.cos(phi / 2) ** 2;

    const [sx, sy] = cm.toScreen(screenX + 0.3, y);
    const barW = intensity * 1.5 * cm.getScale();
    ctx.fillStyle = color;
    ctx.globalAlpha = intensity * 0.8;
    ctx.fillRect(sx, sy - 1, barW, 2);
  }
  ctx.globalAlpha = 1;

  // Fringe spacing (real physical calculation)
  const screenDistM = 1.0; // assume 1m screen distance for physical calculation
  const realFringeSpacing = lambda * screenDistM / d;
  infoDiv.innerHTML = `
    <b>双缝干涉:</b> Δy = λL/d<br>
    波长 λ = ${panel.getValue<number>('wavelength')} nm<br>
    缝间距 d = ${panel.getValue<number>('slitSpacing')} mm<br>
    屏距 L = 1.0 m (标准值)<br>
    条纹间距 Δy = ${(realFringeSpacing * 1e3).toFixed(2)} mm<br>
    明纹条件: d·sinθ = nλ (n=0,±1,±2,...)<br>
    暗纹条件: d·sinθ = (n+½)λ
  `;
}

// ── Single slit diffraction (单缝衍射) ───────────────────────────────
function renderSingleSlit(ctx: CanvasRenderingContext2D): void {
  const a = panel.getValue<number>('slitWidth') * 1e-6; // μm to m
  const lambda = panel.getValue<number>('wavelength') * 1e-9; // nm to m
  const L = panel.getValue<number>('screenDist'); // m
  const color = wavelengthToColor(panel.getValue<number>('wavelength'));
  const [cr, cg, cb] = wavelengthToRGB(panel.getValue<number>('wavelength'));

  // Layout: slit on left, screen on right, intensity curve overlaid
  const slitX = -6;
  const screenX = 8;

  // Draw slit barrier
  ctx.fillStyle = '#475569';
  const [bx] = cm.toScreen(slitX, 0);
  const bw = 0.2 * cm.getScale();
  ctx.fillRect(bx - bw / 2, 0, bw, cm.getHeight());
  // Cut single slit opening -- visual width proportional to parameter (but clamped for visibility)
  const visualSlitH = Math.max(0.15, Math.min(1.5, a * 1e6 / 30)) * cm.getScale();
  const [, slitCy] = cm.toScreen(0, 0);
  ctx.fillStyle = '#070b14';
  ctx.fillRect(bx - bw / 2, slitCy - visualSlitH / 2, bw, visualSlitH);

  // Slit label
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`a = ${panel.getValue<number>('slitWidth')} μm`, bx, slitCy + visualSlitH / 2 + 18);

  // Light source
  cm.drawBall(-12, 0, 6, color, { label: '光源', glow: true });

  // Ray from source to slit
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(...cm.toScreen(-12, 0)); ctx.lineTo(...cm.toScreen(slitX, 0)); ctx.stroke();
  ctx.globalAlpha = 1;

  // Draw screen
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(...cm.toScreen(screenX, -7)); ctx.lineTo(...cm.toScreen(screenX, 7)); ctx.stroke();

  // Compute diffraction intensity pattern
  // I(θ) = I0 * (sin(β)/β)^2, β = π*a*sin(θ)/λ
  // First minima at sin(θ) = λ/a, angular half-width of central max
  // Central max width on screen = 2*λ*L/a, side maxima width = λ*L/a

  const numPoints = 400;
  const screenHalfWorld = 6; // world units for display

  // Compute all intensities first for normalization
  const intensities: number[] = [];
  const yPositions: number[] = [];
  for (let i = 0; i < numPoints; i++) {
    const yWorld = (i / (numPoints - 1) - 0.5) * 2 * screenHalfWorld;
    yPositions.push(yWorld);
    // Map world y to physical angle
    // We scale so the pattern is visible: physical screen position = yWorld * scaleFactor
    // Let's define: physical y on screen maps linearly from world coordinates
    const physicalY = yWorld * (L * lambda / (a * 0.5)); // scale so pattern is visible
    const sinTheta = physicalY / Math.sqrt(physicalY * physicalY + L * L);
    const beta = Math.PI * a * sinTheta / lambda;
    const intensity = Math.abs(beta) < 1e-10 ? 1.0 : (Math.sin(beta) / beta) ** 2;
    intensities.push(intensity);
  }

  // Draw color strip on screen
  for (let i = 0; i < numPoints - 1; i++) {
    const [sx, sy] = cm.toScreen(screenX + 0.2, yPositions[i]);
    const [, sy2] = cm.toScreen(screenX + 0.2, yPositions[i + 1]);
    const stripW = 1.2 * cm.getScale();
    const I = intensities[i];
    ctx.fillStyle = `rgba(${Math.floor(cr * 255)},${Math.floor(cg * 255)},${Math.floor(cb * 255)},${I * 0.9})`;
    ctx.fillRect(sx, Math.min(sy, sy2), stripW, Math.abs(sy2 - sy) + 1);
  }

  // Draw intensity curve next to screen
  const curveX0 = screenX + 2.5; // world x offset for the curve baseline
  const curveScale = 4; // world units for max intensity width
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < numPoints; i++) {
    const xWorld = curveX0 + intensities[i] * curveScale;
    const [px, py] = cm.toScreen(xWorld, yPositions[i]);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // Baseline for intensity curve
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(...cm.toScreen(curveX0, -screenHalfWorld));
  ctx.lineTo(...cm.toScreen(curveX0, screenHalfWorld));
  ctx.stroke();

  // Label: central maximum width annotation
  ctx.fillStyle = '#fbbf24';
  ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'left';
  const [labelX, labelY] = cm.toScreen(curveX0 + curveScale + 0.3, 0);
  ctx.fillText('I₀', labelX, labelY + 4);

  // Diverging rays from slit to screen (visual)
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.15;
  ctx.lineWidth = 1;
  for (let angle = -0.4; angle <= 0.4; angle += 0.08) {
    ctx.beginPath();
    ctx.moveTo(...cm.toScreen(slitX, 0));
    ctx.lineTo(...cm.toScreen(screenX, Math.tan(angle) * (screenX - slitX)));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Physical calculations for info panel
  const centralWidth = 2 * lambda * L / a; // full width of central maximum on screen
  const sideWidth = lambda * L / a; // width of each side maximum
  const firstMinAngle = Math.asin(Math.min(1, lambda / a)) * 180 / Math.PI;

  infoDiv.innerHTML = `
    <b>单缝衍射:</b> I = I₀(sinβ/β)², β = πa·sinθ/λ<br>
    缝宽 a = ${panel.getValue<number>('slitWidth')} μm<br>
    波长 λ = ${panel.getValue<number>('wavelength')} nm<br>
    屏距 L = ${L.toFixed(1)} m<br>
    中央明纹宽度 = ${(centralWidth * 1e3).toFixed(2)} mm<br>
    各级次纹宽度 = ${(sideWidth * 1e3).toFixed(2)} mm<br>
    首级暗纹角 θ₁ = ${firstMinAngle.toFixed(2)}°<br>
    <b>关键:</b> 缝越窄 → 衍射图样越宽 (中央明纹宽度 ∝ 1/a)
  `;
}

// ── Thin film interference (薄膜干涉) ────────────────────────────────
function renderThinFilm(ctx: CanvasRenderingContext2D): void {
  const mode = panel.getValue<string>('filmMode');
  if (mode === '楔形薄膜') {
    renderWedgeFilm(ctx);
  } else {
    renderNewtonRings(ctx);
  }
}

function renderWedgeFilm(ctx: CanvasRenderingContext2D): void {
  const lambdaNm = panel.getValue<number>('wavelength');
  const lambda = lambdaNm * 1e-9; // m
  const n = panel.getValue<number>('filmRefIdx');
  const alphaArcmin = panel.getValue<number>('wedgeAngle');
  const alpha = alphaArcmin / 60 * Math.PI / 180; // arcminutes to radians
  const color = wavelengthToColor(lambdaNm);
  const [cr, cg, cb] = wavelengthToRGB(lambdaNm);

  // Fringe spacing: Δx = λ / (2 * n * tan(α)) ≈ λ / (2 * n * α) for small angles
  const fringeSpacing = lambda / (2 * n * Math.tan(alpha)); // in meters

  // Top-down view of wedge film with equal-thickness fringes (parallel straight lines)
  // We render a rectangular region representing the top-down view of the thin film

  const viewLeft = -12;
  const viewRight = 12;
  const viewTop = 6;
  const viewBottom = -6;

  // Background: dark glass surface
  ctx.fillStyle = '#1a1a2e';
  const [vx1, vy1] = cm.toScreen(viewLeft, viewTop);
  const [vx2, vy2] = cm.toScreen(viewRight, viewBottom);
  ctx.fillRect(vx1, vy1, vx2 - vx1, vy2 - vy1);

  // Draw equal-thickness fringes as vertical lines
  // Map physical fringe spacing to world units for visualization
  // We want to show a reasonable number of fringes (say 5-30 visible)
  const viewWidthWorld = viewRight - viewLeft;
  // Number of fringes we want visible determines the mapping
  const targetFringes = Math.max(3, Math.min(40, viewWidthWorld * 2));
  const worldFringeSpacing = viewWidthWorld / targetFringes;

  // Thickness increases from left to right: at position x, thickness t(x) = (x - viewLeft) * tan(α)
  // Dark fringes (destructive): 2*n*t = k*λ  (with half-wave phase shift at one surface)
  // Actually: 2*n*t = (k + 1/2)*λ for bright fringes (when there's a half-wave loss)
  // and 2*n*t = k*λ for dark fringes.
  // The x-position of the k-th dark fringe: x_k such that t(x_k) = k*λ/(2n)
  // x_k = k * λ/(2*n*tan(α)) = k * fringeSpacing (from the thin edge)

  // Render pixel by pixel (column by column)
  const pxWidth = vx2 - vx1;
  const pxHeight = vy2 - vy1;
  const colWidth = Math.max(1, Math.floor(pxWidth / 300));
  for (let px = 0; px < pxWidth; px += colWidth) {
    // Map pixel x to physical distance from thin edge
    const frac = px / pxWidth;
    // Optical path difference at this x: OPD = 2*n*t = 2*n * (frac * viewWidthWorld * someScale) * tan(alpha)
    // For visualization, we use: phase = 2π * frac * targetFringes
    const phase = 2 * Math.PI * frac * targetFringes;
    // Intensity: for equal-inclination fringes with half-wave shift
    // I = I0 * cos²(phase/2) -- simplified two-beam interference
    const intensity = Math.cos(phase / 2) ** 2;

    ctx.fillStyle = `rgba(${Math.floor(cr * 255 * intensity)},${Math.floor(cg * 255 * intensity)},${Math.floor(cb * 255 * intensity)},0.9)`;
    ctx.fillRect(vx1 + px, vy1, colWidth, pxHeight);
  }

  // Border around the view
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;
  ctx.strokeRect(vx1, vy1, vx2 - vx1, vy2 - vy1);

  // Labels
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('薄 (thin edge)', ...cm.toScreen(viewLeft + 2, viewBottom - 0.8) as [number, number]);
  ctx.fillText('厚 (thick edge)', ...cm.toScreen(viewRight - 2, viewBottom - 0.8) as [number, number]);
  ctx.fillText('楔形薄膜 — 等厚干涉 (俯视图)', ...cm.toScreen(0, viewTop + 1) as [number, number]);

  // Arrow indicating thickness direction
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1.5;
  const [arrX1, arrY1] = cm.toScreen(viewLeft + 1, viewBottom - 1.5);
  const [arrX2, arrY2] = cm.toScreen(viewRight - 1, viewBottom - 1.5);
  ctx.beginPath(); ctx.moveTo(arrX1, arrY1); ctx.lineTo(arrX2, arrY2); ctx.stroke();
  drawArrow(ctx, arrX1, arrY1, arrX2, arrY2, 'rgba(255,255,255,0.5)');
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('厚度增加方向', ...cm.toScreen(0, viewBottom - 2) as [number, number]);

  infoDiv.innerHTML = `
    <b>楔形薄膜 — 等厚干涉:</b><br>
    条纹间距 Δx = λ/(2n·tanα)<br>
    波长 λ = ${lambdaNm} nm<br>
    薄膜折射率 n = ${n.toFixed(2)}<br>
    楔角 α = ${alphaArcmin}′ = ${(alphaArcmin / 60).toFixed(3)}°<br>
    条纹间距 Δx = ${(fringeSpacing * 1e3).toFixed(3)} mm<br>
    <b>特征:</b> 平行等间距直条纹，楔棱处为暗纹 (半波损失)
  `;
}

function renderNewtonRings(ctx: CanvasRenderingContext2D): void {
  const lambdaNm = panel.getValue<number>('wavelength');
  const lambda = lambdaNm * 1e-9; // m
  const R = panel.getValue<number>('newtonR'); // m
  const [cr, cg, cb] = wavelengthToRGB(lambdaNm);

  // Newton's rings: concentric rings seen from top-down view
  // Dark ring radius: r_k = sqrt(k * λ * R), k = 0, 1, 2, ...
  // Bright ring radius: r_k = sqrt((k + 1/2) * λ * R)

  // Render as concentric rings in a circular viewport
  const viewRadius = 7; // world units
  const [cx, cy] = cm.toScreen(0, 0);
  const pxRadius = viewRadius * cm.getScale();

  // Clip to circle
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, pxRadius, 0, Math.PI * 2);
  ctx.clip();

  // Fill background
  ctx.fillStyle = '#070b14';
  ctx.fillRect(cx - pxRadius, cy - pxRadius, 2 * pxRadius, 2 * pxRadius);

  // Render pixel by pixel in radial direction
  // For each radius r (world), compute the air gap thickness: t(r) = r²/(2R)
  // OPD = 2*t + λ/2 (half-wave phase shift at glass-air interface)
  // Dark rings: 2t = kλ => r_k = sqrt(kλR)
  // Intensity: I = cos²(π * OPD / λ) = cos²(π * (2t/λ + 1/2)) = sin²(π * r²/(λR))
  const numRings = 300; // radial resolution
  for (let i = numRings; i >= 0; i--) {
    const rFrac = i / numRings;
    const rWorld = rFrac * viewRadius;
    const rPx = rFrac * pxRadius;

    // Physical radius: map world radius to a physical scale that shows enough rings
    // We want to show about 15-25 rings. r_k = sqrt(k*lambda*R), so k_max rings in radius r_max:
    // k_max = r_max^2/(lambda*R). We pick r_max such that we see ~20 rings.
    const targetMaxK = 20;
    const physicalRmax = Math.sqrt(targetMaxK * lambda * R);
    const physR = rWorld / viewRadius * physicalRmax;

    // Air gap thickness
    const t = physR * physR / (2 * R);
    // OPD = 2t; half-wave loss at glass-air boundary → center is dark
    // Intensity: I = sin²(π·2t/λ) — dark when 2t = kλ (k=0,1,2,...)
    const phase = 2 * Math.PI * t / lambda; // = π·(2t/λ)
    const intensity = Math.sin(phase) ** 2;

    ctx.fillStyle = `rgb(${Math.floor(cr * 255 * intensity)},${Math.floor(cg * 255 * intensity)},${Math.floor(cb * 255 * intensity)})`;
    ctx.beginPath();
    ctx.arc(cx, cy, rPx + 1, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  // Circle border
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, pxRadius, 0, Math.PI * 2);
  ctx.stroke();

  // Title
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('牛顿环 (俯视图)', ...cm.toScreen(0, viewRadius + 1.2) as [number, number]);

  // Center label
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('接触点', cx, cy + pxRadius + 15);

  // Compute ring radii for info display
  const r1 = Math.sqrt(1 * lambda * R);
  const r2 = Math.sqrt(2 * lambda * R);
  const r3 = Math.sqrt(3 * lambda * R);

  infoDiv.innerHTML = `
    <b>牛顿环:</b> 平凸透镜与平面玻璃间的空气薄膜干涉<br>
    暗环半径: r<sub>k</sub> = √(kλR)<br>
    波长 λ = ${lambdaNm} nm<br>
    透镜曲率半径 R = ${R.toFixed(1)} m<br>
    第1级暗环 r₁ = ${(r1 * 1e3).toFixed(3)} mm<br>
    第2级暗环 r₂ = ${(r2 * 1e3).toFixed(3)} mm<br>
    第3级暗环 r₃ = ${(r3 * 1e3).toFixed(3)} mm<br>
    <b>特征:</b> 中心为暗斑 (接触点处半波损失)，环间距向外递减
  `;
}

// ── Drawing utilities ─────────────────────────────────────────────────
function drawArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string): void {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLen = 10;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headLen * Math.cos(angle - 0.4), y2 - headLen * Math.sin(angle - 0.4));
  ctx.lineTo(x2 - headLen * Math.cos(angle + 0.4), y2 - headLen * Math.sin(angle + 0.4));
  ctx.closePath();
  ctx.fill();
}

function drawAngleArc(ctx: CanvasRenderingContext2D, wx: number, wy: number, angle: number, color: string, label: string, upper: boolean): void {
  const [cx, cy] = cm.toScreen(wx, wy);
  const r = 35;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (upper) {
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + angle);
  } else {
    ctx.arc(cx, cy, r, Math.PI / 2 - angle, Math.PI / 2);
  }
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'left';
  const labelAngle = upper ? -Math.PI / 2 + angle / 2 : Math.PI / 2 - angle / 2;
  const lx = cx + (r + 12) * Math.cos(labelAngle);
  const ly = cy + (r + 12) * Math.sin(labelAngle);
  ctx.fillText(`${label} ${(angle * 180 / Math.PI).toFixed(1)}°`, lx, ly);
}

// ── Animation loop with photon particles ─────────────────────────────

let animTime = 0;
let lastFrameTime = 0;

interface Photon {
  x1: number; y1: number; x2: number; y2: number;
  color: string; speed: number; phase: number;
}

function getPhotons(): Photon[] {
  const scene = panel.getValue<string>('scene');
  const photons: Photon[] = [];

  if (scene === '折射定律' || scene === '全反射') {
    const n1 = panel.getValue<number>('n1');
    const n2 = panel.getValue<number>('n2');
    const thetaI = panel.getValue<number>('incidentAngle') * Math.PI / 180;
    const rayLen = 7;

    // Incident photons
    const ix = -rayLen * Math.sin(thetaI);
    const iy = rayLen * Math.cos(thetaI);
    for (let i = 0; i < 5; i++) {
      photons.push({ x1: ix, y1: iy, x2: 0, y2: 0, color: '#fbbf24', speed: 1.2, phase: i / 5 });
    }

    // Reflected photons
    const refX = rayLen * Math.sin(thetaI);
    const refY = rayLen * Math.cos(thetaI);
    const sinTheta2 = n1 * Math.sin(thetaI) / n2;
    const isTR = Math.abs(sinTheta2) > 1;
    for (let i = 0; i < (isTR ? 5 : 2); i++) {
      photons.push({ x1: 0, y1: 0, x2: refX, y2: refY, color: '#f87171', speed: 1.2, phase: i / 5 });
    }

    // Refracted photons
    if (!isTR) {
      const theta2 = Math.asin(sinTheta2);
      const tx = rayLen * Math.sin(theta2);
      const ty = -rayLen * Math.cos(theta2);
      for (let i = 0; i < 4; i++) {
        photons.push({ x1: 0, y1: 0, x2: tx, y2: ty, color: '#4ade80', speed: 0.9, phase: i / 4 });
      }
    }
  } else if (scene === '薄透镜成像' || scene === '凹透镜成像') {
    // Photons along the three characteristic rays
    // We'll just animate generic leftward photons since the exact rays depend on rendering
    const isConvex = scene === '薄透镜成像';
    const f = isConvex ? panel.getValue<number>('focalLength') : -panel.getValue<number>('concaveFocal');
    const u = isConvex ? panel.getValue<number>('objectDist') : panel.getValue<number>('concaveObjDist');
    const objH = 2;

    // Parallel to axis ray
    for (let i = 0; i < 3; i++) {
      photons.push({ x1: -u, y1: objH, x2: 0, y2: objH, color: '#f87171', speed: 1.0, phase: i / 3 });
    }
    // Through center ray
    for (let i = 0; i < 3; i++) {
      photons.push({ x1: -u, y1: objH, x2: 0, y2: 0, color: '#4ade80', speed: 1.0, phase: i / 3 });
    }
  } else if (scene === '双缝干涉') {
    const wl = panel.getValue<number>('wavelength');
    const color = wavelengthToColor(wl);
    // Photons from source to slits
    for (let i = 0; i < 6; i++) {
      photons.push({ x1: -10, y1: 0, x2: -3, y2: 0.3, color, speed: 1.5, phase: i / 6 });
      photons.push({ x1: -10, y1: 0, x2: -3, y2: -0.3, color, speed: 1.5, phase: (i + 0.5) / 6 });
    }
  }

  return photons;
}

function drawPhotons(ctx: CanvasRenderingContext2D): void {
  const photons = getPhotons();

  for (const p of photons) {
    const t = ((animTime * p.speed + p.phase) % 1);
    const wx = p.x1 + (p.x2 - p.x1) * t;
    const wy = p.y1 + (p.y2 - p.y1) * t;
    const [sx, sy] = cm.toScreen(wx, wy);

    // Glowing photon dot
    ctx.save();
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 8;
    ctx.fillStyle = p.color;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(sx, sy, 3, 0, Math.PI * 2);
    ctx.fill();

    // Trailing glow
    const trail = 0.06;
    for (let j = 1; j <= 3; j++) {
      const tt = t - j * trail;
      if (tt < 0) continue;
      const twx = p.x1 + (p.x2 - p.x1) * tt;
      const twy = p.y1 + (p.y2 - p.y1) * tt;
      const [tsx, tsy] = cm.toScreen(twx, twy);
      ctx.globalAlpha = 0.3 - j * 0.08;
      ctx.beginPath();
      ctx.arc(tsx, tsy, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function animatedRender(now: number): void {
  const dt = (now - lastFrameTime) / 1000;
  lastFrameTime = now;
  animTime = (animTime + dt * 0.4) % 100;

  render();
  drawPhotons(cm.ctx);

  requestAnimationFrame(animatedRender);
}

panel.setOnChange(() => {}); // render is called by animLoop
requestAnimationFrame((now) => {
  lastFrameTime = now;
  animatedRender(now);
});

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
