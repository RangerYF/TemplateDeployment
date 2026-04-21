import type { ProjectMeta, SceneSnapshot } from './types';
import type { GeometryType } from '@/types/geometry';
import { mathM01Metas } from './math/m01/meta';

// ─── 注册所有模块的 meta ───

const ALL_METAS: ProjectMeta[] = [
  ...mathM01Metas,
  // 未来扩展：
  // ...mathM02Metas,
  // ...physicsP01Metas,
];

// ─── scene_data 懒加载映射 ───

const sceneLoaders: Record<string, () => Promise<SceneSnapshot>> = {};

// 动态注册 math/m01 的所有场景文件
for (const meta of mathM01Metas) {
  sceneLoaders[meta.id] = () =>
    import(`./math/m01/scenes/${meta.id}.json`).then((m) => m.default as SceneSnapshot);
}

// ─── 公开 API ───

/** 获取所有作品 meta（常驻内存，供 AI 推荐使用） */
export function getAllProjectMetas(): ProjectMeta[] {
  return ALL_METAS;
}

/** 按条件筛选作品 */
export function filterProjects(filters: {
  subject?: string;
  module?: string;
  geometryType?: GeometryType;
  sceneType?: string;
  difficulty?: string;
  tags?: string[];
}): ProjectMeta[] {
  return ALL_METAS.filter((meta) => {
    if (filters.subject && meta.subject !== filters.subject) return false;
    if (filters.module && meta.module !== filters.module) return false;
    if (filters.geometryType && meta.geometryType !== filters.geometryType) return false;
    if (filters.sceneType && meta.sceneType !== filters.sceneType) return false;
    if (filters.difficulty && meta.difficulty !== filters.difficulty) return false;
    if (filters.tags && !filters.tags.some((tag) => meta.tags.includes(tag))) return false;
    return true;
  });
}

/** 按 ID 加载 scene_data（按需加载，不占常驻内存） */
export async function loadSceneData(projectId: string): Promise<SceneSnapshot | null> {
  const loader = sceneLoaders[projectId];
  if (!loader) return null;
  return loader();
}

export type { ProjectMeta, SceneSnapshot } from './types';
