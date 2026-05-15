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
  onOpenRoute: (route: 'p13-builder') => void;
  onBack: () => void;
}

export function P13InductionHome({
  onSelectPreset,
  onOpenRoute,
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
              当前入口按产品口径拆成动生、感生、单棒、双棒、竖直导轨和自由组装六条主线；标准模型与组装入口都从这里进入。
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <SummaryCard
              label="标准模型"
              value={String(availableModels.filter((item) => item.code !== 'P13-BUILDER').length)}
              note="覆盖基础动生、楞次定律、单棒、双棒和竖直导轨"
              background="#FFF4E8"
              borderColor="#F4C48B"
              accent="#B96A16"
            />
            <SummaryCard
              label="组装入口"
              value="1"
              note="提供 P13 独立的实时组装工作台"
              background={COLORS.primaryLight}
              borderColor={`${COLORS.primary}33`}
              accent={COLORS.primary}
            />
            <SummaryCard
              label="预留模型"
              value={String(plannedModels.length)}
              note="当前暂无额外占位模型"
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
                  单棒模型族、双棒模型族和竖直导轨已经统一到同一产品壳层：顶部模型选择、左侧参数区、中央视觉演示、下方图表、右下角结果区和分析面板保持一致。
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
                'P13-BASE-001：基础动生样例。',
                'EMI-001：磁棒-线圈楞次定律。',
                'EMI-011~013：单棒模型族。',
                'EMI-021、EMI-024：双棒主展示模型。',
                'EMI-031：竖直导轨单棒。',
                'P13-BUILDER：实时组装工作台。',
              ]}
            />
            <InfoBoard
              title="入口说明"
              lines={[
                '标准模型适合直接进课堂演示。',
                '自由组装适合在同一工作台里切结构、调参数、看图表和做分步分析。',
                '各模型统一提供显示开关、时间轴和结果区。',
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
              按产品口径拆成 6 条主干。可运行模型直接给入口，未开放的条目只保留最小说明。
            </p>
          </div>

          <div className="space-y-4">
            {tracks.map((track) => (
              <TrackSection
                key={track.key}
                track={track}
                onSelectPreset={onSelectPreset}
                onOpenRoute={onOpenRoute}
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
  onOpenRoute,
}: {
  track: P13ProductTrack;
  onSelectPreset: (presetId: string) => void;
  onOpenRoute: (route: 'p13-builder') => void;
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
            onOpenRoute={onOpenRoute}
          />
        ))}
      </div>
    </section>
  );
}

function ModelCard({
  model,
  onSelectPreset,
  onOpenRoute,
}: {
  model: P13ModelCard;
  onSelectPreset: (presetId: string) => void;
  onOpenRoute: (route: 'p13-builder') => void;
}) {
  const clickable = model.status === 'available' && (!!model.preset || !!model.route);
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
          {clickable ? '可进入' : '预留'}
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

      <div className="mt-4">
        {clickable ? (
          <button
            onClick={() => {
              if (model.route) {
                onOpenRoute(model.route);
                return;
              }
              if (model.preset) {
                onSelectPreset(model.preset.id);
              }
            }}
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
            暂未开放
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
        {['动生基础', '楞次定律', 'EMI-011', 'EMI-021', 'EMI-024', 'EMI-031', 'Builder'].map((item, index) => (
          <span
            key={item}
            className="rounded-full px-3 py-1.5 text-xs font-medium"
            style={{
              color: index >= 3 && index <= 6 ? '#B96A16' : COLORS.textSecondary,
              backgroundColor: index >= 3 && index <= 6 ? '#FFF4E8' : COLORS.bgPage,
            }}
          >
            {item}
          </span>
        ))}
      </div>

      <div className="grid gap-3 xl:grid-cols-[240px_minmax(0,1fr)_260px] xl:grid-rows-[minmax(0,1fr)_180px]">
        <PreviewBlock
          title="左侧参数区"
          subtitle="按模型切换 B / L / m / R / 初态参数"
          className="xl:row-span-2"
        />
        <PreviewBlock title="中央视觉演示区" subtitle="导轨、磁场、导体棒、方向箭头" />
        <PreviewBlock title="右下角终态结果区" subtitle="v终 / I终 / Uc终 / τ / 终态解释" className="xl:row-span-2" />
        <PreviewBlock title="下方图表区" subtitle="v-t / i-t / Uc-t 联动" />
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
