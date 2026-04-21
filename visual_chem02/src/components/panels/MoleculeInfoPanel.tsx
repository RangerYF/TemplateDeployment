/**
 * 分子信息面板 — 命名互译 + 属性展示
 * 导入分子允许单击编辑字段
 */

import { useState, useMemo } from 'react';
import { useMoleculeStore } from '@/store/moleculeStore';
import type { MoleculeMetadata } from '@/data/moleculeMetadata';
import { PanelSection } from './PanelSection';
import { COLORS } from '@/styles/tokens';
import { computeDeviationNotes, type DeviationNote } from '@/engine/deviationNotes';

export function MoleculeInfoPanel() {
  const mol = useMoleculeStore(s => s.currentMolecule);
  const model = useMoleculeStore(s => s.currentModel);
  const updateImportedMeta = useMoleculeStore(s => s.updateImportedMeta);

  const isImported = mol?.id.startsWith('IMP-') ?? false;

  if (!mol) {
    return (
      <PanelSection id="info" title="分子信息">
        <p className="text-xs py-4 text-center" style={{ color: COLORS.textMuted }}>
          请从左侧选择一个分子
        </p>
      </PanelSection>
    );
  }

  const handleUpdate = (field: keyof MoleculeMetadata, value: string) => {
    if (!isImported) return;
    updateImportedMeta(mol.id, { [field]: value });
  };

  const infoRows: { label: string; field: keyof MoleculeMetadata; value: string | undefined }[] = [
    { label: '编号', field: 'id', value: mol.id },
    { label: '中文名', field: 'name_cn', value: mol.name_cn },
    { label: '英文名', field: 'name_en', value: mol.name_en },
    { label: '分子式', field: 'formula', value: mol.formula },
    { label: '学段', field: 'level', value: mol.level },
    { label: '空间构型', field: 'geometry', value: mol.geometry },
    { label: 'VSEPR', field: 'vsepr', value: mol.vsepr },
    { label: '杂化方式', field: 'hybridization', value: mol.hybridization },
    { label: '中心原子', field: 'central_atom', value: mol.central_atom },
    { label: '极性', field: 'polarity', value: mol.polarity },
    { label: '官能团', field: 'functional_group', value: mol.functional_group },
    { label: '特征', field: 'features', value: mol.features },
  ];

  // 对于内置分子，只显示有值的行；对于导入分子，显示全部（可编辑）
  const visibleRows = isImported ? infoRows : infoRows.filter(r => r.value);

  return (
    <PanelSection id="info" title="分子信息">
      <div className="space-y-1.5">
        {/* 标题区 */}
        <div className="pb-2" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
          <div className="text-lg font-semibold" style={{ color: COLORS.text }}>
            {mol.formula || mol.name_cn || mol.id}
          </div>
          <div className="text-sm" style={{ color: COLORS.textSecondary }}>
            {mol.name_cn}{mol.name_en ? ` · ${mol.name_en}` : ''}
          </div>
          {isImported && (
            <div className="text-xs mt-1" style={{ color: COLORS.primary }}>
              自定义导入 · 单击属性值可编辑
            </div>
          )}
        </div>

        {/* 属性列表 */}
        {visibleRows.map(row => (
          <EditableInfoRow
            key={row.label}
            label={row.label}
            value={row.value ?? ''}
            editable={isImported && row.field !== 'id'}
            onSave={(v) => handleUpdate(row.field, v)}
          />
        ))}

        {/* 成键对/孤对 */}
        {(mol.bond_pairs !== undefined || mol.lone_pairs !== undefined) && (
          <>
            {mol.bond_pairs !== undefined && (
              <InfoRow label="成键对" value={mol.bond_pairs.toString()} />
            )}
            {mol.lone_pairs !== undefined && (
              <InfoRow label="孤对" value={mol.lone_pairs.toString()} />
            )}
          </>
        )}

        {/* 整体电荷 */}
        {mol.charge !== undefined && mol.charge !== 0 && (
          <InfoRow
            label="整体电荷"
            value={mol.charge > 0 ? `+${mol.charge}` : `${Math.abs(mol.charge)}−`}
          />
        )}

        {/* 模型统计 */}
        {model && (
          <div className="pt-2" style={{ borderTop: `1px solid ${COLORS.border}` }}>
            <div className="text-xs font-medium mb-1" style={{ color: COLORS.text }}>模型统计</div>
            <InfoRow label="原子数" value={model.atoms.length.toString()} />
            <InfoRow label="键数" value={model.bonds.length.toString()} />
            <InfoRow label="数据来源" value={isImported ? 'SDF 文件导入' : mol.hasSdf ? 'PubChem SDF' : '算法推导'} />
          </div>
        )}

        {/* 键长信息（可折叠） */}
        {model && model.bonds.length > 0 && (
          <CollapsibleSection title="键长 (pm)">
            {getUniqueBondLengths(model).map(({ label, length }) => (
              <div key={label} className="flex justify-between py-0.5">
                <span className="text-xs" style={{ color: COLORS.textMuted }}>{label}</span>
                <span className="text-xs font-medium" style={{ color: COLORS.primary }}>{length}</span>
              </div>
            ))}
          </CollapsibleSection>
        )}

        {/* 键角信息 */}
        {mol.bond_angles && Object.keys(mol.bond_angles).length > 0 && (
          <div className="pt-2" style={{ borderTop: `1px solid ${COLORS.border}` }}>
            <div className="text-xs font-medium mb-1" style={{ color: COLORS.text }}>键角 (°)</div>
            {Object.entries(mol.bond_angles).map(([label, angle]) => (
              <div key={label} className="flex justify-between py-0.5">
                <span className="text-xs" style={{ color: COLORS.textMuted }}>{label}</span>
                <span className="text-xs font-medium" style={{ color: COLORS.info }}>{angle}°</span>
              </div>
            ))}
          </div>
        )}

        {/* 键角偏差分析 */}
        <DeviationSection mol={mol} />
      </div>
    </PanelSection>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-0.5">
      <span className="text-xs" style={{ color: COLORS.textMuted }}>{label}</span>
      <span className="text-xs font-medium" style={{ color: COLORS.text }}>{value}</span>
    </div>
  );
}

function EditableInfoRow({ label, value, editable, onSave }: {
  label: string;
  value: string;
  editable: boolean;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing && editable) {
    return (
      <div className="flex justify-between items-center py-0.5 gap-2">
        <span className="text-xs shrink-0" style={{ color: COLORS.textMuted }}>{label}</span>
        <input
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => { onSave(draft); setEditing(false); }}
          onKeyDown={e => {
            if (e.key === 'Enter') { onSave(draft); setEditing(false); }
            if (e.key === 'Escape') { setDraft(value); setEditing(false); }
          }}
          className="text-xs font-medium text-right flex-1 min-w-0 py-0 px-1 rounded outline-none"
          style={{ border: `1px solid ${COLORS.primary}`, color: COLORS.text, background: COLORS.bg }}
          autoFocus
        />
      </div>
    );
  }

  return (
    <div
      className="flex justify-between items-center py-0.5"
      style={{ cursor: editable ? 'pointer' : 'default' }}
      onClick={() => {
        if (editable) { setDraft(value); setEditing(true); }
      }}
    >
      <span className="text-xs" style={{ color: COLORS.textMuted }}>{label}</span>
      <span
        className="text-xs font-medium"
        style={{
          color: value ? COLORS.text : COLORS.textPlaceholder,
          borderBottom: editable ? `1px dashed ${COLORS.border}` : 'none',
        }}
      >
        {value || (editable ? '点击输入' : '-')}
      </span>
    </div>
  );
}

function DeviationSection({ mol }: { mol: MoleculeMetadata }) {
  const notes = useMemo(() => computeDeviationNotes(mol), [mol]);
  if (notes.length === 0) return null;

  return (
    <div className="pt-2" style={{ borderTop: `1px solid ${COLORS.border}` }}>
      <div className="text-xs font-medium mb-1" style={{ color: COLORS.text }}>键角偏差分析</div>
      {notes.map((note: DeviationNote) => {
        const absDeviation = Math.abs(note.deviation);
        const color = absDeviation > 5 ? '#EF4444' : absDeviation > 2 ? '#F59E0B' : COLORS.primary;
        return (
          <div key={note.angleName} className="py-1" style={{ borderBottom: `1px solid ${COLORS.bgMuted}` }}>
            <div className="flex justify-between text-xs">
              <span style={{ color: COLORS.textMuted }}>{note.angleName}</span>
              <span>
                <span style={{ color: COLORS.info }}>{note.actualAngle}°</span>
                <span style={{ color: COLORS.textMuted }}> / </span>
                <span style={{ color: COLORS.textMuted }}>{note.idealAngle}°</span>
                <span style={{ color, fontWeight: 600, marginLeft: 4 }}>
                  {note.deviation > 0 ? '+' : ''}{note.deviation.toFixed(1)}°
                </span>
              </span>
            </div>
            <div className="text-xs mt-0.5" style={{ color: COLORS.textMuted, fontSize: '12px' }}>
              {note.explanation}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CollapsibleSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="pt-2" style={{ borderTop: `1px solid ${COLORS.border}` }}>
      <button
        className="flex items-center justify-between w-full text-left"
        onClick={() => setOpen(!open)}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
      >
        <span className="text-xs font-medium" style={{ color: COLORS.text }}>{title}</span>
        <span className="text-xs" style={{ color: COLORS.textMuted }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="mt-1">{children}</div>}
    </div>
  );
}

function getUniqueBondLengths(model: { bonds: { from: number; to: number; length: number; type: string }[]; atoms: { element: string }[] }): { label: string; length: number }[] {
  const seen = new Set<string>();
  const result: { label: string; length: number }[] = [];

  for (const bond of model.bonds) {
    const a = model.atoms[bond.from]?.element ?? '?';
    const b = model.atoms[bond.to]?.element ?? '?';
    const roundedLength = Math.round(bond.length);
    const key = `${a}-${b}:${roundedLength}`;
    const keyReverse = `${b}-${a}:${roundedLength}`;
    if (!seen.has(key) && !seen.has(keyReverse)) {
      seen.add(key);
      const orderStr = bond.type === 'double' ? '=' : bond.type === 'triple' ? '≡' : '-';
      result.push({ label: `${a}${orderStr}${b}`, length: roundedLength });
    }
  }

  return result;
}
