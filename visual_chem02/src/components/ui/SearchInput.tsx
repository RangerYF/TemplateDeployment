/**
 * 搜索输入框 — SYXMA-Minimal 风格
 */

import { Search, X } from 'lucide-react';
import { COLORS, RADIUS } from '@/styles/tokens';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchInput({ value, onChange, placeholder = '搜索分子...' }: SearchInputProps) {
  return (
    <div className="relative">
      <Search
        size={14}
        className="absolute left-3 top-1/2 -translate-y-1/2"
        color={COLORS.textPlaceholder}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-8 pr-8 py-2 text-sm outline-none transition-colors"
        style={{
          border: `1px solid ${COLORS.border}`,
          borderRadius: RADIUS.input,
          color: COLORS.textSecondary,
          background: COLORS.bg,
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = COLORS.primary;
          e.currentTarget.style.boxShadow = `0 0 0 2px ${COLORS.primaryFocusRing}`;
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = COLORS.border;
          e.currentTarget.style.boxShadow = 'none';
        }}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full transition-colors"
          style={{ color: COLORS.textMuted }}
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}
