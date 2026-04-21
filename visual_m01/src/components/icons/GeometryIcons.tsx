interface IconProps {
  size?: number;
  className?: string;
}

// 公共样式常量
const HIDDEN = { strokeDasharray: '2 1.5', opacity: 0.4 };
const SW = 1.1; // strokeWidth

/** 正方体 — 斜二测画法，3条隐藏棱 */
export function CubeIcon({ size = 18, className }: IconProps) {
  // Front face: A(2,7) B(10,7) C(10,16) D(2,16)
  // Back face:  E(6,3) F(14,3) G(14,12) H(6,12)
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={SW} strokeLinejoin="round" className={className}>
      {/* 前面 */}
      <rect x="2" y="7" width="8" height="9" />
      {/* 顶面 */}
      <polygon points="2,7 6,3 14,3 10,7" />
      {/* 右面 */}
      <polygon points="10,7 14,3 14,12 10,16" />
      {/* 隐藏棱 */}
      <line x1="2" y1="16" x2="6" y2="12" {...HIDDEN} />
      <line x1="6" y1="12" x2="14" y2="12" {...HIDDEN} />
      <line x1="6" y1="12" x2="6" y2="3" {...HIDDEN} />
    </svg>
  );
}

/** 长方体 — 斜二测画法，3条隐藏棱 */
export function CuboidIcon({ size = 18, className }: IconProps) {
  // Front: A(1,8) B(11,8) C(11,16) D(1,16)
  // Back:  E(5,3) F(15,3) G(15,11) H(5,11)
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={SW} strokeLinejoin="round" className={className}>
      {/* 前面 */}
      <rect x="1" y="8" width="10" height="8" />
      {/* 顶面 */}
      <polygon points="1,8 5,3 15,3 11,8" />
      {/* 右面 */}
      <polygon points="11,8 15,3 15,11 11,16" />
      {/* 隐藏棱 */}
      <line x1="1" y1="16" x2="5" y2="11" {...HIDDEN} />
      <line x1="5" y1="11" x2="15" y2="11" {...HIDDEN} />
      <line x1="5" y1="11" x2="5" y2="3" {...HIDDEN} />
    </svg>
  );
}

/** 正棱柱 — 六棱柱斜二测，隐藏棱虚线 */
export function PrismIcon({ size = 18, className }: IconProps) {
  // Top hexagon (slightly tilted to show depth)
  // Bottom hexagon (same shape, shifted down)
  // Using a simplified view: see top face + 3 front vertical edges
  // Top: A(5,2) B(13,2) C(16,5) D(13,8) E(5,8) F(2,5)
  // Bottom: shift down by 8: A'(5,10) B'(13,10) C'(16,13) D'(13,16) E'(5,16) F'(2,13)
  // Visible verticals: A-A', B-B', C-C' (front three)
  // Hidden verticals: D-D', E-E', F-F'

  // Simpler approach - a hexagonal prism viewed from front-right-above
  // Top hex (visible): centered, showing 3D depth
  const tx = [9, 14, 14, 9, 4, 4]; // top hex x
  const ty = [1, 3, 6, 8, 6, 3];   // top hex y
  const bx = tx;                      // bottom hex x (same)
  const by = ty.map(y => y + 8);     // bottom hex y (shifted down)

  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={SW} strokeLinejoin="round" className={className}>
      {/* 顶面（全部可见） */}
      <polygon points={tx.map((x, i) => `${x},${ty[i]}`).join(' ')} />
      {/* 底面可见边 */}
      <line x1={bx[1]} y1={by[1]} x2={bx[2]} y2={by[2]} />
      <line x1={bx[2]} y1={by[2]} x2={bx[3]} y2={by[3]} />
      <line x1={bx[3]} y1={by[3]} x2={bx[4]} y2={by[4]} />
      {/* 底面隐藏边 */}
      <line x1={bx[4]} y1={by[4]} x2={bx[5]} y2={by[5]} {...HIDDEN} />
      <line x1={bx[5]} y1={by[5]} x2={bx[0]} y2={by[0]} {...HIDDEN} />
      <line x1={bx[0]} y1={by[0]} x2={bx[1]} y2={by[1]} {...HIDDEN} />
      {/* 可见竖棱 */}
      <line x1={tx[1]} y1={ty[1]} x2={bx[1]} y2={by[1]} />
      <line x1={tx[2]} y1={ty[2]} x2={bx[2]} y2={by[2]} />
      <line x1={tx[3]} y1={ty[3]} x2={bx[3]} y2={by[3]} />
      <line x1={tx[4]} y1={ty[4]} x2={bx[4]} y2={by[4]} />
      {/* 隐藏竖棱 */}
      <line x1={tx[5]} y1={ty[5]} x2={bx[5]} y2={by[5]} {...HIDDEN} />
      <line x1={tx[0]} y1={ty[0]} x2={bx[0]} y2={by[0]} {...HIDDEN} />
    </svg>
  );
}

/** 棱锥 — 四棱锥斜二测，2条隐藏棱 */
export function PyramidIcon({ size = 18, className }: IconProps) {
  // Apex: S(9, 1.5)
  // Base (parallelogram viewed from above):
  //   A(2,12) B(8,10) C(16,12) D(10,14)
  // Visible base edges: A-D, D-C, C-B (front/right)
  // Hidden base edge: A-B (back-left)
  // Visible laterals: S-A, S-C, S-D
  // Hidden lateral: S-B
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={SW} strokeLinejoin="round" className={className}>
      {/* 底面可见边 */}
      <line x1="2" y1="13" x2="10" y2="16" />
      <line x1="10" y1="16" x2="16" y2="13" />
      {/* 底面隐藏边 */}
      <line x1="2" y1="13" x2="8" y2="10" {...HIDDEN} />
      <line x1="8" y1="10" x2="16" y2="13" {...HIDDEN} />
      {/* 可见侧棱 */}
      <line x1="9" y1="2" x2="2" y2="13" />
      <line x1="9" y1="2" x2="16" y2="13" />
      <line x1="9" y1="2" x2="10" y2="16" />
      {/* 隐藏侧棱 */}
      <line x1="9" y1="2" x2="8" y2="10" {...HIDDEN} />
    </svg>
  );
}

/** 棱台 — 四棱台斜二测，隐藏棱虚线 */
export function FrustumIcon({ size = 18, className }: IconProps) {
  // Top face (small parallelogram):
  //   E(6,5) F(8,4) G(12,5) H(10,6)
  // Bottom face (larger parallelogram):
  //   A(2,13) B(8,10) C(16,13) D(10,16)
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={SW} strokeLinejoin="round" className={className}>
      {/* 上面（全部可见） */}
      <polygon points="6,5 8,4 12,5 10,6" />
      {/* 底面可见边 */}
      <line x1="2" y1="13" x2="10" y2="16" />
      <line x1="10" y1="16" x2="16" y2="13" />
      {/* 底面隐藏边 */}
      <line x1="2" y1="13" x2="8" y2="10" {...HIDDEN} />
      <line x1="8" y1="10" x2="16" y2="13" {...HIDDEN} />
      {/* 可见侧棱 */}
      <line x1="6" y1="5" x2="2" y2="13" />
      <line x1="12" y1="5" x2="16" y2="13" />
      <line x1="10" y1="6" x2="10" y2="16" />
      {/* 隐藏侧棱 */}
      <line x1="8" y1="4" x2="8" y2="10" {...HIDDEN} />
    </svg>
  );
}

/** 圆锥 — 底面椭圆后半虚线 */
export function ConeIcon({ size = 18, className }: IconProps) {
  // Apex: (9, 2)
  // Base ellipse: cx=9, cy=14, rx=6, ry=2.5
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={SW} className={className}>
      {/* 侧面母线 */}
      <line x1="9" y1="2" x2="3" y2="14" />
      <line x1="9" y1="2" x2="15" y2="14" />
      {/* 底面椭圆前半（可见） */}
      <path d="M 3,14 A 6,2.5 0 0,0 15,14" />
      {/* 底面椭圆后半（隐藏） */}
      <path d="M 3,14 A 6,2.5 0 0,1 15,14" {...HIDDEN} />
    </svg>
  );
}

/** 圆台 — 上下椭圆，下底后半虚线 */
export function TruncatedConeIcon({ size = 18, className }: IconProps) {
  // Top ellipse: cx=9, cy=5, rx=3, ry=1.2
  // Bottom ellipse: cx=9, cy=14, rx=6, ry=2.5
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={SW} className={className}>
      {/* 侧面母线 */}
      <line x1="6" y1="5" x2="3" y2="14" />
      <line x1="12" y1="5" x2="15" y2="14" />
      {/* 上面椭圆（全部可见） */}
      <ellipse cx="9" cy="5" rx="3" ry="1.2" />
      {/* 底面椭圆前半（可见） */}
      <path d="M 3,14 A 6,2.5 0 0,0 15,14" />
      {/* 底面椭圆后半（隐藏） */}
      <path d="M 3,14 A 6,2.5 0 0,1 15,14" {...HIDDEN} />
    </svg>
  );
}

/** 圆柱 — 上椭圆全可见，下椭圆后半虚线 */
export function CylinderIcon({ size = 18, className }: IconProps) {
  // Top ellipse: cx=9, cy=4, rx=5, ry=2
  // Bottom ellipse: cx=9, cy=14, rx=5, ry=2
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={SW} className={className}>
      {/* 上面椭圆（全部可见） */}
      <ellipse cx="9" cy="4" rx="5" ry="2" />
      {/* 竖直母线 */}
      <line x1="4" y1="4" x2="4" y2="14" />
      <line x1="14" y1="4" x2="14" y2="14" />
      {/* 底面椭圆前半（可见） */}
      <path d="M 4,14 A 5,2 0 0,0 14,14" />
      {/* 底面椭圆后半（隐藏） */}
      <path d="M 4,14 A 5,2 0 0,1 14,14" {...HIDDEN} />
    </svg>
  );
}

/** 球 — 外圆 + 赤道半虚线 + 经线半虚线 */
export function SphereIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={SW} className={className}>
      {/* 外轮廓 */}
      <circle cx="9" cy="9" r="7" />
      {/* 赤道前半（可见） */}
      <path d="M 2,9 A 7,2.5 0 0,0 16,9" />
      {/* 赤道后半（隐藏） */}
      <path d="M 2,9 A 7,2.5 0 0,1 16,9" {...HIDDEN} />
      {/* 经线前半（可见，右半） */}
      <path d="M 9,2 A 2.5,7 0 0,1 9,16" />
      {/* 经线后半（隐藏，左半） */}
      <path d="M 9,2 A 2.5,7 0 0,0 9,16" {...HIDDEN} />
    </svg>
  );
}

/** 正四面体 — 1条隐藏棱 */
export function RegularTetrahedronIcon({ size = 18, className }: IconProps) {
  // Apex: D(9, 1.5)
  // Base triangle (viewed from above-right):
  //   A(2, 15) front-left
  //   B(15, 15) front-right
  //   C(11, 9) back
  // Hidden edge: A-C (behind the solid)
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={SW} strokeLinejoin="round" className={className}>
      {/* 底面可见边 */}
      <line x1="2" y1="15" x2="15" y2="15" />
      <line x1="15" y1="15" x2="11" y2="9" />
      {/* 底面隐藏边 */}
      <line x1="2" y1="15" x2="11" y2="9" {...HIDDEN} />
      {/* 可见侧棱 */}
      <line x1="9" y1="1.5" x2="2" y2="15" />
      <line x1="9" y1="1.5" x2="15" y2="15" />
      <line x1="9" y1="1.5" x2="11" y2="9" />
    </svg>
  );
}

/** 墙角四面体 — 直角顶点处3条互相垂直的棱，1条隐藏 */
export function CornerTetrahedronIcon({ size = 18, className }: IconProps) {
  // Right-angle vertex O at back: (7, 10)
  // Three perpendicular edges from O:
  //   A(15, 14) along "x-axis" (right-front)
  //   B(2, 14) along "z-axis" (left-front)
  //   C(7, 2) along "y-axis" (up)
  // Hidden edges: O-A, O-B (behind the front triangle face A-B-C)
  // Actually O is at the back corner, so O's edges going to the front are hidden
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={SW} strokeLinejoin="round" className={className}>
      {/* 可见面的边（前三角形 A-B-C） */}
      <line x1="15" y1="14" x2="2" y2="14" />
      <line x1="2" y1="14" x2="7" y2="2" />
      <line x1="7" y1="2" x2="15" y2="14" />
      {/* 从直角顶点出发的棱（部分隐藏） */}
      <line x1="7" y1="10" x2="7" y2="2" />
      <line x1="7" y1="10" x2="15" y2="14" {...HIDDEN} />
      <line x1="7" y1="10" x2="2" y2="14" {...HIDDEN} />
      {/* 直角标记 */}
      <polyline points="7,8.2 8.8,8.8 8.2,10.6" strokeWidth="0.8" fill="none" />
    </svg>
  );
}

/** 等腰四面体 — 对棱相等，1条隐藏棱 + 等号标记 */
export function IsoscelesTetrahedronIcon({ size = 18, className }: IconProps) {
  // Same base shape as regular tetrahedron
  // A(2, 15) B(15, 15) C(11, 9) D(9, 1.5)
  // Hidden: A-C
  // Equal marks on opposite edge pairs
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={SW} strokeLinejoin="round" className={className}>
      {/* 底面可见边 */}
      <line x1="2" y1="15" x2="15" y2="15" />
      <line x1="15" y1="15" x2="11" y2="9" />
      {/* 底面隐藏边 */}
      <line x1="2" y1="15" x2="11" y2="9" {...HIDDEN} />
      {/* 可见侧棱 */}
      <line x1="9" y1="1.5" x2="2" y2="15" />
      <line x1="9" y1="1.5" x2="15" y2="15" />
      <line x1="9" y1="1.5" x2="11" y2="9" />
      {/* 对棱等号标记（AB=CD 用短横线表示） */}
      <line x1="7.5" y1="14.5" x2="9.5" y2="14.5" strokeWidth="1.4" />
      <line x1="7.5" y1="15.5" x2="9.5" y2="15.5" strokeWidth="1.4" />
    </svg>
  );
}

/** 正交四面体 — 对棱垂直，1条隐藏棱 + 垂直标记 */
export function OrthogonalTetrahedronIcon({ size = 18, className }: IconProps) {
  // Same base as regular tetrahedron
  // A(2, 15) B(15, 15) C(11, 9) D(9, 1.5)
  // Hidden: A-C
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={SW} strokeLinejoin="round" className={className}>
      {/* 底面可见边 */}
      <line x1="2" y1="15" x2="15" y2="15" />
      <line x1="15" y1="15" x2="11" y2="9" />
      {/* 底面隐藏边 */}
      <line x1="2" y1="15" x2="11" y2="9" {...HIDDEN} />
      {/* 可见侧棱 */}
      <line x1="9" y1="1.5" x2="2" y2="15" />
      <line x1="9" y1="1.5" x2="15" y2="15" />
      <line x1="9" y1="1.5" x2="11" y2="9" />
      {/* 垂直标记 ⊥ */}
      <line x1="8" y1="5" x2="8" y2="7.5" strokeWidth="1.2" />
      <line x1="7" y1="7.5" x2="9" y2="7.5" strokeWidth="1.2" />
    </svg>
  );
}
