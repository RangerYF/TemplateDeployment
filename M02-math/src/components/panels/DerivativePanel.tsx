import { useFunctionStore } from '@/editor/store/functionStore';
import { editorInstance } from '@/editor/core/Editor';
import { PanZoomTool } from '@/editor/tools/PanZoomTool';
import { TraceTool } from '@/editor/tools/TraceTool';
import { compileExpression, isParseError, symbolicDerivativeStr } from '@/engine/expressionEngine';
import { COLORS } from '@/styles/colors';
import { Switch } from '@/components/ui/switch';

export function DerivativePanel() {
  const showDerivative   = useFunctionStore((s) => s.features.showDerivative);
  const showTangent      = useFunctionStore((s) => s.features.showTangent);
  const tangentX         = useFunctionStore((s) => s.features.tangentX);
  const tangentY         = useFunctionStore((s) => s.features.tangentY);
  const tangentSlope     = useFunctionStore((s) => s.features.tangentSlope);
  const activeFunctionId = useFunctionStore((s) => s.activeFunctionId);
  const activeFn         = useFunctionStore((s) =>
    s.functions.find((f) => f.id === s.activeFunctionId),
  );

  const setFeature = useFunctionStore((s) => s.setFeature);

  if (!activeFunctionId || activeFn?.mode !== 'standard') return null;

  // Symbolic derivative string for display
  let symbolicDeriv: string | null = null;
  if (activeFn) {
    const compiled = compileExpression(activeFn.exprStr);
    if (!isParseError(compiled)) {
      symbolicDeriv = symbolicDerivativeStr(compiled);
    }
  }

  const handleDerivativeToggle = () => {
    setFeature('showDerivative', !showDerivative);
  };

  const handleTangentToggle = () => {
    const next = !showTangent;
    setFeature('showTangent', next);
    if (next) {
      editorInstance?.activateTool(new TraceTool());
    } else {
      editorInstance?.activateTool(new PanZoomTool());
      useFunctionStore.getState().setTangentPoint(null, 0, null);
    }
  };

  const nearExtreme = tangentSlope !== null && Math.abs(tangentSlope) < 0.01;

  return (
    <div style={{ fontSize: '13px', color: COLORS.textPrimary }}>
      <div style={{ fontWeight: 600, marginBottom: '10px', color: COLORS.textSecondary, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        导数与切线
      </div>

      {/* Show derivative toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: showDerivative ? COLORS.textPrimary : COLORS.textSecondary }}>
          显示导数曲线 f′(x)
        </span>
        <Switch checked={showDerivative} onCheckedChange={handleDerivativeToggle} />
      </div>

      {showDerivative && symbolicDeriv && (
        <div style={{ marginTop: '6px', marginLeft: '24px', color: COLORS.textSecondary, fontFamily: 'monospace', fontSize: '12px' }}>
          f′(x) = {symbolicDeriv}
        </div>
      )}

      {/* Tangent toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', marginTop: '6px' }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: showTangent ? COLORS.textPrimary : COLORS.textSecondary }}>
          显示切线
        </span>
        <Switch checked={showTangent} onCheckedChange={handleTangentToggle} />
      </div>

      {/* Tangent info — only when showTangent AND a point is active */}
      {showTangent && tangentX !== null && (
        <div style={{ marginTop: '8px', marginLeft: '24px', lineHeight: '1.8' }}>
          <div style={infoRowStyle}>
            <span style={{ color: COLORS.textSecondary, minWidth: '40px' }}>切点</span>
            <span style={{ fontFamily: 'monospace' }}>
              x₀ = {tangentX.toFixed(3)}
            </span>
          </div>
          <div style={infoRowStyle}>
            <span style={{ color: COLORS.textSecondary, minWidth: '40px' }}></span>
            <span style={{ fontFamily: 'monospace' }}>
              y₀ = {tangentY.toFixed(3)}
            </span>
          </div>
          <div style={infoRowStyle}>
            <span style={{ color: COLORS.textSecondary, minWidth: '40px' }}>斜率</span>
            <span style={{ fontFamily: 'monospace' }}>
              k = {tangentSlope !== null ? tangentSlope.toFixed(4) : '—'}
            </span>
            {nearExtreme && (
              <span style={{ marginLeft: '8px', color: COLORS.primary, fontSize: '11px' }}>
                极值点附近
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const infoRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '12px',
};
