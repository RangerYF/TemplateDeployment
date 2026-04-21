import React from 'react';
import type { Entity, EntityType } from '@/editor/entities/types';

// ─── 渲染器注册表 ───

type RendererComponent = React.ComponentType<{ entity: Entity }>;

const rendererRegistry: Partial<Record<EntityType, RendererComponent>> = {};

/**
 * 注册实体类型对应的渲染器组件
 * 各 EntityRenderer 文件在模块顶层调用此函数自注册
 */
export function registerRenderer(type: EntityType, component: RendererComponent): void {
  rendererRegistry[type] = component;
}

/**
 * EntityRenderer — 根据实体类型分发到对应渲染器
 */
export function EntityRenderer({ entity }: { entity: Entity }) {
  const Component = rendererRegistry[entity.type];
  if (!Component) return null;
  return React.createElement(Component, { entity });
}
