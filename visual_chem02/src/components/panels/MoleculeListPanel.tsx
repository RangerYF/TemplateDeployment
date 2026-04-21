/**
 * 分子列表面板 — 左侧面板
 * 包含 SDF 导入、搜索、学段筛选、分类筛选和分子列表
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { useMoleculeStore, getFilteredMolecules } from '@/store/moleculeStore';
import { CATEGORY_LABELS, LEVEL_OPTIONS, type MoleculeCategory } from '@/data/moleculeMetadata';
import { SearchInput } from '@/components/ui/SearchInput';
import { COLORS } from '@/styles/tokens';

const CATEGORY_OPTIONS: { value: MoleculeCategory | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  ...Object.entries(CATEGORY_LABELS).map(([value, label]) => ({
    value: value as MoleculeCategory,
    label,
  })),
];

export function MoleculeListPanel() {
  const searchQuery = useMoleculeStore(s => s.searchQuery);
  const levelFilter = useMoleculeStore(s => s.levelFilter);
  const categoryFilter = useMoleculeStore(s => s.categoryFilter);
  const currentMolecule = useMoleculeStore(s => s.currentMolecule);
  const setSearchQuery = useMoleculeStore(s => s.setSearchQuery);
  const setLevelFilter = useMoleculeStore(s => s.setLevelFilter);
  const setCategoryFilter = useMoleculeStore(s => s.setCategoryFilter);
  const selectMolecule = useMoleculeStore(s => s.selectMolecule);
  const compareMode = useMoleculeStore(s => s.compareMode);
  const setCompareMolecule = useMoleculeStore(s => s.setCompareMolecule);
  const importSdfFile = useMoleculeStore(s => s.importSdfFile);
  const importDialogFile = useMoleculeStore(s => s.importDialogFile);
  const importParsedFormula = useMoleculeStore(s => s.importParsedFormula);
  const confirmImport = useMoleculeStore(s => s.confirmImport);
  const cancelImport = useMoleculeStore(s => s.cancelImport);
  const importedMolecules = useMoleculeStore(s => s.importedMolecules);
  const removeImported = useMoleculeStore(s => s.removeImported);
  const error = useMoleculeStore(s => s.error);

  const [dragOver, setDragOver] = useState(false);
  const [importNameCn, setImportNameCn] = useState('');
  const [importNameEn, setImportNameEn] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const molecules = useMemo(
    () => getFilteredMolecules(searchQuery, levelFilter, categoryFilter, importedMolecules),
    [searchQuery, levelFilter, categoryFilter, importedMolecules]
  );

  const handleSelect = (id: string) => {
    if (compareMode) {
      setCompareMolecule(id);
    } else {
      selectMolecule(id);
    }
  };

  const handleFile = useCallback((file: File) => {
    if (!/\.(sdf|mol)$/i.test(file.name)) return;
    void importSdfFile(file);
  }, [importSdfFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleConfirm = () => {
    confirmImport(importNameCn, importNameEn);
    setImportNameCn('');
    setImportNameEn('');
  };

  const handleCancel = () => {
    cancelImport();
    setImportNameCn('');
    setImportNameEn('');
  };

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{
        width: 260,
        background: COLORS.bg,
        borderRight: `1px solid ${COLORS.border}`,
      }}
    >
      {/* 导入 SDF 区域 */}
      <div className="p-3 pb-1">
        {importDialogFile ? (
          // 导入对话框：填写名称
          <div className="rounded-xl p-3 space-y-2" style={{ background: COLORS.bgMuted, border: `1px solid ${COLORS.primary}` }}>
            <div className="text-xs font-medium" style={{ color: COLORS.text }}>
              导入: {importDialogFile.name}
            </div>
            {importParsedFormula && (
              <div className="text-xs" style={{ color: COLORS.textMuted }}>
                分子式: {importParsedFormula}
              </div>
            )}
            <input
              type="text"
              placeholder="中文名称"
              value={importNameCn}
              onChange={e => setImportNameCn(e.target.value)}
              className="w-full text-xs py-1 px-2 rounded outline-none"
              style={{ border: `1px solid ${COLORS.border}`, background: COLORS.bg, color: COLORS.text }}
              autoFocus
            />
            <input
              type="text"
              placeholder="English Name"
              value={importNameEn}
              onChange={e => setImportNameEn(e.target.value)}
              className="w-full text-xs py-1 px-2 rounded outline-none"
              style={{ border: `1px solid ${COLORS.border}`, background: COLORS.bg, color: COLORS.text }}
            />
            <div className="flex gap-2">
              <button
                className="flex-1 py-1 text-xs rounded transition-colors"
                style={{ background: COLORS.primary, color: COLORS.white, border: 'none', cursor: 'pointer' }}
                onClick={handleConfirm}
              >
                确认导入
              </button>
              <button
                className="flex-1 py-1 text-xs rounded transition-colors"
                style={{ background: COLORS.bgActive, color: COLORS.textSecondary, border: 'none', cursor: 'pointer' }}
                onClick={handleCancel}
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          // 拖拽/点击导入
          <div
            className="border-2 border-dashed rounded-xl p-2 text-center cursor-pointer transition-colors"
            style={{
              borderColor: dragOver ? COLORS.primary : COLORS.border,
              background: dragOver ? COLORS.primaryLight : 'transparent',
            }}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => inputRef.current?.click()}
          >
            <div className="text-xs" style={{ color: COLORS.textMuted }}>
              导入 .sdf/.mol 文件
            </div>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".sdf,.mol"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />

        {error && (
          <div className="text-xs mt-1 p-1.5 rounded" style={{ background: '#FEE', color: COLORS.error }}>
            {error}
          </div>
        )}
      </div>

      {/* 搜索 */}
      <div className="px-3 pb-2">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="搜索化学式/名称/编号..."
        />
      </div>

      {/* 学段筛选 */}
      <div className="px-3 pb-2 flex flex-wrap gap-1">
        {LEVEL_OPTIONS.map(level => (
          <button
            key={level}
            className="px-2 py-0.5 text-xs rounded-full transition-colors"
            style={{
              background: levelFilter === level ? COLORS.primary : COLORS.bgMuted,
              color: levelFilter === level ? COLORS.white : COLORS.textSecondary,
              border: 'none',
              cursor: 'pointer',
            }}
            onClick={() => setLevelFilter(level)}
          >
            {level}
          </button>
        ))}
      </div>

      {/* 分类筛选 */}
      <div className="px-3 pb-2">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as MoleculeCategory | 'all')}
          className="w-full text-xs py-1.5 px-2 outline-none transition-colors"
          style={{
            border: `1px solid ${COLORS.border}`,
            borderRadius: '8px',
            color: COLORS.textSecondary,
            background: COLORS.bg,
          }}
        >
          {CATEGORY_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* 分子数量 */}
      <div className="px-3 pb-1">
        <span className="text-xs" style={{ color: COLORS.textMuted }}>
          {compareMode ? '选择对比分子 · ' : ''}{molecules.length} 个分子
          {importedMolecules.length > 0 && ` (含 ${importedMolecules.length} 个导入)`}
        </span>
      </div>

      {/* 分子列表 */}
      <div className="flex-1 overflow-y-auto">
        {molecules.map(mol => {
          const isActive = currentMolecule?.id === mol.id;
          const isImported = mol.id.startsWith('IMP-');
          return (
            <div key={mol.id} className="relative group">
              <button
                className="w-full text-left px-3 py-2 transition-colors"
                style={{
                  background: isActive ? COLORS.primaryLight : 'transparent',
                  borderLeft: isActive ? `3px solid ${COLORS.primary}` : '3px solid transparent',
                  cursor: 'pointer',
                  borderBottom: `1px solid ${COLORS.border}`,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = COLORS.bgHover;
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'transparent';
                }}
                onClick={() => handleSelect(mol.id)}
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium" style={{ color: COLORS.text }}>
                    {mol.formula || mol.name_cn || mol.id}
                  </span>
                  {mol.name_cn && mol.formula && (
                    <span className="text-xs" style={{ color: COLORS.textMuted }}>
                      {mol.name_cn}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs" style={{ color: COLORS.textPlaceholder }}>
                    {mol.id}
                  </span>
                  {isImported ? (
                    <span
                      className="text-xs px-1.5 py-0 rounded-full"
                      style={{ background: COLORS.primaryLight, color: COLORS.primary, fontSize: '12px' }}
                    >
                      导入
                    </span>
                  ) : mol.level ? (
                    <span
                      className="text-xs px-1.5 py-0 rounded-full"
                      style={{ background: COLORS.bgMuted, color: COLORS.textMuted, fontSize: '12px' }}
                    >
                      {mol.level}
                    </span>
                  ) : null}
                </div>
              </button>
              {/* 导入分子的删除按钮 */}
              {isImported && (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-xs px-1.5 py-0.5 rounded"
                  style={{ background: COLORS.bgActive, color: COLORS.error, border: 'none', cursor: 'pointer' }}
                  onClick={(e) => { e.stopPropagation(); removeImported(mol.id); }}
                  title="移除导入分子"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
