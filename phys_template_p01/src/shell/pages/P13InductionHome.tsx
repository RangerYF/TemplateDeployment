import { COLORS, SHADOWS } from '@/styles/tokens';
import {
  getP13AvailableModels,
  getP13PlannedModels,
  getP13ProductTracks,
  type P13ModelCard,
  type P13ProductTrack,
} from './p13PresetCatalog';

const VIEWPORT_LABELS: Record<string, string> = {
  field: '场',
  motion: '运动',
  force: '受力',
  circuit: '电路',
};

interface P13InductionHomeProps {
  onSelectPreset: (presetId: string) => void;
  onBack: () => void;
}

export function P13InductionHome({
  onSelectPreset,
  onBack,
}: P13InductionHomeProps) {
  const availableModels = getP13AvailableModels();
  const plannedModels = getP13PlannedModels();
  const tracks = getP13ProductTracks();

  return (
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: COLORS.bgPage }}>
      <header
        className="border-b px-5 py-5"
        style={{
          backgroundColor: COLORS.bg,
          borderColor: COLORS.border,
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-4xl">
            <button
              onClick={onBack}
              className="mb-3 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors hover:bg-gray-100"
              style={{ color: COLORS.textSecondary }}
            >
              ← 返回模板库
            </button>
            <h1 className="text-2xl font-semibold" style={{ color: COLORS.text }}>
              P-13 电磁感应
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6" style={{ color: COLORS.textMuted }}>
              在单棒模型族（EMI-011~013）完成后，本轮开始覆盖双棒模型：先开放 EMI-021 双棒基础（无摩擦），继续沿用统一壳层的参数区、视觉演示、图表、分步分析与终态结果区。
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <SummaryCard
              label="当前阶段"
              value="Phase 5"
              note="启动双棒模型：先开放 EMI-021"
              background="#FFF4E8"
              borderColor="#F4C48B"
              accent="#B96A16"
            />
            <SummaryCard
              label="已开放模型"
              value={String(availableModels.length)}
              note="保留 Phase 1 / 2，并延伸到双棒 EMI-021"
              background={COLORS.primaryLight}
              borderColor={`${COLORS.primary}33`}
              accent={COLORS.primary}
            />
            <SummaryCard
              label="后续模型位"
              value={String(plannedModels.length)}
              note="不提前做 Phase 4~6，只保留结构位"
              background={COLORS.bg}
              borderColor={COLORS.border}
              accent={COLORS.text}
            />
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-5">
        <section className="mb-6 grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
          <div
            className="rounded-3xl border p-5"
            style={{
              backgroundColor: COLORS.bg,
              borderColor: COLORS.border,
              boxShadow: SHADOWS.sm,
            }}
          >
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold" style={{ color: COLORS.textSecondary }}>
                  统一壳层预览
                </h2>
                <p className="mt-1 text-sm leading-6" style={{ color: COLORS.textMuted }}>
                  当前已把单棒模型族与 EMI-021 双棒基础统一收口到同一产品壳层：顶部模型选择、左侧参数区、中央视觉演示、下方图表、右下角终态结果区。
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {['顶部模型选择', '左侧参数区', '中央视觉演示', '下方图表', '右下角终态结果'].map((item) => (
                  <span
                    key={item}
                    className="rounded-full px-2.5 py-1 text-xs font-medium"
                    style={{
                      color: '#B96A16',
                      backgroundColor: '#FFF4E8',
                    }}
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <ShellPreview />
          </div>

          <div className="space-y-4">
            <InfoBoard
              title="当前已可进入"
              lines={[
                'P13-BASE-001：保留基础动生样例，不回退已有行为。',
                'EMI-001：继续承担楞次定律方向判断页面。',
                'EMI-011：纯电阻单棒，保留 Phase 3 的真实力-电-运动耦合。',
                'EMI-012：单棒 + 含电源，新增 v终 / I终 口径。',
                'EMI-013：单棒 + 含电容，新增 I终 = 0 与 U电容 口径。',
                'EMI-021：双棒无摩擦耦合，新增 v1-t / v2-t / i-t 与终态共速口径。',
              ]}
            />
            <InfoBoard
              title="本轮边界"
              lines={[
                '不提前实现 EMI-022/023、EMI-031。',
                '不提前实现 builder，只保留产品结构位。',
                '继续按理想模型实现，不引入自感和任意拓扑。',
              ]}
            />
          </div>
        </section>

        <section>
          <div className="mb-4">
            <h2 className="text-sm font-semibold" style={{ color: COLORS.textSecondary }}>
              产品主干模型
            </h2>
            <p className="mt-1 text-sm leading-6" style={{ color: COLORS.textMuted }}>
              按产品口径拆成 6 条主干。当前可运行模型直接给入口，未开放的条目只展示编号、教学用途和阶段说明。
            </p>
          </div>

          <div className="space-y-4">
            {tracks.map((track) => (
              <TrackSection
                key={track.key}
                track={track}
                onSelectPreset={onSelectPreset}
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function TrackSection({
  track,
  onSelectPreset,
}: {
  track: P13ProductTrack;
  onSelectPreset: (presetId: string) => void;
}) {
  const availableCount = track.models.filter((model) => model.status === 'available').length;
  return (
    <section
      className="rounded-3xl border p-5"
      style={{
        backgroundColor: COLORS.bg,
        borderColor: COLORS.border,
        boxShadow: SHADOWS.sm,
      }}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold" style={{ color: COLORS.text }}>
            {track.title}
          </h3>
          <p className="mt-1 max-w-3xl text-sm leading-6" style={{ color: COLORS.textMuted }}>
            {track.summary}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span
            className="rounded-full px-2.5 py-1 text-xs font-semibold"
            style={{
              color: availableCount > 0 ? COLORS.primary : '#B96A16',
              backgroundColor: availableCount > 0 ? COLORS.primaryLight : '#FFF4E8',
            }}
          >
            {availableCount > 0 ? `已开放 ${availableCount}` : '仅占位'}
          </span>
          <span
            className="rounded-full px-2.5 py-1 text-xs font-medium"
            style={{
              color: COLORS.textSecondary,
              backgroundColor: COLORS.bgPage,
            }}
          >
            {track.note}
          </span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {track.models.map((model) => (
          <ModelCard
            key={model.code}
            model={model}
            onSelectPreset={onSelectPreset}
          />
        ))}
      </div>
    </section>
  );
}

function ModelCard({
  model,
  onSelectPreset,
}: {
  model: P13ModelCard;
  onSelectPreset: (presetId: string) => void;
}) {
  const clickable = model.status === 'available' && !!model.preset;
  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        backgroundColor: COLORS.bg,
        borderColor: clickable ? `${COLORS.primary}35` : COLORS.border,
        boxShadow: SHADOWS.sm,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div
            className="text-xs font-medium uppercase tracking-[0.16em]"
            style={{ color: clickable ? COLORS.primary : '#B96A16' }}
          >
            {model.code}
          </div>
          <div className="mt-2 text-base font-semibold" style={{ color: COLORS.text }}>
            {model.title}
          </div>
        </div>
        <span
          className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={{
            color: clickable ? COLORS.primary : '#B96A16',
            backgroundColor: clickable ? COLORS.primaryLight : '#FFF4E8',
          }}
        >
          {clickable ? '已开放' : '占位'}
        </span>
      </div>

      <p className="mt-3 text-sm leading-6" style={{ color: COLORS.textMuted }}>
        {model.summary}
      </p>
      <p className="mt-3 text-xs leading-5" style={{ color: COLORS.textSecondary }}>
        {model.teachingUse}
      </p>

      {model.preset && (
        <div className="mt-4 flex flex-wrap gap-2">
          {model.preset.supportedViewports.map((viewport) => (
            <span
              key={viewport}
              className="rounded-full px-2.5 py-1 text-[11px] font-medium"
              style={{
                backgroundColor: COLORS.bgPage,
                color: COLORS.textSecondary,
              }}
            >
              {VIEWPORT_LABELS[viewport] ?? viewport}
            </span>
          ))}
        </div>
      )}

      <div
        className="mt-4 rounded-2xl px-3 py-2 text-xs leading-5"
        style={{
          backgroundColor: COLORS.bgPage,
          color: COLORS.textMuted,
        }}
      >
        {model.phaseNote}
      </div>

      <div className="mt-4">
        {clickable ? (
          <button
            onClick={() => model.preset && onSelectPreset(model.preset.id)}
            className="w-full rounded-2xl px-3 py-2 text-sm font-medium"
            style={{
              color: COLORS.white,
              backgroundColor: COLORS.primary,
            }}
          >
            进入模型
          </button>
        ) : (
          <div
            className="w-full rounded-2xl px-3 py-2 text-center text-sm font-medium"
            style={{
              color: COLORS.textSecondary,
              backgroundColor: COLORS.bgMuted,
            }}
          >
            当前阶段未开放
          </div>
        )}
      </div>
    </div>
  );
}

function ShellPreview() {
  return (
    <div
      className="rounded-[28px] border p-4"
      style={{
        backgroundColor: '#FFFDF9',
        borderColor: COLORS.border,
      }}
    >
      <div className="mb-3 flex flex-wrap gap-2">
        {['动生基础', '楞次定律', 'EMI-011', 'EMI-021', '竖直导轨', 'Builder'].map((item, index) => (
          <span
            key={item}
            className="rounded-full px-3 py-1.5 text-xs font-medium"
            style={{
              color: index === 3 ? '#B96A16' : COLORS.textSecondary,
              backgroundColor: index === 3 ? '#FFF4E8' : COLORS.bgPage,
            }}
          >
            {item}
          </span>
        ))}
      </div>

      <div className="grid gap-3 xl:grid-cols-[240px_minmax(0,1fr)_260px] xl:grid-rows-[minmax(0,1fr)_180px]">
        <PreviewBlock
          title="左侧参数区"
          subtitle="B / L / m1 / m2 / R1 / R2 / v1_0 / v2_0"
          className="xl:row-span-2"
        />
        <PreviewBlock title="中央视觉演示区" subtitle="导轨、磁场、导体棒、方向箭头" />
        <PreviewBlock title="右下角终态结果区" subtitle="v终 / I终 / τ / 观测窗末态" className="xl:row-span-2" />
        <PreviewBlock title="下方图表区" subtitle="v-t / i-t 联动" />
      </div>
    </div>
  );
}

function PreviewBlock({
  title,
  subtitle,
  className = '',
}: {
  title: string;
  subtitle: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-3xl border p-4 ${className}`.trim()}
      style={{
        backgroundColor: COLORS.bg,
        borderColor: COLORS.border,
      }}
    >
      <div className="text-sm font-semibold" style={{ color: COLORS.text }}>
        {title}
      </div>
      <div className="mt-2 text-xs leading-5" style={{ color: COLORS.textMuted }}>
        {subtitle}
      </div>
    </div>
  );
}

function InfoBoard({
  title,
  lines,
}: {
  title: string;
  lines: string[];
}) {
  return (
    <section
      className="rounded-3xl border p-4"
      style={{
        backgroundColor: COLORS.bg,
        borderColor: COLORS.border,
        boxShadow: SHADOWS.sm,
      }}
    >
      <h2 className="text-sm font-semibold" style={{ color: COLORS.text }}>
        {title}
      </h2>
      <div className="mt-3 space-y-2">
        {lines.map((line) => (
          <div
            key={line}
            className="rounded-2xl px-3 py-2 text-sm leading-6"
            style={{
              color: COLORS.textSecondary,
              backgroundColor: COLORS.bgPage,
            }}
          >
            {line}
          </div>
        ))}
      </div>
    </section>
  );
}

function SummaryCard({
  label,
  value,
  note,
  background,
  borderColor,
  accent,
}: {
  label: string;
  value: string;
  note: string;
  background: string;
  borderColor: string;
  accent: string;
}) {
  return (
    <div
      className="min-w-[168px] rounded-2xl border px-4 py-3"
      style={{
        backgroundColor: background,
        borderColor,
      }}
    >
      <div className="text-xs font-medium uppercase tracking-[0.14em]" style={{ color: accent }}>
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold" style={{ color: COLORS.text }}>
        {value}
      </div>
      <div className="mt-1 text-xs leading-5" style={{ color: COLORS.textMuted }}>
        {note}
      </div>
    </div>
  );
}
