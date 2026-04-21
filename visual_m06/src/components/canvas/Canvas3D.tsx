import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import { useVectorStore } from '@/editor';
import type { Vec3D } from '@/editor/entities/types';
import { add3D, cross3D, dot3D, mag3D, angle3D, toDeg } from '@/engine/vectorMath';
import { useFmt } from '@/hooks/useFmt';
import { COLORS, RADIUS } from '@/styles/tokens';

// ─── 3D 向量箭头组件 ───

interface Arrow3DProps {
  from?: Vec3D;
  to: Vec3D;
  color: string;
  label: string;
  opacity?: number;
}

function Arrow3D({ from = [0, 0, 0], to, color, label, opacity = 1 }: Arrow3DProps) {
  const start = new THREE.Vector3(from[0], from[1], from[2]);
  const end = new THREE.Vector3(to[0], to[1], to[2]);
  const dir = new THREE.Vector3().subVectors(end, start);
  const length = dir.length();

  const arrowHelper = useMemo(() => {
    if (length < 0.01) return null;
    const normDir = dir.clone().normalize();
    const helper = new THREE.ArrowHelper(normDir, start, length, color, 0.2, 0.1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (helper as any).children.forEach((child: THREE.Mesh) => {
      if (child.material) {
        (child.material as THREE.MeshBasicMaterial).opacity = opacity;
        (child.material as THREE.MeshBasicMaterial).transparent = opacity < 1;
      }
    });
    return helper;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from[0], from[1], from[2], to[0], to[1], to[2], color, opacity, length]);

  if (!arrowHelper) return null;

  const midX = (from[0] + to[0]) / 2;
  const midY = (from[1] + to[1]) / 2;
  const midZ = (from[2] + to[2]) / 2;

  return (
    <group>
      <primitive object={arrowHelper} />
      <Html
        position={[midX + 0.15, midY + 0.15, midZ + 0.15]}
        style={{ pointerEvents: 'none' }}
      >
        <div
          style={{
            color,
            fontWeight: 700,
            fontSize: 18,
            fontFamily: 'Inter, sans-serif',
            textShadow: '0 0 4px #fff, 0 0 8px #fff',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </div>
      </Html>
    </group>
  );
}

// ─── 坐标轴 ───

function CoordAxes() {
  const show3DGrid = useVectorStore((s) => s.show3DGrid);
  const axisLength = 4;
  const axes = [
    { from: [0, 0, 0] as Vec3D, to: [axisLength, 0, 0] as Vec3D, color: '#000000', label: 'x' },
    { from: [0, 0, 0] as Vec3D, to: [0, axisLength, 0] as Vec3D, color: '#000000', label: 'y' },
    { from: [0, 0, 0] as Vec3D, to: [0, 0, axisLength] as Vec3D, color: '#000000', label: 'z' },
  ];

  return (
    <>
      {axes.map(({ from, to, color, label }) => {
        const dir = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]).normalize();
        const helper = new THREE.ArrowHelper(dir, new THREE.Vector3(...from), axisLength, color, 0.3, 0.15);
        return (
          <group key={label}>
            <primitive object={helper} />
            <Html position={[to[0] + 0.2, to[1] + 0.1, to[2] + 0.1]} style={{ pointerEvents: 'none' }}>
              <div style={{ color, fontWeight: 700, fontSize: 18, fontFamily: 'Inter, sans-serif' }}>{label}</div>
            </Html>
          </group>
        );
      })}
      {/* 网格平面（可开关） */}
      {show3DGrid && <gridHelper args={[8, 8, '#ddd', '#eee']} rotation={[0, 0, 0]} position={[0, 0, 0]} />}
    </>
  );
}

// ─── 平行六面体线框 ───

function ParallelepipedWireframe({ a, b, c }: { a: Vec3D; b: Vec3D; c: Vec3D }) {
  const geo = useMemo(() => {
    const v: [number, number, number][] = [
      [0, 0, 0],
      [a[0], a[1], a[2]],
      [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
      [b[0], b[1], b[2]],
      [c[0], c[1], c[2]],
      [a[0] + c[0], a[1] + c[1], a[2] + c[2]],
      [a[0] + b[0] + c[0], a[1] + b[1] + c[1], a[2] + b[2] + c[2]],
      [b[0] + c[0], b[1] + c[1], b[2] + c[2]],
    ];
    const edges = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7],
    ];
    const positions: number[] = [];
    edges.forEach(([i, j]) => { positions.push(...v[i], ...v[j]); });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    return g;
  }, [a, b, c]);

  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color="#aaaaaa" />
    </lineSegments>
  );
}

// ─── 平行四边形面片（叉积可视化）───

function ParallelogramFace({ a, b }: { a: Vec3D; b: Vec3D }) {
  const geometry = useMemo(() => {
    const verts = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(a[0], a[1], a[2]),
      new THREE.Vector3(a[0] + b[0], a[1] + b[1], a[2] + b[2]),
      new THREE.Vector3(b[0], b[1], b[2]),
    ];
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array([
      ...verts[0].toArray(), ...verts[1].toArray(), ...verts[2].toArray(),
      ...verts[0].toArray(), ...verts[2].toArray(), ...verts[3].toArray(),
    ]);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.computeVertexNormals();
    return geo;
  }, [a, b]);

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial color={COLORS.vecResult} transparent opacity={0.15} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ─── 空间向量场景内容 ───

function Space3DScene() {
  const vecA3 = useVectorStore((s) => s.vecA3);
  const vecB3 = useVectorStore((s) => s.vecB3);
  const { f, fv3 } = useFmt();

  const sum = add3D(vecA3, vecB3);
  const dotVal = dot3D(vecA3, vecB3);
  const angleRad = angle3D(vecA3, vecB3);
  const angleDeg = toDeg(angleRad);

  return (
    <>
      <CoordAxes />
      <Arrow3D to={vecA3} color={COLORS.vecA} label={`a=${fv3(vecA3)}`} />
      <Arrow3D to={vecB3} color={COLORS.vecB} label={`b=${fv3(vecB3)}`} />
      <Arrow3D to={sum} color={COLORS.vecResult} label={`a+b=${fv3(sum)}`} />

      {/* 标量结果 HUD */}
      <Html position={[-3.5, 4, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{
          background: 'rgba(255,255,255,0.92)',
          border: `1px solid ${COLORS.border}`,
          borderRadius: RADIUS.md,
          padding: '8px 12px',
          fontSize: 18,
          color: COLORS.text,
          fontFamily: 'Inter, sans-serif',
          minWidth: 180,
        }}>
          <div><b style={{ color: COLORS.vecResult }}>a+b</b> = {fv3(sum)}</div>
          <div style={{ marginTop: 4 }}><b>a·b</b> = {f(dotVal)}</div>
          <div><b>θ</b> ≈ {f(angleDeg)}°</div>
        </div>
      </Html>
    </>
  );
}

// ─── 叉积场景内容 ───

function CrossProductScene() {
  const vecA3 = useVectorStore((s) => s.vecA3);
  const vecB3 = useVectorStore((s) => s.vecB3);
  const { f, fv3 } = useFmt();

  const crossVec = cross3D(vecA3, vecB3);
  const crossMag = mag3D(crossVec);
  const aAngleB = toDeg(angle3D(vecA3, vecB3));

  return (
    <>
      <CoordAxes />
      <Arrow3D to={vecA3} color={COLORS.vecA} label={`a=${fv3(vecA3)}`} />
      <Arrow3D to={vecB3} color={COLORS.vecB} label={`b=${fv3(vecB3)}`} />

      {/* 叉积向量 */}
      {crossMag > 0.01 && (
        <Arrow3D to={crossVec} color={COLORS.vecResult} label={`a×b=${fv3(crossVec)}`} />
      )}

      {/* 平行四边形面片 */}
      <ParallelogramFace a={vecA3} b={vecB3} />

      {/* HUD */}
      <Html position={[-3.5, 4, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{
          background: 'rgba(255,255,255,0.92)',
          border: `1px solid ${COLORS.border}`,
          borderRadius: RADIUS.md,
          padding: '8px 12px',
          fontSize: 18,
          color: COLORS.text,
          fontFamily: 'Inter, sans-serif',
          minWidth: 200,
        }}>
          <div><b style={{ color: COLORS.vecResult }}>a×b</b> = {fv3(crossVec)}</div>
          <div style={{ marginTop: 4 }}><b>|a×b|</b> = {f(crossMag)}（面积）</div>
          <div><b>a 与 b 夹角</b> ≈ {f(aAngleB)}°</div>
          {crossMag < 0.01 && (
            <div style={{ color: COLORS.error, marginTop: 4 }}>⚠ a ∥ b，叉积为零向量</div>
          )}
        </div>
      </Html>
    </>
  );
}

// ─── VEC-071 立体几何应用场景 ───

function Geometry3DScene() {
  const vecA3 = useVectorStore((s) => s.vecA3);
  const vecB3 = useVectorStore((s) => s.vecB3);
  const { f, fv3 } = useFmt();

  // 固定高向量 c = [0, 0, 2]
  const vecC3: Vec3D = [0, 0, 2];

  const crossVec = cross3D(vecA3, vecB3);
  const crossMag = mag3D(crossVec);
  const sum = add3D(vecA3, vecB3);
  const diagonal = add3D(sum, vecC3);
  const dotVal = dot3D(vecA3, vecB3);
  const aAngleB = toDeg(angle3D(vecA3, vecB3));

  // 计算底面积和体积
  const baseArea = crossMag;
  const volume = baseArea * 2; // 高度 |c| = 2

  return (
    <>
      <CoordAxes />

      {/* 平行六面体线框 */}
      <ParallelepipedWireframe a={vecA3} b={vecB3} c={vecC3} />

      {/* 底面两边向量 */}
      <Arrow3D to={vecA3} color={COLORS.vecA} label={`a=${fv3(vecA3)}`} />
      <Arrow3D to={vecB3} color={COLORS.vecB} label={`b=${fv3(vecB3)}`} />

      {/* 高向量 c */}
      <Arrow3D to={vecC3} color={COLORS.negVec} label="c=[0,0,2]" opacity={0.6} />

      {/* 面法向量 n = a × b */}
      {crossMag > 0.01 && (
        <Arrow3D to={crossVec} color={COLORS.vecScalar} label={`n=a×b`} opacity={0.9} />
      )}

      {/* 底面平行四边形 */}
      <ParallelogramFace a={vecA3} b={vecB3} />

      {/* 空间对角线 */}
      <Arrow3D to={diagonal} color={COLORS.vecResult} label={`对角线`} opacity={0.65} />

      {/* HUD */}
      <Html position={[-3.5, 4.5, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{
          background: 'rgba(255,255,255,0.93)',
          border: `1px solid ${COLORS.border}`,
          borderRadius: RADIUS.md,
          padding: '8px 12px',
          fontSize: 18,
          color: COLORS.text,
          fontFamily: 'Inter, sans-serif',
          minWidth: 220,
          lineHeight: 1.7,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4, color: COLORS.primary }}>立体几何应用</div>
          <div><b style={{ color: COLORS.vecScalar }}>法向量 n</b> = {fv3(crossVec)}</div>
          <div>底面积 = |a×b| = {f(crossMag, 3)}</div>
          <div>体积 = 底面积 × 2 = {f(volume, 3)}</div>
          <div>a·b = {f(dotVal)}，θ ≈ {f(aAngleB, 1)}°</div>
          <div><b style={{ color: COLORS.vecResult }}>空间对角线</b> = {fv3(diagonal)}</div>
          <div>|对角线| = {f(mag3D(diagonal), 3)}</div>
        </div>
      </Html>
    </>
  );
}

// ─── 主 Canvas3D 组件 ───

export function Canvas3D() {
  const operation = useVectorStore((s) => s.operation);
  const showPerspective = useVectorStore((s) => s.showPerspective);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);

  return (
    <div className="w-full h-full" style={{ background: COLORS.bgPage }}>
      <Canvas
        key={showPerspective ? 'perspective' : 'orthographic'}
        orthographic={!showPerspective}
        camera={showPerspective
          ? { position: [4, 3, 4] as [number, number, number], fov: 50 }
          : { position: [4, 3, 4] as [number, number, number], zoom: 80 }
        }
        style={{ width: '100%', height: '100%' }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 5, 5]} intensity={0.6} />

        {operation === 'space3D' && <Space3DScene />}
        {operation === 'crossProduct' && <CrossProductScene />}
        {operation === 'geometry3D' && <Geometry3DScene />}

        <OrbitControls
          ref={controlsRef}
          target={[0, 0, 0]}
          enablePan
          enableZoom
          enableRotate
        />
      </Canvas>

      {/* 操作提示 */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          fontSize: 18,
          color: COLORS.textMuted,
          pointerEvents: 'none',
        }}
      >
        左键旋转 | 滚轮缩放 | 中键平移
        {!showPerspective && ' | 正交投影'}
      </div>
    </div>
  );
}
