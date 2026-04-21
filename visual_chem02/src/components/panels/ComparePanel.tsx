/**
 * 对比面板 — 两个分子的参数对比表
 * 含元数据属性 + 键长/键角/键能对比
 */

import { useMemo } from 'react';
import { useMoleculeStore } from '@/store/moleculeStore';
import { PanelSection } from './PanelSection';
import { COLORS } from '@/styles/tokens';
import { analyzeBonds, formatBondLengths, formatBondAngles, formatBondEnergies } from '@/engine/bondAnalysis';

export function ComparePanel() {
  const mol = useMoleculeStore(s => s.currentMolecule);
  const compareMol = useMoleculeStore(s => s.compareMolecule);
  const currentModel = useMoleculeStore(s => s.currentModel);
  const compareModel = useMoleculeStore(s => s.compareModel);
  const compareMode = useMoleculeStore(s => s.compareMode);
  const toggleCompareMode = useMoleculeStore(s => s.toggleCompareMode);
  const setCompareMolecule = useMoleculeStore(s => s.setCompareMolecule);

  const analysisA = useMemo(() => {
    if (!currentModel || !mol) return null;
    return analyzeBonds(currentModel, mol);
  }, [currentModel, mol]);

  const analysisB = useMemo(() => {
    if (!compareModel || !compareMol) return null;
    return analyzeBonds(compareModel, compareMol);
  }, [compareModel, compareMol]);

  return (
    <PanelSection id="compare" title="分子对比" defaultOpen={false}>
      <div className="space-y-3">
        {/* 对比模式开关 */}
        <label className="flex items-center justify-between cursor-pointer py-0.5">
          <span className="text-xs font-medium" style={{ color: COLORS.text }}>
            启用对比模式
          </span>
          <div
            className="relative w-8 h-4 rounded-full transition-colors"
            style={{ background: compareMode ? COLORS.primary : COLORS.bgActive }}
            onClick={toggleCompareMode}
          >
            <div
              className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform shadow-sm"
              style={{ transform: compareMode ? 'translateX(16px)' : 'translateX(2px)' }}
            />
          </div>
        </label>

        {/* 对比内容 */}
        {compareMode && mol && compareMol && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  <th className="py-1.5 text-left" style={{ color: COLORS.textMuted }}>属性</th>
                  <th className="py-1.5 text-left" style={{ color: COLORS.primary }}>
                    {mol.formula}
                  </th>
                  <th className="py-1.5 text-left" style={{ color: COLORS.info }}>
                    {compareMol.formula}
                  </th>
                </tr>
              </thead>
              <tbody>
                <CompareRow label="中文名" a={mol.name_cn} b={compareMol.name_cn} />
                <CompareRow label="空间构型" a={mol.geometry} b={compareMol.geometry} />
                <CompareRow label="VSEPR" a={mol.vsepr} b={compareMol.vsepr} />
                <CompareRow label="杂化方式" a={mol.hybridization} b={compareMol.hybridization} />
                <CompareRow label="成键对" a={mol.bond_pairs?.toString()} b={compareMol.bond_pairs?.toString()} />
                <CompareRow label="孤对" a={mol.lone_pairs?.toString()} b={compareMol.lone_pairs?.toString()} />
                <CompareRow label="极性" a={mol.polarity} b={compareMol.polarity} />
                <CompareRow label="官能团" a={mol.functional_group} b={compareMol.functional_group} />
                <CompareRow label="学段" a={mol.level} b={compareMol.level} />

                {/* 键长/键角/键能对比 */}
                {analysisA && analysisB && (
                  <>
                    <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                      <td colSpan={3} className="py-1.5 text-xs font-medium" style={{ color: COLORS.text, paddingTop: 8 }}>
                        键参数对比
                      </td>
                    </tr>
                    <CompareRow
                      label="键长 (pm)"
                      a={formatBondLengths(analysisA.bondLengths)}
                      b={formatBondLengths(analysisB.bondLengths)}
                    />
                    <CompareRow
                      label="键角 (°)"
                      a={formatBondAngles(analysisA.bondAngles)}
                      b={formatBondAngles(analysisB.bondAngles)}
                    />
                    <CompareRow
                      label="键能 (kJ/mol)"
                      a={formatBondEnergies(analysisA.bondLengths)}
                      b={formatBondEnergies(analysisB.bondLengths)}
                    />
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 提示 */}
        {compareMode && !compareMol && (
          <p className="text-xs py-2 text-center" style={{ color: COLORS.textMuted }}>
            请从左侧分子列表选择对比分子
          </p>
        )}

        {compareMode && compareMol && (
          <button
            className="w-full py-1.5 text-xs rounded-lg transition-colors"
            style={{
              background: COLORS.bgMuted,
              color: COLORS.textSecondary,
              border: `1px solid ${COLORS.border}`,
            }}
            onClick={() => setCompareMolecule(null)}
          >
            清除对比
          </button>
        )}
      </div>
    </PanelSection>
  );
}

function CompareRow({ label, a, b }: { label: string; a?: string; b?: string }) {
  const same = a && b && a === b;
  return (
    <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
      <td className="py-1" style={{ color: COLORS.textMuted, whiteSpace: 'nowrap' }}>{label}</td>
      <td className="py-1" style={{ color: COLORS.text, fontSize: '12px', wordBreak: 'break-all' }}>{a || '-'}</td>
      <td
        className="py-1"
        style={{ color: same ? COLORS.textMuted : COLORS.text, fontSize: '12px', wordBreak: 'break-all' }}
      >
        {b || '-'}
        {a && b && a !== b && (
          <span className="ml-1" style={{ color: COLORS.warning, fontSize: '12px' }}>≠</span>
        )}
      </td>
    </tr>
  );
}
