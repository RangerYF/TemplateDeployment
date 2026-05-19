import { useState, useCallback } from 'react';
import { COLORS, RADIUS } from '@/styles/tokens';

export function AlgebraInputBar({ onSubmit }: { onSubmit: (expr: string) => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = useCallback(() => {
    if (!value.trim()) return;
    try {
      onSubmit(value.trim());
      setValue('');
      setError('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '解析失败');
    }
  }, [value, onSubmit]);

  return (
    <div style={{
      position: 'absolute', top: 8, right: 10, zIndex: 25,
      display: 'flex', alignItems: 'center', gap: 6,
      background: 'rgba(255,255,255,0.95)',
      padding: '4px 8px', borderRadius: RADIUS.sm,
      border: `1px solid ${COLORS.border}`,
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    }}>
      <span style={{ fontSize: 12, color: COLORS.textMuted, flexShrink: 0 }}>f(x)</span>
      <input
        type="text"
        value={value}
        onChange={(e) => { setValue(e.target.value); setError(''); }}
        onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
        placeholder="y=2x+1, x=3, (x-1)²+(y-2)²=4"
        style={{
          width: 220, padding: '4px 8px', fontSize: 13,
          border: `1px solid ${error ? COLORS.error : COLORS.border}`,
          borderRadius: RADIUS.sm, outline: 'none',
          background: COLORS.bg, color: COLORS.text,
        }}
      />
      <button
        onClick={handleSubmit}
        style={{
          padding: '4px 10px', fontSize: 13, cursor: 'pointer',
          borderRadius: RADIUS.sm, border: `1px solid ${COLORS.primary}`,
          background: COLORS.primaryLight, color: COLORS.primary,
          fontWeight: 600,
        }}
      >
        添加
      </button>
      {error && (
        <span style={{ fontSize: 11, color: COLORS.error, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {error}
        </span>
      )}
    </div>
  );
}
