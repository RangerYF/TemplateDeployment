import * as THREE from 'three';
import type { Vec2 } from '@/engine/orbitalMechanics';

export class OrbitLine {
  mesh: THREE.Mesh;
  private lastHash = '';

  constructor(color: string, _dashed = false) {
    const c = new THREE.Color(color).multiplyScalar(0.45);
    const mat = new THREE.MeshBasicMaterial({
      color: c,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
  }

  updatePoints(points: Vec2[]) {
    if (points.length < 3) return;

    const first = points[0];
    const last = points[points.length - 1];
    const hash = `${points.length}:${first.x.toFixed(1)},${first.y.toFixed(1)}:${last.x.toFixed(1)},${last.y.toFixed(1)}`;
    if (hash === this.lastHash) return;
    this.lastHash = hash;

    const pts3d = points.map((p) => new THREE.Vector3(p.x, 0, -p.y));

    let sampled = pts3d;
    if (pts3d.length > 200) {
      const step = Math.ceil(pts3d.length / 200);
      sampled = pts3d.filter((_, i) => i % step === 0);
    }

    const firstPt = sampled[0];
    const lastPt = sampled[sampled.length - 1];
    const endGap = firstPt.distanceTo(lastPt);
    let maxDist = 0;
    for (const p of sampled) {
      const d = p.length();
      if (d > maxDist) maxDist = d;
    }
    const closed = endGap < Math.max(maxDist * 0.05, 3);

    const curve = new THREE.CatmullRomCurve3(sampled, closed, 'chordal');
    const segments = Math.min(sampled.length * 2, 256);
    const geo = new THREE.TubeGeometry(curve, segments, 0.8, 6, closed);

    this.mesh.geometry.dispose();
    this.mesh.geometry = geo;
    this.mesh.position.set(0, 0, 0);
  }

  animate(_dt: number) {}

  addTo(scene: THREE.Scene) {
    scene.add(this.mesh);
  }

  dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
