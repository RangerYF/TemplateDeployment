import { useEntityStore } from '@/editor/store/entityStore';
import type { AnyEntity, ConicEntity } from '@/types';
import { isConicEntity } from '@/types';

/**
 * Return the currently active entity (conic or line), or `null` if nothing is selected.
 */
export function useActiveEntity(): AnyEntity | null {
  const entities       = useEntityStore((s) => s.entities);
  const activeEntityId = useEntityStore((s) => s.activeEntityId);
  return entities.find((e) => e.id === activeEntityId) ?? null;
}

/**
 * Return the active entity only when it is a conic (not a line, implicit curve, or movable point).
 * Used by panels that only operate on conics.
 */
export function useActiveConic(): ConicEntity | null {
  const entity = useActiveEntity();
  if (!entity || !isConicEntity(entity)) return null;
  return entity;
}

/**
 * Type-safe variant: returns the active entity only when its discriminant
 * `type` field matches the requested type, otherwise `null`.
 */
export function useActiveEntityOfType<T extends AnyEntity>(
  type: T['type'],
): T | null {
  const entity = useActiveEntity();
  if (!entity || entity.type !== type) return null;
  return entity as T;
}
