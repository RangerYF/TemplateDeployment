import { useState, useRef, useCallback } from 'react';
import { useToolStore } from '@/editor/store';
import { parseTextCommand, executeTextCommand } from '@/editor/commandParser';

const TOOL_PLACEHOLDERS: Record<string, string> = {
  drawSegment: '输入线段名(如AB)，按Enter键完成画线',
  crossSection: '输入截面名(如ABC)，按Enter键完成创建',
};

const SUPPORTED_TOOLS = new Set(Object.keys(TOOL_PLACEHOLDERS));

interface Feedback {
  type: 'success' | 'error';
  message: string;
}

/** 外层包装：监听 toolId，通过 key 切换触发内层重新挂载（自动清空状态） */
export function TextCommandInput() {
  const activeToolId = useToolStore((s) => s.activeToolId);

  if (!SUPPORTED_TOOLS.has(activeToolId)) return null;

  return <TextCommandInputInner key={activeToolId} toolId={activeToolId} />;
}

function TextCommandInputInner({ toolId }: { toolId: string }) {
  const [value, setValue] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showFeedback = useCallback((fb: Feedback) => {
    setFeedback(fb);
    clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 2000);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = value.trim();
      if (!trimmed) return;

      const parsed = parseTextCommand(trimmed, toolId);
      const result = executeTextCommand(parsed);

      if (result.success) {
        setValue('');
        showFeedback({ type: 'success', message: result.message });
      } else {
        showFeedback({ type: 'error', message: result.message });
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      inputRef.current?.blur();
    }

    // 阻止全局快捷键
    e.stopPropagation();
  }, [value, toolId, showFeedback]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 72,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 16,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={TOOL_PLACEHOLDERS[toolId]}
        style={{
          width: 300,
          padding: '4px 12px',
          fontSize: 13,
          fontWeight: 500,
          border: '1.5px solid #3b82f6',
          borderRadius: 16,
          background: 'rgba(239,246,255,0.95)',
          backdropFilter: 'blur(4px)',
          outline: 'none',
          textAlign: 'center',
          color: '#1e3a5f',
        }}
        onFocus={(e) => {
          e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.25)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.boxShadow = 'none';
        }}
      />
      {feedback && (
        <div
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: feedback.type === 'success' ? '#16a34a' : '#dc2626',
            background: 'rgba(255,255,255,0.9)',
            padding: '2px 10px',
            borderRadius: 4,
            whiteSpace: 'nowrap',
          }}
        >
          {feedback.message}
        </div>
      )}
    </div>
  );
}
