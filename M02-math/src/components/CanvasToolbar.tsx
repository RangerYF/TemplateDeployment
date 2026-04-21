import {
  Hand, MousePointer, MapPin,
} from 'lucide-react';
import { useCanvasToolStore, type CanvasMode } from '@/editor/store/canvasToolStore';
import { COLORS } from '@/styles/colors';

// ─── Tool definitions ────────────────────────────────────────────────────────

interface ToolDef {
  mode: CanvasMode;
  icon: React.ElementType;
  label: string;
}

const TOOLS: ToolDef[] = [
  { mode: 'pan-zoom',  icon: Hand,          label: '拖动' },
  { mode: 'select',    icon: MousePointer,  label: '选中' },
  { mode: 'pin-point', icon: MapPin,        label: '取点' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function CanvasToolbar() {
  const mode    = useCanvasToolStore((s) => s.mode);
  const setMode = useCanvasToolStore((s) => s.setMode);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: '4px 6px',
        background: 'rgba(26, 26, 30, 0.88)',
        backdropFilter: 'blur(8px)',
        borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        zIndex: 20,
        userSelect: 'none',
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {TOOLS.map((t) => (
        <ToolButton
          key={t.mode}
          icon={t.icon}
          label={t.label}
          active={mode === t.mode}
          onClick={() => setMode(t.mode)}
        />
      ))}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ToolButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      title={label}
      onClick={onClick}
      style={{
        width: 32, height: 32,
        borderRadius: 8,
        border: 'none',
        background: active ? 'rgba(50,213,131,0.25)' : 'transparent',
        color: active ? COLORS.primary : COLORS.neutral,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        transition: 'background 0.12s, color 0.12s',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
          e.currentTarget.style.color = COLORS.canvasText;
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = COLORS.neutral;
        }
      }}
    >
      <Icon size={16} />
    </button>
  );
}
