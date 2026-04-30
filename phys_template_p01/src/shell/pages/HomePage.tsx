import {
  isBuilderEnabled,
  isBuilderFeedbackMode,
  isElectricFeedbackMode,
  isP08StandaloneMode,
} from '@/app-config';
import { COLORS, SHADOWS, RADIUS } from '@/styles/tokens';

interface HomePageProps {
  onSelectTemplate: () => void;
  onSelectBuilder?: () => void;
  onSelectP13?: () => void;
  onSelectP08?: () => void;
  onSelectP08Builder?: () => void;
}

export function HomePage({
  onSelectTemplate,
  onSelectBuilder,
  onSelectP13,
  onSelectP08,
  onSelectP08Builder,
}: HomePageProps) {
  if (isP08StandaloneMode) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center px-6 py-12"
        style={{ backgroundColor: COLORS.bgPage }}
      >
        <div className="w-full max-w-5xl">
          <div className="mx-auto max-w-3xl text-center">
            <div
              className="text-xs font-semibold uppercase tracking-[0.18em]"
              style={{ color: COLORS.primary }}
            >
              P-08 Standalone
            </div>
            <h1
              className="mt-4 text-3xl font-bold"
              style={{ color: COLORS.text }}
            >
              P-08 电场与磁场可视化器
            </h1>
            <p
              className="mt-3 text-sm leading-7"
              style={{ color: COLORS.textMuted }}
            >
              这个独立部署只保留两个入口：P-08 电场与磁场可视化器，以及 P-08 场搭建器。
            </p>
          </div>

          <div className="mt-10 flex flex-wrap justify-center gap-6">
            {onSelectP08 && (
              <button
                onClick={onSelectP08}
                className="group flex w-80 flex-col items-center rounded-2xl border p-8 text-center transition-all hover:shadow-lg"
                style={{
                  backgroundColor: COLORS.bg,
                  borderColor: COLORS.border,
                  borderRadius: RADIUS.card,
                  boxShadow: SHADOWS.sm,
                }}
              >
                <div
                  className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
                  style={{ backgroundColor: COLORS.infoLight }}
                >
                  🧲
                </div>
                <span
                  className="mb-2 text-base font-semibold"
                  style={{ color: COLORS.text }}
                >
                  P-08 电场与磁场可视化器
                </span>
                <span
                  className="text-xs leading-relaxed"
                  style={{ color: COLORS.textMuted }}
                >
                  进入 P-08 教学场景入口，按模块浏览静电场、静磁场、粒子运动与复合场演示。
                </span>
              </button>
            )}

            {onSelectP08Builder && (
              <button
                onClick={onSelectP08Builder}
                className="group flex w-80 flex-col items-center rounded-2xl border p-8 text-center transition-all hover:shadow-lg"
                style={{
                  backgroundColor: COLORS.bg,
                  borderColor: COLORS.border,
                  borderRadius: RADIUS.card,
                  boxShadow: SHADOWS.sm,
                }}
              >
                <div
                  className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
                  style={{ backgroundColor: '#EAF7F1' }}
                >
                  🧪
                </div>
                <span
                  className="mb-2 text-base font-semibold"
                  style={{ color: COLORS.text }}
                >
                  P-08 场搭建器
                </span>
                <span
                  className="text-xs leading-relaxed"
                  style={{ color: COLORS.textMuted }}
                >
                  从空白场景直接搭建电荷、电场、磁场、导线和螺线管，只保留 P-08 相关能力。
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const title = isElectricFeedbackMode
    ? '电学实验反馈版'
    : isBuilderFeedbackMode
      ? '电学实验与搭建反馈版'
      : '电路模拟器';
  const subtitle = isElectricFeedbackMode
    ? '当前只开放模板实验与专题页体验'
    : isBuilderFeedbackMode
      ? '当前保留两块入口：电学实验模板与自由搭建'
      : '选择一种方式开始';
  const templateLabel = isBuilderFeedbackMode ? '电学实验模板' : '实验模板';
  const templateDescription = isBuilderFeedbackMode
    ? '进入 P-04 电学实验模板与专题页，查看测量、比较和误差分析等实验内容'
    : '覆盖当前开放的电学实验模板与专题分析页面，适合收集课堂体验反馈';
  const builderLabel = isBuilderFeedbackMode ? '自由搭建' : '自由搭建';
  const builderDescription = isBuilderFeedbackMode
    ? '进入统一搭建台，可从空白开始，也可在同一工作台里直接加载模板继续搭建'
    : '从元器件库拖拽元件到画布，自由连线搭建电路';

  return (
    <div
      className="flex h-screen flex-col items-center justify-center"
      style={{ backgroundColor: COLORS.bgPage }}
    >
      <h1
        className="mb-2 text-2xl font-bold"
        style={{ color: COLORS.text }}
      >
        {title}
      </h1>
      <p
        className="mb-10 text-sm"
        style={{ color: COLORS.textMuted }}
      >
        {subtitle}
      </p>

      <div className="flex flex-wrap justify-center gap-6">
        {/* 实验模板模式 */}
        <button
          onClick={onSelectTemplate}
          className="group flex w-64 flex-col items-center rounded-2xl border p-8 text-center transition-all hover:shadow-lg"
          style={{
            backgroundColor: COLORS.bg,
            borderColor: COLORS.border,
            borderRadius: RADIUS.card,
            boxShadow: SHADOWS.sm,
          }}
        >
          <div
            className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
            style={{ backgroundColor: COLORS.primaryLight }}
          >
            📋
          </div>
          <span
            className="mb-2 text-base font-semibold"
            style={{ color: COLORS.text }}
          >
            {templateLabel}
          </span>
          <span
            className="text-xs leading-relaxed"
            style={{ color: COLORS.textMuted }}
          >
            {templateDescription}
          </span>
        </button>

        {onSelectP08 && (
          <button
            onClick={onSelectP08}
            className="group flex w-64 flex-col items-center rounded-2xl border p-8 text-center transition-all hover:shadow-lg"
            style={{
              backgroundColor: COLORS.bg,
              borderColor: COLORS.border,
              borderRadius: RADIUS.card,
              boxShadow: SHADOWS.sm,
            }}
          >
            <div
              className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
              style={{ backgroundColor: COLORS.infoLight }}
            >
              🧲
            </div>
            <span
              className="mb-2 text-base font-semibold"
              style={{ color: COLORS.text }}
            >
              P-08 电场与磁场可视化器
            </span>
            <span
              className="text-xs leading-relaxed"
              style={{ color: COLORS.textMuted }}
            >
              进入独立入口，按静电场、带电粒子在电场中、静磁场、带电粒子在磁场中、复合场组织教学场景
            </span>
          </button>
        )}

        {onSelectP08Builder && (
          <button
            onClick={onSelectP08Builder}
            className="group flex w-64 flex-col items-center rounded-2xl border p-8 text-center transition-all hover:shadow-lg"
            style={{
              backgroundColor: COLORS.bg,
              borderColor: COLORS.border,
              borderRadius: RADIUS.card,
              boxShadow: SHADOWS.sm,
            }}
          >
            <div
              className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
              style={{ backgroundColor: '#EAF7F1' }}
            >
              🧪
            </div>
            <span
              className="mb-2 text-base font-semibold"
              style={{ color: COLORS.text }}
            >
              P-08 场搭建器
            </span>
            <span
              className="text-xs leading-relaxed"
              style={{ color: COLORS.textMuted }}
            >
              独立进入空白场景，添加电荷、电场、磁场、导线和螺线管，直接完成课堂搭建
            </span>
          </button>
        )}

        {/* 自由搭建模式 */}
        {isBuilderEnabled && onSelectBuilder && (
          <button
            onClick={onSelectBuilder}
            className="group flex w-64 flex-col items-center rounded-2xl border p-8 text-center transition-all hover:shadow-lg"
            style={{
              backgroundColor: COLORS.bg,
              borderColor: COLORS.border,
              borderRadius: RADIUS.card,
              boxShadow: SHADOWS.sm,
            }}
          >
            <div
              className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
              style={{ backgroundColor: '#EEF2FF' }}
            >
              🔧
            </div>
            <span
              className="mb-2 text-base font-semibold"
              style={{ color: COLORS.text }}
            >
              {builderLabel}
            </span>
            <span
              className="text-xs leading-relaxed"
              style={{ color: COLORS.textMuted }}
            >
              {builderDescription}
            </span>
          </button>
        )}

        {onSelectP13 && (
          <button
            onClick={onSelectP13}
            className="group flex w-64 flex-col items-center rounded-2xl border p-8 text-center transition-all hover:shadow-lg"
            style={{
              backgroundColor: COLORS.bg,
              borderColor: COLORS.border,
              borderRadius: RADIUS.card,
              boxShadow: SHADOWS.sm,
            }}
          >
            <div
              className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
              style={{ backgroundColor: '#FFF4E8' }}
            >
              🔄
            </div>
            <span
              className="mb-2 text-base font-semibold"
              style={{ color: COLORS.text }}
            >
              P-13 电磁感应
            </span>
            <span
              className="text-xs leading-relaxed"
              style={{ color: COLORS.textMuted }}
            >
              进入独立入口，查看已开放的基础样例、EMI-001 楞次定律、单棒模型族以及双棒 EMI-021，并为后续分支保留扩展位
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
