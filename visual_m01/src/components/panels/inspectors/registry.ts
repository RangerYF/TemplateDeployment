import React from 'react';
import type { Entity, EntityType } from '@/editor/entities/types';

type InspectorComponent = React.ComponentType<{ entity: Entity }>;

export const inspectorRegistry: Partial<Record<EntityType, InspectorComponent>> = {};

export function registerInspector(type: EntityType, component: InspectorComponent): void {
  inspectorRegistry[type] = component;
}
