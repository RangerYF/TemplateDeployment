import { useEffect, useState } from 'react';
import type { PresetData } from '@/core/types';
import { COLORS, SHADOWS } from '@/styles/tokens';
import {
  getP08ModuleSections,
  getP08SceneTeachingUse,
  type P08ModuleKey,
} from './p08PresetCatalog';

const MODULE_DECORATION: Record<
  P08ModuleKey,
  { marker: string; accent: string; background: string }
> = {
  electrostatic: {
    marker: 'E',
    accent: COLORS.info,
    background: COLORS.infoLight,
  },
  'particle-electric': {
    marker: 'qE',
    accent: COLORS.warning,
    background: COLORS.warningLight,
  },
  magnetostatic: {
    marker: 'B',
    accent: COLORS.primary,
    background: COLORS.primaryLight,
  },
  'particle-magnetic': {
    marker: 'qvB',
    accent: '#9B59B6',
    background: '#F5EDFF',
  },
  'combined-field': {
    marker: 'E+B',
    accent: '#EB7A2F',
    background: '#FFF1E8',
  },
};

const VIEWPORT_LABELS: Record<string, string> = {
  field: '场',
  motion: '运动',
  force: '受力',
  circuit: '电路',
  energy: '能量',
  momentum: '动量',
};

interface P08FieldMagnetHomeProps {
  onSelectPreset: (presetId: string, moduleKey: P08ModuleKey) => void;
  onOpenBuilder: () => void;
  onBack: () => void;
  initialActiveKey?: P08ModuleKey;
}

export function P08FieldMagnetHome({
  onSelectPreset,
  onOpenBuilder,
  onBack,
  initialActiveKey,
}: P08FieldMagnetHomeProps) {
  const sections = getP08ModuleSections();
  const [activeKey, setActiveKey] = useState<P08ModuleKey>(
    initialActiveKey ?? sections[0]?.key ?? 'electrostatic',
  );
  useEffect(() => {
    if (initialActiveKey) {
      setActiveKey(initialActiveKey);
    }
  }, [initialActiveKey]);
  const activeSection =
    sections.find((section) => section.key === activeKey) ?? sections[0];

  return (
    <div
      className="flex h-screen flex-col"
      style={{ backgroundColor: COLORS.bgPage }}
    >
      <header
        className="px-6 py-5"
        style={{
          backgroundColor: COLORS.bg,
          borderBottom: `1px solid ${COLORS.border}`,
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <button
              onClick={onBack}
              className="mb-3 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors hover:bg-gray-100"
              style={{ color: COLORS.textSecondary }}
            >
              ← 返回模板库
            </button>
            <h1
              className="text-2xl font-semibold"
              style={{ color: COLORS.text }}
            >
              P-08 电场与磁场可视化器
            </h1>
            <p
              className="mt-2 max-w-3xl text-sm leading-6"
              style={{ color: COLORS.textMuted }}
            >
              面向高中物理课堂的场线与粒子运动演示模块，按 5 个教学模块组织当前可验收、可对外说明的 P-08 场景。
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={onOpenBuilder}
              className="rounded-2xl border px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
              style={{
                backgroundColor: '#EAF7F1',
                borderColor: '#89C79E',
                boxShadow: SHADOWS.sm,
              }}
            >
              <div className="text-xs font-medium" style={{ color: '#1F7A4C' }}>
                新入口
              </div>
              <div className="mt-1 text-base font-semibold" style={{ color: COLORS.text }}>
                进入场搭建器
              </div>
              <div className="mt-1 text-xs leading-5" style={{ color: COLORS.textMuted }}>
                空白场景添加电荷、匀强场、导线和螺线管，直接完成课堂搭建
              </div>
            </button>

            <div
              className="rounded-2xl border px-4 py-3"
              style={{
                backgroundColor: COLORS.primaryLight,
                borderColor: `${COLORS.primary}33`,
              }}
            >
              <div className="text-xs font-medium" style={{ color: COLORS.primary }}>
                已开放模块
              </div>
              <div
                className="mt-1 text-2xl font-semibold"
                style={{ color: COLORS.text }}
              >
                {sections.length}
              </div>
              <div className="text-xs" style={{ color: COLORS.textMuted }}>
                共 {sections.reduce((sum, section) => sum + section.presets.length, 0)} 个场景
              </div>
            </div>

            <div
              className="rounded-2xl border px-4 py-3"
              style={{
                backgroundColor: COLORS.bg,
                borderColor: COLORS.border,
              }}
            >
              <div className="text-xs font-medium" style={{ color: COLORS.textSecondary }}>
                当前状态
              </div>
              <div
                className="mt-1 text-base font-semibold"
                style={{ color: COLORS.text }}
              >
                核心能力已可验收
              </div>
              <div className="text-xs" style={{ color: COLORS.textMuted }}>
                未完成项已单独标注，不与已交付能力混报
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <section className="mb-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {sections.map((section, index) => {
              const decoration = MODULE_DECORATION[section.key];
              const isActive = section.key === activeSection?.key;
              return (
                <button
                  key={section.key}
                  onClick={() => setActiveKey(section.key)}
                  className="rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
                  style={{
                    backgroundColor: isActive ? COLORS.bg : decoration.background,
                    borderColor: isActive ? decoration.accent : `${decoration.accent}33`,
                    boxShadow: isActive ? SHADOWS.md : SHADOWS.sm,
                  }}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span
                      className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                      style={{
                        color: decoration.accent,
                        backgroundColor: isActive ? decoration.background : COLORS.bg,
                      }}
                    >
                      模块 {index + 1}
                    </span>
                    <span
                      className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                      style={{
                        color: decoration.accent,
                        backgroundColor: COLORS.bg,
                      }}
                    >
                      {section.presets.length} 个场景
                    </span>
                  </div>
                  <div
                    className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-semibold"
                    style={{
                      color: decoration.accent,
                      backgroundColor: isActive ? decoration.background : COLORS.bg,
                    }}
                  >
                    {decoration.marker}
                  </div>
                  <div
                    className="text-base font-semibold"
                    style={{ color: COLORS.text }}
                  >
                    {section.title}
                  </div>
                  <div
                    className="mt-2 text-xs leading-5"
                    style={{ color: COLORS.textMuted }}
                  >
                    {section.summary}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {activeSection && (
          <section>
            {activeSection.presets.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {activeSection.presets.map((preset) => (
                  <PresetCard
                    key={preset.id}
                    preset={preset}
                    moduleKey={activeSection.key}
                    onClick={() => onSelectPreset(preset.id, activeSection.key)}
                  />
                ))}
              </div>
            ) : (
              <div
                className="rounded-2xl border px-5 py-10 text-center text-sm"
                style={{
                  backgroundColor: COLORS.bg,
                  borderColor: COLORS.border,
                  color: COLORS.textMuted,
                }}
              >
                当前模式下没有可展示的 P-08 场景。
              </div>
            )}
          </section>
        )}

      </main>
    </div>
  );
}

function PresetCard({
  preset,
  moduleKey,
  onClick,
}: {
  preset: PresetData;
  moduleKey: P08ModuleKey;
  onClick: () => void;
}) {
  const decoration = MODULE_DECORATION[moduleKey];
  const teachingUse = getP08SceneTeachingUse(preset.id);
  return (
    <button
      onClick={onClick}
      className="group rounded-2xl border p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg"
      style={{
        backgroundColor: COLORS.bg,
        borderColor: COLORS.border,
        boxShadow: SHADOWS.sm,
      }}
    >
      <div
        className="mb-4 flex h-24 items-center justify-between rounded-2xl px-4"
        style={{ backgroundColor: decoration.background }}
      >
        <div>
          <div
            className="text-[11px] font-medium uppercase tracking-[0.14em]"
            style={{ color: decoration.accent }}
          >
            场景入口
          </div>
          <div
            className="mt-2 text-lg font-semibold"
            style={{ color: COLORS.text }}
          >
            {decoration.marker}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div
            className="rounded-full px-3 py-1 text-[11px] font-semibold"
            style={{
              color: decoration.accent,
              backgroundColor: COLORS.bg,
            }}
          >
            {preset.duration > 0 ? `${preset.duration}s 动画` : '静态场景'}
          </div>
        </div>
      </div>

      <div
        className="text-base font-semibold transition-colors"
        style={{ color: COLORS.text }}
      >
        {preset.name}
      </div>
      <p
        className="mt-2 min-h-[3rem] text-sm leading-6"
        style={{ color: COLORS.textMuted }}
      >
        {preset.description}
      </p>

      <div
        className="mt-4 rounded-2xl border px-4 py-3"
        style={{
          borderColor: COLORS.border,
          backgroundColor: COLORS.bgMuted,
        }}
      >
        <div
          className="text-[11px] font-medium uppercase tracking-[0.12em]"
          style={{ color: COLORS.textSecondary }}
        >
          适合讲什么
        </div>
        <div
          className="mt-2 text-xs leading-6"
          style={{ color: COLORS.text }}
        >
          {teachingUse}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {preset.supportedViewports.map((viewport) => (
          <span
            key={viewport}
            className="rounded-full px-2.5 py-1 text-[11px] font-medium"
            style={{
              color: COLORS.textSecondary,
              backgroundColor: COLORS.bgMuted,
            }}
          >
            {VIEWPORT_LABELS[viewport] ?? viewport}
          </span>
        ))}
      </div>

      <div
        className="mt-5 flex items-center justify-end border-t pt-4 text-xs"
        style={{ borderColor: COLORS.border }}
      >
        <span
          className="font-medium transition-colors"
          style={{ color: decoration.accent }}
        >
          进入场景 →
        </span>
      </div>
    </button>
  );
}
