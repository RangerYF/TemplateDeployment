import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const React = (window as any).React;

interface SnellWindowProps {
  depthCm: number;
  waterN: number;
  incidentAngleDeg: number;
  viewMode: '3d' | '2d' | 'topview';
  wavelength: number;
  showColor: boolean;
}

interface Ctx {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  dyn: THREE.Group;
  animId: number;
}

function disposeGroup(g: THREE.Group) {
  while (g.children.length > 0) {
    const c = g.children[0];
    g.remove(c);
    if ((c as any).geometry) (c as any).geometry.dispose();
    if ((c as any).material) {
      const m = (c as any).material;
      if (Array.isArray(m)) m.forEach((x: THREE.Material) => x.dispose()); else m.dispose();
    }
  }
}

const COL_GREEN = 0x44cc88;
const COL_BLUE = 0x5599dd;
const COL_RAY_UW = 0x556677;
const COL_NORMAL = 0x99aabb;
const BG_COLOR = 0xf5f7fa;
const WATER_COLOR = 0xd4eaf7;

function makeTextSprite(text: string, color: string = '#333'): THREE.Sprite {
  const dpr = Math.max(window.devicePixelRatio, 2);
  const baseW = 512, baseH = 128;
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
  sprite.scale.set(3.2, 0.8, 1);
  return sprite;
}

function buildArc(center: THREE.Vector3, fromDir: THREE.Vector3, toDir: THREE.Vector3, radius: number, color: number): THREE.Line {
  const a = fromDir.clone().normalize();
  const b = toDir.clone().normalize();
  const angle = Math.acos(Math.min(1, Math.max(-1, a.dot(b))));
  const axis = new THREE.Vector3().crossVectors(a, b);
  if (axis.length() < 0.001) {
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints([center]), new THREE.LineBasicMaterial({ color }));
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

function addArrowHead(group: THREE.Group, from: THREE.Vector3, to: THREE.Vector3, color: number, t = 0.55) {
  const dir = to.clone().sub(from).normalize();
  const pos = from.clone().lerp(to, t);
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.45, 8),
    new THREE.MeshPhongMaterial({ color })
  );
  cone.position.copy(pos);
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  cone.quaternion.copy(quat);
  group.add(cone);
}

function makeDashedLine(pts: THREE.Vector3[], color: number, opacity: number, dash: number, gap: number): THREE.Line {
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineDashedMaterial({ color, transparent: true, opacity, dashSize: dash, gapSize: gap });
  const line = new THREE.Line(geo, mat);
  line.computeLineDistances();
  return line;
}

function buildScene(ctx: Ctx, props: SnellWindowProps) {
  disposeGroup(ctx.dyn);
  const { depthCm: depth, waterN, incidentAngleDeg } = props;
  const incRad = Math.max(0.01, incidentAngleDeg * Math.PI / 180);
  const critAngle = Math.asin(Math.min(1, 1 / waterN));
  const critDeg = critAngle * 180 / Math.PI;
  const windowR = depth * Math.tan(critAngle);
  const axisTop = 10;
  const axisBot = -(depth + 4);
  const surfHalf = 18;

  // ── 1. Environment ──

  // Water surface fill (subtle)
  const surf = new THREE.Mesh(
    new THREE.PlaneGeometry(50, 50),
    new THREE.MeshPhongMaterial({ color: 0x88bbdd, transparent: true, opacity: 0.05, side: THREE.DoubleSide })
  );
  surf.rotation.x = -Math.PI / 2;
  surf.position.y = 0.01;
  ctx.dyn.add(surf);

  // Water volume (light blue)
  const waterH = depth + 6;
  const water = new THREE.Mesh(
    new THREE.BoxGeometry(50, waterH, 50),
    new THREE.MeshPhongMaterial({ color: WATER_COLOR, transparent: true, opacity: 0.12, side: THREE.BackSide })
  );
  water.position.y = -waterH / 2;
  ctx.dyn.add(water);

  // Grid on surface
  const grid = new THREE.GridHelper(30, 15, 0xd0d8e0, 0xe4eaef);
  grid.position.y = 0.02;
  ctx.dyn.add(grid);

  // ── 2. Interface line (horizontal) ──
  const ifGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-surfHalf, 0, 0), new THREE.Vector3(surfHalf, 0, 0)
  ]);
  ctx.dyn.add(new THREE.Line(ifGeo, new THREE.LineBasicMaterial({ color: 0x6699bb, transparent: true, opacity: 0.6 })));
  const ifLabel = makeTextSprite('界面', '#6699bb');
  ifLabel.position.set(surfHalf + 2, 0, 0);
  ctx.dyn.add(ifLabel);

  // ── 3. Central vertical axis (dashed) ──
  ctx.dyn.add(makeDashedLine(
    [new THREE.Vector3(0, axisBot, 0), new THREE.Vector3(0, axisTop, 0)],
    0x99aabb, 0.45, 0.4, 0.25
  ));

  // ── 4. Medium labels ──
  const airLabel = makeTextSprite('空气 n₁ = 1', '#88aabb');
  airLabel.position.set(-surfHalf + 2, 4, 0);
  ctx.dyn.add(airLabel);
  const waterLabel = makeTextSprite(`水 n₂ = ${waterN.toFixed(2)}`, '#5588aa');
  waterLabel.position.set(-surfHalf + 2, -2.5, 0);
  ctx.dyn.add(waterLabel);

  // ── 5. Source point ──
  const srcPos = new THREE.Vector3(0, -depth, 0);
  const srcMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 16, 16),
    new THREE.MeshPhongMaterial({ color: COL_GREEN, emissive: COL_GREEN, emissiveIntensity: 0.4 })
  );
  srcMesh.position.copy(srcPos);
  ctx.dyn.add(srcMesh);
  const srcLabel = makeTextSprite('光源', '#44aa77');
  srcLabel.position.set(1.5, -depth, 0);
  ctx.dyn.add(srcLabel);

  // ── 6. Incident ray ──
  const hitX = depth * Math.tan(incRad);
  const hitPt = new THREE.Vector3(hitX, 0, 0);
  const uwGeo = new THREE.BufferGeometry().setFromPoints([srcPos, hitPt]);
  ctx.dyn.add(new THREE.Line(uwGeo, new THREE.LineBasicMaterial({ color: COL_RAY_UW })));
  addArrowHead(ctx.dyn, srcPos, hitPt, COL_RAY_UW);

  // Hit point marker
  const hitMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 12, 12),
    new THREE.MeshPhongMaterial({ color: 0x445566 })
  );
  hitMesh.position.copy(hitPt);
  ctx.dyn.add(hitMesh);

  // ── 7. Normal at hit point (dashed) ──
  const nLen = 5;
  ctx.dyn.add(makeDashedLine(
    [hitPt.clone().add(new THREE.Vector3(0, -nLen, 0)), hitPt.clone().add(new THREE.Vector3(0, nLen, 0))],
    COL_NORMAL, 0.5, 0.3, 0.2
  ));

  // ── 8. Angle arcs + labels ──
  const toSource = srcPos.clone().sub(hitPt).normalize();
  const normalDown = new THREE.Vector3(0, -1, 0);
  ctx.dyn.add(buildArc(hitPt, normalDown, toSource, 1.6, COL_RAY_UW));
  const arcMidDir = normalDown.clone().add(toSource).normalize();
  const t1Label = makeTextSprite(`θ₁ = ${incidentAngleDeg.toFixed(0)}°`, '#556677');
  t1Label.position.copy(hitPt).add(arcMidDir.multiplyScalar(2.8));
  ctx.dyn.add(t1Label);

  // ── 9. Refraction or TIR ──
  const sinR = Math.sin(incRad) * waterN;
  const isTIR = sinR > 1;
  const exitLen = 14;
  const reflLen = Math.max(6, depth * 0.8);

  if (!isTIR) {
    const refractedAngle = Math.asin(sinR);
    const refDir = new THREE.Vector3(Math.sin(refractedAngle), Math.cos(refractedAngle), 0);
    const exitPt = hitPt.clone().add(refDir.clone().multiplyScalar(exitLen));
    const refrGeo = new THREE.BufferGeometry().setFromPoints([hitPt, exitPt]);
    ctx.dyn.add(new THREE.Line(refrGeo, new THREE.LineBasicMaterial({ color: COL_GREEN })));
    addArrowHead(ctx.dyn, hitPt, exitPt, COL_GREEN);

    const normalUp = new THREE.Vector3(0, 1, 0);
    ctx.dyn.add(buildArc(hitPt, normalUp, refDir.clone().normalize(), 2.2, COL_GREEN));
    const refArcMid = normalUp.clone().add(refDir.clone().normalize()).normalize();
    const t2Label = makeTextSprite(`θ₂ = ${(refractedAngle * 180 / Math.PI).toFixed(1)}°`, '#33aa77');
    t2Label.position.copy(hitPt).add(refArcMid.multiplyScalar(3.5));
    ctx.dyn.add(t2Label);
  } else {
    const reflDir = new THREE.Vector3(Math.sin(incRad), -Math.cos(incRad), 0);
    const reflPt = hitPt.clone().add(reflDir.clone().multiplyScalar(reflLen));
    const reflGeo = new THREE.BufferGeometry().setFromPoints([hitPt, reflPt]);
    ctx.dyn.add(new THREE.Line(reflGeo, new THREE.LineBasicMaterial({ color: COL_BLUE })));
    addArrowHead(ctx.dyn, hitPt, reflPt, COL_BLUE);

    const tirLabel = makeTextSprite('全反射 TIR', '#5599dd');
    tirLabel.position.copy(hitPt).add(new THREE.Vector3(2, -2, 0));
    ctx.dyn.add(tirLabel);
  }

  // ── 10. Critical angle reference ray (dashed, dim) ──
  const critHitX = depth * Math.tan(critAngle);
  const critHitPt = new THREE.Vector3(critHitX, 0, 0);
  ctx.dyn.add(makeDashedLine(
    [srcPos.clone(), critHitPt.clone()],
    0xddaa44, 0.35, 0.35, 0.2
  ));
  // Critical ray exits along the surface
  const critExitPt = critHitPt.clone().add(new THREE.Vector3(8, 0.01, 0));
  ctx.dyn.add(makeDashedLine(
    [critHitPt.clone(), critExitPt],
    0xddaa44, 0.35, 0.35, 0.2
  ));
  const critRefLabel = makeTextSprite(`θc = ${critDeg.toFixed(1)}°`, '#bb8833');
  critRefLabel.position.copy(critHitPt).add(new THREE.Vector3(0, -1.5, 0));
  ctx.dyn.add(critRefLabel);

  // ── 11. Snell's window ring ──
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(windowR, 0.05, 8, 64),
    new THREE.MeshPhongMaterial({ color: COL_GREEN, transparent: true, opacity: 0.45, emissive: COL_GREEN, emissiveIntensity: 0.12 })
  );
  torus.rotation.x = Math.PI / 2;
  torus.position.y = 0.05;
  ctx.dyn.add(torus);

  // Critical cone
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(windowR, depth, 32, 1, true),
    new THREE.MeshPhongMaterial({ color: COL_GREEN, transparent: true, opacity: 0.025, side: THREE.DoubleSide })
  );
  cone.rotation.x = Math.PI;
  cone.position.y = -depth / 2;
  ctx.dyn.add(cone);

  // Window radius dimension line (on surface, from center to ring)
  const rLineGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0.08, 0), new THREE.Vector3(windowR, 0.08, 0)
  ]);
  ctx.dyn.add(new THREE.Line(rLineGeo, new THREE.LineBasicMaterial({ color: 0x44aa77, transparent: true, opacity: 0.5 })));
  const wLabel = makeTextSprite(`r = ${windowR.toFixed(1)} cm`, '#44aa77');
  wLabel.position.set(windowR / 2, 1.2, 0);
  ctx.dyn.add(wLabel);

  // Depth dimension line (vertical, from source to surface at x offset)
  const dimX = -3;
  const dimTopPt = new THREE.Vector3(dimX, 0, 0);
  const dimBotPt = new THREE.Vector3(dimX, -depth, 0);
  ctx.dyn.add(makeDashedLine([dimBotPt, dimTopPt], 0x88aabb, 0.4, 0.25, 0.15));
  // Tick marks
  const tickW = 0.4;
  const tickTopGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(dimX - tickW, 0, 0), new THREE.Vector3(dimX + tickW, 0, 0)
  ]);
  ctx.dyn.add(new THREE.Line(tickTopGeo, new THREE.LineBasicMaterial({ color: 0x88aabb, transparent: true, opacity: 0.5 })));
  const tickBotGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(dimX - tickW, -depth, 0), new THREE.Vector3(dimX + tickW, -depth, 0)
  ]);
  ctx.dyn.add(new THREE.Line(tickBotGeo, new THREE.LineBasicMaterial({ color: 0x88aabb, transparent: true, opacity: 0.5 })));
  const depthLabel = makeTextSprite(`h = ${depth} cm`, '#6688aa');
  depthLabel.position.set(dimX - 2.5, -depth / 2, 0);
  ctx.dyn.add(depthLabel);
}

function setCameraView(cam: THREE.PerspectiveCamera, ctrl: OrbitControls, mode: string, depth: number) {
  ctrl.enableRotate = true;
  ctrl.minAzimuthAngle = -Infinity;
  ctrl.maxAzimuthAngle = Infinity;
  ctrl.minPolarAngle = 0;
  ctrl.maxPolarAngle = Math.PI;
  if (mode === '3d') {
    cam.position.set(16, 6, 16);
    ctrl.target.set(0, -depth / 2, 0);
  } else if (mode === '2d') {
    cam.position.set(0, -depth / 3, 26);
    ctrl.target.set(0, -depth / 3, 0);
    ctrl.minAzimuthAngle = -0.3;
    ctrl.maxAzimuthAngle = 0.3;
  } else {
    cam.position.set(0, 26, 0.01);
    ctrl.target.set(0, 0, 0);
    ctrl.enableRotate = false;
  }
  ctrl.update();
}

function SnellWindowScene(props: SnellWindowProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const ctxRef = React.useRef<Ctx | null>(null);
  const prevViewRef = React.useRef<string>(props.viewMode);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.setClearColor(BG_COLOR);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(BG_COLOR);
    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const dl = new THREE.DirectionalLight(0xffffff, 0.45);
    dl.position.set(10, 20, 10);
    scene.add(dl);

    const camera = new THREE.PerspectiveCamera(50, el.clientWidth / el.clientHeight, 0.1, 200);
    camera.position.set(16, 6, 16);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, -4, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.update();

    const dyn = new THREE.Group();
    scene.add(dyn);

    let animId = 0;
    const tick = () => { animId = requestAnimationFrame(tick); controls.update(); renderer.render(scene, camera); };
    tick();

    ctxRef.current = { renderer, scene, camera, controls, dyn, animId };

    const ro = new ResizeObserver(() => {
      const w = el.clientWidth, h = el.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    ro.observe(el);

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
      controls.dispose();
      disposeGroup(dyn);
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
      ctxRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    buildScene(ctx, props);
    if (props.viewMode !== prevViewRef.current) {
      prevViewRef.current = props.viewMode;
      setCameraView(ctx.camera, ctx.controls, props.viewMode, props.depthCm);
    }
  }, [props.depthCm, props.waterN, props.incidentAngleDeg, props.viewMode, props.wavelength, props.showColor]);

  return <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />;
}

Object.assign(window, { SnellWindowScene });

export {};
