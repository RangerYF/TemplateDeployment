import { ELECTROCHEM_MODELS } from '@/data/electrochemModels';
import { getCurrentModel, getCurrentScenario, useElectrochemStore } from '@/store/electrochemStore';

export function getChem06AiContext() {
  const state = useElectrochemStore.getState();
  const currentModel = getCurrentModel(state);
  const currentScenario = getCurrentScenario(state);

  return {
    templateKey: 'chem06',
    aiLevel: 'L2',
    title: '电化学演示台',
    current: {
      selectedModelId: state.selectedModelId,
      selectedScenarioId: state.selectedScenarioId,
      playing: state.playing,
      speed: state.speed,
      progress: state.progress,
      showIonLabels: state.showIonLabels,
      ionLabelFontSize: state.ionLabelFontSize,
      searchQuery: state.searchQuery,
      familyFilter: state.familyFilter,
    },
    activeModel: {
      id: currentModel.id,
      title: currentModel.title,
      family: currentModel.family,
      subtype: currentModel.subtype,
      level: currentModel.level,
      environment: currentModel.environment,
      layoutPreset: currentModel.layoutPreset,
      tags: currentModel.tags,
      scenarios: currentModel.scenarios.map((scenario) => ({
        id: scenario.id,
        label: scenario.label,
        duration: scenario.duration,
        totalReaction: scenario.totalReaction,
        currentDirection: scenario.currentDirection,
        electronDirection: scenario.electronDirection,
        keyframes: scenario.keyframes.map((keyframe) => ({
          at: keyframe.at,
          title: keyframe.title,
          focus: keyframe.focus,
        })),
      })),
    },
    activeScenario: {
      id: currentScenario.id,
      label: currentScenario.label,
      caption: currentScenario.caption,
      totalReaction: currentScenario.totalReaction,
      currentDirection: currentScenario.currentDirection,
      electronDirection: currentScenario.electronDirection,
      leftElectrode: currentScenario.leftElectrode,
      rightElectrode: currentScenario.rightElectrode,
      streams: currentScenario.streams.map((stream) => ({
        id: stream.id,
        label: stream.label,
        kind: stream.kind,
        direction: stream.direction,
        note: stream.note,
        emphasis: stream.emphasis,
      })),
      keyframes: currentScenario.keyframes,
      phIndicators: currentScenario.phIndicators,
      competition: currentScenario.competition,
      trend: currentScenario.trend,
    },
    options: {
      familyFilters: ['all', 'galvanic', 'electrolytic'],
      speeds: [0.5, 1, 2],
      progressRange: [0, 1],
      ionLabelFontSizeRange: [10, 18],
    },
    modelLibrary: ELECTROCHEM_MODELS.map((model) => ({
      id: model.id,
      title: model.title,
      family: model.family,
      subtype: model.subtype,
      level: model.level,
      environment: model.environment,
      layoutPreset: model.layoutPreset,
      tags: model.tags,
      scenarios: model.scenarios.map((scenario) => ({
        id: scenario.id,
        label: scenario.label,
      })),
    })),
    resultInterpretationHints: [
      '电极反应、总反应、电子/电流方向、离子流和关键帧来自 C06 内置模型数据。',
      'AI 应通过 operations 选择模型、场景、播放进度、显示项和筛选条件，不要直接手写 electrochem 状态树。',
      '选择模型必须来自 modelLibrary；选择场景必须属于当前或目标模型的 scenarios。',
      '派生解释和可视化粒子流由 C06 数据驱动，AI 不应伪造反应式或迁移方向。',
    ],
  };
}
