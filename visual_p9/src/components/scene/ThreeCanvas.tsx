import { useEffect, useRef, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { buildFrame } from '@/engine/orbitalMechanics';
import type { SceneFrame, BodyRenderState } from '@/engine/orbitalMechanics';
import { useSimulationStore, useActiveModel, useActiveParams } from '@/store/simulationStore';
import { CONSTANTS } from '@/data/celestialData';
import { SceneManager } from './three/SceneManager';
import { StarField } from './three/StarField';
import { CelestialBody } from './three/CelestialBody';
import { OrbitLine } from './three/OrbitLine';
import { VectorArrow } from './three/VectorArrow';
import { ParamOverlay } from '../overlay/ParamOverlay';
import { MetricsOverlay } from '../overlay/MetricsOverlay';

function cardRow(label: string, value: string): string {
  return `<div style="display:flex;justify-content:space-between;align-items:baseline;font-size:12px;margin-top:5px;gap:14px">
    <span style="color:rgba(255,255,255,0.45);white-space:nowrap">${label}</span>
    <span style="color:rgba(255,255,255,0.92);font-weight:500;white-space:nowrap">${value}</span>
  </div>`;
}

function computeRealtimeSpeed(body: BodyRenderState, frame: SceneFrame, params: Record<string, number>): string | null {
  // Binary star system: v = ω × r, ω = √(G(m1+m2)/L³)
  if (body.id === 'star1' || body.id === 'star2') {
    const m1 = params.m1Kg;
    const m2 = params.m2Kg;
    const Lm = (params.separationKm ?? 0) * 1000;
    if (!m1 || !m2 || Lm <= 0) return null;
    const omega = Math.sqrt(CONSTANTS.gravitationalConstant * (m1 + m2) / Lm ** 3);
    const rM = body.id === 'star1' ? (m2 / (m1 + m2)) * Lm : (m1 / (m1 + m2)) * Lm;
    const speed = omega * rM;
    if (!Number.isFinite(speed)) return null;
    return `v = ${(speed / 1000).toFixed(2)} km/s`;
  }

  const mu = CONSTANTS.gravitationalConstant * (params.centralMassKg ?? params.earthMassKg ?? 6e24);
  const center = frame.bodies.find((b) => b.id === 'center' || b.id === 'earth');
  if (!center) return null;
  const dx = body.position.x - center.position.x;
  const dy = body.position.y - center.position.y;
  const distPx = Math.sqrt(dx * dx + dy * dy);
  if (distPx < 1) return null;

  const EARTH_RADIUS_PX = 28;
  const ORBIT_SCALE = 3e5;
  const rM = 6.371e6 + (distPx - EARTH_RADIUS_PX) * ORBIT_SCALE;
  if (rM <= 0) return null;

  let aM: number | undefined;
  if (params.periapsisRadiusM && params.apoapsisRadiusM) {
    aM = (params.periapsisRadiusM + params.apoapsisRadiusM) / 2;
  }

  const speed = aM ? Math.sqrt(mu * (2 / rM - 1 / aM)) : Math.sqrt(mu / rM);
  if (!Number.isFinite(speed)) return null;
  return `v = ${(speed / 1000).toFixed(2)} km/s`;
}

function buildCardHtml(body: BodyRenderState, frame: SceneFrame, params: Record<string, number>): string {
  let rows = '';

  const nearby = (a: { x: number; y: number }, b: { x: number; y: number }, r: number) => {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy < r * r;
  };

  let hasSpeed = false;
  for (const v of frame.vectors) {
    if (!nearby(v.from, body.position, 20)) continue;
    if (v.color === '#4CAF50' || v.color === '#8BC34A') {
      const m = v.label.match(/([\d.]+)\s*(km\/s|m\/s)/);
      if (m) {
        rows += cardRow('速度', `v = ${m[1]} ${m[2]}`);
        hasSpeed = true;
      }
    } else if (v.color === '#FF9800') {
      rows += cardRow('向心加速度', '方向已标示 →');
    }
  }

  if (!hasSpeed) {
    const computed = computeRealtimeSpeed(body, frame, params);
    if (computed) rows += cardRow('速度', computed);
  }

  for (const m of frame.markers) {
    if (!nearby(m.position, body.position, 30) || !m.label) continue;
    rows += cardRow('轨道', m.label);
  }

  return rows;
}

// ---- Sector mesh helpers ----

interface SectorMesh {
  mesh: THREE.Mesh;
  label: CSS2DObject;
}

function createSectorMesh(points: Array<{ x: number; y: number }>, color: string, areaLabel: string): SectorMesh {
  const shape = new THREE.Shape();
  shape.moveTo(points[0].x, -points[0].y);
  for (let i = 1; i < points.length; i++) {
    shape.lineTo(points[i].x, -points[i].y);
  }
  shape.closePath();

  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color).getHex(),
    transparent: true,
    opacity: 0.25,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.2;

  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;

  const labelDiv = document.createElement('div');
  labelDiv.textContent = areaLabel;
  labelDiv.style.cssText =
    'color:rgba(255,255,255,0.7);font-size:10px;font-family:Inter,system-ui,sans-serif;pointer-events:none;white-space:nowrap;text-shadow:0 1px 3px rgba(0,0,0,0.9)';
  const label = new CSS2DObject(labelDiv);
  label.position.set(cx, 0.5, -cy);

  return { mesh, label };
}

export function ThreeCanvas() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mgrRef = useRef<SceneManager | null>(null);
  const starsRef = useRef<StarField | null>(null);
  const bodiesRef = useRef(new Map<string, CelestialBody>());
  const orbitsRef = useRef(new Map<string, OrbitLine>());
  const vectorsRef = useRef(new Map<string, VectorArrow>());
  const sectorsRef = useRef(new Map<string, SectorMesh>());
  const sectorHashRef = useRef('');
  const markersRef = useRef(new Map<string, { group: THREE.Group; label: CSS2DObject }>());
  const frameRef = useRef<SceneFrame | null>(null);
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null);

  const selectedIdRef = useRef<string | null>(null);
  const cardObjRef = useRef<CSS2DObject | null>(null);
  const cardContentRef = useRef<HTMLElement | null>(null);

  const model = useActiveModel();
  const params = useActiveParams();

  const staticFrame = useMemo(
    () => buildFrame(model.id, params, 0, 'low', 0),
    [model.id, params],
  );

  // ---- Card management ----

  const dismissCard = useCallback(() => {
    const id = selectedIdRef.current;
    const obj = cardObjRef.current;
    if (obj && id) {
      const body = bodiesRef.current.get(id);
      if (body) body.group.remove(obj);
      obj.element.remove();
    }
    selectedIdRef.current = null;
    cardObjRef.current = null;
    cardContentRef.current = null;
  }, []);

  const showCard = useCallback(
    (bodyId: string) => {
      dismissCard();
      const body = bodiesRef.current.get(bodyId);
      const frame = frameRef.current;
      if (!body || !frame) return;
      const bodyData = frame.bodies.find((b) => b.id === bodyId);
      if (!bodyData) return;

      const root = document.createElement('div');
      root.style.cssText =
        'background:rgba(5,10,24,0.88);border:1px solid rgba(255,255,255,0.18);border-radius:14px;padding:10px 14px;backdrop-filter:blur(14px);min-width:170px;font-family:Inter,system-ui,sans-serif;pointer-events:auto;cursor:default;box-shadow:0 4px 24px rgba(0,0,0,0.5)';

      const hdr = document.createElement('div');
      hdr.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px';
      const titleWrap = document.createElement('div');
      titleWrap.style.cssText = 'display:flex;align-items:center;gap:6px';
      const dot = document.createElement('span');
      dot.style.cssText = `width:10px;height:10px;border-radius:50%;background:${bodyData.color};flex-shrink:0`;
      titleWrap.appendChild(dot);
      const title = document.createElement('span');
      title.style.cssText = 'color:#fff;font-size:13px;font-weight:600;white-space:nowrap';
      title.textContent = bodyData.label;
      titleWrap.appendChild(title);
      hdr.appendChild(titleWrap);
      const closeBtn = document.createElement('button');
      closeBtn.style.cssText =
        'color:rgba(255,255,255,0.35);font-size:15px;cursor:pointer;background:none;border:none;padding:0 2px;line-height:1;flex-shrink:0;transition:color 0.15s';
      closeBtn.textContent = '✕';
      closeBtn.onmouseenter = () => { closeBtn.style.color = 'rgba(255,255,255,0.8)'; };
      closeBtn.onmouseleave = () => { closeBtn.style.color = 'rgba(255,255,255,0.35)'; };
      closeBtn.addEventListener('click', (e) => { e.stopPropagation(); dismissCard(); });
      hdr.appendChild(closeBtn);
      root.appendChild(hdr);

      const hr = document.createElement('div');
      hr.style.cssText = 'height:1px;background:rgba(255,255,255,0.1);margin:8px 0 4px';
      root.appendChild(hr);

      const content = document.createElement('div');
      const p = useSimulationStore.getState();
      const currentParams = p.paramsByModel[p.currentModelId] || {};
      content.innerHTML = buildCardHtml(bodyData, frame, currentParams);
      root.appendChild(content);

      const cardObj = new CSS2DObject(root);
      const radius = bodyData.radiusPx;
      cardObj.position.set(radius + 12, radius + 8, 0);
      body.group.add(cardObj);

      selectedIdRef.current = bodyId;
      cardObjRef.current = cardObj;
      cardContentRef.current = content;
    },
    [dismissCard],
  );

  useEffect(() => {
    const interval = setInterval(() => {
      const id = selectedIdRef.current;
      const el = cardContentRef.current;
      const frame = frameRef.current;
      if (!id || !el || !frame) return;
      const body = frame.bodies.find((b) => b.id === id);
      if (!body) { dismissCard(); return; }
      const p = useSimulationStore.getState();
      const currentParams = p.paramsByModel[p.currentModelId] || {};
      el.innerHTML = buildCardHtml(body, frame, currentParams);
    }, 200);
    return () => clearInterval(interval);
  }, [dismissCard]);

  // ---- Three.js init ----

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const mgr = new SceneManager(el);
    mgrRef.current = mgr;
    const stars = new StarField();
    stars.addTo(mgr.scene);
    starsRef.current = stars;

    const ro = new ResizeObserver(() => mgr.resize());
    ro.observe(el);

    return () => {
      ro.disconnect();
      dismissCard();
      stars.dispose();
      bodiesRef.current.forEach((b) => b.dispose());
      bodiesRef.current.clear();
      orbitsRef.current.forEach((o) => o.dispose());
      orbitsRef.current.clear();
      vectorsRef.current.forEach((v) => v.dispose());
      vectorsRef.current.clear();
      sectorsRef.current.forEach((s) => { s.mesh.geometry.dispose(); (s.mesh.material as THREE.Material).dispose(); s.label.element.remove(); });
      sectorsRef.current.clear();
      markersRef.current.forEach((m) => {
        m.group.traverse((child) => {
          if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
            child.geometry.dispose();
            if (child.material instanceof THREE.Material) child.material.dispose();
          }
        });
        m.label.element.remove();
      });
      markersRef.current.clear();
      mgr.dispose();
      mgrRef.current = null;
    };
  }, [dismissCard]);

  // ---- Animation loop ----

  useEffect(() => {
    let id: number;
    let last = performance.now();

    const loop = (now: number) => {
      id = requestAnimationFrame(loop);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      const mgr = mgrRef.current;
      if (!mgr) return;

      const sim = useSimulationStore.getState();
      if (sim.isPlaying) sim.tick(dt);

      const s = useSimulationStore.getState();
      const p = { ...(s.paramsByModel[s.currentModelId] || {}) };
      const frame: SceneFrame = buildFrame(
        s.currentModelId, p, s.elapsedSeconds, s.hohmannPhase, s.hohmannIgnitionAngle,
      );
      frameRef.current = frame;

      if (frame.bodies.length > 0) {
        mgr.setSunPosition(frame.bodies[0].position.x, frame.bodies[0].position.y);
      }

      syncBodies(mgr, frame, dt, s.elapsedSeconds);
      syncOrbits(mgr, frame, dt);
      syncVectors(mgr, frame, s.showVectors);
      syncSectors(mgr, frame, s.showAreaSectors);
      syncMarkers(mgr, frame);

      mgr.render();
    };

    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, []);

  // ---- Sync helpers ----

  function syncBodies(mgr: SceneManager, frame: SceneFrame, dt: number, elapsedSeconds: number) {
    const map = bodiesRef.current;
    const needed = new Set(frame.bodies.map((b) => b.id));
    map.forEach((body, id) => {
      if (!needed.has(id)) {
        if (selectedIdRef.current === id) dismissCard();
        mgr.scene.remove(body.group);
        body.dispose();
        map.delete(id);
      }
    });
    const stars = frame.bodies.filter((fb) => fb.id.includes('star'));
    const isBinarySystem = stars.length >= 2;
    const centerBody = isBinarySystem
      ? null
      : frame.bodies.find((fb) => fb.id === 'earth' || fb.id === 'center' || fb.id.includes('star'));

    for (const b of frame.bodies) {
      let body = map.get(b.id);
      if (!body) {
        const isStar = b.id.includes('star') || b.id.includes('sun') || b.id === 'center';

        let renderRadius = b.radiusPx;
        if (isStar) {
          renderRadius = Math.min(renderRadius, 12);
        }
        if (!isStar && b.id !== 'earth' && centerBody) {
          const dx = b.position.x - centerBody.position.x;
          const dy = b.position.y - centerBody.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const gap = dist - centerBody.radiusPx;
          if (gap > 0) {
            const maxAllowed = gap - 0.5;
            renderRadius = Math.min(renderRadius, Math.max(3, maxAllowed));
          }
          renderRadius = Math.min(renderRadius, 5);
        }

        const orbiters = frame.bodies.filter((fb) => fb.id !== 'earth' && fb.id !== 'center' && !fb.id.includes('star'));
        const showLabel = !b.hideLabel && orbiters.length > 2;

        body = new CelestialBody(renderRadius, b.color, showLabel ? b.label : '', b.id, isStar);
        body.group.userData.bodyId = b.id;
        body.addTo(mgr.scene);
        map.set(b.id, body);
      }
      body.setPosition(b.position.x, b.position.y);
      if (b.id === 'earth') {
        body.setRotationY(elapsedSeconds * (Math.PI * 2 / 86400));
      } else {
        body.rotate(dt);
      }

      // Auto-hide label when too close to center body
      if (centerBody && b.id !== centerBody.id) {
        const dx = b.position.x - centerBody.position.x;
        const dy = b.position.y - centerBody.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        body.setLabelVisible(dist > centerBody.radiusPx * 1.8);
      }
    }
  }

  function syncOrbits(mgr: SceneManager, frame: SceneFrame, dt: number) {
    const map = orbitsRef.current;
    const visiblePaths = frame.paths.filter(
      (p) => !p.id.includes('spin') && !p.id.includes('rotation'),
    );
    const needed = new Set(visiblePaths.map((p) => p.id));
    map.forEach((o, id) => {
      if (!needed.has(id)) { mgr.scene.remove(o.mesh); o.dispose(); map.delete(id); }
    });
    for (const p of visiblePaths) {
      let orbit = map.get(p.id);
      if (!orbit) { orbit = new OrbitLine(p.color, p.dashed); orbit.addTo(mgr.scene); map.set(p.id, orbit); }

      orbit.updatePoints(p.points);
      orbit.animate(dt);
    }
  }

  function syncVectors(mgr: SceneManager, frame: SceneFrame, show: boolean) {
    const map = vectorsRef.current;
    if (!show) { map.forEach((v) => v.setVisible(false)); return; }
    const needed = new Set(frame.vectors.map((_, i) => `vec-${i}`));
    map.forEach((v, id) => {
      if (!needed.has(id)) { mgr.scene.remove(v.group); v.dispose(); map.delete(id); }
    });
    frame.vectors.forEach((vec, i) => {
      const key = `vec-${i}`;
      let arrow = map.get(key);
      if (!arrow) { arrow = new VectorArrow(vec.color); arrow.addTo(mgr.scene); map.set(key, arrow); }
      arrow.update(vec.from.x, vec.from.y, vec.to.x, vec.to.y);
      arrow.setLabel(vec.label);
      arrow.setVisible(true);
    });
  }

  function syncSectors(mgr: SceneManager, frame: SceneFrame, show: boolean) {
    const map = sectorsRef.current;
    if (!show || frame.sectors.length === 0) {
      if (map.size > 0) {
        map.forEach((s) => { mgr.scene.remove(s.mesh); mgr.scene.remove(s.label); s.mesh.geometry.dispose(); (s.mesh.material as THREE.Material).dispose(); s.label.element.remove(); });
        map.clear();
        sectorHashRef.current = '';
      }
      return;
    }
    const hash = frame.sectors.map((s) => {
      const p0 = s.points[0];
      const pn = s.points[s.points.length - 1];
      return `${s.id}:${p0?.x.toFixed(1)},${p0?.y.toFixed(1)}-${pn?.x.toFixed(1)},${pn?.y.toFixed(1)}`;
    }).join('|');
    if (hash === sectorHashRef.current) return;
    sectorHashRef.current = hash;

    map.forEach((s) => { mgr.scene.remove(s.mesh); mgr.scene.remove(s.label); s.mesh.geometry.dispose(); (s.mesh.material as THREE.Material).dispose(); s.label.element.remove(); });
    map.clear();
    for (const s of frame.sectors) {
      if (s.points.length < 3) continue;
      const sector = createSectorMesh(s.points, s.color, s.areaLabel);
      mgr.scene.add(sector.mesh);
      mgr.scene.add(sector.label);
      map.set(s.id, sector);
    }
  }

  function syncMarkers(mgr: SceneManager, frame: SceneFrame) {
    const map = markersRef.current;
    const needed = new Set(frame.markers.map((m) => m.label || `marker-${m.position.x}-${m.position.y}`));
    map.forEach((m, id) => {
      if (!needed.has(id)) {
        mgr.scene.remove(m.group);
        m.group.traverse((child) => {
          if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
            child.geometry.dispose();
            if (child.material instanceof THREE.Material) child.material.dispose();
          }
        });
        m.label.element.remove();
        map.delete(id);
      }
    });
    for (const m of frame.markers) {
      const key = m.label || `marker-${m.position.x}-${m.position.y}`;
      let existing = map.get(key);
      if (!existing) {
        const group = new THREE.Group();
        const color = new THREE.Color(m.color);

        if (m.cross) {
          const mat = new THREE.LineBasicMaterial({ color });
          const makeLineGeo = (pts: number[]) => {
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
            return g;
          };
          group.add(new THREE.Line(makeLineGeo([-4, 0, 0, 4, 0, 0]), mat));
          group.add(new THREE.Line(makeLineGeo([0, 0, -4, 0, 0, 4]), mat));
        } else {
          const geo = new THREE.SphereGeometry(1.5, 16, 16);
          const mat = new THREE.MeshBasicMaterial({ color });
          group.add(new THREE.Mesh(geo, mat));
        }

        const labelDiv = document.createElement('div');
        labelDiv.textContent = m.label;
        labelDiv.style.cssText =
          'color:rgba(255,255,255,0.75);font-size:10px;font-family:Inter,system-ui,sans-serif;pointer-events:none;white-space:nowrap;text-shadow:0 1px 3px rgba(0,0,0,0.9);transform:translateY(-12px)';
        const label = new CSS2DObject(labelDiv);
        label.position.set(0, 2, 0);
        group.add(label);

        mgr.scene.add(group);
        existing = { group, label };
        map.set(key, existing);
      }
      existing.group.position.set(m.position.x, 0.5, -m.position.y);
    }
  }

  // ---- Click detection ----

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    pointerDownRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const down = pointerDownRef.current;
      pointerDownRef.current = null;
      if (!down) return;
      const dx = e.clientX - down.x;
      const dy = e.clientY - down.y;
      if (dx * dx + dy * dy > 25) return;

      const mgr = mgrRef.current;
      const el = containerRef.current;
      if (!mgr || !el) return;

      const rect = el.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, mgr.camera);

      const groups: THREE.Object3D[] = [];
      bodiesRef.current.forEach((b) => groups.push(b.group));
      const hits = raycaster.intersectObjects(groups, true);

      if (hits.length > 0) {
        let obj: THREE.Object3D | null = hits[0].object;
        while (obj && !obj.userData.bodyId) obj = obj.parent;
        if (obj?.userData.bodyId) {
          const hitId = obj.userData.bodyId as string;
          if (selectedIdRef.current === hitId) { dismissCard(); } else { showCard(hitId); }
        }
      }
    },
    [showCard, dismissCard],
  );

  return (
    <div
      ref={wrapperRef}
      className="relative h-full w-full"
      style={{ background: '#000814' }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <div ref={containerRef} className="absolute inset-0" />

      {/* Legend */}
      {staticFrame.legend && staticFrame.legend.length > 0 && (
        <div
          className="pointer-events-none absolute left-4 top-4 z-10 max-w-[300px] rounded-2xl px-4 py-3"
          style={{
            background: 'rgba(5, 10, 24, 0.6)',
            backdropFilter: 'blur(20px) saturate(1.5)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 20,
          }}
        >
          <div className="text-xs font-semibold text-white">{model.name_cn}</div>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
            {staticFrame.legend.map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-[11px] text-white/80">
                <span
                  className="h-2.5 w-2.5 rounded-full border border-white/50"
                  style={{ background: item.color, filter: 'brightness(0.55)' }}
                />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Floating panels */}
      <ParamOverlay />
      <MetricsOverlay />
    </div>
  );
}
