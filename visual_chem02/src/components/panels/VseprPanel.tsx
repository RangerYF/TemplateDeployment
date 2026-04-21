/**
 * VSEPR 构型可视化面板
 * 显示当前分子的 VSEPR 构型信息 + 速查表
 */

import { useMoleculeStore } from '@/store/moleculeStore';
import { findVseprTemplate } from '@/data/vsepr';
import { PanelSection } from './PanelSection';
import { COLORS } from '@/styles/tokens';

const VSEPR_TABLE = [
  { bp: 2, lp: 0, eGeom: '直线形', mGeom: '直线形', angle: '180°', example: 'CO₂, CS₂' },
  { bp: 2, lp: 1, eGeom: '三角形', mGeom: 'V形', angle: '~120°', example: 'SO₂, O₃' },
  { bp: 2, lp: 2, eGeom: '四面体', mGeom: 'V形', angle: '~104.5°', example: 'H₂O, H₂S' },
  { bp: 2, lp: 3, eGeom: '三角双锥', mGeom: '直线形', angle: '180°', example: 'XeF₂' },
  { bp: 3, lp: 0, eGeom: '三角形', mGeom: '平面三角形', angle: '120°', example: 'BF₃, SO₃' },
  { bp: 3, lp: 1, eGeom: '四面体', mGeom: '三角锥形', angle: '~107°', example: 'NH₃, PCl₃' },
  { bp: 4, lp: 0, eGeom: '四面体', mGeom: '正四面体', angle: '109.5°', example: 'CH₄, CCl₄' },
  { bp: 4, lp: 2, eGeom: '八面体', mGeom: '平面正方形', angle: '90°', example: 'XeF₄' },
  { bp: 5, lp: 0, eGeom: '三角双锥', mGeom: '三角双锥', angle: '90°/120°', example: 'PCl₅' },
  { bp: 5, lp: 1, eGeom: '八面体', mGeom: '四方锥', angle: '~90°', example: 'IF₅' },
  { bp: 6, lp: 0, eGeom: '八面体', mGeom: '正八面体', angle: '90°', example: 'SF₆' },
];

export function VseprPanel() {
  const mol = useMoleculeStore(s => s.currentMolecule);

  const currentTemplate = mol?.bond_pairs != null && mol?.lone_pairs != null
    ? findVseprTemplate(mol.bond_pairs, mol.lone_pairs)
    : null;

  return (
    <PanelSection id="vsepr" title="VSEPR 构型" defaultOpen={false}>
      <div className="space-y-3">
        {/* 当前分子的 VSEPR 信息 */}
        {currentTemplate && mol && (
          <div
            className="p-3 rounded-xl space-y-1.5"
            style={{
              background: COLORS.primaryLight,
              border: `1px solid ${COLORS.primary}`,
            }}
          >
            <div className="text-xs font-semibold" style={{ color: COLORS.primary }}>
              当前分子: {mol.formula}
            </div>
            <div className="grid grid-cols-2 gap-1">
              <InfoItem label="电子域构型" value={currentTemplate.electronGeometry} />
              <InfoItem label="分子构型" value={currentTemplate.geometry} />
              <InfoItem label="成键对" value={mol.bond_pairs?.toString() ?? '-'} />
              <InfoItem label="孤电子对" value={mol.lone_pairs?.toString() ?? '-'} />
              <InfoItem label="理想键角" value={`${currentTemplate.idealAngle}°`} />
              <InfoItem label="杂化" value={mol.hybridization ?? '-'} />
            </div>
          </div>
        )}

        {/* 速查表 */}
        <div>
          <div className="text-xs font-medium mb-1.5" style={{ color: COLORS.text }}>
            VSEPR 速查表
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  <th className="py-1 text-left" style={{ color: COLORS.textMuted }}>成键</th>
                  <th className="py-1 text-left" style={{ color: COLORS.textMuted }}>孤对</th>
                  <th className="py-1 text-left" style={{ color: COLORS.textMuted }}>构型</th>
                  <th className="py-1 text-left" style={{ color: COLORS.textMuted }}>键角</th>
                </tr>
              </thead>
              <tbody>
                {VSEPR_TABLE.map((row, i) => {
                  const isHighlighted = mol?.bond_pairs === row.bp && mol?.lone_pairs === row.lp;
                  return (
                    <tr
                      key={i}
                      style={{
                        borderBottom: `1px solid ${COLORS.border}`,
                        background: isHighlighted ? COLORS.primaryLight : 'transparent',
                      }}
                    >
                      <td className="py-1" style={{ color: COLORS.text }}>{row.bp}</td>
                      <td className="py-1" style={{ color: COLORS.text }}>{row.lp}</td>
                      <td className="py-1" style={{ color: COLORS.textSecondary }}>{row.mGeom}</td>
                      <td className="py-1" style={{ color: COLORS.info }}>{row.angle}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PanelSection>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs" style={{ color: COLORS.textMuted, fontSize: '12px' }}>{label}</div>
      <div className="text-xs font-medium" style={{ color: COLORS.text }}>{value}</div>
    </div>
  );
}
