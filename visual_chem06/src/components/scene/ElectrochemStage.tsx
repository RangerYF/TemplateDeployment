import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { AlertTriangle, ArrowLeftRight, Gauge, PauseCircle, PlayCircle } from 'lucide-react';
import { COLORS, SHADOWS } from '@/styles/tokens';
import { getCurrentModel, getCurrentScenario, useElectrochemStore } from '@/store/electrochemStore';
import type { LayoutPreset, StreamChannel, SurfaceEffect, ZoneId } from '@/types/electrochem';

interface Point { x: number; y: number; }
interface Rect { x: number; y: number; w: number; h: number; zone: ZoneId; }
interface StageGeometry {
  baths: Rect[];
  leftElectrode: { x: number; y: number; h: number };
  rightElectrode: { x: number; y: number; h: number };
  device: { x: number; y: number; w: number; h: number };
  divider?: { x: number; y: number; w: number; h: number };
  bridgePath?: string;
  membraneLabel?: Point;
  bathLabels: Record<ZoneId, Point | undefined>;
  gasLabels: Record<'left' | 'right', Point | undefined>;
  channelMap: Record<StreamChannel, Point[]>;
}

const WIDTH = 920;
const HEIGHT = 560;
const ELECTRODE_BASE_WIDTH = 18;

function blendHex(from: string, to: string, t: number) {
  const a = from.replace('#', '');
  const b = to.replace('#', '');
  const mix = (index: number) => {
    const start = parseInt(a.slice(index, index + 2), 16);
    const end = parseInt(b.slice(index, index + 2), 16);
    return Math.round(start + (end - start) * t).toString(16).padStart(2, '0');
  };
  return `#${mix(0)}${mix(2)}${mix(4)}`;
}

function getPointOnPolyline(points: Point[], t: number) {
  if (points.length <= 1) return points[0] ?? { x: 0, y: 0 };
  const lengths = points.slice(1).map((point, index) => Math.hypot(point.x - points[index].x, point.y - points[index].y));
  const total = lengths.reduce((sum, value) => sum + value, 0);
  let distance = total * t;
  for (let index = 0; index < lengths.length; index += 1) {
    if (distance <= lengths[index]) {
      const start = points[index];
      const end = points[index + 1];
      const ratio = lengths[index] === 0 ? 0 : distance / lengths[index];
      return { x: start.x + (end.x - start.x) * ratio, y: start.y + (end.y - start.y) * ratio };
    }
    distance -= lengths[index];
  }
  return points[points.length - 1];
}

function getGeometry(preset: LayoutPreset): StageGeometry {
  if (preset === 'dual-bath') {
    return {
      baths: [{ x: 120, y: 220, w: 250, h: 190, zone: 'left' }, { x: 550, y: 220, w: 250, h: 190, zone: 'right' }],
      leftElectrode: { x: 232, y: 130, h: 250 },
      rightElectrode: { x: 662, y: 130, h: 250 },
      device: { x: 430, y: 38, w: 60, h: 34 },
      bridgePath: 'M370 220 C395 188 420 180 460 180 C500 180 525 188 550 220',
      membraneLabel: undefined,
      bathLabels: { left: { x: 245, y: 448 }, right: { x: 675, y: 448 }, main: undefined },
      gasLabels: { left: undefined, right: undefined },
      channelMap: {
        'wire-top': [{ x: 241, y: 130 }, { x: 241, y: 81 }, { x: 430, y: 81 }, { x: 490, y: 81 }, { x: 671, y: 81 }, { x: 671, y: 130 }],
        'bath-main-left': [{ x: 240, y: 305 }, { x: 280, y: 330 }, { x: 320, y: 360 }],
        'bath-main-right': [{ x: 600, y: 360 }, { x: 640, y: 330 }, { x: 680, y: 305 }],
        'bath-center-left': [{ x: 241, y: 300 }, { x: 300, y: 310 }, { x: 340, y: 320 }],
        'bath-center-right': [{ x: 580, y: 320 }, { x: 620, y: 310 }, { x: 671, y: 300 }],
        'bridge-left-to-right': [{ x: 370, y: 220 }, { x: 410, y: 185 }, { x: 510, y: 185 }, { x: 550, y: 220 }],
        'bridge-right-to-left': [{ x: 370, y: 220 }, { x: 410, y: 185 }, { x: 510, y: 185 }, { x: 550, y: 220 }],
        'membrane-left-to-right': [{ x: 418, y: 325 }, { x: 502, y: 325 }],
        'membrane-right-to-left': [{ x: 418, y: 325 }, { x: 502, y: 325 }],
        'membrane-upper-left-to-right': [{ x: 410, y: 311 }, { x: 510, y: 311 }],
        'membrane-upper-right-to-left': [{ x: 410, y: 311 }, { x: 510, y: 311 }],
        'membrane-lower-left-to-right': [{ x: 410, y: 339 }, { x: 510, y: 339 }],
        'membrane-lower-right-to-left': [{ x: 410, y: 339 }, { x: 510, y: 339 }],
      },
    };
  }

  if (preset === 'separator-cell') {
    return {
      baths: [{ x: 180, y: 190, w: 280, h: 220, zone: 'left' }, { x: 460, y: 190, w: 280, h: 220, zone: 'right' }],
      leftElectrode: { x: 290, y: 115, h: 265 },
      rightElectrode: { x: 625, y: 115, h: 265 },
      device: { x: 430, y: 38, w: 60, h: 34 },
      divider: { x: 451, y: 190, w: 18, h: 220 },
      membraneLabel: { x: 460, y: 286 },
      bathLabels: { left: { x: 320, y: 450 }, right: { x: 600, y: 450 }, main: undefined },
      gasLabels: { left: { x: 290, y: 160 }, right: { x: 630, y: 160 } },
      channelMap: {
        'wire-top': [{ x: 299, y: 115 }, { x: 299, y: 81 }, { x: 430, y: 81 }, { x: 490, y: 81 }, { x: 634, y: 81 }, { x: 634, y: 115 }],
        'bath-main-left': [{ x: 305, y: 305 }, { x: 350, y: 330 }, { x: 390, y: 360 }],
        'bath-main-right': [{ x: 530, y: 360 }, { x: 575, y: 330 }, { x: 630, y: 305 }],
        'bath-center-left': [{ x: 305, y: 300 }, { x: 360, y: 315 }, { x: 415, y: 320 }],
        'bath-center-right': [{ x: 505, y: 320 }, { x: 565, y: 315 }, { x: 630, y: 300 }],
        'bridge-left-to-right': [{ x: 430, y: 210 }, { x: 490, y: 210 }],
        'bridge-right-to-left': [{ x: 430, y: 210 }, { x: 490, y: 210 }],
        'membrane-left-to-right': [{ x: 418, y: 325 }, { x: 502, y: 325 }],
        'membrane-right-to-left': [{ x: 418, y: 325 }, { x: 502, y: 325 }],
        'membrane-upper-left-to-right': [{ x: 410, y: 311 }, { x: 510, y: 311 }],
        'membrane-upper-right-to-left': [{ x: 410, y: 311 }, { x: 510, y: 311 }],
        'membrane-lower-left-to-right': [{ x: 410, y: 339 }, { x: 510, y: 339 }],
        'membrane-lower-right-to-left': [{ x: 410, y: 339 }, { x: 510, y: 339 }],
      },
    };
  }

  return {
    baths: [{ x: 210, y: 180, w: 500, h: 240, zone: 'main' }],
    leftElectrode: { x: 320, y: 110, h: 280 },
    rightElectrode: { x: 600, y: 110, h: 280 },
    device: { x: 430, y: 38, w: 60, h: 34 },
    bathLabels: { left: undefined, right: undefined, main: { x: 460, y: 458 } },
    gasLabels: { left: { x: 320, y: 160 }, right: { x: 600, y: 160 } },
    channelMap: {
      'wire-top': [{ x: 329, y: 110 }, { x: 329, y: 81 }, { x: 430, y: 81 }, { x: 490, y: 81 }, { x: 609, y: 81 }, { x: 609, y: 110 }],
      'bath-main-left': [{ x: 335, y: 300 }, { x: 410, y: 330 }, { x: 470, y: 360 }],
      'bath-main-right': [{ x: 450, y: 360 }, { x: 520, y: 330 }, { x: 605, y: 300 }],
      'bath-center-left': [{ x: 335, y: 300 }, { x: 435, y: 310 }, { x: 520, y: 320 }],
      'bath-center-right': [{ x: 400, y: 320 }, { x: 500, y: 310 }, { x: 605, y: 300 }],
      'bridge-left-to-right': [{ x: 430, y: 210 }, { x: 490, y: 210 }],
      'bridge-right-to-left': [{ x: 430, y: 210 }, { x: 490, y: 210 }],
      'membrane-left-to-right': [{ x: 418, y: 325 }, { x: 502, y: 325 }],
      'membrane-right-to-left': [{ x: 418, y: 325 }, { x: 502, y: 325 }],
      'membrane-upper-left-to-right': [{ x: 410, y: 311 }, { x: 510, y: 311 }],
      'membrane-upper-right-to-left': [{ x: 410, y: 311 }, { x: 510, y: 311 }],
      'membrane-lower-left-to-right': [{ x: 410, y: 339 }, { x: 510, y: 339 }],
      'membrane-lower-right-to-left': [{ x: 410, y: 339 }, { x: 510, y: 339 }],
    },
  };
}

function getEffectWidth(effect: SurfaceEffect, progress: number) {
  if (effect === 'dissolve' || effect === 'consume') return ELECTRODE_BASE_WIDTH - progress * 7;
  if (effect === 'deposit' || effect === 'coat') return ELECTRODE_BASE_WIDTH + progress * 7;
  return ELECTRODE_BASE_WIDTH;
}

function buildBubbles(effect: SurfaceEffect, anchorX: number, anchorY: number, progress: number) {
  if (effect !== 'bubbles') return [];
  return Array.from({ length: 5 }, (_, index) => {
    const offset = (progress * 1.6 + index / 5) % 1;
    return {
      key: `bubble-${anchorX}-${index}`,
      x: anchorX + (index % 2 === 0 ? -14 : 12) + Math.sin(offset * Math.PI * 2) * 4,
      y: anchorY - offset * 72,
      size: 8 - offset * 2,
    };
  });
}

function estimateLabelWidth(label: string, fontSize: number) {
  return Math.max(24, label.length * fontSize * 0.92 + 10);
}

export function ElectrochemStage() {
  const selectedModelId = useElectrochemStore((state) => state.selectedModelId);
  const selectedScenarioId = useElectrochemStore((state) => state.selectedScenarioId);
  const playing = useElectrochemStore((state) => state.playing);
  const progress = useElectrochemStore((state) => state.progress);
  const tick = useElectrochemStore((state) => state.tick);
  const togglePlaying = useElectrochemStore((state) => state.togglePlaying);
  const speed = useElectrochemStore((state) => state.speed);
  const showIonLabels = useElectrochemStore((state) => state.showIonLabels);
  const ionLabelFontSize = useElectrochemStore((state) => state.ionLabelFontSize);

  const model = getCurrentModel({ selectedModelId });
  const scenario = getCurrentScenario({ selectedModelId, selectedScenarioId });
  const geometry = useMemo(() => getGeometry(model.layoutPreset), [model.layoutPreset]);
  const rafRef = useRef<number | null>(null);
  const timeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      timeRef.current = null;
      return;
    }

    const loop = (timestamp: number) => {
      if (timeRef.current === null) timeRef.current = timestamp;
      const delta = Math.min((timestamp - timeRef.current) / 1000, 0.05);
      timeRef.current = timestamp;
      tick(delta);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      timeRef.current = null;
    };
  }, [playing, tick]);

  const activeKeyframe = [...scenario.keyframes].reverse().find((item) => progress >= item.at) ?? scenario.keyframes[0];
  const zoneColor = (zone: ZoneId) => {
    const shift = scenario.solutionShifts?.find((item) => item.zone === zone);
    if (!shift) return zone === 'main' ? '#EAF6FF' : '#EEF7FF';
    return blendHex(shift.from, shift.to, progress);
  };

  const particles = scenario.streams.flatMap((stream) => {
    const isMembraneChannel = stream.channel.startsWith('membrane');
    const visualCount = isMembraneChannel ? Math.max(3, Math.ceil(stream.count * 0.5)) : stream.count;
    return Array.from({ length: visualCount }, (_, index) => {
    const raw = (progress + index / visualCount) % 1;
    const pathT = stream.direction === 'right-to-left' || stream.direction === 'down' ? 1 - raw : raw;
    const point = getPointOnPolyline(geometry.channelMap[stream.channel], pathT);
    return { key: `${stream.id}-${index}`, point, color: stream.color, emphasis: stream.emphasis, label: stream.label };
  });
  });

  const bubbleParticles = [
    ...buildBubbles(scenario.leftElectrode.surfaceEffect, geometry.leftElectrode.x + 9, geometry.leftElectrode.y + geometry.leftElectrode.h - 24, progress),
    ...buildBubbles(scenario.rightElectrode.surfaceEffect, geometry.rightElectrode.x + 9, geometry.rightElectrode.y + geometry.rightElectrode.h - 24, progress),
  ];

  return (
    <section className="flex h-full flex-col p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: COLORS.textMuted }}>动态演示</div>
          <h2 className="mt-1 text-lg font-semibold" style={{ color: COLORS.text }}>{model.title}</h2>
          <p className="mt-1 text-sm" style={{ color: COLORS.textSecondary }}>{scenario.caption}</p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
          style={{ background: playing ? COLORS.primaryLight : COLORS.bg, color: playing ? COLORS.primary : COLORS.textSecondary, boxShadow: SHADOWS.sm }}
          onClick={togglePlaying}
        >
          {playing ? <PauseCircle size={16} /> : <PlayCircle size={16} />}
          {playing ? '暂停舞台' : '播放舞台'}
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden rounded-[22px] border" style={{ borderColor: COLORS.border, background: COLORS.bg, boxShadow: SHADOWS.md }}>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
          <rect x="0" y="0" width={WIDTH} height={HEIGHT} fill="#FBFCFD" />
          {geometry.baths.map((bath) => (
            <g key={bath.zone}>
              <rect x={bath.x} y={bath.y} width={bath.w} height={bath.h} rx="26" fill={zoneColor(bath.zone)} stroke="#BFD7EA" strokeWidth="2" />
              <rect x={bath.x + 16} y={bath.y + 18} width={bath.w - 32} height="18" rx="9" fill="#FFFFFF" opacity="0.46" />
            </g>
          ))}
          {geometry.bridgePath ? <path d={geometry.bridgePath} fill="none" stroke="#A7C3D8" strokeWidth="20" strokeLinecap="round" opacity="0.9" /> : null}
          {geometry.divider ? <rect {...geometry.divider} rx="8" fill="#DDE7F0" /> : null}
          <rect x={geometry.device.x} y={geometry.device.y} width={geometry.device.w} height={geometry.device.h} rx="14" fill="#F6FAF8" stroke={COLORS.primary} strokeWidth="2" />
          <text x={geometry.device.x + geometry.device.w / 2} y={geometry.device.y + 22} textAnchor="middle" fontSize="12" fill={COLORS.text} fontWeight="600">{scenario.loopLabel}</text>
          <path d={`M${geometry.leftElectrode.x + 9} ${geometry.leftElectrode.y} V81 H${geometry.rightElectrode.x + 9} V${geometry.rightElectrode.y}`} fill="none" stroke="#6B7280" strokeWidth="4" strokeLinecap="round" />
          <ElectrodeRect x={geometry.leftElectrode.x} y={geometry.leftElectrode.y} h={geometry.leftElectrode.h} width={getEffectWidth(scenario.leftElectrode.surfaceEffect, progress)} color="#64748B" />
          <ElectrodeRect x={geometry.rightElectrode.x} y={geometry.rightElectrode.y} h={geometry.rightElectrode.h} width={getEffectWidth(scenario.rightElectrode.surfaceEffect, progress)} color="#7C8897" />
          <text x={geometry.leftElectrode.x + 9} y={geometry.leftElectrode.y - 8} textAnchor="middle" fontSize="12" fill={COLORS.text}>{scenario.leftElectrode.label}</text>
          <text x={geometry.rightElectrode.x + 9} y={geometry.rightElectrode.y - 8} textAnchor="middle" fontSize="12" fill={COLORS.text}>{scenario.rightElectrode.label}</text>
          {Object.entries(geometry.bathLabels).map(([zone, point]) => point ? <text key={zone} x={point.x} y={point.y} textAnchor="middle" fontSize="13" fill={COLORS.textSecondary}>{zone === 'main' ? model.bathLabel : zone === 'left' ? model.leftChamberLabel : model.rightChamberLabel}</text> : null)}
          {geometry.membraneLabel && model.membraneLabel ? <text x={geometry.membraneLabel.x} y={geometry.membraneLabel.y} textAnchor="middle" fontSize="12" fill={COLORS.textSecondary}>{model.membraneLabel}</text> : null}
          {geometry.bridgePath && model.saltBridgeLabel ? <text x="460" y="165" textAnchor="middle" fontSize="12" fill={COLORS.textSecondary}>{model.saltBridgeLabel}</text> : null}
          {geometry.gasLabels.left && model.gasLabels?.left ? <text x={geometry.gasLabels.left.x} y={geometry.gasLabels.left.y} textAnchor="middle" fontSize="12" fill={COLORS.textMuted}>{model.gasLabels.left}</text> : null}
          {geometry.gasLabels.right && model.gasLabels?.right ? <text x={geometry.gasLabels.right.x} y={geometry.gasLabels.right.y} textAnchor="middle" fontSize="12" fill={COLORS.textMuted}>{model.gasLabels.right}</text> : null}

          {particles.map((particle) => (
            <g key={particle.key}>
              <circle cx={particle.point.x} cy={particle.point.y} r={particle.emphasis ? 5 : 4} fill={particle.color} stroke="#FFFFFF" strokeWidth="1.2" />
              {showIonLabels ? (
                <g transform={`translate(${particle.point.x + 10}, ${particle.point.y - 14})`}>
                  <rect width={estimateLabelWidth(particle.label, ionLabelFontSize)} height={ionLabelFontSize + 6} rx="10" fill="rgba(255,255,255,0.94)" stroke={particle.color} strokeWidth="1" />
                  <text x="5" y={ionLabelFontSize} fontSize={ionLabelFontSize} fontWeight="700" fill={particle.color}>{particle.label}</text>
                </g>
              ) : null}
            </g>
          ))}

          {bubbleParticles.map((bubble) => (
            <circle key={bubble.key} cx={bubble.x} cy={bubble.y} r={bubble.size / 2} fill="#FFFFFF" stroke="#FFFFFFCC" strokeWidth="1" opacity="0.86" />
          ))}
        </svg>

        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-5 top-5 max-w-[360px] rounded-[20px] px-4 py-4" style={{ background: 'rgba(255,255,255,0.92)', boxShadow: SHADOWS.sm }}>
            <div className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: COLORS.primary }}>{activeKeyframe?.title}</div>
            <div className="mt-2 text-sm leading-6" style={{ color: COLORS.textSecondary }}>{activeKeyframe?.description ?? scenario.caption}</div>
          </div>
          {scenario.competition ? (
            <div className="absolute right-5 top-5 rounded-[18px] px-4 py-3 text-sm" style={{ background: '#FFF7EE', color: COLORS.textSecondary, boxShadow: SHADOWS.sm }}>
              <div className="flex items-center gap-2 font-semibold" style={{ color: COLORS.text }}>
                <AlertTriangle size={15} color="#F59E0B" />
                <span>{scenario.competition.title}</span>
              </div>
              <div className="mt-1">{scenario.competition.winner} 优先于 {scenario.competition.loser}</div>
            </div>
          ) : null}
          <div className="absolute bottom-5 left-5 right-5 flex flex-wrap items-end gap-3">
            <LegendCard icon={<ArrowLeftRight size={14} />} title="电子 / 电流" body={`${scenario.electronDirection}；${scenario.currentDirection}`} />
            {scenario.phIndicators?.map((item) => <LegendCard key={item.label} icon={<Gauge size={14} />} title={item.label} body={`${item.trend === 'up' ? '↑' : item.trend === 'down' ? '↓' : '→'} ${item.note}`} />)}
          </div>
          <div className="absolute bottom-5 right-5 rounded-[18px] px-4 py-3 text-sm" style={{ background: 'rgba(255,255,255,0.92)', color: COLORS.textSecondary, boxShadow: SHADOWS.sm }}>
            <div className="font-semibold" style={{ color: COLORS.text }}>速度</div>
            <div className="mt-1">{speed}x</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ElectrodeRect({ x, y, h, width, color }: { x: number; y: number; h: number; width: number; color: string }) {
  return <rect x={x + (ELECTRODE_BASE_WIDTH - width) / 2} y={y} width={width} height={h} rx="10" fill={color} />;
}

function LegendCard({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-[18px] px-4 py-3 text-sm" style={{ background: 'rgba(255,255,255,0.92)', color: COLORS.textSecondary, boxShadow: SHADOWS.sm }}>
      <div className="flex items-center gap-2 font-semibold" style={{ color: COLORS.text }}>{icon}<span>{title}</span></div>
      <div className="mt-1 max-w-[280px] leading-6">{body}</div>
    </div>
  );
}




