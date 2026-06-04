import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { useSimulationStore } from '@/store/simulationStore';
import { solveInterface } from '@/engine/refractionSolver';
import { wavelengthToColor } from '@/lib/utils/wavelengthToColor';
import { SnellSceneManager } from './three/SnellSceneManager';
import type { Point } from '@/data/refractionData';

const SCALE = 0.05;
const CX = 500;
const MAX_LEN = 30;

function p2v(p: Point, iy: number): THREE.Vector3 {
  return new THREE.Vector3((p.x - CX) * SCALE, -(p.y - iy) * SCALE, 0);
}

function clampLen(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3 {
  const dir = to.clone().sub(from);
  const len = Math.min(dir.length(), MAX_LEN);
  return from.clone().add(dir.normalize().multiplyScalar(len));
}

function makeLabel(text: string, color = 'rgba(255,255,255,0.8)', fontSize = 13): CSS2DObject {
  const div = document.createElement('div');
  div.textContent = text;
  div.style.cssText = `color:${color};font-size:${fontSize}px;font-family:Inter,system-ui,sans-serif;pointer-events:none;text-shadow:0 1px 4px rgba(0,0,0,0.9)`;
  return new CSS2DObject(div);
}

// ── Laser pen ───────────────────────────────────────────────────────
function createLaserPen(): THREE.Group {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.13, 2.2, 12),
    new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.85, roughness: 0.2 }),
  ));
  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(0.19, 0.19, 0.1, 12),
    new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.9, roughness: 0.1 }),
  );
  ring.position.y = 0.95;
  g.add(ring);
  const tip = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0x44ff88, toneMapped: false }),
  );
  tip.name = 'tip';
  tip.position.y = 1.15;
  g.add(tip);
  return g;
}

// ── Persistent scene objects (created once, updated by reference) ────
interface Objs {
  medium: THREE.Mesh;
  medMat: THREE.MeshPhysicalMaterial;
  laserPen: THREE.Group;
  tipMat: THREE.MeshBasicMaterial;
  // 3 rays: each has a Line and a Cone arrow
  incLine: THREE.Line; incArrow: THREE.Mesh;
  refrLine: THREE.Line; refrArrow: THREE.Mesh;
  reflLine: THREE.Line; reflArrow: THREE.Mesh;
  normalLine: THREE.Line;
  hitDot: THREE.Mesh;
  hitGlow: THREE.Mesh;
  labelGroup: THREE.Group;
}

function makeLine(color: number, opacity: number): THREE.Line {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
  return new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
}

function makeArrow(color: number, opacity: number): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 0.65, 6),
    new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: true, opacity }),
  );
}

function createObjs(dyn: THREE.Group): Objs {
  // Grid — bright enough to see
  const grid = new THREE.GridHelper(50, 25, 0x3a6a5a, 0x1e3530);
  grid.position.y = 0.02;
  (grid.material as THREE.Material).opacity = 0.5;
  (grid.material as THREE.Material).transparent = true;
  dyn.add(grid);

  // Interface border
  dyn.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-25, 0, -14), new THREE.Vector3(25, 0, -14),
      new THREE.Vector3(25, 0, 14), new THREE.Vector3(-25, 0, 14),
      new THREE.Vector3(-25, 0, -14),
    ]),
    new THREE.LineBasicMaterial({ color: 0x55ccaa, opacity: 0.5, transparent: true }),
  ));

  // Medium block
  const medMat = new THREE.MeshPhysicalMaterial({
    color: 0x44aacc,
    transmission: 0.85,
    ior: 1.5,
    roughness: 0.02,
    thickness: 4,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const medium = new THREE.Mesh(new THREE.BoxGeometry(50, 14, 28), medMat);
  medium.position.set(0, -7, 0);
  dyn.add(medium);

  // Laser pen
  const laserPen = createLaserPen();
  dyn.add(laserPen);
  const tipMat = (laserPen.getObjectByName('tip') as THREE.Mesh).material as THREE.MeshBasicMaterial;

  // Rays — each line + arrow, separate geometries
  const incLine = makeLine(0x44ff88, 1);
  const incArrow = makeArrow(0x44ff88, 1);
  const refrLine = makeLine(0x44ff88, 1);
  const refrArrow = makeArrow(0x44ff88, 1);
  const reflLine = makeLine(0x88bbdd, 0.5);
  const reflArrow = makeArrow(0x88bbdd, 0.5);
  dyn.add(incLine, incArrow, refrLine, refrArrow, reflLine, reflArrow);

  // Normal
  const normalLine = new THREE.Line(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3)),
    new THREE.LineDashedMaterial({ color: 0xaabbcc, dashSize: 0.4, gapSize: 0.25, transparent: true, opacity: 0.6 }),
  );
  dyn.add(normalLine);

  // Hit markers
  const hitDot = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
  );
  const hitGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0x44ff88, toneMapped: false, transparent: true, opacity: 0.2, depthWrite: false }),
  );
  dyn.add(hitDot, hitGlow);

  const labelGroup = new THREE.Group();
  dyn.add(labelGroup);

  return { medium, medMat, laserPen, tipMat, incLine, incArrow, refrLine, refrArrow, reflLine, reflArrow, normalLine, hitDot, hitGlow, labelGroup };
}

// ── Update (fast — only position/color changes, no geometry rebuild) ──
function updateLine(line: THREE.Line, arrow: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3, color: number, visible: boolean) {
  line.visible = visible;
  arrow.visible = visible;
  if (!visible) return;

  const actualTo = clampLen(from, to);
  const pos = line.geometry.attributes.position as THREE.BufferAttribute;
  pos.setXYZ(0, from.x, from.y, from.z);
  pos.setXYZ(1, actualTo.x, actualTo.y, actualTo.z);
  pos.needsUpdate = true;

  (line.material as THREE.LineBasicMaterial).color.setHex(color);
  (arrow.material as THREE.MeshBasicMaterial).color.setHex(color);

  arrow.position.copy(actualTo);
  const dir = actualTo.clone().sub(from).normalize();
  arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
}

function update(objs: Objs, settings: ReturnType<typeof useSimulationStore.getState>['settings']) {
  const iy = settings.elementCenterY ?? 250;
  const n2 = settings.medium2N;
  const showColor = settings.showColor;

  const rayHex = new THREE.Color(showColor ? wavelengthToColor(settings.wavelength) : '#44ff88').getHex();

  // Medium ior
  objs.medMat.ior = Math.max(1.01, n2);
  const isWater = Math.abs(n2 - 1.333) < 0.05;
  objs.medMat.color.set(isWater ? 0x44aadd : 0x44aacc);

  // Tip color
  objs.tipMat.color.setHex(rayHex);

  // Solve
  const source = { x: Math.max(40, Math.min(960, settings.sourceAnchorX)), y: Math.max(20, Math.min(600, settings.sourceY ?? 86)) };
  const result = solveInterface(settings, source);

  // Laser pen orientation
  if (result.segments.length > 0) {
    const from3 = p2v(result.segments[0].from, iy);
    const to3 = p2v(result.segments[0].to, iy);
    const dir = to3.clone().sub(from3).normalize();
    objs.laserPen.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    objs.laserPen.position.copy(from3.clone().add(dir.clone().multiplyScalar(-1.3)));
  }

  // Rays
  let hasInc = false, hasRefr = false, hasRefl = false;
  for (const seg of result.segments) {
    const from = p2v(seg.from, iy);
    const to = p2v(seg.to, iy);
    if (seg.kind === 'incident') { updateLine(objs.incLine, objs.incArrow, from, to, rayHex, true); hasInc = true; }
    else if (seg.kind === 'refracted') { updateLine(objs.refrLine, objs.refrArrow, from, to, rayHex, true); hasRefr = true; }
    else if (seg.kind === 'reflected') { updateLine(objs.reflLine, objs.reflArrow, from, to, 0x88bbdd, true); hasRefl = true; }
  }
  if (!hasInc) { objs.incLine.visible = false; objs.incArrow.visible = false; }
  if (!hasRefr) { objs.refrLine.visible = false; objs.refrArrow.visible = false; }
  if (!hasRefl) { objs.reflLine.visible = false; objs.reflArrow.visible = false; }

  // Normal
  if (settings.showNormals && result.normals.length > 0) {
    objs.normalLine.visible = true;
    const a = p2v(result.normals[0][0], iy);
    const b = p2v(result.normals[0][1], iy);
    const pos = objs.normalLine.geometry.attributes.position as THREE.BufferAttribute;
    pos.setXYZ(0, a.x, a.y, a.z);
    pos.setXYZ(1, b.x, b.y, b.z);
    pos.needsUpdate = true;
    objs.normalLine.geometry.computeBoundingSphere();
    (objs.normalLine as THREE.Line).computeLineDistances();
  } else {
    objs.normalLine.visible = false;
  }

  // Hit
  if (result.hitPoint) {
    const hp = p2v(result.hitPoint, iy);
    objs.hitDot.visible = true; objs.hitDot.position.copy(hp);
    objs.hitGlow.visible = true; objs.hitGlow.position.copy(hp);
    (objs.hitGlow.material as THREE.MeshBasicMaterial).color.setHex(rayHex);
  } else {
    objs.hitDot.visible = false; objs.hitGlow.visible = false;
  }

  // Labels (only part that gets rebuilt)
  SnellSceneManager.disposeGroup(objs.labelGroup);

  if (settings.showAngles) {
    for (const mark of result.angleMarks) {
      const pos = p2v(mark.at, iy);
      const label = makeLabel(mark.label);
      const rad = (mark.rayAngleDeg * Math.PI) / 180;
      label.position.set(pos.x + Math.sin(rad) * 2.5, pos.y + Math.cos(rad) * 1.5, 0);
      objs.labelGroup.add(label);
    }
  }

  const n1L = makeLabel(`n₁ = ${settings.medium1N.toFixed(3)}`, 'rgba(255,255,255,0.45)');
  n1L.position.set(23, 4, 0);
  objs.labelGroup.add(n1L);

  const n2L = makeLabel(`n₂ = ${n2.toFixed(3)}`, 'rgba(255,255,255,0.45)');
  n2L.position.set(23, -4, 0);
  objs.labelGroup.add(n2L);

  const stL = makeLabel(result.status, 'rgba(255,255,255,0.5)', 11);
  stL.position.set(0, 9, 0);
  objs.labelGroup.add(stL);
}

// ── Component ───────────────────────────────────────────────────────
export function InterfaceScene3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mgrRef = useRef<SnellSceneManager | null>(null);
  const objsRef = useRef<Objs | null>(null);
  const settings = useSimulationStore((s) => s.settings);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const mgr = new SnellSceneManager(el);
    mgrRef.current = mgr;

    // Brighter dark background
    mgr.scene.background = new THREE.Color(0x0e1524);
    mgr.renderer.setClearColor(0x0e1524);

    // Stronger lights
    mgr.scene.children.forEach((c) => {
      if (c instanceof THREE.AmbientLight) c.intensity = 0.7;
      if (c instanceof THREE.DirectionalLight) { c.intensity = 1.8; c.position.set(12, 20, 18); }
    });
    mgr.scene.add(new THREE.PointLight(0x4488ff, 0.5, 80, undefined));

    mgr.camera.position.set(5, 14, 30);
    mgr.controls.target.set(0, -1, 0);
    mgr.controls.update();

    objsRef.current = createObjs(mgr.dyn);

    const ro = new ResizeObserver((entries) => {
      for (const e of entries) mgr.resize(e.contentRect.width, e.contentRect.height);
    });
    ro.observe(el);
    return () => { ro.disconnect(); mgr.dispose(); mgrRef.current = null; objsRef.current = null; };
  }, []);

  useEffect(() => {
    if (objsRef.current) update(objsRef.current, settings);
  }, [
    settings.sourceAngleDeg, settings.medium1N, settings.medium2N,
    settings.sourceAnchorX, settings.sourceY, settings.elementCenterY,
    settings.wavelength, settings.showColor, settings.showAngles, settings.showNormals,
  ]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
    </div>
  );
}
