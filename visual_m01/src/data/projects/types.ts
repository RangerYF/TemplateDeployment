import type { GeometryType } from '@/types/geometry';
import type { Entity } from '@/editor/entities/types';

/** 作品元数据（用于 AI 推荐匹配） */
export interface ProjectMeta {
  /** 唯一标识，如 "cube-S01-1" */
  id: string;
  /** 作品标题，如 "正方体 — 基础认知" */
  title: string;
  /** 自然语言描述（供 LLM 理解和匹配） */
  description: string;
  /** 学科 */
  subject: 'math' | 'physics' | 'chemistry';
  /** 模块编码 */
  module: string;
  /** 几何体类型 */
  geometryType: GeometryType;
  /** 场景类型编码 */
  sceneType: string;
  /** 知识点标签（供 LLM 匹配） */
  tags: string[];
  /** 难度 */
  difficulty: 'basic' | 'intermediate' | 'advanced';
  /** 来源 */
  source: 'system' | 'community';
  /** 来源真题 ID（如 geo-cmm-15476，仅 pipeline 生成的作品有值） */
  sourceQuestionId?: string;
  /** 来源真题原文 */
  sourceQuestionContent?: string;
  /** 来源真题选项（选择题） */
  sourceQuestionOptions?: string[];
  /** 来源真题答案 */
  sourceQuestionAnswer?: string;
}

/** scene_data 快照结构（与 EntityStore.getSnapshot 一致） */
export interface SceneSnapshot {
  entities: Record<string, Entity>;
  nextId: number;
  activeGeometryId: string | null;
}
