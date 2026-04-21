import { useMemo } from 'react';
import type { BuilderResult } from '../engine/types';
import type { GeometryProperties } from './entities/types';
import { useEntityStore } from './store/entityStore';
import { buildGeometry } from '../engine/builders';
import { signals } from './signals';

// ─── 运行时缓存 ───

interface CacheEntry {
  params: GeometryProperties['params'];
  geometryType: GeometryProperties['geometryType'];
  result: BuilderResult;
}

const cache = new Map<string, CacheEntry>();

/**
 * 获取几何体的 BuilderResult（缓存命中时直接返回）
 * 参数变化时自动重算并发射 geometryRebuilt Signal
 */
export function getBuilderResult(
  geometryId: string,
  geometryType: GeometryProperties['geometryType'],
  params: GeometryProperties['params'],
): BuilderResult | null {
  const entry = cache.get(geometryId);

  if (
    entry &&
    entry.geometryType === geometryType &&
    JSON.stringify(entry.params) === JSON.stringify(params)
  ) {
    return entry.result;
  }

  const result = buildGeometry(geometryType, params as never);
  if (!result) return null;

  cache.set(geometryId, { params, geometryType, result });
  signals.geometryRebuilt.emit({ geometryId });
  return result;
}

export function invalidateCache(geometryId: string): void {
  cache.delete(geometryId);
}

export function clearCache(): void {
  cache.clear();
}

// ─── React Hook ───

/**
 * 订阅 EntityStore 中几何体实体的参数，自动获取/缓存 BuilderResult
 */
export function useBuilderResult(geometryId: string | null | undefined): BuilderResult | null {
  const geometry = useEntityStore((s) => {
    if (!geometryId) return undefined;
    const e = s.entities[geometryId];
    return e?.type === 'geometry' ? e : undefined;
  });

  return useMemo(() => {
    if (!geometry || geometry.type !== 'geometry') return null;
    const props = geometry.properties as GeometryProperties;
    return getBuilderResult(geometry.id, props.geometryType, props.params);
  }, [geometry]);
}
