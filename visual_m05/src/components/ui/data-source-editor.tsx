import { useRef, useMemo, useCallback } from 'react';
import { COLORS } from '@/styles/tokens';
import { HISTOGRAM_DATASETS, resolveData } from '@/types/simulation';
import type { DataSpec, DataPrecision } from '@/types/simulation';

interface Props {
  spec: DataSpec;
  onChange: (spec: DataSpec) => void;
}

const PRECISION_LABELS: [DataPrecision, string][] = [[0, '整数'], [1, '一位小数'], [2, '两位小数']];

export function DataSourceEditor({ spec, onChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resolvedCount = useMemo(() => {
    try { return resolveData(spec).length; } catch { return 0; }
  }, [spec]);

  const set = (patch: Partial<DataSpec>) => onChange({ ...spec, ...patch });

  // Export current resolved data as JSON
  const handleExport = useCallback(() => {
    try {
      const data = resolveData(spec);
      const sourceName = spec.mode === 'preset'
        ? (HISTOGRAM_DATASETS.find(d => d.id === spec.presetId)?.name ?? '数据集')
        : '自定义数据';
      const json = JSON.stringify({ name: sourceName, data, description: '' }, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'dataset.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error(e); }
  }, [spec]);

  // Import JSON
  const handleImportFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        const data: number[] = Array.isArray(json.data)
          ? json.data.filter((v: unknown) => typeof v === 'number')
          : [];
        set({ mode: 'manual', customText: data.join(', ') });
      } catch { alert('JSON格式错误'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec, onChange]);

  return (
    <div className="flex flex-col gap-3">
      {/* Mode tabs */}
      <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${COLORS.border}`, fontSize: 14 }}>
        {(['preset', 'manual'] as const).map(m => (
          <button key={m} onClick={() => set({ mode: m })}
            className="flex-1 py-1.5 font-medium transition-colors"
            style={{
              backgroundColor: spec.mode === m ? COLORS.primary : 'transparent',
              color: spec.mode === m ? COLORS.white : COLORS.textSecondary,
              border: 'none', cursor: 'pointer',
            }}>
            {m === 'preset' ? '预设数据集' : '手动输入'}
          </button>
        ))}
      </div>

      {spec.mode === 'preset' && (
        <>
          {/* Dataset select */}
          <div>
            <div style={{ fontSize: 14, color: COLORS.textSecondary, marginBottom: 4 }}>数据集</div>
            <select
              value={spec.presetId}
              onChange={e => set({ presetId: e.target.value })}
              style={{
                width: '100%', fontSize: 14, padding: '4px 6px',
                border: `1px solid ${COLORS.border}`, borderRadius: 6,
                backgroundColor: COLORS.bg, color: COLORS.text,
              }}
            >
              {HISTOGRAM_DATASETS.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <div style={{ fontSize: 14, color: COLORS.textMuted, marginTop: 3 }}>
              {HISTOGRAM_DATASETS.find(d => d.id === spec.presetId)?.description}
            </div>
          </div>

          {/* Range filter */}
          <div>
            <div style={{ fontSize: 14, color: COLORS.textSecondary, marginBottom: 4 }}>取值范围筛选</div>
            <div className="flex items-center gap-1">
              <input type="number" placeholder="最小值" value={spec.filterMin ?? ''}
                onChange={e => set({ filterMin: e.target.value === '' ? null : parseFloat(e.target.value) })}
                style={{ width: 70, fontSize: 14, padding: '3px 5px', border: `1px solid ${COLORS.border}`, borderRadius: 4, backgroundColor: COLORS.bg, color: COLORS.text }} />
              <span style={{ fontSize: 14, color: COLORS.textMuted }}>~</span>
              <input type="number" placeholder="最大值" value={spec.filterMax ?? ''}
                onChange={e => set({ filterMax: e.target.value === '' ? null : parseFloat(e.target.value) })}
                style={{ width: 70, fontSize: 14, padding: '3px 5px', border: `1px solid ${COLORS.border}`, borderRadius: 4, backgroundColor: COLORS.bg, color: COLORS.text }} />
              {(spec.filterMin !== null || spec.filterMax !== null) && (
                <button onClick={() => set({ filterMin: null, filterMax: null })}
                  style={{ fontSize: 14, color: COLORS.textMuted, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>✕</button>
              )}
            </div>
          </div>

          {/* Precision selector */}
          <div>
            <div style={{ fontSize: 14, color: COLORS.textSecondary, marginBottom: 4 }}>数据精度</div>
            <div className="flex gap-1">
              {PRECISION_LABELS.map(([p, label]) => (
                <button key={p} onClick={() => set({ precision: p })}
                  className="flex-1 py-1 rounded text-sm font-medium"
                  style={{
                    backgroundColor: spec.precision === p ? COLORS.primary : COLORS.bgMuted,
                    color: spec.precision === p ? COLORS.white : COLORS.textSecondary,
                    border: `1px solid ${spec.precision === p ? COLORS.primary : COLORS.border}`,
                    cursor: 'pointer', fontSize: 14,
                  }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {spec.mode === 'manual' && (
        <div>
          <div style={{ fontSize: 14, color: COLORS.textSecondary, marginBottom: 4 }}>输入数据（逗号或换行分隔）</div>
          <textarea
            value={spec.customText}
            onChange={e => set({ customText: e.target.value })}
            placeholder="例如: 72, 85, 68, 91, 76..."
            rows={5}
            style={{
              width: '100%', fontSize: 14, padding: '6px 8px', resize: 'vertical',
              border: `1px solid ${COLORS.border}`, borderRadius: 6,
              backgroundColor: COLORS.bg, color: COLORS.text,
              fontFamily: 'monospace', boxSizing: 'border-box',
            }}
          />
          {/* Precision selector also in manual mode */}
          <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: 14, color: COLORS.textMuted, marginBottom: 3 }}>数据精度</div>
            <div className="flex gap-1">
              {PRECISION_LABELS.map(([p, label]) => (
                <button key={p} onClick={() => set({ precision: p })}
                  className="flex-1 py-1 rounded text-sm font-medium"
                  style={{
                    backgroundColor: spec.precision === p ? COLORS.primary : COLORS.bgMuted,
                    color: spec.precision === p ? COLORS.white : COLORS.textSecondary,
                    border: `1px solid ${spec.precision === p ? COLORS.primary : COLORS.border}`,
                    cursor: 'pointer', fontSize: 14,
                  }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer: count + import/export */}
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 14, color: COLORS.textMuted }}>
          共 {resolvedCount} 个数据点
        </span>
        <div className="flex gap-1">
          <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportFile} />
          <button onClick={() => fileInputRef.current?.click()}
            style={{ fontSize: 14, color: COLORS.textSecondary, padding: '2px 6px', border: `1px solid ${COLORS.border}`, borderRadius: 4, backgroundColor: 'transparent', cursor: 'pointer' }}>
            导入
          </button>
          <button onClick={handleExport} disabled={resolvedCount === 0}
            style={{ fontSize: 14, color: COLORS.textSecondary, padding: '2px 6px', border: `1px solid ${COLORS.border}`, borderRadius: 4, backgroundColor: 'transparent', cursor: 'pointer', opacity: resolvedCount === 0 ? 0.5 : 1 }}>
            导出
          </button>
        </div>
      </div>
    </div>
  );
}
