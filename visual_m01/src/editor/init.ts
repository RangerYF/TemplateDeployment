import { useEffect } from 'react';
import { useEntityStore } from './store/entityStore';
import { registerAllTools } from './tools';
import { setupShortcuts, teardownShortcuts } from './shortcuts';
import { buildGeometry } from '../engine/builders';
import { DEFAULT_PARAMS } from '../types/geometry';
import type { GeometryProperties } from './entities/types';
import type { Entity } from './entities/types';

let initialized = false;

/**
 * 编辑器核心初始化（非 React 版本，可在任意上下文调用）
 * 幂等：多次调用不重复执行
 */
export function initEditor(geometryType?: import('../types/geometry').GeometryType): void {
  if (initialized) return;
  initialized = true;

  const store = useEntityStore.getState();

  // 1. 注册所有 Tool
  registerAllTools();

  // 2. 创建初始 Geometry Entity（默认正方体，可通过参数指定）
  const defaultType = geometryType ?? 'cube';
  const defaultParams = DEFAULT_PARAMS[defaultType];

  const geometry = store.createEntity('geometry', {
    geometryType: defaultType,
    params: defaultParams,
  } as GeometryProperties);

  // 3. 设置 activeGeometryId
  store.setActiveGeometryId(geometry.id);

  // 4. 构建 BuilderResult 并创建 builtIn 子实体
  const result = buildGeometry(defaultType, defaultParams);
  if (result) {
    store.createBuiltInEntities(geometry.id, result);
  }
}

/**
 * 重置编辑器状态，允许重新初始化
 * 用于从工作台切换不同作品时
 */
export function resetEditor(): void {
  const store = useEntityStore.getState();
  // 清空所有实体
  store.loadSnapshot({ entities: {}, nextId: 1, activeGeometryId: null });
  initialized = false;
}

/**
 * 使用已有快照初始化编辑器（加载已保存的作品）
 */
export function initEditorWithSnapshot(snapshot: {
  entities: Record<string, Entity>;
  nextId: number;
  activeGeometryId: string | null;
}): void {
  if (!initialized) {
    registerAllTools();
  }
  initialized = true;

  const store = useEntityStore.getState();
  store.loadSnapshot(snapshot);
}

/**
 * React Hook：在应用顶层调用一次，初始化编辑器系统
 * 包含快捷键绑定（mount 时绑定，unmount 时解绑）
 */
export function useEditorInit(): void {
  // initEditor 内部有模块级 initialized 守卫，天然幂等
  // setupShortcuts / teardownShortcuts 每次 mount/unmount 正确绑定/解绑
  // （React 18 StrictMode 会 mount→unmount→mount，需确保第二次 mount 重新绑定）
  useEffect(() => {
    initEditor();
    setupShortcuts();
    return () => {
      teardownShortcuts();
    };
  }, []);
}
