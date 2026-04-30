import {
  filterVisibleCategories,
  filterVisiblePresets,
  isElectricExperimentFeedbackMode,
} from '@/app-config';
import { presetRegistry } from '@/core/registries/preset-registry';
import { COLORS } from '@/styles/tokens';
import { P08_PRESET_IDS, P08_PRODUCT_CATEGORY } from './p08PresetCatalog';
import { P13_PRODUCT_CATEGORY } from './p13PresetCatalog';

const CATEGORY_LABELS: Record<string, string> = {
  'P-01': '力学',
  'P-02': '电磁学',
  'P-03': '热学',
  'P-04': '电学实验',
  'P-08': '电场与磁场可视化器',
  'P-13': '电磁感应',
};

/** 专题实验（独立页面，不走 simulator 流程） */
const SPECIAL_EXPERIMENTS = [
  {
    id: '__meter-error__',
    hash: 'meter-error',
    name: '电表测量误差对比',
    description: '对比理想电路、电压表内接法、外接法的测量差异，实时显示误差与推荐方案',
    category: 'P-04',
    icon: '📊',
  },
  {
    id: '__measure-emf-compare__',
    hash: 'measure-emf-compare',
    name: '测电源E/r内外接对比',
    description: '同屏比较理想、内接法、外接法的 U-I 图线、拟合值和误差变化',
    category: 'P-04',
    icon: '📈',
  },
  {
    id: '__half-deflection-compare__',
    hash: 'half-deflection-compare',
    name: '半偏法内阻对比',
    description: '切换电流表半偏/电压表半偏，观察滑动变阻器阻值与误差的关系',
    category: 'P-04',
    icon: '📉',
  },
  {
    id: '__ohmmeter-midpoint-compare__',
    hash: 'ohmmeter-midpoint-compare',
    name: '欧姆表中值电阻对比',
    description: '比较理想调零与当前调零状态，直观看出 Rx=R中 时的半偏关系',
    category: 'P-04',
    icon: '🎯',
  },
  {
    id: '__meter-reading-trainer__',
    hash: 'meter-reading-trainer',
    name: '电表表头读数训练',
    description: '训练常见电流表、电压表、灵敏电流计的表盘读数，支持整格和半格估读',
    category: 'P-04',
    icon: '🧭',
  },
  {
    id: '__voltage-resistance-method__',
    hash: 'voltage-resistance-method',
    name: '伏阻法测电阻',
    description: '通过串联分压和电压表读数，比较理想与真实电压表下对未知电阻 Rx 的间接测量',
    category: 'P-04',
    icon: '🔌',
  },
  {
    id: '__current-resistance-method__',
    hash: 'current-resistance-method',
    name: '安阻法测电阻',
    description: '并联 R0 与 Rx，分两次测支路电流，利用电流分配关系反推未知电阻并比较 Ra 引入的误差',
    category: 'P-04',
    icon: '🔍',
  },
  {
    id: '__meter-conversion__',
    hash: 'meter-conversion',
    name: '电表改装实验',
    description: '切换分流与分压两种改装方式，观察量程、电路分配、刻度和误差如何同步变化',
    category: 'P-04',
    icon: '🛠️',
  },
];

interface PresetGalleryProps {
  onSelectPreset: (presetId: string) => void;
  onBack?: () => void;
  onOpenP13?: () => void;
  onOpenP08?: () => void;
}

export function PresetGallery({
  onSelectPreset,
  onBack,
  onOpenP13,
  onOpenP08,
}: PresetGalleryProps) {
  const categories = filterVisibleCategories(presetRegistry.getCategories()).filter(
    (category) => category !== P08_PRODUCT_CATEGORY && category !== P13_PRODUCT_CATEGORY,
  );

  return (
    <div
      className="flex h-screen flex-col"
      style={{ backgroundColor: COLORS.bgPage }}
    >
      {/* 顶栏 */}
      <header
        className="flex items-center px-6 py-4"
        style={{ borderBottom: `1px solid ${COLORS.border}`, backgroundColor: COLORS.bg }}
      >
        {onBack && (
          <button
            onClick={onBack}
            className="mr-3 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors hover:bg-gray-100"
            style={{ color: COLORS.textSecondary }}
          >
            ← 返回
          </button>
        )}
        <h1 className="text-lg font-semibold" style={{ color: COLORS.text }}>
          {isElectricExperimentFeedbackMode ? '电学实验模板库' : '实验模板库'}
        </h1>
        <span className="ml-3 text-xs" style={{ color: COLORS.textMuted }}>
          {isElectricExperimentFeedbackMode ? '当前仅开放 P-04 电学实验模板与专题页' : '选择一个预设场景开始'}
        </span>
      </header>

      {/* 预设网格 */}
      <main className="flex-1 overflow-y-auto p-6">
        {(onOpenP08 || onOpenP13) && !isElectricExperimentFeedbackMode && (
          <section className="mb-8">
            <h2
              className="mb-4 text-sm font-semibold"
              style={{ color: COLORS.textSecondary }}
            >
              产品模块
            </h2>
            <div className="grid gap-4 lg:grid-cols-2">
              {onOpenP08 && (
                <button
                  onClick={onOpenP08}
                  className="group flex w-full flex-col rounded-2xl border p-6 text-left transition-all hover:shadow-md lg:justify-between"
                  style={{
                    backgroundColor: COLORS.primaryLight,
                    borderColor: `${COLORS.primary}33`,
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className="flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
                      style={{ backgroundColor: COLORS.bg }}
                    >
                      🧲
                    </div>
                    <div>
                      <div
                        className="text-xs font-medium uppercase tracking-[0.16em]"
                        style={{ color: COLORS.primary }}
                      >
                        P-08
                      </div>
                      <div
                        className="mt-1 text-lg font-semibold"
                        style={{ color: COLORS.text }}
                      >
                        电场与磁场可视化器
                      </div>
                      <div
                        className="mt-2 text-sm leading-6"
                        style={{ color: COLORS.textMuted }}
                      >
                        从独立入口进入 5 个教学模块：静电场、带电粒子在电场中、静磁场、带电粒子在磁场中、复合场。
                      </div>
                    </div>
                  </div>
                  <div
                    className="mt-4 text-sm font-medium"
                    style={{ color: COLORS.primary }}
                  >
                    打开 P-08 页面 →
                  </div>
                </button>
              )}

              {onOpenP13 && (
                <button
                  onClick={onOpenP13}
                  className="group flex w-full flex-col rounded-2xl border p-6 text-left transition-all hover:shadow-md lg:justify-between"
                  style={{
                    backgroundColor: '#FFF4E8',
                    borderColor: '#F4C48B',
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className="flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
                      style={{ backgroundColor: COLORS.bg }}
                    >
                      🔄
                    </div>
                    <div>
                      <div
                        className="text-xs font-medium uppercase tracking-[0.16em]"
                        style={{ color: '#B96A16' }}
                      >
                        P-13
                      </div>
                      <div
                        className="mt-1 text-lg font-semibold"
                        style={{ color: COLORS.text }}
                      >
                        电磁感应
                      </div>
                      <div
                        className="mt-2 text-sm leading-6"
                        style={{ color: COLORS.textMuted }}
                      >
                        从独立入口查看当前已开放的基础样例、EMI-001、单棒模型族与双棒 EMI-021，并为后续分支保留清晰扩展结构。
                      </div>
                    </div>
                  </div>
                  <div
                    className="mt-4 text-sm font-medium"
                    style={{ color: '#B96A16' }}
                  >
                    打开 P-13 页面 →
                  </div>
                </button>
              )}
            </div>
          </section>
        )}

        {categories.map((cat) => {
          const presets = filterVisiblePresets(presetRegistry.getByCategory(cat)).filter(
            (preset) => !P08_PRESET_IDS.has(preset.id),
          );
          const experiments = SPECIAL_EXPERIMENTS.filter((exp) => exp.category === cat);
          if (presets.length === 0 && experiments.length === 0) return null;
          return (
            <section key={cat} className="mb-8">
              <h2
                className="mb-4 text-sm font-semibold"
                style={{ color: COLORS.textSecondary }}
              >
                {CATEGORY_LABELS[cat] ?? cat}
              </h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {/* 专题实验卡片 */}
                {experiments.map((exp) => (
                    <button
                      key={exp.id}
                      onClick={() => { window.location.hash = exp.hash; }}
                      className="group flex flex-col rounded-xl border p-4 text-left transition-all hover:shadow-md"
                      style={{
                        backgroundColor: '#F0FBF6',
                        borderColor: COLORS.primary + '40',
                      }}
                    >
                      <div
                        className="mb-3 flex h-24 items-center justify-center rounded-lg text-2xl"
                        style={{ backgroundColor: COLORS.primaryLight }}
                      >
                        {exp.icon}
                      </div>
                      <span className="text-sm font-medium" style={{ color: COLORS.primary }}>
                        {exp.name}
                      </span>
                      <span className="mt-1 line-clamp-2 text-xs" style={{ color: COLORS.textMuted }}>
                        {exp.description}
                      </span>
                      <div className="mt-2">
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                          style={{ backgroundColor: COLORS.primaryLight, color: COLORS.primary }}
                        >
                          专题实验
                        </span>
                      </div>
                    </button>
                  ))}

                {presets.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => onSelectPreset(preset.id)}
                    className="group flex flex-col rounded-xl border p-4 text-left transition-all hover:shadow-md"
                    style={{
                      backgroundColor: COLORS.bg,
                      borderColor: COLORS.border,
                    }}
                  >
                    {/* 预览占位 */}
                    <div
                      className="mb-3 flex h-24 items-center justify-center rounded-lg text-2xl"
                      style={{ backgroundColor: COLORS.bgMuted }}
                    >
                      {preset.supportedViewports.includes('force') ? '⚖️' : '⚡'}
                    </div>

                    {/* 标题 */}
                    <span
                      className="text-sm font-medium group-hover:text-[color:var(--hover-color)]"
                      style={{
                        color: COLORS.text,
                        '--hover-color': COLORS.primary,
                      } as React.CSSProperties}
                    >
                      {preset.name}
                    </span>

                    {/* 描述 */}
                    <span
                      className="mt-1 line-clamp-2 text-xs"
                      style={{ color: COLORS.textMuted }}
                    >
                      {preset.description}
                    </span>

                    <div className="mt-2 flex items-center gap-2">
                      {preset.duration === 0 && (
                        <span
                          className="text-[10px]"
                          style={{ color: COLORS.textMuted }}
                        >
                          静态
                        </span>
                      )}
                      {preset.duration > 0 && (
                        <span
                          className="text-[10px]"
                          style={{ color: COLORS.textMuted }}
                        >
                          {preset.duration}s 动画
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
