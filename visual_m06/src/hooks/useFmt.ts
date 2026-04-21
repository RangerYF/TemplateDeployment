import { useVectorStore } from '@/editor';
import { fmt, fmtVec2D, fmtVec3D, fmtSurd, fmtVec2DSurd, fmtVec3DSurd } from '@/engine/vectorMath';
import type { Vec2D, Vec3D } from '@/editor/entities/types';

/** 返回绑定到当前 decimalPlaces / surdMode 的格式化函数 */
export function useFmt() {
  const dp = useVectorStore((s) => s.decimalPlaces);
  const surd = useVectorStore((s) => s.surdMode);
  return {
    f: (n: number, customDp?: number) => surd ? fmtSurd(n, customDp ?? dp) : fmt(n, customDp ?? dp),
    fv2: (v: Vec2D) => surd ? fmtVec2DSurd(v, dp) : fmtVec2D(v, dp),
    fv3: (v: Vec3D) => surd ? fmtVec3DSurd(v, dp) : fmtVec3D(v, dp),
  };
}
