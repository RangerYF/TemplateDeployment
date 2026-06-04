/**
 * SnellSceneManager.ts
 * Lightweight Three.js scene manager for the Snell's Window 3D experiment.
 *
 * Responsibilities:
 *   - WebGLRenderer, PerspectiveCamera, OrbitControls setup
 *   - Basic lighting (ambient + directional)
 *   - A `dyn` group for dynamic content that gets rebuilt on settings change
 *   - Camera presets for 3d / 2d / topview modes
 *   - Resize handling and cleanup
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

const BG_COLOR = 0xf5f7fa;

export class SnellSceneManager {
  readonly renderer: THREE.WebGLRenderer;
  readonly css2d: CSS2DRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  readonly dyn: THREE.Group;

  private animId = 0;

  constructor(container: HTMLElement) {
    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setClearColor(BG_COLOR);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    // CSS2D label renderer
    this.css2d = new CSS2DRenderer();
    this.css2d.setSize(container.clientWidth, container.clientHeight);
    this.css2d.domElement.style.position = 'absolute';
    this.css2d.domElement.style.top = '0';
    this.css2d.domElement.style.left = '0';
    this.css2d.domElement.style.pointerEvents = 'none';
    container.appendChild(this.css2d.domElement);

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(BG_COLOR);

    // Lighting
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const dl = new THREE.DirectionalLight(0xffffff, 0.45);
    dl.position.set(10, 20, 10);
    this.scene.add(dl);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      200,
    );
    this.camera.position.set(16, 6, 16);

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, -4, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.update();

    // Dynamic group
    this.dyn = new THREE.Group();
    this.scene.add(this.dyn);

    // Start animation loop
    const tick = () => {
      this.animId = requestAnimationFrame(tick);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      this.css2d.render(this.scene, this.camera);
    };
    tick();
  }

  // ---------------------------------------------------------------------------
  // Camera presets
  // ---------------------------------------------------------------------------

  setCameraView(mode: '3d' | '2d' | 'topview', depth: number): void {
    const cam = this.camera;
    const ctrl = this.controls;

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
      // topview
      cam.position.set(0, 26, 0.01);
      ctrl.target.set(0, 0, 0);
      ctrl.enableRotate = false;
    }

    ctrl.update();
  }

  // ---------------------------------------------------------------------------
  // Resize
  // ---------------------------------------------------------------------------

  resize(width: number, height: number): void {
    if (width === 0 || height === 0) return;
    this.renderer.setSize(width, height);
    this.css2d.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  dispose(): void {
    cancelAnimationFrame(this.animId);
    this.controls.dispose();
    SnellSceneManager.disposeGroup(this.dyn);
    this.renderer.dispose();
    const domEl = this.renderer.domElement;
    domEl.parentElement?.removeChild(domEl);
    this.css2d.domElement.parentElement?.removeChild(this.css2d.domElement);
  }

  // ---------------------------------------------------------------------------
  // Static helpers
  // ---------------------------------------------------------------------------

  /** Recursively dispose geometry, materials, and CSS2D DOM elements. */
  static disposeGroup(g: THREE.Object3D): void {
    const children = [...g.children];
    for (const c of children) {
      g.remove(c);
      if (c.children.length > 0) SnellSceneManager.disposeGroup(c);
      if ((c as THREE.Mesh).geometry) (c as THREE.Mesh).geometry.dispose();
      const mat = (c as THREE.Mesh).material;
      if (mat) {
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else (mat as THREE.Material).dispose();
      }
      // Clean up CSS2DObject DOM elements
      if ('element' in c && c.element instanceof HTMLElement) {
        c.element.remove();
      }
    }
  }
}
