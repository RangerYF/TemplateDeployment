import { COLORS, RADIUS } from '@/styles/tokens';
import { useCrystalStore } from '@/store';
import { PACKING_DATA } from '@/data/packingData';
import { cn } from '@/lib/utils/cn';

/**
 * 从 rRatio 字符串（如 'r/R = 0.225' 或 '—'）中提取数值。
 * 返回 null 表示不适用（如 SC 四面体空隙）。
 */
function parseRRatio(rRatio: string): number | null {
  const match = rRatio.match(/[\d.]+/);
  if (!match) return null;
  const val = parseFloat(match[0]);
  return isNaN(val) ? null : val;
}

const SPEED_OPTIONS = [
  { value: 0.5, label: '0.5x' },
  { value: 1, label: '1x' },
  { value: 2, label: '2x' },
];

const VOID_TYPES: { value: 'tetrahedral' | 'octahedral' | 'all'; label: string }[] = [
  { value: 'tetrahedral', label: '四面体空隙' },
  { value: 'octahedral', label: '八面体空隙' },
  { value: 'all', label: '全部' },
];

export function PackingControlPanel() {
  const packingType = useCrystalStore((s) => s.packingType);
  const packingStep = useCrystalStore((s) => s.packingStep);
  const packingMaxSteps = useCrystalStore((s) => s.packingMaxSteps);
  const packingPlaying = useCrystalStore((s) => s.packingPlaying);
  const packingSpeed = useCrystalStore((s) => s.packingSpeed);
  const showVoids = useCrystalStore((s) => s.showVoids);
  const voidType = useCrystalStore((s) => s.voidType);
  const setPackingStep = useCrystalStore((s) => s.setPackingStep);
  const togglePackingPlay = useCrystalStore((s) => s.togglePackingPlay);
  const setPackingSpeed = useCrystalStore((s) => s.setPackingSpeed);
  const toggleVoids = useCrystalStore((s) => s.toggleVoids);
  const setVoidType = useCrystalStore((s) => s.setVoidType);

  const packingInfo = PACKING_DATA.find((p) => p.type === packingType);

  return (
    <div className="space-y-4">
      {/* Play / Pause + Step */}
      <div>
        <Label text="动画控制" />
        <div className="flex items-center gap-2">
          <button
            className="px-4 py-1.5 text-xs font-medium"
            style={{
              borderRadius: RADIUS.xs,
              backgroundColor: packingPlaying ? COLORS.error : COLORS.primary,
              color: COLORS.white,
            }}
            onClick={togglePackingPlay}
          >
            {packingPlaying ? '暂停' : '播放'}
          </button>
          <span className="text-xs tabular-nums" style={{ color: COLORS.textMuted }}>
            步骤 {packingStep} / {packingMaxSteps}
          </span>
        </div>
      </div>

      {/* Step slider */}
      <div>
        <Label text="步骤进度" />
        <input
          type="range"
          min={0}
          max={packingMaxSteps}
          value={packingStep}
          onChange={(e) => setPackingStep(Number(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
          style={{
            accentColor: COLORS.primary,
            backgroundColor: COLORS.bgActive,
          }}
        />
      </div>

      {/* Speed control */}
      <div>
        <Label text="播放速度" />
        <div className="flex gap-1">
          {SPEED_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={cn('flex-1 py-1 text-xs font-medium transition-colors')}
              style={{
                borderRadius: RADIUS.xs,
                backgroundColor:
                  packingSpeed === opt.value ? COLORS.primary : COLORS.bgMuted,
                color:
                  packingSpeed === opt.value ? COLORS.white : COLORS.textSecondary,
              }}
              onClick={() => setPackingSpeed(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Show voids toggle */}
      <div>
        <Label text="空隙显示" />
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs" style={{ color: COLORS.text }}>
            显示空隙
          </span>
          <button
            className="w-8 h-4 rounded-full relative transition-colors"
            style={{
              backgroundColor: showVoids ? COLORS.primary : COLORS.bgActive,
            }}
            onClick={toggleVoids}
          >
            <span
              className="absolute top-0.5 w-3 h-3 rounded-full transition-all"
              style={{
                backgroundColor: COLORS.white,
                left: showVoids ? '16px' : '2px',
              }}
            />
          </button>
        </div>

        {/* Void type selector */}
        {showVoids && (
          <div className="flex gap-1">
            {VOID_TYPES.map((vt) => (
              <button
                key={vt.value}
                className={cn('flex-1 py-1 text-xs font-medium transition-colors')}
                style={{
                  borderRadius: RADIUS.xs,
                  backgroundColor:
                    voidType === vt.value ? COLORS.primary : COLORS.bgMuted,
                  color:
                    voidType === vt.value ? COLORS.white : COLORS.textSecondary,
                }}
                onClick={() => setVoidType(vt.value)}
              >
                {vt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Packing info display */}
      {packingInfo && (
        <div>
          <Label text="堆积信息" />
          <div
            className="space-y-1.5 p-2.5"
            style={{
              borderRadius: RADIUS.xs,
              backgroundColor: COLORS.bgMuted,
            }}
          >
            <InfoRow label="名称" value={packingInfo.nameCn} />
            <InfoRow
              label="堆积效率"
              value={`${(packingInfo.packingEfficiency * 100).toFixed(2)}%`}
            />
            <InfoRow label="配位数" value={String(packingInfo.coordinationNumber)} />
            <InfoRow label="层序列" value={packingInfo.layerSequence} />
          </div>
        </div>
      )}

      {/* Void info */}
      {packingInfo && showVoids && (
        <div>
          <Label text="空隙信息" />
          <div
            className="space-y-2 p-2.5"
            style={{
              borderRadius: RADIUS.xs,
              backgroundColor: COLORS.bgMuted,
            }}
          >
            {(voidType === 'tetrahedral' || voidType === 'all') && (
              <div>
                <p
                  className="text-xs font-medium mb-0.5"
                  style={{ color: COLORS.text }}
                >
                  四面体空隙
                </p>
                <p className="text-xs" style={{ color: COLORS.textMuted }}>
                  {packingInfo.voidInfo.tetrahedral.count}
                </p>
                <p className="text-xs" style={{ color: COLORS.textMuted }}>
                  {packingInfo.voidInfo.tetrahedral.rRatio}
                </p>
                <MaxIonRadiusRow
                  rRatio={packingInfo.voidInfo.tetrahedral.rRatio}
                  sphereRadiusPm={packingInfo.sphereRadiusPm}
                />
              </div>
            )}
            {(voidType === 'octahedral' || voidType === 'all') && (
              <div>
                <p
                  className="text-xs font-medium mb-0.5"
                  style={{ color: COLORS.text }}
                >
                  八面体空隙
                </p>
                <p className="text-xs" style={{ color: COLORS.textMuted }}>
                  {packingInfo.voidInfo.octahedral.count}
                </p>
                <p className="text-xs" style={{ color: COLORS.textMuted }}>
                  {packingInfo.voidInfo.octahedral.rRatio}
                </p>
                <MaxIonRadiusRow
                  rRatio={packingInfo.voidInfo.octahedral.rRatio}
                  sphereRadiusPm={packingInfo.sphereRadiusPm}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Description */}
      {packingInfo && (
        <div>
          <Label text="说明" />
          <p
            className="text-xs leading-relaxed"
            style={{ color: COLORS.textSecondary }}
          >
            {packingInfo.description}
          </p>
        </div>
      )}

      {/* Examples */}
      {packingInfo && packingInfo.examples.length > 0 && (
        <div>
          <Label text="代表物质" />
          <div className="flex flex-wrap gap-1">
            {packingInfo.examples.map((ex, i) => (
              <span
                key={i}
                className="text-xs px-2 py-0.5"
                style={{
                  borderRadius: RADIUS.xs,
                  backgroundColor: COLORS.primaryLight,
                  color: COLORS.primary,
                }}
              >
                {ex}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

function Label({ text }: { text: string }) {
  return (
    <p
      className="text-xs font-semibold mb-1.5"
      style={{ color: COLORS.textSecondary }}
    >
      {text}
    </p>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span style={{ color: COLORS.textMuted }}>{label}</span>
      <span className="font-medium" style={{ color: COLORS.text }}>
        {value}
      </span>
    </div>
  );
}

/** 显示可容纳最大离子半径，rRatio 无数值时不渲染 */
function MaxIonRadiusRow({
  rRatio,
  sphereRadiusPm,
}: {
  rRatio: string;
  sphereRadiusPm: number;
}) {
  const ratio = parseRRatio(rRatio);
  if (ratio === null) return null;
  const maxRadius = Math.round(ratio * sphereRadiusPm);
  return (
    <p className="text-xs mt-0.5" style={{ color: COLORS.primary }}>
      可容纳最大离子半径：{maxRadius} pm
    </p>
  );
}
