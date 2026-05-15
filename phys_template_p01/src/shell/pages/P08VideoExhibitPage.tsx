import { useMemo } from 'react';
import { COLORS, SHADOWS } from '@/styles/tokens';

interface Props {
  onBack: () => void;
  presetId: string;
}

interface VideoConfig {
  title: string;
  subtitle: string;
  description: string;
  bilibiliUrl: string;
  bilibiliBvid: string;
  keyPoints: string[];
  note: string;
}

const VIDEO_CONFIGS: Record<string, VideoConfig> = {
  'P02-EMF042-cyclotron': {
    title: '回旋加速器视频演示',
    subtitle: '用视频直观展示半径逐步增大与交变电场加速',
    description: '这个场景改成视频形式展示，不再强行用静态参数页去模拟课堂成片效果。适合直接投影讲“带电粒子在磁场中回旋、跨缝加速、半径逐步扩张”的整体过程。',
    bilibiliUrl: 'https://www.bilibili.com/video/BV1UhRWBDEB6',
    bilibiliBvid: 'BV1UhRWBDEB6',
    keyPoints: [
      '缝隙处交变电场提供加速，粒子每次过缝动能增加。',
      '磁场区内速度变大后，回旋半径随之增大。',
      '整段视频比静态画面更适合讲完整流程和视觉节奏。',
    ],
    note: '如果当前网络环境无法直接加载 B 站嵌入，可点击下方按钮在新标签页打开。',
  },
  'P02-EMF043-em-flowmeter': {
    title: '电磁流量计视频演示',
    subtitle: '用视频直观展示导电流体切割磁感线与电压建立',
    description: '这个场景也改成视频形式展示，更适合直接讲“导电流体在磁场中流动，形成感应电压，并通过电压反推流速”的完整仪器感。',
    bilibiliUrl: 'https://www.bilibili.com/video/BV1UhRWBDEB6',
    bilibiliBvid: 'BV1UhRWBDEB6',
    keyPoints: [
      '导电流体运动时，正负电荷分离并建立横向电势差。',
      '稳定后可用 U = BvL 反求流速。',
      '视频形式比粒子小球演示更接近课堂最终想展示的仪器画面。',
    ],
    note: '当前先复用同一个高质量参考视频页结构；如果你有专门的流量计视频链接，可以再单独替换。',
  },
};

export function P08VideoExhibitPage({ onBack, presetId }: Props) {
  const config = useMemo(() => VIDEO_CONFIGS[presetId] ?? VIDEO_CONFIGS['P02-EMF042-cyclotron']!, [presetId]);

  return (
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: COLORS.bgPage }}>
      <header
        className="border-b px-6 py-5"
        style={{
          backgroundColor: COLORS.bg,
          borderColor: COLORS.border,
        }}
      >
        <button
          onClick={onBack}
          className="text-left text-xs transition-opacity hover:opacity-70"
          style={{ color: COLORS.textSecondary }}
        >
          ← 返回 P-08
        </button>
        <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: COLORS.primary }}>
          P-08 VIDEO EXHIBIT
        </div>
        <h1 className="mt-2 text-2xl font-semibold" style={{ color: COLORS.text }}>
          {config.title}
        </h1>
        <p className="mt-2 max-w-4xl text-sm leading-6" style={{ color: COLORS.textSecondary }}>
          {config.description}
        </p>
      </header>

      <main className="flex-1 p-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px]">
          <section
            className="rounded-[28px] border p-5"
            style={{
              borderColor: COLORS.border,
              backgroundColor: COLORS.bg,
              boxShadow: SHADOWS.md,
            }}
          >
            <div className="mb-4">
              <div className="text-sm font-semibold" style={{ color: COLORS.text }}>
                {config.subtitle}
              </div>
              <div className="mt-1 text-xs" style={{ color: COLORS.textMuted }}>
                Bilibili · {config.bilibiliBvid}
              </div>
            </div>

            <div
              className="overflow-hidden rounded-[20px] border"
              style={{
                borderColor: COLORS.border,
                backgroundColor: '#000000',
                aspectRatio: '16 / 9',
              }}
            >
              <iframe
                title={config.title}
                src={`https://player.bilibili.com/player.html?bvid=${config.bilibiliBvid}&page=1&high_quality=1&danmaku=0`}
                style={{ width: '100%', height: '100%', border: '0' }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href={config.bilibiliUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-80"
                style={{
                  backgroundColor: COLORS.primary,
                  color: '#FFFFFF',
                }}
              >
                在新标签页打开视频
              </a>
            </div>
          </section>

          <aside className="grid gap-4">
            <section
              className="rounded-[24px] border p-5"
              style={{
                borderColor: COLORS.border,
                backgroundColor: COLORS.bg,
                boxShadow: SHADOWS.sm,
              }}
            >
              <div className="text-sm font-semibold" style={{ color: COLORS.text }}>
                课堂讲解要点
              </div>
              <div className="mt-3 grid gap-3">
                {config.keyPoints.map((point) => (
                  <div
                    key={point}
                    className="rounded-2xl border px-4 py-3 text-sm leading-6"
                    style={{
                      borderColor: COLORS.border,
                      backgroundColor: COLORS.bgMuted,
                      color: COLORS.textSecondary,
                    }}
                  >
                    {point}
                  </div>
                ))}
              </div>
            </section>

            <section
              className="rounded-[24px] border p-5"
              style={{
                borderColor: COLORS.border,
                backgroundColor: COLORS.bg,
                boxShadow: SHADOWS.sm,
              }}
            >
              <div className="text-sm font-semibold" style={{ color: COLORS.text }}>
                说明
              </div>
              <p className="mt-3 text-sm leading-6" style={{ color: COLORS.textSecondary }}>
                {config.note}
              </p>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
