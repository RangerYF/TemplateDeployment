import * as THREE from 'three';

export class StarField {
  group: THREE.Group;
  private outerSkybox: THREE.Mesh;
  private innerSkybox: THREE.Mesh;
  private particles: THREE.Points;

  constructor() {
    this.group = new THREE.Group();
    const loader = new THREE.TextureLoader();

    // Outer skybox — large inverted sphere with milky way texture
    const outerGeo = new THREE.SphereGeometry(2000, 64, 64);
    const outerTex = loader.load(`${import.meta.env.BASE_URL}textures/stars_milky.jpg`);
    outerTex.colorSpace = THREE.SRGBColorSpace;
    const outerMat = new THREE.MeshBasicMaterial({
      map: outerTex,
      side: THREE.BackSide,
      fog: false,
    });
    this.outerSkybox = new THREE.Mesh(outerGeo, outerMat);
    this.group.add(this.outerSkybox);

    // Inner skybox — semi-transparent overlay for depth
    const innerGeo = new THREE.SphereGeometry(1900, 64, 64);
    const innerTex = loader.load(`${import.meta.env.BASE_URL}textures/stars_milky.jpg`);
    innerTex.colorSpace = THREE.SRGBColorSpace;
    const innerMat = new THREE.MeshBasicMaterial({
      map: innerTex,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.3,
      fog: false,
    });
    this.innerSkybox = new THREE.Mesh(innerGeo, innerMat);
    this.innerSkybox.rotation.y = Math.PI / 3;
    this.group.add(this.innerSkybox);

    // 1500 particle stars scattered in the mid-distance
    const count = 1500;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 800 + Math.random() * 1000;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      sizes[i] = 0.5 + Math.random() * 2.5;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 2,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.particles = new THREE.Points(geo, mat);
    this.group.add(this.particles);
  }

  addTo(scene: THREE.Scene) {
    scene.add(this.group);
  }

  dispose() {
    this.outerSkybox.geometry.dispose();
    (this.outerSkybox.material as THREE.Material).dispose();
    this.innerSkybox.geometry.dispose();
    (this.innerSkybox.material as THREE.Material).dispose();
    this.particles.geometry.dispose();
    (this.particles.material as THREE.Material).dispose();
  }
}
