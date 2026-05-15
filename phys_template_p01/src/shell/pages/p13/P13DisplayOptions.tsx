import { Switch } from '@/components/ui/switch';
import { P13PanelCard, P13_SHELL_COLORS } from './P13WorkbenchShell';

export interface P13DisplayOptions {
  showVectors: boolean;
  showLabels: boolean;
  showGrid: boolean;
  showAxes: boolean;
}

export const DEFAULT_P13_DISPLAY_OPTIONS: P13DisplayOptions = {
  showVectors: true,
  showLabels: true,
  showGrid: true,
  showAxes: false,
};

export function P13DisplayOptionsPanel({
  options,
  onChange,
  subtitle = '统一控制向量箭头、标注文字、背景网格和坐标轴显隐。',
}: {
  options: P13DisplayOptions;
  onChange: (next: P13DisplayOptions) => void;
  subtitle?: string;
}) {
  return (
    <P13PanelCard title="显示选项" subtitle={subtitle}>
      <div className="space-y-3">
        <DisplayOptionRow
          label="向量箭头"
          description="控制速度、电流、安培力等方向箭头"
          checked={options.showVectors}
          onCheckedChange={(checked) => onChange({ ...options, showVectors: checked })}
        />
        <DisplayOptionRow
          label="标注文字"
          description="控制结构标签、方向说明和读数框"
          checked={options.showLabels}
          onCheckedChange={(checked) => onChange({ ...options, showLabels: checked })}
        />
        <DisplayOptionRow
          label="网格背景"
          description="控制演示区里的辅助网格"
          checked={options.showGrid}
          onCheckedChange={(checked) => onChange({ ...options, showGrid: checked })}
        />
        <DisplayOptionRow
          label="坐标轴"
          description="在演示区叠加统一参考坐标轴"
          checked={options.showAxes}
          onCheckedChange={(checked) => onChange({ ...options, showAxes: checked })}
        />
      </div>
    </P13PanelCard>
  );
}

function DisplayOptionRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-sm font-medium" style={{ color: P13_SHELL_COLORS.text }}>
          {label}
        </div>
        <div className="mt-1 text-xs leading-5" style={{ color: P13_SHELL_COLORS.secondary }}>
          {description}
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export function P13StageGrid({
  left,
  top,
  right,
  bottom,
  stepX = 36,
  stepY = 28,
}: {
  left: number;
  top: number;
  right: number;
  bottom: number;
  stepX?: number;
  stepY?: number;
}) {
  const verticalLines = [];
  for (let x = left; x <= right; x += stepX) {
    verticalLines.push(x);
  }
  const horizontalLines = [];
  for (let y = top; y <= bottom; y += stepY) {
    horizontalLines.push(y);
  }

  return (
    <g opacity="0.75">
      {verticalLines.map((x) => (
        <line
          key={`grid-x-${x}`}
          x1={x}
          y1={top}
          x2={x}
          y2={bottom}
          stroke="#E5E7EB"
          strokeWidth="1"
        />
      ))}
      {horizontalLines.map((y) => (
        <line
          key={`grid-y-${y}`}
          x1={left}
          y1={y}
          x2={right}
          y2={y}
          stroke="#EEF2F7"
          strokeWidth="1"
        />
      ))}
    </g>
  );
}

export function P13StageAxes({
  originX,
  originY,
  xLength = 112,
  yLength = 88,
}: {
  originX: number;
  originY: number;
  xLength?: number;
  yLength?: number;
}) {
  const xEnd = originX + xLength;
  const yEnd = originY - yLength;
  return (
    <g>
      <line x1={originX} y1={originY} x2={xEnd} y2={originY} stroke="#94A3B8" strokeWidth="2.5" />
      <line x1={originX} y1={originY} x2={originX} y2={yEnd} stroke="#94A3B8" strokeWidth="2.5" />
      <path d={`M ${xEnd} ${originY} L ${xEnd - 8} ${originY - 4} L ${xEnd - 8} ${originY + 4} Z`} fill="#94A3B8" />
      <path d={`M ${originX} ${yEnd} L ${originX - 4} ${yEnd + 8} L ${originX + 4} ${yEnd + 8} Z`} fill="#94A3B8" />
      <text x={xEnd + 10} y={originY + 4} fill={P13_SHELL_COLORS.muted} fontSize="11">
        x
      </text>
      <text x={originX - 6} y={yEnd - 8} fill={P13_SHELL_COLORS.muted} fontSize="11">
        y
      </text>
    </g>
  );
}
