import { useMemo } from 'react';
import { useM04FunctionStore } from '@/editor/store/m04FunctionStore';
import { buildTrigAnalysis } from '@/engine/trigAnalysis';
import { COLORS } from '@/styles/colors';

export function TrigAnalysisPanel() {
  const fnType = useM04FunctionStore((s) => s.fnType);
  const transform = useM04FunctionStore((s) => s.transform);
  const showAnalysis = useM04FunctionStore((s) => s.showAnalysis);
  const setShowAnalysis = useM04FunctionStore((s) => s.setShowAnalysis);
  const analysisDisplay = useM04FunctionStore((s) => s.analysisDisplay);
  const setAnalysisDisplay = useM04FunctionStore((s) => s.setAnalysisDisplay);

  const items = useMemo(() => buildTrigAnalysis(fnType, transform), [fnType, transform]);

  return (
    <div style={{ padding: '12px 14px', borderTop: `1px solid ${COLORS.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.textPrimary }}>图像性质</span>
        <button
          onClick={() => setShowAnalysis(!showAnalysis)}
          style={{
            padding: '3px 8px',
            fontSize: 10,
            fontWeight: 600,
            borderRadius: 9999,
            border: `1px solid ${showAnalysis ? COLORS.primary : COLORS.borderMuted}`,
            background: showAnalysis ? `${COLORS.primary}22` : 'transparent',
            color: showAnalysis ? COLORS.primary : COLORS.textSecondary,
            cursor: 'pointer',
          }}
        >
          {showAnalysis ? '收起' : '展开'}
        </button>
      </div>

      {showAnalysis && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ padding: '8px 10px', borderRadius: 10, background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}` }}>
            {[
              ['showZeros', '零点'],
              ['showSymmetryAxes', '对称轴'],
              ['showSymmetryCenters', '对称中心'],
            ].map(([key, label]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 0' }}>
                <span style={{ fontSize: 11, color: analysisDisplay[key as keyof typeof analysisDisplay] ? COLORS.textPrimary : COLORS.textSecondary }}>
                  图上显示{label}
                </span>
                <button
                  onClick={() => setAnalysisDisplay(key as keyof typeof analysisDisplay, !analysisDisplay[key as keyof typeof analysisDisplay])}
                  style={{
                    padding: '2px 8px',
                    fontSize: 10,
                    fontWeight: 600,
                    borderRadius: 9999,
                    border: `1px solid ${analysisDisplay[key as keyof typeof analysisDisplay] ? COLORS.primary : COLORS.borderMuted}`,
                    background: analysisDisplay[key as keyof typeof analysisDisplay] ? `${COLORS.primary}22` : 'transparent',
                    color: analysisDisplay[key as keyof typeof analysisDisplay] ? COLORS.primary : COLORS.textSecondary,
                    cursor: 'pointer',
                  }}
                >
                  {analysisDisplay[key as keyof typeof analysisDisplay] ? '开' : '关'}
                </button>
              </div>
            ))}
          </div>
          {items.map((item) => (
            <div key={item.label} style={{ padding: '8px 10px', borderRadius: 10, background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textSecondary, marginBottom: 4 }}>{item.label}</div>
              {item.values.map((value, index) => (
                <div key={index} style={{ fontSize: 11, color: COLORS.textPrimary, fontFamily: 'monospace', lineHeight: 1.6 }}>
                  {value}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
