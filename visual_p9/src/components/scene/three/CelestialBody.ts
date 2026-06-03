import * as THREE from 'three';
import { Lensflare, LensflareElement } from 'three/examples/jsm/objects/Lensflare.js';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

const textureLoader = new THREE.TextureLoader();
const textureCache = new Map<string, THREE.Texture>();

function loadTexture(path: string): THREE.Texture {
  if (textureCache.has(path)) return textureCache.get(path)!;
  const tex = textureLoader.load(path);
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(path, tex);
  return tex;
}

export class CelestialBody {
  group: THREE.Group;
  private sphere: THREE.Mesh;
  private lensflare: Lensflare | null = null;
  private atmosphere: THREE.Mesh | null = null;
  private labelObject: CSS2DObject | null = null;
  readonly isStar: boolean;

  constructor(radius: number, color: string, label: string, bodyId: string, isStar = false) {
    this.group = new THREE.Group();
    this.isStar = isStar;

    const geo = new THREE.SphereGeometry(radius, 64, 64);

    if (isStar) {
      const sunTex = loadTexture('/textures/sun.jpg');
      const mat = new THREE.MeshBasicMaterial({
        map: sunTex,
        toneMapped: false,
      });
      this.sphere = new THREE.Mesh(geo, mat);

      const flare0 = loadTexture('/textures/lensflare0.png');
      const flare2 = loadTexture('/textures/lensflare2.png');
      const lensflare = new Lensflare();
      lensflare.addElement(new LensflareElement(flare0, radius * 8, 0, new THREE.Color(0xffffff)));
      lensflare.addElement(new LensflareElement(flare2, radius * 4, 0.1, new THREE.Color(0xffaa44)));
      lensflare.addElement(new LensflareElement(flare2, radius * 2, 0.15, new THREE.Color(0xff8800)));
      lensflare.addElement(new LensflareElement(flare2, radius * 1.5, 0.3, new THREE.Color(0xff6600)));
      this.lensflare = lensflare;
      this.group.add(lensflare);
    } else {
      let mat: THREE.Material;

      if (bodyId === 'earth') {
        mat = new THREE.MeshLambertMaterial({
          map: loadTexture('/textures/earth_day.jpg'),
          color: 0xffffff,
        });
      } else {
        mat = new THREE.MeshLambertMaterial({
          color: new THREE.Color(color),
        });
      }

      this.sphere = new THREE.Mesh(geo, mat);
      this.sphere.castShadow = true;
      this.sphere.receiveShadow = true;

      // Atmosphere glow for Earth
      if (bodyId === 'earth') {
        const atmosGeo = new THREE.SphereGeometry(radius * 1.04, 64, 64);
        const atmosMat = new THREE.MeshBasicMaterial({
          color: 0x4488ff,
          transparent: true,
          opacity: 0.12,
          side: THREE.BackSide,
          depthWrite: false,
        });
        this.atmosphere = new THREE.Mesh(atmosGeo, atmosMat);
        this.group.add(this.atmosphere);
      }
    }

    this.group.add(this.sphere);

    if (label) {
      const div = document.createElement('div');
      div.textContent = label;
      div.style.color = 'rgba(255,255,255,0.65)';
      div.style.fontSize = '11px';
      div.style.fontFamily = 'Inter, system-ui, sans-serif';
      div.style.pointerEvents = 'none';
      div.style.whiteSpace = 'nowrap';
      div.style.textShadow = '0 1px 4px rgba(0,0,0,0.9)';
      div.style.transform = 'translateY(14px)';
      this.labelObject = new CSS2DObject(div);
      this.labelObject.position.set(0, 0, 0);
      this.group.add(this.labelObject);
    }
  }

  setPosition(x: number, y: number) {
    this.group.position.set(x, 0, -y);
  }

  rotate(delta: number) {
    this.sphere.rotation.y += delta * 0.3;
  }

  setRotationY(angle: number) {
    this.sphere.rotation.y = angle;
  }

  setLabelVisible(visible: boolean) {
    if (this.labelObject) this.labelObject.visible = visible;
  }

  addTo(scene: THREE.Scene) {
    scene.add(this.group);
  }

  dispose() {
    this.sphere.geometry.dispose();
    (this.sphere.material as THREE.Material).dispose();
    if (this.lensflare) {
      this.lensflare.dispose();
    }
    if (this.atmosphere) {
      this.atmosphere.geometry.dispose();
      (this.atmosphere.material as THREE.Material).dispose();
    }
    if (this.labelObject) {
      this.group.remove(this.labelObject);
      this.labelObject.element.remove();
    }
  }
}
