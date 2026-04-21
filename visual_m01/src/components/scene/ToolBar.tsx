import {
  SelectIcon,
  DrawSegmentIcon,
  CrossSectionIcon,
  CoordSystemIcon,
  CircumCircleIcon,
  AngleIcon,
  DistanceIcon,
} from '@/components/icons/ToolIcons';
import { useToolStore } from '@/editor/store';

const TOOLS = [
  { id: 'select', label: '选择', Icon: SelectIcon },
  { id: 'drawSegment', label: '画线段', Icon: DrawSegmentIcon },
  { id: 'crossSection', label: '创建截面', Icon: CrossSectionIcon },
  { id: 'coordSystem', label: '建坐标系', Icon: CoordSystemIcon },
  { id: 'circumCircle', label: '画外接圆', Icon: CircumCircleIcon },
  { id: 'angle', label: '标记角度', Icon: AngleIcon },
  { id: 'distance', label: '标记距离', Icon: DistanceIcon },
] as const;

export function ToolBar() {
  const activeToolId = useToolStore((s) => s.activeToolId);
  const setActiveTool = useToolStore((s) => s.setActiveTool);

  return (
    <div
      style={{
        position: 'absolute',
        top: 10,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'row',
        gap: 2,
        zIndex: 10,
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(8px)',
        borderRadius: 8,
        border: '1px solid #e5e7eb',
        padding: '4px 6px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      }}
    >
      {TOOLS.map((tool) => {
        const isActive = activeToolId === tool.id;
        return (
          <button
            key={tool.id}
            onClick={() => setActiveTool(tool.id)}
            style={{
              minWidth: 48,
              padding: '4px 6px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              borderRadius: 6,
              border: isActive ? '1.5px solid #00C06B' : '1.5px solid transparent',
              background: isActive ? 'rgba(0,192,107,0.1)' : 'transparent',
              color: isActive ? '#00C06B' : '#374151',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.background = 'rgba(243,244,246,0.95)';
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.background = isActive ? 'rgba(0,192,107,0.1)' : 'transparent';
            }}
          >
            <tool.Icon size={18} />
            <span
              style={{
                fontSize: 10,
                lineHeight: 1,
                whiteSpace: 'nowrap',
                color: isActive ? '#00C06B' : '#6b7280',
              }}
            >
              {tool.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
