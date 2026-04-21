import { COLORS } from '@/styles/tokens';
import { useSimulationStore } from '@/editor/store';

export function ResultsPanel() {
  const activeSimId = useSimulationStore(s => s.activeSimId);
  const simulations = useSimulationStore(s => s.simulations);
  const activeSim = activeSimId ? simulations[activeSimId] : undefined;
  const result = activeSim?.result;

  if (!result) {
    return (
      <div style={{ fontSize: 14, color: COLORS.textMuted, textAlign: 'center', padding: '8px 0' }}>
        运行模拟后查看结果
      </div>
    );
  }

  const entries = Object.entries(result.stats);

  return (
    <div className="flex flex-col gap-1.5">
      {entries.map(([key, value]) => (
        <div
          key={key}
          className="flex items-center justify-between py-1.5 px-2 rounded-lg"
          style={{ backgroundColor: COLORS.bg, border: `1px solid ${COLORS.border}` }}
        >
          <span style={{ fontSize: 14, color: COLORS.textMuted, flexShrink: 0 }}>{key}</span>
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: COLORS.text,
              textAlign: 'right',
              marginLeft: 8,
              wordBreak: 'break-all',
            }}
          >
            {String(value)}
          </span>
        </div>
      ))}
      <div style={{ fontSize: 14, color: COLORS.textTertiary, textAlign: 'right', marginTop: 4 }}>
        {new Date(result.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
}
