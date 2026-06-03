import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

export class VectorArrow {
  group: THREE.Group;
  private shaft: THREE.Line;
  private head: THREE.Mesh;
  private labelObj: CSS2DObject | null = null;

  constructor(color: string) {
    this.group = new THREE.Group();
    const c = new THREE.Color(color);
    const mat = new THREE.LineBasicMaterial({ color: c });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
    this.shaft = new THREE.Line(geo, mat);
    this.group.add(this.shaft);

    const headGeo = new THREE.ConeGeometry(1.5, 6, 8);
    headGeo.rotateX(Math.PI / 2);
    this.head = new THREE.Mesh(headGeo, new THREE.MeshLambertMaterial({ color: c }));
    this.group.add(this.head);
  }

  update(fx: number, fy: number, tx: number, ty: number) {
    const pos = this.shaft.geometry.attributes.position as THREE.BufferAttribute;
    pos.setXYZ(0, fx, 2, -fy);
    pos.setXYZ(1, tx, 2, -ty);
    pos.needsUpdate = true;
    this.head.position.set(tx, 2, -ty);
    const dx = tx - fx;
    const dz = -ty - -fy;
    const angle = Math.atan2(dx, dz);
    this.head.rotation.set(0, angle, 0);
    if (this.labelObj) this.labelObj.position.copy(this.head.position);
  }

  setLabel(text: string) {
    if (!text) {
      if (this.labelObj) this.labelObj.element.style.display = 'none';
      return;
    }
    if (!this.labelObj) {
      const div = document.createElement('div');
      div.style.cssText =
        'color:rgba(255,255,255,0.75);font-size:10px;font-family:Inter,system-ui,sans-serif;pointer-events:none;white-space:nowrap;text-shadow:0 1px 3px rgba(0,0,0,0.9);transform:translateY(-14px)';
      this.labelObj = new CSS2DObject(div);
      this.group.add(this.labelObj);
    }
    this.labelObj.element.style.display = '';
    this.labelObj.element.textContent = text;
  }

  setVisible(v: boolean) {
    this.group.visible = v;
    if (this.labelObj) this.labelObj.visible = v;
  }

  addTo(scene: THREE.Scene) {
    scene.add(this.group);
  }

  dispose() {
    this.shaft.geometry.dispose();
    (this.shaft.material as THREE.Material).dispose();
    this.head.geometry.dispose();
    (this.head.material as THREE.Material).dispose();
    if (this.labelObj) {
      this.group.remove(this.labelObj);
      this.labelObj.element.remove();
    }
  }
}
