import { useCallback, useMemo } from 'react';
import { presetRegistry } from '@/core/registries/preset-registry';
import { P08_MODULES, getP08ModuleKeyByPresetId } from '@/shell/pages/p08PresetCatalog';
import type { TopBarTab, TopBarModuleSelector } from '@/shell/layout/TopBar';

export function useP08SpecialPageNav(
  presetId: string,
  onSelectPreset: (id: string) => void,
) {
  const moduleKey = getP08ModuleKeyByPresetId(presetId) ?? 'electrostatic';

  const tabs = useMemo((): TopBarTab[] => {
    const mod = P08_MODULES.find((m) => m.key === moduleKey);
    if (!mod) return [];
    return mod.presetIds
      .map((id) => {
        const p = presetRegistry.get(id);
        return p ? { id, label: p.name } : null;
      })
      .filter((t): t is TopBarTab => t !== null);
  }, [moduleKey]);

  const handleSelectTab = useCallback(
    (tabId: string) => {
      if (tabId !== presetId) onSelectPreset(tabId);
    },
    [presetId, onSelectPreset],
  );

  const moduleSelector: TopBarModuleSelector = useMemo(
    () => ({
      modules: P08_MODULES.map((m) => ({ key: m.key, label: m.shortTitle })),
      activeKey: moduleKey,
      onSelect: (newKey: string) => {
        const mod = P08_MODULES.find((m) => m.key === newKey);
        if (mod) onSelectPreset(mod.recommendedPresetId);
      },
    }),
    [moduleKey, onSelectPreset],
  );

  return { tabs, handleSelectTab, moduleSelector };
}
