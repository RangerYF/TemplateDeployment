export type ModelFamily = 'galvanic' | 'electrolytic';
export type LevelTag = '[高中必修]' | '[高中选修]' | '[拓展]';
export type LayoutPreset = 'single-bath' | 'dual-bath' | 'separator-cell';
export type ScenarioId = 'standard' | 'discharge' | 'charge';
export type SurfaceEffect = 'stable' | 'dissolve' | 'deposit' | 'bubbles' | 'coat' | 'consume';
export type Direction = 'left-to-right' | 'right-to-left' | 'up' | 'down';
export type StreamKind = 'electron' | 'cation' | 'anion';
export type StreamChannel =
  | 'wire-top'
  | 'bath-main-left'
  | 'bath-main-right'
  | 'bath-center-left'
  | 'bath-center-right'
  | 'bridge-left-to-right'
  | 'bridge-right-to-left'
  | 'membrane-left-to-right'
  | 'membrane-right-to-left'
  | 'membrane-upper-left-to-right'
  | 'membrane-upper-right-to-left'
  | 'membrane-lower-left-to-right'
  | 'membrane-lower-right-to-left';
export type FocusArea = 'wire' | 'solution' | 'electrode' | 'equation' | 'trend';
export type TipKind = 'info' | 'warning';
export type PhTrend = 'up' | 'down' | 'steady';
export type ZoneId = 'left' | 'right' | 'main';

export interface ParticleStream {
  id: string;
  label: string;
  kind: StreamKind;
  channel: StreamChannel;
  direction: Direction;
  color: string;
  count: number;
  note: string;
  emphasis?: boolean;
}

export interface Keyframe {
  at: number;
  title: string;
  description: string;
  focus: FocusArea;
}

export interface ElectrodeState {
  label: string;
  material: string;
  polarity: string;
  role: string;
  reaction: string;
  surfaceEffect: SurfaceEffect;
  surfaceNote: string;
}

export interface SolutionShift {
  zone: ZoneId;
  label: string;
  note: string;
  from: string;
  to: string;
}

export interface PhIndicator {
  zone: ZoneId;
  label: string;
  trend: PhTrend;
  note: string;
}

export interface CompetitionNote {
  title: string;
  winner: string;
  loser: string;
  explanation: string;
}

export interface TrendNote {
  title: string;
  points: string[];
}

export interface EnvironmentTip {
  title: string;
  body: string;
  kind: TipKind;
}

export interface PracticeOption {
  id: string;
  label: string;
  correct: boolean;
  explanation: string;
}

export interface PracticeQuestion {
  id: string;
  prompt: string;
  options: PracticeOption[];
}

export interface PracticeSet {
  title: string;
  intro: string;
  questions: PracticeQuestion[];
}

export interface GasLabels {
  left?: string;
  right?: string;
}

export interface ModelScenario {
  id: ScenarioId | string;
  label: string;
  loopLabel: string;
  duration: number;
  caption: string;
  totalReaction: string;
  currentDirection: string;
  electronDirection: string;
  leftElectrode: ElectrodeState;
  rightElectrode: ElectrodeState;
  streams: ParticleStream[];
  keyframes: Keyframe[];
  solutionShifts?: SolutionShift[];
  phIndicators?: PhIndicator[];
  competition?: CompetitionNote;
  trend?: TrendNote;
}

export interface ElectrochemModel {
  id: string;
  title: string;
  family: ModelFamily;
  subtype: string;
  level: LevelTag;
  priority: 'P2';
  summary: string;
  environment: string;
  layoutPreset: LayoutPreset;
  apparatusNote: string;
  bathLabel?: string;
  leftChamberLabel?: string;
  rightChamberLabel?: string;
  membraneLabel?: string;
  saltBridgeLabel?: string;
  gasLabels?: GasLabels;
  tags: string[];
  sourceNote: string;
  sourceTags: string[];
  crossDisciplineNote?: string;
  environmentTips: EnvironmentTip[];
  scenarios: ModelScenario[];
  practice?: PracticeSet;
}

export interface AnswerMap {
  [questionId: string]: string;
}
