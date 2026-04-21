import type { PresetData } from '../types';

// ─── PresetRegistry API ───

export interface IPresetRegistry {
  register(preset: PresetData): void;
  get(id: string): PresetData | undefined;
  getAll(): PresetData[];
  getByCategory(category: string): PresetData[];
  getCategories(): string[];
}

// ─── PresetRegistry 实现 ───

export function createPresetRegistry(): IPresetRegistry {
  const presets = new Map<string, PresetData>();

  return {
    register(preset: PresetData): void {
      if (presets.has(preset.id)) {
        console.warn(
          `[PresetRegistry] 预设 "${preset.id}" 已注册，跳过重复注册`,
        );
        return;
      }
      presets.set(preset.id, preset);
    },

    get(id: string): PresetData | undefined {
      return presets.get(id);
    },

    getAll(): PresetData[] {
      return Array.from(presets.values());
    },

    getByCategory(category: string): PresetData[] {
      return Array.from(presets.values()).filter(
        (p) => p.category === category,
      );
    },

    getCategories(): string[] {
      const cats = new Set<string>();
      for (const p of presets.values()) {
        cats.add(p.category);
      }
      return Array.from(cats);
    },
  };
}

/** 全局默认实例 */
export const presetRegistry = createPresetRegistry();
