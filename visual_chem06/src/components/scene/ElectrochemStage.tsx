import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { ArrowLeftRight, Gauge, PauseCircle, PlayCircle } from 'lucide-react';
import { COLORS, SHADOWS } from '@/styles/tokens';
import { getCurrentModel, getCurrentScenario, useElectrochemStore } from '@/store/electrochemStore';
import type { Direction, LayoutPreset, StreamChannel, SurfaceEffect, ZoneId } from '@/types/electrochem';

interface Point { x: number; y: number; }
interface Rect { x: number; y: number; w: number; h: number; zone: ZoneId; }
interface RenderParticle {
  key: string;
  point: Point;
  color: string;
  opacity: number;
  emphasis?: boolean;
  label: string;
  diffusion: boolean;
  channel: StreamChannel;
  fixedLabel?: boolean;
  direction: Direction;
}
interface ParticleLabel extends RenderParticle {
  labelX: number;
  labelY: number;
  textAnchor: 'start' | 'middle' | 'end';
}
interface BubbleParticle {
  key: string;
  x: number;
  y: number;
  size: number;
  color: string;
  label?: string;
  labelColor: string;
}
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

function getVisualParticleCount(count: number, isMembraneChannel: boolean, isDiffusion: boolean) {
  if (isDiffusion) return Math.max(1, Math.ceil(count * 0.45));
  if (isMembraneChannel) return Math.max(2, Math.ceil(count * 0.4));
  return Math.max(3, Math.ceil(count * 0.75));
}

function isBubbleEffect(effect: SurfaceEffect) {
  return effect === 'bubbles' || effect === 'consume-bubbles';
}

function getGasFormula(reaction: string) {
  const reactionParts = reaction.split('→');
  const productSide = reactionParts[reactionParts.length - 1] ?? reaction;
  if (productSide.includes('Cl₂')) return 'Cl₂';
  if (productSide.includes('CO₂')) return 'CO₂';
  if (productSide.includes('O₂')) return 'O₂';
  if (productSide.includes('H₂')) return 'H₂';
  return undefined;
}

function getGasBubbleColor(formula?: string) {
  if (formula === 'Cl₂') return '#B4D23B';
  if (formula === 'CO₂') return '#E4E8EF';
  if (formula === 'H₂') return '#DDEBFF';
  if (formula === 'O₂') return '#E6F7FF';
  return '#FFFFFF';
}

function getGasLabelColor(formula?: string) {
  if (formula === 'Cl₂') return '#5D7F12';
  if (formula === 'CO₂') return '#53606F';
  if (formula === 'H₂') return '#2B66A2';
  if (formula === 'O₂') return '#1F7894';
  return COLORS.textSecondary;
}

function estimateLabelWidth(label: string, fontSize: number) {
  return Array.from(label).reduce((sum, char) => {
    if (/[\u2070-\u209F]/u.test(char)) return sum + fontSize * 0.42;
    if (/[A-Z]/.test(char)) return sum + fontSize * 0.68;
    if (/[a-z0-9+\-]/.test(char)) return sum + fontSize * 0.5;
    return sum + fontSize * 0.76;
  }, 3);
}

function getLabelBox(label: ParticleLabel, fontSize: number) {
  const width = estimateLabelWidth(label.label, fontSize);
  const left = label.textAnchor === 'start' ? label.labelX : label.labelX - width;
  const right = label.textAnchor === 'start' ? label.labelX + width : label.labelX;
  return { left, right, top: label.labelY - fontSize - 2, bottom: label.labelY + 4 };
}

function boxesOverlap(a: ReturnType<typeof getLabelBox>, b: ReturnType<typeof getLabelBox>) {
  const padding = 5;
  return !(a.right + padding < b.left || a.left > b.right + padding || a.bottom + padding < b.top || a.top > b.bottom + padding);
}

function layoutParticleLabels(particles: RenderParticle[], fontSize: number): ParticleLabel[] {
  const placed: ParticleLabel[] = [];
  const verticalOffsets = [-4, -18, 12, -32, 26, -46, 40];

  particles.forEach((particle, particleIndex) => {
    if (particle.fixedLabel) {
      const offsetX = particle.direction === 'right-to-left' ? -12 : 12;
      placed.push({
        ...particle,
        labelX: particle.point.x + offsetX,
        labelY: particle.point.y - 8,
        textAnchor: offsetX < 0 ? 'end' : 'start',
      });
      return;
    }

    if (particle.channel.startsWith('bridge') && (particle.label === 'Mg²⁺' || particle.label === 'SO₄²⁻')) {
      placed.push({
        ...particle,
        labelX: particle.point.x,
        labelY: particle.point.y + (particle.label === 'Mg²⁺' ? -13 : 22),
        textAnchor: 'middle',
      });
      return;
    }

    const sideOrder: Array<'right' | 'left'> = particleIndex % 2 === 0 ? ['right', 'left'] : ['left', 'right'];
    const candidates = verticalOffsets.flatMap((offset) => sideOrder.map((side) => ({
      ...particle,
      labelX: particle.point.x + (side === 'right' ? 10 : -10),
      labelY: particle.point.y + offset,
      textAnchor: side === 'right' ? 'start' as const : 'end' as const,
    })));
    const selected = candidates.find((candidate) => {
      const box = getLabelBox(candidate, fontSize);
      if (box.left < 6 || box.right > WIDTH - 6 || box.top < 6 || box.bottom > HEIGHT - 6) return false;
      return placed.every((label) => !boxesOverlap(box, getLabelBox(label, fontSize)));
    }) ?? candidates[0];

    placed.push(selected);
  });

  return placed;
}

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
        'bath-center-to-left': [{ x: 460, y: 330 }, { x: 360, y: 315 }, { x: 241, y: 300 }],
        'bath-center-to-right': [{ x: 460, y: 330 }, { x: 560, y: 315 }, { x: 671, y: 300 }],
        'bath-left-to-center': [{ x: 241, y: 300 }, { x: 360, y: 315 }, { x: 460, y: 330 }],
        'bath-right-to-center': [{ x: 671, y: 300 }, { x: 560, y: 315 }, { x: 460, y: 330 }],
      'bath-near-left': [{ x: 241, y: 290 }, { x: 280, y: 310 }, { x: 310, y: 320 }],
      'bath-near-right': [{ x: 671, y: 290 }, { x: 640, y: 310 }, { x: 610, y: 320 }],
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
      gasLabels: { left: { x: 230, y: 160 }, right: { x: 690, y: 160 } },
      channelMap: {
        'wire-top': [{ x: 299, y: 115 }, { x: 299, y: 81 }, { x: 430, y: 81 }, { x: 490, y: 81 }, { x: 634, y: 81 }, { x: 634, y: 115 }],
        'bath-main-left': [{ x: 305, y: 305 }, { x: 350, y: 330 }, { x: 390, y: 360 }],
        'bath-main-right': [{ x: 530, y: 360 }, { x: 575, y: 330 }, { x: 630, y: 305 }],
        'bath-center-left': [{ x: 305, y: 300 }, { x: 360, y: 315 }, { x: 415, y: 320 }],
        'bath-center-right': [{ x: 505, y: 320 }, { x: 565, y: 315 }, { x: 630, y: 300 }],
        'bath-center-to-left': [{ x: 460, y: 330 }, { x: 380, y: 315 }, { x: 305, y: 300 }],
        'bath-center-to-right': [{ x: 460, y: 330 }, { x: 540, y: 315 }, { x: 630, y: 300 }],
        'bath-left-to-center': [{ x: 305, y: 300 }, { x: 380, y: 315 }, { x: 460, y: 330 }],
        'bath-right-to-center': [{ x: 630, y: 300 }, { x: 540, y: 315 }, { x: 460, y: 330 }],
        'bath-near-left': [{ x: 305, y: 290 }, { x: 340, y: 310 }, { x: 370, y: 320 }],
        'bath-near-right': [{ x: 630, y: 290 }, { x: 600, y: 310 }, { x: 570, y: 320 }],
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
    gasLabels: { left: { x: 290, y: 170 }, right: { x: 635, y: 170 } },
    channelMap: {
      'wire-top': [{ x: 329, y: 110 }, { x: 329, y: 81 }, { x: 430, y: 81 }, { x: 490, y: 81 }, { x: 609, y: 81 }, { x: 609, y: 110 }],
      'bath-main-left': [{ x: 335, y: 300 }, { x: 410, y: 330 }, { x: 470, y: 360 }],
      'bath-main-right': [{ x: 450, y: 360 }, { x: 520, y: 330 }, { x: 605, y: 300 }],
      'bath-center-left': [{ x: 335, y: 300 }, { x: 435, y: 310 }, { x: 520, y: 320 }],
      'bath-center-right': [{ x: 400, y: 320 }, { x: 500, y: 310 }, { x: 605, y: 300 }],
      'bath-center-to-left': [{ x: 470, y: 330 }, { x: 405, y: 315 }, { x: 335, y: 300 }],
      'bath-center-to-right': [{ x: 450, y: 330 }, { x: 530, y: 315 }, { x: 605, y: 300 }],
      'bath-left-to-center': [{ x: 335, y: 300 }, { x: 405, y: 315 }, { x: 470, y: 330 }],
      'bath-right-to-center': [{ x: 605, y: 300 }, { x: 530, y: 315 }, { x: 450, y: 330 }],
      'bath-near-left': [{ x: 335, y: 290 }, { x: 390, y: 310 }, { x: 440, y: 320 }],
      'bath-near-right': [{ x: 605, y: 290 }, { x: 550, y: 310 }, { x: 500, y: 320 }],
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

function jitterPoint(point: Point, streamId: string, index: number, progress: number, enabled: boolean): Point {
  if (!enabled) return point;
  const seed = streamId.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) + index * 17;
  return {
    x: point.x + Math.sin(progress * Math.PI * 2 + seed) * 10,
    y: point.y + Math.cos(progress * Math.PI * 1.5 + seed * 0.7) * 8,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getDirectionVector(direction: Direction) {
  if (direction === 'left-to-right') return { x: 1, y: 0 };
  if (direction === 'right-to-left') return { x: -1, y: 0 };
  if (direction === 'down') return { x: 0, y: 1 };
  return { x: 0, y: -1 };
}

function getDiffusionParticle(points: Point[], streamId: string, index: number, count: number, progress: number, baths: Rect[], direction: Direction, diffusionBias?: 'directional' | 'strong-directional') {
  const seed = streamId.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) + index * 31;
  const origin = points[0] ?? { x: 0, y: 0 };
  const isStrongDirectional = diffusionBias === 'strong-directional';
  const phase = (progress * (isStrongDirectional ? 1.18 : 0.9 + (seed % 4) * 0.08) + index / count) % 1;
  const angle = (index / count) * Math.PI * 2 + seed * 0.19;
  const radius = 4 + Math.pow(phase, 0.72) * (isStrongDirectional ? 24 : 58 + (seed % 5) * 5);
  const spread = Math.sin(phase * Math.PI * 2 + seed) * (isStrongDirectional ? 4 : 5);
  const directionVector = getDirectionVector(direction);
  const forwardDistance = diffusionBias ? Math.pow(phase, 0.7) * (isStrongDirectional ? 118 : 34 + (seed % 4) * 5) : 0;
  const minX = Math.min(...baths.map((bath) => bath.x + 18));
  const maxX = Math.max(...baths.map((bath) => bath.x + bath.w - 18));
  const minY = Math.min(...baths.map((bath) => bath.y + 26));
  const maxY = Math.max(...baths.map((bath) => bath.y + bath.h - 24));
  const opacity = phase < 0.18 ? phase / 0.18 : Math.max(0.12, 1 - (phase - 0.18) / 0.82);

  return {
    point: {
      x: clamp(origin.x + directionVector.x * forwardDistance + Math.cos(angle) * radius + Math.cos(angle + Math.PI / 2) * spread, minX, maxX),
      y: clamp(origin.y + directionVector.y * forwardDistance + Math.sin(angle) * radius + Math.sin(angle + Math.PI / 2) * spread, minY, maxY),
    },
    opacity,
  };
}

function getEffectWidth(effect: SurfaceEffect, progress: number) {
  if (effect === 'dissolve' || effect === 'dissolve-sludge' || effect === 'consume' || effect === 'consume-bubbles') return ELECTRODE_BASE_WIDTH - progress * 7;
  if (effect === 'deposit' || effect === 'coat') return ELECTRODE_BASE_WIDTH + progress * 7;
  return ELECTRODE_BASE_WIDTH;
}

function buildBubbles(effect: SurfaceEffect, anchorX: number, anchorY: number, progress: number, formula?: string): BubbleParticle[] {
  if (!isBubbleEffect(effect)) return [];
  const color = getGasBubbleColor(formula);
  const labelColor = getGasLabelColor(formula);
  return Array.from({ length: 5 }, (_, index) => {
    const offset = (progress * 1.6 + index / 5) % 1;
    return {
      key: `bubble-${anchorX}-${index}`,
      x: anchorX + (index % 2 === 0 ? -14 : 12) + Math.sin(offset * Math.PI * 2) * 4,
      y: anchorY - offset * 72,
      size: 8 - offset * 2,
      color,
      label: formula,
      labelColor,
    };
  });
}

function buildSludgeParticles(effect: SurfaceEffect, anchorX: number, electrodeBottomY: number, bathBottomY: number, progress: number) {
  if (effect !== 'dissolve-sludge') return [];
  return Array.from({ length: 6 }, (_, index) => {
    const offset = (progress * 0.8 + index / 6) % 1;
    const fallHeight = bathBottomY - electrodeBottomY;
    const xJitter = (index % 3 - 1) * 10 + Math.sin(offset * Math.PI * 3 + index) * 5;
    return {
      key: `sludge-${anchorX}-${index}`,
      x: anchorX + xJitter,
      y: electrodeBottomY + offset * fallHeight,
      size: 4 + (index % 3),
      opacity: 0.7 + (1 - offset) * 0.3,
    };
  });
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
    const isDiffusion = stream.movementMode === 'diffusion';
    const visualCount = getVisualParticleCount(stream.count, isMembraneChannel, isDiffusion);
    return Array.from({ length: visualCount }, (_, index) => {
      const raw = (progress + index / visualCount) % 1;
      const pathT = stream.direction === 'right-to-left' || stream.direction === 'down' ? 1 - raw : raw;
      const channel = geometry.channelMap[stream.channel];
      const diffusionParticle = isDiffusion ? getDiffusionParticle(channel, stream.id, index, visualCount, progress, geometry.baths, stream.direction, stream.diffusionBias) : undefined;
      const point = diffusionParticle?.point ?? jitterPoint(getPointOnPolyline(channel, pathT), stream.id, index, progress, false);
      return { key: `${stream.id}-${index}`, point, color: stream.color, opacity: diffusionParticle?.opacity ?? 0.9, emphasis: stream.emphasis, label: stream.label, diffusion: isDiffusion, channel: stream.channel, fixedLabel: stream.fixedLabel, direction: stream.direction };
    });
  });
  const particleLabels = showIonLabels ? layoutParticleLabels(particles, ionLabelFontSize) : [];

  const leftGasFormula = isBubbleEffect(scenario.leftElectrode.surfaceEffect) ? getGasFormula(scenario.leftElectrode.reaction) : undefined;
  const rightGasFormula = isBubbleEffect(scenario.rightElectrode.surfaceEffect) ? getGasFormula(scenario.rightElectrode.reaction) : undefined;
  const bubbleParticles = [
    ...buildBubbles(scenario.leftElectrode.surfaceEffect, geometry.leftElectrode.x + 9, geometry.leftElectrode.y + geometry.leftElectrode.h - 24, progress, leftGasFormula),
    ...buildBubbles(scenario.rightElectrode.surfaceEffect, geometry.rightElectrode.x + 9, geometry.rightElectrode.y + geometry.rightElectrode.h - 24, progress, rightGasFormula),
  ];

  const bathBottom = geometry.baths[0].y + geometry.baths[0].h;
  const sludgeParticles = [
    ...buildSludgeParticles(scenario.leftElectrode.surfaceEffect, geometry.leftElectrode.x + 9, geometry.leftElectrode.y + geometry.leftElectrode.h, bathBottom - 16, progress),
    ...buildSludgeParticles(scenario.rightElectrode.surfaceEffect, geometry.rightElectrode.x + 9, geometry.rightElectrode.y + geometry.rightElectrode.h, bathBottom - 16, progress),
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
          {(() => {
            const cx = geometry.device.x + geometry.device.w / 2;
            const cy = 81;
            const isPowerSource = model.family === 'electrolytic' || scenario.loopLabel.includes('电源') || scenario.loopLabel.includes('充电');
            const gap = isPowerSource ? 10 : 14;
            const lx = geometry.leftElectrode.x + 9;
            const rx = geometry.rightElectrode.x + 9;
            return (
              <g>
                <path d={`M${lx} ${geometry.leftElectrode.y} V${cy} H${cx - gap}`} fill="none" stroke="#6B7280" strokeWidth="4" strokeLinecap="round" />
                <path d={`M${cx + gap} ${cy} H${rx} V${geometry.rightElectrode.y}`} fill="none" stroke="#6B7280" strokeWidth="4" strokeLinecap="round" />
                {isPowerSource ? (
                  <g>
                    <line x1={cx - 4} y1={cy - 7} x2={cx - 4} y2={cy + 7} stroke="#6B7280" strokeWidth="2.8" />
                    <line x1={cx + 4} y1={cy - 12} x2={cx + 4} y2={cy + 12} stroke="#6B7280" strokeWidth="2.8" />
                    <text x={cx - 4} y={cy - 11} textAnchor="middle" fontSize="10" fontWeight="700" fill="#6B7280">−</text>
                    <text x={cx + 4} y={cy - 16} textAnchor="middle" fontSize="10" fontWeight="700" fill="#6B7280">+</text>
                  </g>
                ) : (
                  <g>
                    <circle cx={cx} cy={cy} r={12} fill="#FBFCFD" stroke="#6B7280" strokeWidth="2.5" />
                    <line x1={cx - 7} y1={cy - 7} x2={cx + 7} y2={cy + 7} stroke="#6B7280" strokeWidth="2" />
                    <line x1={cx + 7} y1={cy - 7} x2={cx - 7} y2={cy + 7} stroke="#6B7280" strokeWidth="2" />
                  </g>
                )}
              </g>
            );
          })()}
          <ElectrodeRect x={geometry.leftElectrode.x} y={geometry.leftElectrode.y} h={geometry.leftElectrode.h} width={getEffectWidth(scenario.leftElectrode.surfaceEffect, progress)} color={getElectrodeFill(scenario.leftElectrode.material, scenario.leftElectrode.surfaceEffect, progress)} />
          <ElectrodeRect x={geometry.rightElectrode.x} y={geometry.rightElectrode.y} h={geometry.rightElectrode.h} width={getEffectWidth(scenario.rightElectrode.surfaceEffect, progress)} color={getElectrodeFill(scenario.rightElectrode.material, scenario.rightElectrode.surfaceEffect, progress)} />
          <ElectrodeLabel side="left" electrode={scenario.leftElectrode} family={model.family} loopLabel={scenario.loopLabel} x={geometry.leftElectrode.x - 16} y={geometry.leftElectrode.y + 18} />
          <ElectrodeLabel side="right" electrode={scenario.rightElectrode} family={model.family} loopLabel={scenario.loopLabel} x={geometry.rightElectrode.x + 34} y={geometry.rightElectrode.y + 18} />
          {Object.entries(geometry.bathLabels).map(([zone, point]) => point ? <text key={zone} x={point.x} y={point.y} textAnchor="middle" fontSize="13" fill={COLORS.textSecondary}>{zone === 'main' ? model.bathLabel : zone === 'left' ? model.leftChamberLabel : model.rightChamberLabel}</text> : null)}
          {geometry.membraneLabel && model.membraneLabel ? <text x={geometry.membraneLabel.x} y={geometry.membraneLabel.y} textAnchor="middle" fontSize="12" fill={COLORS.textSecondary}>{model.membraneLabel}</text> : null}
          {geometry.bridgePath && model.saltBridgeLabel ? <text x="460" y="165" textAnchor="middle" fontSize="12" fill={COLORS.textSecondary}>{model.saltBridgeLabel}</text> : null}
          {geometry.gasLabels.left && model.gasLabels?.left && !leftGasFormula ? <text x={geometry.gasLabels.left.x} y={geometry.gasLabels.left.y} textAnchor="middle" fontSize="12" fill={COLORS.textMuted}>{model.gasLabels.left}</text> : null}
          {geometry.gasLabels.right && model.gasLabels?.right && !rightGasFormula ? <text x={geometry.gasLabels.right.x} y={geometry.gasLabels.right.y} textAnchor="middle" fontSize="12" fill={COLORS.textMuted}>{model.gasLabels.right}</text> : null}
          {model.bathLabel && model.layoutPreset === 'separator-cell' ? geometry.baths.map((bath) => <text key={`sol-${bath.zone}`} x={bath.x + bath.w / 2} y={bath.y + bath.h - 28} textAnchor="middle" fontSize="12" fontWeight="500" fill={COLORS.textMuted}>{model.bathLabel}</text>) : null}

          <g opacity="0.92">
            {particles.map((particle) => (
              <circle key={particle.key} cx={particle.point.x} cy={particle.point.y} r={particle.emphasis ? 4.8 : 3.8} fill={particle.color} stroke="#FFFFFF" strokeWidth="1.2" opacity={particle.opacity} />
            ))}
          </g>

          {bubbleParticles.map((bubble) => (
            <circle key={bubble.key} cx={bubble.x} cy={bubble.y} r={bubble.size / 2} fill={bubble.color} stroke="#2F5F7C" strokeWidth="1.1" opacity="0.86" />
          ))}

          <g>
            {bubbleParticles.filter((bubble, index) => bubble.label && index % 2 === 0).map((bubble, index) => (
              <text
                key={`gas-label-${bubble.key}`}
                x={bubble.x + (index % 2 === 0 ? 10 : -10)}
                y={bubble.y - 2}
                textAnchor={index % 2 === 0 ? 'start' : 'end'}
                fontSize={ionLabelFontSize}
                fontWeight="700"
                fill={bubble.labelColor}
                stroke="rgba(255,255,255,0.96)"
                strokeWidth="3.2"
                paintOrder="stroke"
              >
                {bubble.label}
              </text>
            ))}
          </g>

          {showIonLabels ? (
            <g>
              {particleLabels.map((particle) => (
                <text
                  key={`label-${particle.key}`}
                  x={particle.labelX}
                  y={particle.labelY}
                  textAnchor={particle.textAnchor}
                  fontSize={ionLabelFontSize}
                  fontWeight="700"
                  fill={particle.color}
                  stroke="rgba(255,255,255,0.96)"
                  strokeWidth="3.2"
                  paintOrder="stroke"
                >
                  {particle.label}
                </text>
              ))}
            </g>
          ) : null}

          {sludgeParticles.length > 0 ? (
            <g>
              {sludgeParticles.map((p) => (
                <rect key={p.key} x={p.x - p.size / 2} y={p.y - p.size / 2} width={p.size} height={p.size * 0.7} rx="1" fill="#8B7355" opacity={p.opacity} transform={`rotate(${(p.y * 3) % 40 - 20}, ${p.x}, ${p.y})`} />
              ))}
              {[
                ...(scenario.leftElectrode.surfaceEffect === 'dissolve-sludge' ? [{ side: 'left' as const, ex: geometry.leftElectrode.x }] : []),
                ...(scenario.rightElectrode.surfaceEffect === 'dissolve-sludge' ? [{ side: 'right' as const, ex: geometry.rightElectrode.x }] : []),
              ].map(({ side, ex }) => {
                const bath = geometry.baths[geometry.baths.length === 1 ? 0 : side === 'left' ? 0 : 1];
                const cx = ex + 9;
                const by = bath.y + bath.h - 6;
                const bw = 48;
                const bh = 5 + progress * 7;
                return (
                  <g key={`sludge-pile-${side}`}>
                    <ellipse cx={cx} cy={by} rx={bw / 2} ry={bh / 2} fill="#8B7355" opacity="0.6" />
                    <ellipse cx={cx - 8} cy={by + 1} rx={6} ry={2.5} fill="#A08060" opacity="0.45" />
                    <ellipse cx={cx + 10} cy={by - 1} rx={5} ry={2} fill="#6B5B45" opacity="0.5" />
                    <ellipse cx={cx + 2} cy={by - bh / 2 + 1} rx={3} ry={1.5} fill="#9A8465" opacity="0.35" />
                    <text x={cx + bw / 2 + 8} y={by + 4} textAnchor="start" fontSize="11" fill="#8B7355" fontWeight="600">阳极泥</text>
                  </g>
                );
              })}
            </g>
          ) : null}
        </svg>

        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-5 top-5 max-w-[360px] rounded-[20px] px-4 py-4" style={{ background: 'rgba(255,255,255,0.92)', boxShadow: SHADOWS.sm }}>
            <div className="text-xs font-semibold tracking-[0.16em]" style={{ color: COLORS.primary }}>{activeKeyframe?.title}</div>
            <div className="mt-2 text-sm leading-6" style={{ color: COLORS.textSecondary }}>{activeKeyframe?.description ?? scenario.caption}</div>
          </div>
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


function getElectrodeColor(material: string) {
  if (material.includes('锌')) return '#7F8EA3';
  if (material.includes('铜') || material === 'Cu') return '#A94328';
  if (material.includes('二氧化铅')) return '#3D2B1F';
  if (material.includes('铅')) return '#6B7280';
  if (material.includes('Pt') || material.includes('铂')) return '#8A94A6';
  if (material.includes('镍')) return '#A0A8B0';
  if (material.includes('石墨') || material.includes('碳')) return '#4B5563';
  if (material.includes('铁') || material.includes('钢')) return '#728091';
  return '#64748B';
}

function getElectrodeFill(material: string, effect: SurfaceEffect, progress: number) {
  if (effect === 'coat' && material.includes('待镀')) return blendHex('#728091', '#A94328', progress);
  return getElectrodeColor(material);
}

function getPolarityMark(polarity: string) {
  if (polarity.includes('正')) return '(+)';
  if (polarity.includes('负')) return '(-)';
  return '';
}


function ElectrodeLabel({ side, electrode, family, loopLabel, x, y }: { side: 'left' | 'right'; electrode: { label: string; polarity: string; role: string }; family: string; loopLabel: string; x: number; y: number }) {
  const anchor = side === 'left' ? 'end' : 'start';
  const isElectrolytic = family === 'electrolytic';
  const isChargingScenario = loopLabel.includes('充电');
  const title = isElectrolytic ? `接电源${electrode.polarity}的电极` : electrode.label;
  const descriptor = isElectrolytic
    ? electrode.label
    : electrode.role
      ? isChargingScenario ? electrode.role : `${electrode.role}（${getPolarityMark(electrode.polarity)} ${electrode.polarity}）`
      : `${getPolarityMark(electrode.polarity)} ${electrode.polarity}`;
  const visibleDescriptor = descriptor.trim();
  return (
    <g>
      <text x={x} y={y} textAnchor={anchor} fontSize="12" fill={COLORS.text} fontWeight="700">{title}</text>
      {visibleDescriptor ? <text x={x} y={y + 16} textAnchor={anchor} fontSize="11" fill={COLORS.textSecondary}>{visibleDescriptor}</text> : null}
    </g>
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




