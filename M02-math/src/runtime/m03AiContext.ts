import { useEntityStore } from '@/editor/store/entityStore';
import { useM03InteractionStore } from '@/editor/store/m03InteractionStore';
import { useLocusStore } from '@/editor/store/locusStore';
import { useOpticalStore } from '@/editor/store/opticalStore';
import type { AnyEntity, ConicEntity, LineEntity } from '@/types';
import { isConicEntity } from '@/types';

type ConicSummary = {
  id: string;
  type: ConicEntity['type'];
  label: string | null;
  visible: boolean;
  params: ConicEntity['params'];
  derived: ConicEntity['derived'];
};

type LineSummary = {
  id: string;
  label: string | null;
  visible: boolean;
  params: LineEntity['params'];
  equationStr?: string | null;
};

type EntitySummary = {
  id: string;
  type: AnyEntity['type'];
  label: string | null;
  visible: boolean;
};

export interface M03AiContext {
  templateKey: 'm03';
  activeEntityId: string | null;
  activeEntity: EntitySummary | null;
  entities: EntitySummary[];
  conics: ConicSummary[];
  lines: LineSummary[];
  availableEntityLabels: string[];
  viewport: ReturnType<ReturnType<typeof useEntityStore.getState>['getSnapshot']>['viewport'];
  displayOptions: ReturnType<ReturnType<typeof useEntityStore.getState>['getSnapshot']>['displayOptions'];
  interaction: ReturnType<ReturnType<typeof useM03InteractionStore.getState>['getSnapshot']>;
  locus: ReturnType<ReturnType<typeof useLocusStore.getState>['getSnapshot']>;
  optical: ReturnType<ReturnType<typeof useOpticalStore.getState>['getSnapshot']>;
  notes: string[];
}

function entityLabel(entity: AnyEntity): string | null {
  return typeof entity.label === 'string' && entity.label.trim() ? entity.label.trim() : null;
}

function summarizeEntity(entity: AnyEntity): EntitySummary {
  return {
    id: entity.id,
    type: entity.type,
    label: entityLabel(entity),
    visible: entity.visible,
  };
}

export function buildM03AiContext(): M03AiContext {
  const entityState = useEntityStore.getState();
  const entitySnapshot = entityState.getSnapshot();
  const entities = entitySnapshot.entities;
  const activeEntity = entities.find((entity) => entity.id === entitySnapshot.activeEntityId) ?? null;

  return {
    templateKey: 'm03',
    activeEntityId: entitySnapshot.activeEntityId,
    activeEntity: activeEntity ? summarizeEntity(activeEntity) : null,
    entities: entities.map(summarizeEntity),
    conics: entities.filter(isConicEntity).map((entity) => ({
      id: entity.id,
      type: entity.type,
      label: entityLabel(entity),
      visible: entity.visible,
      params: structuredClone(entity.params),
      derived: structuredClone(entity.derived),
    })),
    lines: entities
      .filter((entity): entity is LineEntity => entity.type === 'line')
      .map((entity) => ({
        id: entity.id,
        label: entityLabel(entity),
        visible: entity.visible,
        params: structuredClone(entity.params),
        equationStr: entity.equationStr,
      })),
    availableEntityLabels: entities
      .map(entityLabel)
      .filter((label): label is string => Boolean(label)),
    viewport: structuredClone(entitySnapshot.viewport),
    displayOptions: structuredClone(entitySnapshot.displayOptions),
    interaction: structuredClone(useM03InteractionStore.getState().getSnapshot()),
    locus: structuredClone(useLocusStore.getState().getSnapshot()),
    optical: structuredClone(useOpticalStore.getState().getSnapshot()),
    notes: [
      'M03 AI 第一阶段优先使用 operations 创建/修改圆锥曲线、直线、隐式曲线、显示项、视窗和专题开关。',
      'pinned points、pinned intersections 和动点动画可被 snapshot 保存，但第一阶段 AI 不主动创建。',
      '引用已有对象时优先使用 entityId；没有 entityId 时使用唯一 label；对象缺失或歧义时返回 warnings。',
    ],
  };
}
