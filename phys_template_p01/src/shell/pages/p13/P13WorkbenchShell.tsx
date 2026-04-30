import type { ReactNode } from 'react';
import { COLORS, SHADOWS } from '@/styles/tokens';

export const P13_SHELL_COLORS = {
  pageBg: COLORS.bgPage,
  panelBg: COLORS.bg,
  panelSoft: '#FCFCFD',
  blockBg: COLORS.bg,
  blockSoft: COLORS.bgMuted,
  border: COLORS.border,
  borderStrong: COLORS.borderStrong,
  text: COLORS.text,
  muted: COLORS.textMuted,
  secondary: COLORS.textSecondary,
  primary: '#B96A16',
  primarySoft: '#FFF4E8',
  primaryBorder: '#F4C48B',
  velocity: '#2563EB',
  emf: '#0EA5E9',
  current: '#F97316',
  force: '#DC2626',
  field: '#16A34A',
} as const;

type BadgeTone = 'primary' | 'muted' | 'warning' | 'success';

interface WorkbenchBadge {
  label: string;
  value: string;
  tone?: BadgeTone;
}

interface P13WorkbenchShellProps {
  title: string;
  subtitle: string;
  onBack: () => void;
  badges?: WorkbenchBadge[];
  modelRail?: ReactNode;
  leftPanel: ReactNode;
  stagePanel: ReactNode;
  chartPanel: ReactNode;
  analysisPanel?: ReactNode;
  resultPanel: ReactNode;
}

const BADGE_STYLES: Record<BadgeTone, { color: string; backgroundColor: string }> = {
  primary: {
    color: P13_SHELL_COLORS.primary,
    backgroundColor: P13_SHELL_COLORS.primarySoft,
  },
  muted: {
    color: P13_SHELL_COLORS.secondary,
    backgroundColor: '#F3F4F6',
  },
  warning: {
    color: '#B96A16',
    backgroundColor: '#FFF4E8',
  },
  success: {
    color: '#166534',
    backgroundColor: '#EAF8EE',
  },
};

export function P13WorkbenchShell({
  title,
  subtitle,
  onBack,
  badges,
  modelRail,
  leftPanel,
  stagePanel,
  chartPanel,
  analysisPanel,
  resultPanel,
}: P13WorkbenchShellProps) {
  return (
    <div
      className="flex min-h-screen w-full flex-col"
      style={{ backgroundColor: P13_SHELL_COLORS.pageBg }}
    >
      <header
        className="border-b px-4 py-4 md:px-5"
        style={{
          borderColor: P13_SHELL_COLORS.border,
          backgroundColor: P13_SHELL_COLORS.panelBg,
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-4xl">
            <button
              onClick={onBack}
              className="mb-3 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors hover:bg-gray-100"
              style={{
                color: P13_SHELL_COLORS.secondary,
                border: `1px solid ${P13_SHELL_COLORS.border}`,
                backgroundColor: P13_SHELL_COLORS.blockBg,
              }}
            >
              ← 返回 P-13
            </button>
            <h1 className="text-lg font-semibold md:text-xl" style={{ color: P13_SHELL_COLORS.text }}>
              {title}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6" style={{ color: P13_SHELL_COLORS.muted }}>
              {subtitle}
            </p>
          </div>

          {badges && badges.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {badges.map((badge) => (
                <P13HeaderBadge key={`${badge.label}-${badge.value}`} {...badge} />
              ))}
            </div>
          )}
        </div>

        {modelRail && <div className="mt-4">{modelRail}</div>}
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-5">
        <div className="grid gap-4 xl:grid-cols-[310px_minmax(0,1fr)_336px] xl:grid-rows-[minmax(0,1fr)_290px]">
          <aside className="order-1 xl:row-span-2">{leftPanel}</aside>
          <section className="order-2 min-h-[360px]">{stagePanel}</section>
          <section className="order-3 min-h-[260px]">{chartPanel}</section>
          <aside className="order-4 xl:row-span-2 xl:col-start-3">
            <div className="flex h-full flex-col gap-4">
              {analysisPanel && <div className="xl:flex-1">{analysisPanel}</div>}
              <div>{resultPanel}</div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

export function P13HeaderBadge({
  label,
  value,
  tone = 'primary',
}: WorkbenchBadge) {
  const style = BADGE_STYLES[tone];
  return (
    <div
      className="rounded-full px-3 py-1.5 text-xs"
      style={{
        color: style.color,
        backgroundColor: style.backgroundColor,
      }}
    >
      <span className="mr-1 opacity-80">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

export function P13PanelCard({
  title,
  subtitle,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-3xl border p-4 ${className}`.trim()}
      style={{
        backgroundColor: P13_SHELL_COLORS.panelBg,
        borderColor: P13_SHELL_COLORS.border,
        boxShadow: SHADOWS.sm,
      }}
    >
      <div className="mb-3">
        <h2 className="text-sm font-semibold" style={{ color: P13_SHELL_COLORS.text }}>
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 text-xs leading-5" style={{ color: P13_SHELL_COLORS.muted }}>
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

export function P13MetricLine({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <span style={{ color: P13_SHELL_COLORS.secondary }}>{label}</span>
      <span
        className="text-right"
        style={{
          color: P13_SHELL_COLORS.text,
          fontWeight: emphasis ? 700 : 500,
        }}
      >
        {value}
      </span>
    </div>
  );
}

export function P13LegendBadge({
  label,
  color,
}: {
  label: string;
  color: string;
}) {
  return (
    <span
      className="rounded-full px-2.5 py-1 text-xs font-medium"
      style={{
        color,
        backgroundColor: `${color}16`,
      }}
    >
      {label}
    </span>
  );
}
