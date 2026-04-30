import type { PresetData } from '@/core/types';

export type AppScope =
  | 'full'
  | 'electric-feedback'
  | 'builder-feedback'
  | 'builder-free-feedback'
  | 'p08-standalone';

const rawScope = import.meta.env.VITE_APP_SCOPE?.trim().toLowerCase();

export const appScope: AppScope =
  rawScope === 'electric-feedback'
    ? 'electric-feedback'
    : rawScope === 'builder-feedback'
      ? 'builder-feedback'
      : rawScope === 'builder-free-feedback'
        ? 'builder-free-feedback'
        : rawScope === 'p08-standalone'
          ? 'p08-standalone'
        : 'full';

export const isElectricFeedbackMode = appScope === 'electric-feedback';
export const isBuilderFeedbackMode = appScope === 'builder-feedback';
export const isBuilderTemplateFeedbackMode = isBuilderFeedbackMode;
export const isBuilderFreeFeedbackMode = appScope === 'builder-free-feedback';
export const isSingleEntryBuilderFeedbackMode = isBuilderFreeFeedbackMode;
export const isP08StandaloneMode = appScope === 'p08-standalone';
export const isBuilderEnabled = !isElectricFeedbackMode && !isP08StandaloneMode;
export const isFullAppMode = appScope === 'full';
export const isElectricExperimentFeedbackMode = isElectricFeedbackMode || isBuilderFeedbackMode;

const visiblePresetCategories = isP08StandaloneMode
  ? ['P-08']
  : isElectricExperimentFeedbackMode
    ? ['P-04']
    : null;
const hiddenPresetIds = isElectricExperimentFeedbackMode
  ? new Set([
      'P04-CIR-EXP007-meter-conversion-ammeter',
      'P04-CIR-EXP008-meter-conversion-voltmeter',
    ])
  : null;

export function isPresetVisible(
  preset: Pick<PresetData, 'id' | 'category'> | undefined,
): boolean {
  if (!preset) return false;
  if (hiddenPresetIds?.has(preset.id)) return false;
  if (!visiblePresetCategories) return true;
  return visiblePresetCategories.includes(preset.category);
}

export function filterVisibleCategories(categories: string[]): string[] {
  if (!visiblePresetCategories) return categories;
  return categories.filter((category) => visiblePresetCategories.includes(category));
}

export function filterVisiblePresets<T extends Pick<PresetData, 'id' | 'category'>>(
  presets: T[],
): T[] {
  return presets.filter((preset) => isPresetVisible(preset));
}
