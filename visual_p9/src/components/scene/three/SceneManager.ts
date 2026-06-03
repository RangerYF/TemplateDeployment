import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';

export class SceneManager {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  composer: EffectComposer;
  controls: OrbitControls;
  css2DRenderer: CSS2DRenderer;
  ambientLight: THREE.AmbientLight;
  sunLight: THREE.PointLight;
  dirLight: THREE.DirectionalLight;
  fillLight: THREE.PointLight;
  private bloomPass: UnrealBloomPass;
  private container: HTMLElement;
  private baseBloomStrength = 0.35;

  constructor(container: HTMLElement) {
    this.container = container;
    const { width, height } = container.getBoundingClientRect();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000814);

    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 5000);
    this.camera.position.set(0, 300, 600);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = 'block';

    // CSS2D label renderer
    this.css2DRenderer = new CSS2DRenderer();
    this.css2DRenderer.setSize(width, height);
    this.css2DRenderer.domElement.style.position = 'absolute';
    this.css2DRenderer.domElement.style.top = '0';
    this.css2DRenderer.domElement.style.left = '0';
    this.css2DRenderer.domElement.style.pointerEvents = 'none';
    container.appendChild(this.css2DRenderer.domElement);

    // OrbitControls with damping
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.rotateSpeed = 0.3;
    this.controls.zoomSpeed = 0.8;
    this.controls.panSpeed = 0.5;
    this.controls.minDistance = 50;
    this.controls.maxDistance = 2000;

    // Ambient — warm neutral, avoid grey cast
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(this.ambientLight);

    // Key light — strong directional from upper-right, creates terminator line
    this.dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
    this.dirLight.position.set(300, 250, 400);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.set(1024, 1024);
    this.scene.add(this.dirLight);

    // Point light at center for star models (Lensflare glow source)
    this.sunLight = new THREE.PointLight(0xfff0dd, 3, 1500, 0.4);
    this.scene.add(this.sunLight);

    // Fill light — cool blue from opposite side to soften shadows
    this.fillLight = new THREE.PointLight(0x4488ff, 1.5, 2000, 0.5);
    this.fillLight.position.set(-200, 100, -300);
    this.scene.add(this.fillLight);

    // Post-processing: render at physical pixel resolution
    const pr = this.renderer.getPixelRatio();
    const pw = width * pr;
    const ph = height * pr;
    this.composer = new EffectComposer(this.renderer);
    this.composer.setSize(pw, ph);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(pw, ph),
      this.baseBloomStrength,
      0.4,
      0.2,
    );
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());
    this.composer.addPass(new SMAAPass(pw, ph));
  }

  setSunPosition(x: number, y: number) {
    this.sunLight.position.set(x, 50, -y);
  }

  updateBloom() {
    const dist = this.camera.position.length();
    const maxDist = 1500;
    const normalizedDist = Math.min(dist / maxDist, 1);
    this.bloomPass.strength = this.baseBloomStrength + (1 - normalizedDist) * 0.4;
  }

  resize() {
    const { width, height } = this.container.getBoundingClientRect();
    if (width === 0 || height === 0) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.css2DRenderer.setSize(width, height);
    const pr = this.renderer.getPixelRatio();
    this.composer.setSize(width * pr, height * pr);
    this.bloomPass.resolution.set(width * pr, height * pr);
  }

  render() {
    this.controls.update();
    this.updateBloom();
    this.composer.render();
    this.css2DRenderer.render(this.scene, this.camera);
  }

  dispose() {
    this.controls.dispose();
    this.composer.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.container.removeChild(this.renderer.domElement);
    }
    if (this.css2DRenderer.domElement.parentNode) {
      this.container.removeChild(this.css2DRenderer.domElement);
    }
  }
}
