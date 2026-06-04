/**
 * SnellWindowCanvas.tsx
 * React component for the Snell's Window 3D scene (opt-006, shape='snellwindow').
 *
 * Reads settings from useSimulationStore, creates a SnellSceneManager on mount,
 * and rebuilds the scene whenever relevant settings change.
 *
 * Ported from phys_template_p03/src/module-refraction-3d.tsx (lines 197-447).
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useSimulationStore } from '@/store/simulationStore';
import { SnellSceneManager } from './three/SnellSceneManager';
import { sourceSamplePoints, sourceOuterPoints } from '@/engine/snellWindowSolver';
import type { SnellSourceShape } from '@/data/refractionData';

// ---------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------

const COL_GREEN = 0x44cc88;
const COL_BLUE = 0x5599dd;
const COL_RAY_UW = 0x556677;
const COL_NORMAL = 0x99aabb;
const WATER_COLOR = 0xd4eaf7;

// ---------------------------------------------------------------------------
// Text sprite helper
// ---------------------------------------------------------------------------

function makeTextSprite(text: string, color: string = '#333'): THREE.Sprite {
  const dpr = Math.max(devicePixelRatio, 2);
  const baseW = 512;
  const baseH = 128;
  const canvas = document.createElement('canvas');
  canvas.width = baseW * dpr;
  canvas.height = baseH * dpr;
  const c = canvas.getContext('2d')!;
  c.scale(dpr, dpr);
  c.font = 'bold 42px system-ui, -apple-system, sans-serif';
  c.fillStyle = color;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text, baseW / 2, baseH / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(4.8, 1.2, 1);
  return sprite;
}

// ---------------------------------------------------------------------------
// Geometry helpers (ported verbatim from old module)
// ---------------------------------------------------------------------------

function buildArc(
  center: THREE.Vector3,
  fromDir: THREE.Vector3,
  toDir: THREE.Vector3,
  radius: number,
  color: number,
): THREE.Line {
  const a = fromDir.clone().normalize();
  const b = toDir.clone().normalize();
  const angle = Math.acos(Math.min(1, Math.max(-1, a.dot(b))));
  const axis = new THREE.Vector3().crossVectors(a, b);
  if (axis.length() < 0.001) {
    return new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([center]),
      new THREE.LineBasicMaterial({ color }),
    );
  }
  axis.normalize();
  const pts: THREE.Vector3[] = [];
  const segs = 32;
  for (let i = 0; i <= segs; i++) {
    const t = (i / segs) * angle;
    const dir = a.clone().applyAxisAngle(axis, t);
    pts.push(center.clone().add(dir.multiplyScalar(radius)));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  return new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 }));
}

function addArrowHead(
  group: THREE.Group,
  from: THREE.Vector3,
  to: THREE.Vector3,
  color: number,
  t = 0.55,
): void {
  const dir = to.clone().sub(from).normalize();
  const pos = from.clone().lerp(to, t);
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.45, 8),
    new THREE.MeshPhongMaterial({ color }),
  );
  cone.position.copy(pos);
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  cone.quaternion.copy(quat);
  group.add(cone);
}

function makeDashedLine(
  pts: THREE.Vector3[],
  color: number,
  opacity: number,
  dash: number,
  gap: number,
): THREE.Line {
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineDashedMaterial({ color, transparent: true, opacity, dashSize: dash, gapSize: gap });
  const line = new THREE.Line(geo, mat);
  line.computeLineDistances();
  return line;
}

function makeCircleLine(radius: number, color: number, opacity: number): THREE.Group {
  const pts: THREE.Vector3[] = [];
  const segs = 96;
  for (let i = 0; i <= segs; i++) {
    const a = (Math.PI * 2 * i) / segs;
    pts.push(new THREE.Vector3(Math.cos(a) * radius, 0.08, Math.sin(a) * radius));
  }
  const group = new THREE.Group();
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  group.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity })));
  const tube = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.06, 6, 96),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: opacity * 0.7 }),
  );
  tube.rotation.x = Math.PI / 2;
  tube.position.y = 0.08;
  group.add(tube);
  return group;
}

function addRayLine(
  group: THREE.Group,
  from: THREE.Vector3,
  to: THREE.Vector3,
  color: number,
  opacity: number,
  dashed = false,
): void {
  const line = dashed
    ? makeDashedLine([from, to], color, opacity, 0.35, 0.22)
    : new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([from, to]),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
      );
  group.add(line);
  if (!dashed) addArrowHead(group, from, to, color, 0.62);
}

function addWindowPatch(
  group: THREE.Group,
  sourcePoints: THREE.Vector3[],
  radius: number,
): void {
  if (sourcePoints.length <= 1) return;
  const mat = new THREE.MeshBasicMaterial({
    color: COL_GREEN,
    transparent: true,
    opacity: 0.055,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  sourcePoints.forEach((pt) => {
    const disk = new THREE.Mesh(new THREE.CircleGeometry(radius, 64), mat);
    disk.rotation.x = -Math.PI / 2;
    disk.position.set(pt.x, 0.06, pt.z);
    group.add(disk);
  });
}

// ---------------------------------------------------------------------------
// buildScene  — clears `dyn` and rebuilds all 3D objects
// ---------------------------------------------------------------------------

interface SceneParams {
  depth: number;
  waterN: number;
  incidentAngleDeg: number;
  sourceShape: SnellSourceShape;
  sourceSize: number;
  polygonSides: number;
  lineSamples: number;
}

function buildScene(dyn: THREE.Group, p: SceneParams): void {
  SnellSceneManager.disposeGroup(dyn);

  const { depth, waterN, incidentAngleDeg, sourceShape, sourceSize, polygonSides, lineSamples } = p;
  const incRad = Math.max(0.01, incidentAngleDeg * (Math.PI / 180));
  const critAngle = Math.asin(Math.min(1, 1 / waterN));
  const critDeg = critAngle * (180 / Math.PI);
  const windowR = depth * Math.tan(critAngle);

  const samples = sourceSamplePoints(sourceShape, sourceSize, polygonSides, depth, lineSamples);
  const outerSamples = sourceOuterPoints(sourceShape, sourceSize, polygonSides, depth);

  const axisTop = 10;
  const axisBot = -(depth + 4);
  const surfHalf = 18;

  // ── 1. Environment ──────────────────────────────────────────────────────

  // Water surface fill (subtle)
  const surf = new THREE.Mesh(
    new THREE.PlaneGeometry(50, 50),
    new THREE.MeshPhongMaterial({ color: 0x88bbdd, transparent: true, opacity: 0.05, side: THREE.DoubleSide }),
  );
  surf.rotation.x = -Math.PI / 2;
  surf.position.y = 0.01;
  dyn.add(surf);

  // Water volume (light blue)
  const waterH = depth + 6;
  const water = new THREE.Mesh(
    new THREE.BoxGeometry(50, waterH, 50),
    new THREE.MeshPhongMaterial({ color: WATER_COLOR, transparent: true, opacity: 0.12, side: THREE.BackSide }),
  );
  water.position.y = -waterH / 2;
  dyn.add(water);

  // Grid on surface
  const grid = new THREE.GridHelper(30, 15, 0xd0d8e0, 0xe4eaef);
  grid.position.y = 0.02;
  dyn.add(grid);

  // ── 2. Interface line (horizontal) ──────────────────────────────────────

  const ifGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-surfHalf, 0, 0),
    new THREE.Vector3(surfHalf, 0, 0),
  ]);
  dyn.add(new THREE.Line(ifGeo, new THREE.LineBasicMaterial({ color: 0x6699bb, transparent: true, opacity: 0.6 })));
  const ifLabel = makeTextSprite('界面', '#6699bb');
  ifLabel.position.set(surfHalf + 2, 0, 0);
  dyn.add(ifLabel);

  // ── 3. Central vertical axis (dashed) ───────────────────────────────────

  dyn.add(
    makeDashedLine(
      [new THREE.Vector3(0, axisBot, 0), new THREE.Vector3(0, axisTop, 0)],
      0x99aabb,
      0.45,
      0.4,
      0.25,
    ),
  );

  // ── 4. Medium labels ────────────────────────────────────────────────────

  const airLabel = makeTextSprite('空气 n₁ = 1', '#88aabb');
  airLabel.position.set(-surfHalf + 2, 4, 0);
  dyn.add(airLabel);

  const waterLabel = makeTextSprite(`水 n₂ = ${waterN.toFixed(2)}`, '#5588aa');
  waterLabel.position.set(-surfHalf + 2, -2.5, 0);
  dyn.add(waterLabel);

  // ── 5. Source shape ─────────────────────────────────────────────────────

  const srcPos = new THREE.Vector3(0, -depth, 0);
  const srcMat = new THREE.MeshPhongMaterial({
    color: COL_GREEN,
    emissive: COL_GREEN,
    emissiveIntensity: 0.35,
    transparent: true,
    opacity: 0.88,
  });

  if (sourceShape === 'line') {
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-sourceSize / 2, -depth, 0),
      new THREE.Vector3(sourceSize / 2, -depth, 0),
    ]);
    dyn.add(new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: COL_GREEN, transparent: true, opacity: 0.95 })));
    samples.forEach((pt) => {
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), srcMat);
      bead.position.copy(pt);
      dyn.add(bead);
    });
  } else if (sourceShape === 'polygon') {
    const vertices: THREE.Vector3[] = [];
    for (let i = 1; i < samples.length; i++) vertices.push(samples[i]);
    vertices.push(samples[1]);
    dyn.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(vertices),
        new THREE.LineBasicMaterial({ color: COL_GREEN, transparent: true, opacity: 0.95 }),
      ),
    );
    const fillShape = new THREE.Shape();
    vertices.slice(0, -1).forEach((pt, index) => {
      if (index === 0) fillShape.moveTo(pt.x, pt.z);
      else fillShape.lineTo(pt.x, pt.z);
    });
    const fill = new THREE.Mesh(
      new THREE.ShapeGeometry(fillShape),
      new THREE.MeshPhongMaterial({ color: COL_GREEN, transparent: true, opacity: 0.14, side: THREE.DoubleSide }),
    );
    fill.rotation.x = -Math.PI / 2;
    fill.position.y = -depth;
    dyn.add(fill);
    samples.forEach((pt, index) => {
      const bead = new THREE.Mesh(new THREE.SphereGeometry(index === 0 ? 0.16 : 0.1, 10, 10), srcMat);
      bead.position.copy(pt);
      dyn.add(bead);
    });
  } else {
    // point source
    const srcMesh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), srcMat);
    srcMesh.position.copy(srcPos);
    dyn.add(srcMesh);
  }

  const srcLabel = makeTextSprite(
    sourceShape === 'line' ? '线光源' : sourceShape === 'polygon' ? '多边形光源' : '点光源',
    '#44aa77',
  );
  srcLabel.position.set(sourceSize / 2 + 1.5, -depth, 0);
  dyn.add(srcLabel);

  // ── 6. Rays from sampled emitters ───────────────────────────────────────

  const hitX = depth * Math.tan(incRad);
  const sampleOpacity = sourceShape === 'point' ? 1 : 0.34;
  const refractionOpacity = sourceShape === 'point' ? 1 : 0.38;

  samples.forEach((sample, index) => {
    const isMain = index === 0;
    const opacity = isMain ? 1 : sampleOpacity;

    // Incident ray (underwater)
    const hitPtForSample = sample.clone().add(new THREE.Vector3(hitX, depth, 0));
    addRayLine(dyn, sample, hitPtForSample, COL_RAY_UW, opacity);

    // Refracted ray (above surface)
    const sinR = Math.sin(incRad) * waterN;
    if (sinR <= 1) {
      const refractedAngle = Math.asin(sinR);
      const refDir = new THREE.Vector3(Math.sin(refractedAngle), Math.cos(refractedAngle), 0);
      addRayLine(
        dyn,
        hitPtForSample,
        hitPtForSample.clone().add(refDir.multiplyScalar(isMain ? 14 : 8)),
        COL_GREEN,
        isMain ? 1 : refractionOpacity,
      );
    }

    // Critical-angle ray (dashed yellow)
    const critHitPtForSample = sample.clone().add(new THREE.Vector3(windowR, depth, 0));
    addRayLine(dyn, sample, critHitPtForSample, 0xddaa44, isMain ? 0.45 : 0.22, true);

    // TIR ray
    const tirAngle = Math.min(Math.PI / 2 - 0.02, critAngle + (Math.PI / 2 - critAngle) * 0.48);
    const tirHit = sample.clone().add(new THREE.Vector3(depth * Math.tan(tirAngle), depth, 0));
    const reflDir = new THREE.Vector3(Math.sin(tirAngle), -Math.cos(tirAngle), 0);
    addRayLine(dyn, sample, tirHit, COL_BLUE, isMain ? 0.5 : 0.18, true);
    addRayLine(
      dyn,
      tirHit,
      tirHit.clone().add(reflDir.multiplyScalar(isMain ? Math.max(6, depth * 0.7) : 5)),
      COL_BLUE,
      isMain ? 0.5 : 0.18,
      true,
    );
  });

  const hitPt = new THREE.Vector3(hitX, 0, 0);

  // Hit point marker
  const hitMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 12, 12),
    new THREE.MeshPhongMaterial({ color: 0x445566 }),
  );
  hitMesh.position.copy(hitPt);
  dyn.add(hitMesh);

  // ── 7. Normal at hit point (dashed) ─────────────────────────────────────

  const nLen = 5;
  dyn.add(
    makeDashedLine(
      [hitPt.clone().add(new THREE.Vector3(0, -nLen, 0)), hitPt.clone().add(new THREE.Vector3(0, nLen, 0))],
      COL_NORMAL,
      0.5,
      0.3,
      0.2,
    ),
  );

  // ── 8. Angle arcs + labels ──────────────────────────────────────────────

  const toSource = srcPos.clone().sub(hitPt).normalize();
  const normalDown = new THREE.Vector3(0, -1, 0);
  dyn.add(buildArc(hitPt, normalDown, toSource, 1.6, COL_RAY_UW));
  const arcMidDir = normalDown.clone().add(toSource).normalize();
  const t1Label = makeTextSprite(`θ₁ = ${incidentAngleDeg.toFixed(0)}°`, '#556677');
  t1Label.position.copy(hitPt).add(arcMidDir.multiplyScalar(2.8));
  dyn.add(t1Label);

  // ── 9. Main ray refraction or TIR labels ────────────────────────────────

  const sinR = Math.sin(incRad) * waterN;
  const isTIR = sinR > 1;

  if (!isTIR) {
    const refractedAngle = Math.asin(sinR);
    const refDir = new THREE.Vector3(Math.sin(refractedAngle), Math.cos(refractedAngle), 0);

    const normalUp = new THREE.Vector3(0, 1, 0);
    dyn.add(buildArc(hitPt, normalUp, refDir.clone().normalize(), 2.2, COL_GREEN));
    const refArcMid = normalUp.clone().add(refDir.clone().normalize()).normalize();
    const t2Label = makeTextSprite(`θ₂ = ${(refractedAngle * (180 / Math.PI)).toFixed(1)}°`, '#33aa77');
    t2Label.position.copy(hitPt).add(refArcMid.multiplyScalar(3.5));
    dyn.add(t2Label);
  } else {
    const tirLabel = makeTextSprite('全反射 TIR', '#5599dd');
    tirLabel.position.copy(hitPt).add(new THREE.Vector3(2, -2, 0));
    dyn.add(tirLabel);
  }

  // ── 10. Critical angle reference label ──────────────────────────────────

  const critHitX = depth * Math.tan(critAngle);
  const critHitPt = new THREE.Vector3(critHitX, 0, 0);
  const critRefLabel = makeTextSprite(`θc = ${critDeg.toFixed(1)}°`, '#bb8833');
  critRefLabel.position.copy(critHitPt).add(new THREE.Vector3(0, -1.5, 0));
  dyn.add(critRefLabel);

  // ── 11. Snell's window ring ─────────────────────────────────────────────

  addWindowPatch(dyn, outerSamples, windowR);

  if (samples.length > 1) {
    samples.forEach((pt, index) => {
      const ring = makeCircleLine(windowR, COL_GREEN, index === 0 ? 0.7 : 0.35);
      ring.position.set(pt.x, 0, pt.z);
      dyn.add(ring);
    });
  }

  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(windowR, 0.05, 8, 64),
    new THREE.MeshPhongMaterial({
      color: COL_GREEN,
      transparent: true,
      opacity: 0.45,
      emissive: COL_GREEN,
      emissiveIntensity: 0.12,
    }),
  );
  torus.rotation.x = Math.PI / 2;
  torus.position.y = 0.05;
  dyn.add(torus);

  // Critical cone(s)
  const coneMat = new THREE.MeshPhongMaterial({
    color: COL_GREEN,
    transparent: true,
    opacity: sourceShape === 'point' ? 0.09 : 0.04,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const coneSources = sourceShape === 'point' ? [srcPos] : samples;
  coneSources.forEach((pt) => {
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(windowR, depth, 32, 1, true),
      coneMat,
    );
    cone.rotation.x = Math.PI;
    cone.position.set(pt.x, -depth / 2, pt.z);
    dyn.add(cone);
  });

  // Window radius dimension line (on surface, from center to ring)
  const rLineGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0.08, 0),
    new THREE.Vector3(windowR, 0.08, 0),
  ]);
  dyn.add(new THREE.Line(rLineGeo, new THREE.LineBasicMaterial({ color: 0x44aa77, transparent: true, opacity: 0.5 })));
  const wLabel = makeTextSprite(`r = ${windowR.toFixed(1)} cm`, '#44aa77');
  wLabel.position.set(windowR / 2, 1.2, 0);
  dyn.add(wLabel);

  // Depth dimension line (vertical, from source to surface at x offset)
  const dimX = -3;
  const dimTopPt = new THREE.Vector3(dimX, 0, 0);
  const dimBotPt = new THREE.Vector3(dimX, -depth, 0);
  dyn.add(makeDashedLine([dimBotPt, dimTopPt], 0x88aabb, 0.4, 0.25, 0.15));

  // Tick marks
  const tickW = 0.4;
  const tickTopGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(dimX - tickW, 0, 0),
    new THREE.Vector3(dimX + tickW, 0, 0),
  ]);
  dyn.add(new THREE.Line(tickTopGeo, new THREE.LineBasicMaterial({ color: 0x88aabb, transparent: true, opacity: 0.5 })));
  const tickBotGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(dimX - tickW, -depth, 0),
    new THREE.Vector3(dimX + tickW, -depth, 0),
  ]);
  dyn.add(new THREE.Line(tickBotGeo, new THREE.LineBasicMaterial({ color: 0x88aabb, transparent: true, opacity: 0.5 })));
  const depthLabel = makeTextSprite(`h = ${depth} cm`, '#6688aa');
  depthLabel.position.set(dimX - 2.5, -depth / 2, 0);
  dyn.add(depthLabel);
}

// ---------------------------------------------------------------------------
// React component
// ---------------------------------------------------------------------------

export function SnellWindowCanvas() {
  const settings = useSimulationStore((s) => s.settings);
  const containerRef = useRef<HTMLDivElement>(null);
  const mgrRef = useRef<SnellSceneManager | null>(null);
  const prevViewRef = useRef<string>(settings.snellViewMode);

  // Mount / unmount
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const mgr = new SnellSceneManager(el);
    mgrRef.current = mgr;

    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      mgr.resize(w, h);
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      mgr.dispose();
      mgrRef.current = null;
    };
  }, []);

  // Rebuild scene on settings change
  useEffect(() => {
    const mgr = mgrRef.current;
    if (!mgr) return;

    const depth = settings.snellSourceDepthCm;
    const waterN = settings.snellWaterN;
    const incidentAngleDeg = settings.snellIncidentAngleDeg;
    const sourceShape: SnellSourceShape = settings.snellSourceShape ?? 'point';
    const sourceSize = Math.max(1, settings.snellSourceSizeCm ?? 4);
    const polygonSides = Math.round(Math.min(8, Math.max(3, settings.snellPolygonSides ?? 5)));
    const lineSamples = Math.round(settings.snellLineSampleCount ?? 7);

    buildScene(mgr.dyn, {
      depth,
      waterN,
      incidentAngleDeg,
      sourceShape,
      sourceSize,
      polygonSides,
      lineSamples,
    });

    // Update camera only when view mode actually changes
    if (settings.snellViewMode !== prevViewRef.current) {
      prevViewRef.current = settings.snellViewMode;
      mgr.setCameraView(settings.snellViewMode, depth);
    }
  }, [
    settings.snellSourceDepthCm,
    settings.snellWaterN,
    settings.snellIncidentAngleDeg,
    settings.snellViewMode,
    settings.snellSourceShape,
    settings.snellSourceSizeCm,
    settings.snellPolygonSides,
    settings.snellLineSampleCount,
    settings.wavelength,
    settings.showColor,
  ]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
    </div>
  );
}
