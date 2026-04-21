import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useEntityStore, useSelectionStore, useToolStore } from '@/editor/store';
import type { Entity } from '@/editor/entities/types';
import { EntityRenderer } from './renderers/index';
import { ToolEventDispatcher } from './ToolEventDispatcher';
import { ContextMenu3D } from './ContextMenu3D';
import { ToolBar } from './ToolBar';
import { MeasurementDisplay } from '@/components/info/MeasurementDisplay';
import { useNotificationStore } from './notificationStore';
import { ModeIndicator } from './ModeIndicator';
import { TextCommandInput } from './TextCommandInput';
import { AnimationDriver } from './AnimationDriver';

// 触发 renderer 自注册（side-effect import）
import './renderers/GeometryEntityRenderer';
import './renderers/PointEntityRenderer';
import './renderers/SegmentEntityRenderer';
import './renderers/FaceEntityRenderer';
import './renderers/CoordSystemRenderer';
import './renderers/CircumSphereRenderer';
import './renderers/CircumCircleRenderer';
import './renderers/AngleMeasurementRenderer';
import './renderers/DistanceMeasurementRenderer';

/** 预设视角 */
const CAMERA_VIEWS = {
  reset: { position: new THREE.Vector3(4, 4, 4), target: new THREE.Vector3(0, 1.3, 0) },
  front: { position: new THREE.Vector3(0, 1.3, 5), target: new THREE.Vector3(0, 1.3, 0) },
  top: { position: new THREE.Vector3(0, 6, 0.01), target: new THREE.Vector3(0, 0, 0) },
  side: { position: new THREE.Vector3(5, 1.3, 0), target: new THREE.Vector3(0, 1.3, 0) },
} as const;

type ViewKey = keyof typeof CAMERA_VIEWS;

// ─── 渲染顺序：Face → Segment → Geometry → Point ───
const TYPE_ORDER: Record<string, number> = {
  face: 0,
  segment: 1,
  geometry: 2,
  point: 3,
  coordinateSystem: 4,
  circumSphere: 5,
  circumCircle: 6,
  angleMeasurement: 7,
  distanceMeasurement: 8,
};

function sortEntities(a: Entity, b: Entity): number {
  return (TYPE_ORDER[a.type] ?? 99) - (TYPE_ORDER[b.type] ?? 99);
}

/** 相机动画控制器（Canvas 内） */
function CameraAnimator({ controlsRef }: { controlsRef: React.RefObject<THREE.EventDispatcher | null> }) {
  const { camera } = useThree();
  const animTarget = useRef<{ pos: THREE.Vector3; lookAt: THREE.Vector3 } | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const { viewKey } = (e as CustomEvent).detail as { viewKey: ViewKey };
      const view = CAMERA_VIEWS[viewKey];
      if (view) {
        animTarget.current = { pos: view.position.clone(), lookAt: view.target.clone() };
      }
    };
    window.addEventListener('camera-set-view', handler);
    return () => window.removeEventListener('camera-set-view', handler);
  }, []);

  useFrame(() => {
    if (!animTarget.current) return;
    const { pos, lookAt } = animTarget.current;
    camera.position.lerp(pos, 0.1);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const controls = controlsRef.current as any;
    if (controls?.target) {
      controls.target.lerp(lookAt, 0.1);
      controls.update();
    }

    if (camera.position.distanceTo(pos) < 0.02) {
      camera.position.copy(pos);
      if (controls?.target) {
        controls.target.copy(lookAt);
        controls.update();
      }
      animTarget.current = null;
    }
  });

  return null;
}

function SceneContent() {
  const entitiesMap = useEntityStore((s) => s.entities);
  const clearSelection = useSelectionStore((s) => s.clear);

  // 按类型排序 + 过滤可见实体（entitiesMap 引用稳定，仅在实际变更时重算）
  const sortedEntities = useMemo(
    () => Object.values(entitiesMap).filter((e) => e.visible).sort(sortEntities),
    [entitiesMap],
  );

  return (
    <ToolEventDispatcher>
      <group
        onPointerMissed={() => {
          clearSelection();
        }}
      >
        {sortedEntities.map((entity) => (
          <EntityRenderer key={entity.id} entity={entity} />
        ))}
      </group>
    </ToolEventDispatcher>
  );
}

/** 视角快捷按钮 */
const VIEW_BUTTONS: { key: ViewKey; label: string; title: string }[] = [
  { key: 'reset', label: '\u21BA', title: '重置视角' },
  { key: 'front', label: '前', title: '正视图' },
  { key: 'top', label: '顶', title: '俯视图' },
  { key: 'side', label: '侧', title: '侧视图' },
];

function ViewButtons() {
  const handleClick = useCallback((key: ViewKey) => {
    window.dispatchEvent(new CustomEvent('camera-set-view', { detail: { viewKey: key } }));
  }, []);

  return (
    <div
      style={{
        position: 'absolute',
        left: 12,
        bottom: 12,
        display: 'flex',
        gap: 4,
        zIndex: 10,
      }}
    >
      {VIEW_BUTTONS.map((b) => (
        <button
          key={b.key}
          title={b.title}
          onClick={() => handleClick(b.key)}
          style={{
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 6,
            border: '1px solid #d1d5db',
            background: 'rgba(255,255,255,0.92)',
            color: '#374151',
            fontSize: 14,
            cursor: 'pointer',
            backdropFilter: 'blur(4px)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(243,244,246,0.95)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.92)'; }}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}

export function Scene3D() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);
  const isDragging = useToolStore((s) => s.isDragging);
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);

  // 禁用 OrbitControls 的右键平移，改用中键；配置触屏手势
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.PAN,
        RIGHT: -1,
      };
      // 触屏：单指旋转，双指缩放+平移
      controlsRef.current.touches = {
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN,
      };
    }
  }, []);

  return (
    <div
      ref={setContainerEl}
      className="w-full h-full relative"
      style={{ backgroundColor: '#f8f9fa' }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Canvas
        camera={{ position: [4, 4, 4], fov: 50 }}
        style={{ width: '100%', height: '100%' }}
        gl={{ preserveDrawingBuffer: true }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />

        <SceneContent />

        <OrbitControls
          ref={controlsRef}
          target={[0, 0.8, 0]}
          enablePan={!isDragging}
          enableZoom={!isDragging}
          enableRotate={!isDragging}
        />

        <CameraAnimator controlsRef={controlsRef} />
        <AnimationDriver />

        <gridHelper args={[10, 10, '#ddd', '#eee']} />
      </Canvas>

      <ContextMenu3D />
      <ToolBar />
      <MeasurementDisplay />
      <ModeIndicator />
      <TextCommandInput />
      <SceneNotification />

      {containerEl && <ViewButtons />}
    </div>
  );
}

function SceneNotification() {
  const message = useNotificationStore((s) => s.message);
  if (!message) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.75)',
        color: '#fff',
        padding: '6px 16px',
        borderRadius: 6,
        fontSize: 13,
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        zIndex: 20,
      }}
    >
      {message}
    </div>
  );
}
