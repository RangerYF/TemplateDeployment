import { useState, useEffect } from 'react';
import { useFunctionStore } from '@/editor/store/functionStore';
import { parse } from 'mathjs';
import { COLORS } from '@/styles/colors';

export interface DebugInfo {
  pointsRendered: number;
  canvasWidth: number;
  canvasHeight: number;
}

export function DebugOverlay({ debugInfo }: { debugInfo: DebugInfo | null }) {
  const [visible, setVisible] = useState(false);

  // Toggle with Ctrl+Shift+D (dev builds only)
  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setVisible((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const activeFunctionId = useFunctionStore((s) => s.activeFunctionId);
  const activeFunction = useFunctionStore((s) =>
    s.functions.find((f) => f.id === s.activeFunctionId) ?? null,
  );
  const viewport = useFunctionStore((s) => s.viewport);

  if (!import.meta.env.DEV || !visible) return null;

  const transform = activeFunction?.transform ?? { a: 1, b: 1, h: 0, k: 0 };

  const namedParamScope: Record<string, number> =
    activeFunction && activeFunction.templateId === null && activeFunction.namedParams.length > 0
      ? Object.fromEntries(activeFunction.namedParams.map((p) => [p.name, p.value]))
      : {};

  const mergedScope = { ...namedParamScope, a: transform.a, b: transform.b, h: transform.h, k: transform.k };

  let parsedTree = '—';
  if (activeFunction?.exprStr) {
    try {
      parsedTree = parse(activeFunction.exprStr).toString();
    } catch {
      parsedTree = '(parse error)';
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        zIndex: 100,
        background: 'rgba(0, 0, 0, 0.78)',
        color: '#E0E0E0',
        padding: '10px 14px',
        borderRadius: '8px',
        fontSize: '11px',
        fontFamily: 'monospace',
        lineHeight: '1.6',
        maxWidth: '380px',
        backdropFilter: 'blur(6px)',
        pointerEvents: 'none',
        userSelect: 'text',
      }}
    >
      <div style={{ fontWeight: 700, color: COLORS.primary, marginBottom: '6px' }}>
        Debug Overlay
        {activeFunction ? ` — ${activeFunction.label}` : ''}
      </div>

      <Row label="Active ID" value={activeFunctionId ?? 'none'} />
      <Row label="Expression" value={activeFunction?.exprStr ?? '—'} />
      <Row label="Parsed" value={parsedTree} />

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)', margin: '5px 0' }} />

      <Row label="Transform" value={`a=${transform.a} b=${transform.b} h=${transform.h} k=${transform.k}`} />
      <Row
        label="Named params"
        value={
          Object.keys(namedParamScope).length > 0
            ? Object.entries(namedParamScope).map(([k, v]) => `${k}=${v}`).join(', ')
            : '(none)'
        }
      />
      <Row
        label="Merged scope"
        value={Object.entries(mergedScope).map(([k, v]) => `${k}=${v}`).join(', ')}
      />

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)', margin: '5px 0' }} />

      <Row
        label="Canvas"
        value={debugInfo ? `${debugInfo.canvasWidth} × ${debugInfo.canvasHeight}` : '—'}
      />
      <Row label="Points rendered" value={debugInfo?.pointsRendered?.toString() ?? '—'} />
      <Row
        label="Viewport"
        value={`[${viewport.xMin}, ${viewport.xMax}] × [${viewport.yMin}, ${viewport.yMax}]`}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: '6px' }}>
      <span style={{ color: COLORS.neutral, flexShrink: 0 }}>{label}:</span>
      <span style={{ wordBreak: 'break-all' }}>{value}</span>
    </div>
  );
}
