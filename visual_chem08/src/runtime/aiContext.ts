import { BUFFER_SYSTEMS } from '@/data/bufferSystems';
import { INDICATORS } from '@/data/indicators';
import { TITRATION_PRESETS } from '@/data/titrationPresets';
import { useBufferStore, useComparisonStore, useTitrationStore, useUIStore } from '@/store';

export function getChem08AiContext() {
  const titration = useTitrationStore.getState();
  const buffer = useBufferStore.getState();
  const comparison = useComparisonStore.getState();
  const ui = useUIStore.getState();
  const activePreset = TITRATION_PRESETS.find((preset) => preset.type === titration.titrationTypeId);
  const activeBuffer = BUFFER_SYSTEMS.find((item) => item.id === buffer.selectedBufferId);

  return {
    templateKey: 'chem08',
    activeTab: ui.activeTab,
    titration: {
      titrationTypeId: titration.titrationTypeId,
      preset: activePreset,
      titrantConc: titration.titrantConc,
      analyteConc: titration.analyteConc,
      analyteVol: titration.analyteVol,
      selectedIndicatorIds: titration.selectedIndicatorIds,
      eqVolume: titration.curveData?.eqVolume,
      eqPH: titration.curveData?.eqPH,
      halfEqVolume: titration.curveData?.halfEqVolume,
      halfEqPH: titration.curveData?.halfEqPH,
      jumpRange: titration.curveData?.jumpRange,
      maxVolume: titration.curveData?.maxVolume,
    },
    comparison: {
      selectedTypes: comparison.selectedTypes,
      availableTypes: TITRATION_PRESETS.map((preset) => ({
        type: preset.type,
        label: preset.label,
        titrantFormula: preset.titrantFormula,
        analyteFormula: preset.analyteFormula,
        recommendedIndicators: preset.recommendedIndicators,
      })),
    },
    buffer: {
      selectedBufferId: buffer.selectedBufferId,
      system: activeBuffer,
      addedAmount: buffer.addedAmount,
      addType: buffer.addType,
      bufferConc: buffer.bufferConc,
      bufferVol: buffer.bufferVol,
      displayMode: buffer.displayMode,
      result: buffer.result,
    },
    libraries: {
      titrationPresets: TITRATION_PRESETS,
      indicators: INDICATORS,
      bufferSystems: BUFFER_SYSTEMS,
    },
    controls: {
      tabs: ['curve', 'comparison', 'buffer'],
      titrationTypes: TITRATION_PRESETS.map((preset) => preset.type),
      indicatorIds: INDICATORS.map((indicator) => indicator.id),
      bufferIds: BUFFER_SYSTEMS.map((bufferSystem) => bufferSystem.id),
      concentrationRange: [0.001, 5],
      analyteVolumeRangeMl: [1, 200],
      bufferVolumeRangeMl: [1, 1000],
      addedAmountRangeMol: [0.000001, 1],
    },
  };
}
