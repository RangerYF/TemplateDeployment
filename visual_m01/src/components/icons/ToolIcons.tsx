interface IconProps {
  size?: number;
  className?: string;
  color?: string;
}

/** 选择 — 鼠标指针箭头 */
export function SelectIcon({ size = 18, className, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M5 3l14 10h-7.5l-3.5 8L5 3z" fill={color} stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

/** 画线段 — 两端带点的斜线 */
export function DrawSegmentIcon({ size = 18, className, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" className={className}>
      <line x1="5" y1="19" x2="19" y2="5" />
      <circle cx="5" cy="19" r="2" fill={color} />
      <circle cx="19" cy="5" r="2" fill={color} />
    </svg>
  );
}

/** 创建截面 — 立方体被平面切割 */
export function CrossSectionIcon({ size = 18, className, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      {/* 立方体轮廓（浅色） */}
      <path d="M4 8l8-4 8 4v8l-8 4-8-4V8z" stroke={color} strokeWidth="1.2" strokeLinejoin="round" opacity="0.4" />
      <line x1="4" y1="8" x2="20" y2="8" stroke={color} strokeWidth="1.2" opacity="0.4" />
      {/* 截面填充区域 */}
      <polygon points="4,11 12,6 20,13 12,18" fill={color} opacity="0.2" />
      <polygon points="4,11 12,6 20,13 12,18" stroke={color} strokeWidth="1.8" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

/** 建坐标系 — XYZ 三轴 */
export function CoordSystemIcon({ size = 18, className, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" className={className}>
      {/* 原点 */}
      <circle cx="8" cy="16" r="1.5" fill={color} />
      {/* Y 轴（向上） */}
      <line x1="8" y1="16" x2="8" y2="4" />
      <polyline points="6,6 8,4 10,6" strokeWidth="1.3" />
      {/* X 轴（向右） */}
      <line x1="8" y1="16" x2="21" y2="16" />
      <polyline points="19,14 21,16 19,18" strokeWidth="1.3" />
      {/* Z 轴（左下） */}
      <line x1="8" y1="16" x2="2" y2="21" />
      <polyline points="2,19 2,21 4,21" strokeWidth="1.3" />
    </svg>
  );
}

/** 画外接圆 — 三角形外接圆 */
export function CircumCircleIcon({ size = 18, className, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" className={className}>
      <circle cx="12" cy="12" r="9" />
      <polygon points="12,4 4.5,18 19.5,18" strokeLinejoin="round" />
    </svg>
  );
}

/** 标记角度 — 两条射线 + 角弧线 */
export function AngleIcon({ size = 18, className, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" className={className}>
      {/* 两条射线 */}
      <line x1="4" y1="20" x2="20" y2="20" />
      <line x1="4" y1="20" x2="16" y2="4" />
      {/* 角弧 */}
      <path d="M10 20 A 7 7 0 0 1 8.4 14" fill="none" strokeWidth="1.5" />
    </svg>
  );
}

/** 标记距离 — 两端带横线的双向箭头 */
export function DistanceIcon({ size = 18, className, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" className={className}>
      {/* 左端标线 */}
      <line x1="4" y1="8" x2="4" y2="16" />
      {/* 右端标线 */}
      <line x1="20" y1="8" x2="20" y2="16" />
      {/* 中间连线 */}
      <line x1="4" y1="12" x2="20" y2="12" />
      {/* 左箭头 */}
      <polyline points="7,10 4,12 7,14" strokeWidth="1.3" />
      {/* 右箭头 */}
      <polyline points="17,10 20,12 17,14" strokeWidth="1.3" />
    </svg>
  );
}
