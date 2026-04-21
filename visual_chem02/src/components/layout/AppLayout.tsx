/**
 * 应用布局 — 左列表 + 中3D + 右面板
 */

import { TopBar } from './TopBar';
import { MoleculeListPanel } from '@/components/panels/MoleculeListPanel';
import { MoleculeInfoPanel } from '@/components/panels/MoleculeInfoPanel';
import { DisplayModePanel } from '@/components/panels/DisplayModePanel';
import { VseprPanel } from '@/components/panels/VseprPanel';
import { ComparePanel } from '@/components/panels/ComparePanel';
import { MoleculeScene } from '@/components/scene/MoleculeScene';
import { CompareScene } from '@/components/scene/CompareScene';
import { useMoleculeStore } from '@/store/moleculeStore';
import { COLORS } from '@/styles/tokens';

export function AppLayout() {
  const compareMode = useMoleculeStore(s => s.compareMode);
  const compareMolecule = useMoleculeStore(s => s.compareMolecule);

  const showCompareScene = compareMode && compareMolecule;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden" style={{ background: COLORS.bgPage }}>
      <TopBar />

      <div className="flex flex-1 overflow-hidden">
        {/* 左侧分子列表 */}
        <MoleculeListPanel />

        {/* 中央 3D 场景 */}
        <div className="flex-1 relative overflow-hidden">
          {showCompareScene ? <CompareScene /> : <MoleculeScene />}
        </div>

        {/* 右侧面板 */}
        <div
          className="overflow-y-auto shrink-0"
          style={{
            width: 280,
            background: COLORS.bg,
            borderLeft: `1px solid ${COLORS.border}`,
          }}
        >
          <MoleculeInfoPanel />
          <DisplayModePanel />
          <VseprPanel />
          <ComparePanel />
        </div>
      </div>
    </div>
  );
}
