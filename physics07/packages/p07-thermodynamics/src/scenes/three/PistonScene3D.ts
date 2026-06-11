import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { getTheme, canvasBg } from '../../themeMode';

/**
 * PistonScene3D — a self-contained Three.js renderer that mounts two canvases
 * (WebGL + CSS2D labels) as absolutely-positioned overlays inside the existing
 * 2D canvas container. It runs its OWN requestAnimationFrame loop (independent
 * of the SimLoop) so OrbitControls stay smooth even when the simulation is
 * paused. The piston SceneModule updates the `dyn` group's objects each frame;
 * this class just keeps rendering.
 *
 * Lifecycle: show() on enter, hide() on leave (stops the loop to save CPU).
 */
const BG = 0xeef3f8; // light, matches the app's light theme

export class PistonScene3D {
  readonly renderer: THREE.WebGLRenderer;
  readonly css2d: CSS2DRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  /** Content group — cleared & rebuilt by the scene module when layout changes. */
  readonly dyn: THREE.Group;

  private container: HTMLElement;
  private animId = 0;
  private running = false;

  // Theme-mutable lighting / grid references.
  private ambient!: THREE.AmbientLight;
  private hemi!: THREE.HemisphereLight;
  private grid!: THREE.GridHelper;

  constructor(container: HTMLElement) {
    this.container = container;
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 600;

    // WebGL renderer (overlay)
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.setClearColor(BG);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    const gl = this.renderer.domElement;
    gl.style.position = 'absolute';
    gl.style.top = '0';
    gl.style.left = '0';
    gl.style.width = '100%';
    gl.style.height = '100%';
    gl.style.zIndex = '5';
    container.appendChild(gl);

    // CSS2D label renderer (overlay on top, click-through)
    this.css2d = new CSS2DRenderer();
    this.css2d.setSize(w, h);
    const lbl = this.css2d.domElement;
    lbl.style.position = 'absolute';
    lbl.style.top = '0';
    lbl.style.left = '0';
    lbl.style.width = '100%';
    lbl.style.height = '100%';
    lbl.style.pointerEvents = 'none';
    lbl.style.zIndex = '6';
    container.appendChild(lbl);

    // Scene + camera
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(BG);
    // Background-matched fog: melts the distant ground grid into the backdrop so
    // it never piles up into a hard "horizon band". The cylinder sits well within
    // ~18 units of the camera, i.e. before `near`, so it is never fogged.
    this.scene.fog = new THREE.Fog(BG, 20, 50);
    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 200);
    this.camera.position.set(9, 6, 14);

    // Controls
    this.controls = new OrbitControls(this.camera, gl);
    this.controls.target.set(0, 0.5, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.09;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 40;
    this.controls.update();

    // Image-based lighting: an in-code RoomEnvironment gives the metal piston /
    // caps and glass real reflections (no external HDRI asset needed).
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // Lighting (intensities/colours re-tuned per theme by applyTheme)
    this.ambient = new THREE.AmbientLight(0xffffff, 0.9);
    this.scene.add(this.ambient);
    const key = new THREE.DirectionalLight(0xffffff, 1.8);
    key.position.set(8, 16, 12);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.7);
    fill.position.set(-10, 6, -8);
    this.scene.add(fill);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0xb8c4d4, 0.6);
    this.scene.add(this.hemi);

    // Subtle ground grid for depth (recreated per theme by applyTheme)
    this.grid = new THREE.GridHelper(60, 30, 0xb4c2d4, 0xd4dde8);
    (this.grid.material as THREE.Material).opacity = 0.6;
    (this.grid.material as THREE.Material).transparent = true;
    this.grid.position.y = -4;
    this.scene.add(this.grid);

    this.dyn = new THREE.Group();
    this.scene.add(this.dyn);

    this.applyTheme(getTheme());

    // Keep the 3D overlay fitted to its container on window/layout resize.
    const ro = new ResizeObserver(() => {
      if (this.running) this.resizeToContainer();
    });
    ro.observe(container);

    this.hide(); // start hidden until the piston scene activates
  }

  show(): void {
    this.renderer.domElement.style.display = 'block';
    this.css2d.domElement.style.display = 'block';
    this.resizeToContainer();
    if (!this.running) {
      this.running = true;
      this.loop();
    }
  }

  hide(): void {
    this.renderer.domElement.style.display = 'none';
    this.css2d.domElement.style.display = 'none';
    this.running = false;
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = 0;
    }
  }

  private loop = (): void => {
    if (!this.running) return;
    this.animId = requestAnimationFrame(this.loop);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.css2d.render(this.scene, this.camera);
  };

  setBackground(hex: string): void {
    const c = new THREE.Color(hex);
    this.scene.background = c;
    this.renderer.setClearColor(c);
    if (this.scene.fog) this.scene.fog.color.copy(c);
  }

  /** Re-tune lights + grid for the given theme. */
  applyTheme(theme: 'light' | 'dark'): void {
    const dark = theme === 'dark';
    this.ambient.intensity = dark ? 0.55 : 0.9;
    this.hemi.intensity = dark ? 0.45 : 0.6;
    this.hemi.groundColor.set(dark ? 0x1a2438 : 0xb8c4d4);
    this.renderer.toneMappingExposure = dark ? 1.05 : 1.25;
    (this.grid.material as THREE.Material).dispose();
    const newGrid = new THREE.GridHelper(60, 30, dark ? 0x33415e : 0xb4c2d4, dark ? 0x1c2740 : 0xd4dde8);
    (newGrid.material as THREE.Material).opacity = dark ? 0.5 : 0.6;
    (newGrid.material as THREE.Material).transparent = true;
    newGrid.position.y = -4;
    this.scene.remove(this.grid);
    this.scene.add(newGrid);
    this.grid = newGrid;
  }

  /** Called on a theme toggle: re-theme lights/grid and refresh the background. */
  refreshTheme(): void {
    this.applyTheme(getTheme());
    this.setBackground(canvasBg());
  }

  resizeToContainer(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h);
    this.css2d.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.hide();
    this.controls.dispose();
    PistonScene3D.disposeGroup(this.dyn);
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.css2d.domElement.remove();
  }

  /** Recursively dispose geometry/materials and remove CSS2D label DOM. */
  static disposeGroup(g: THREE.Object3D): void {
    const children = [...g.children];
    for (const c of children) {
      g.remove(c);
      if (c.children.length) PistonScene3D.disposeGroup(c);
      if ((c as THREE.Mesh).geometry) (c as THREE.Mesh).geometry.dispose();
      const mat = (c as THREE.Mesh).material;
      if (mat) {
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else (mat as THREE.Material).dispose();
      }
      if ('element' in c && (c as { element?: unknown }).element instanceof HTMLElement) {
        ((c as { element: HTMLElement }).element).remove();
      }
    }
  }
}
