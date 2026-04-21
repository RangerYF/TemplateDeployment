import { create } from 'zustand';
import type { Vec2D, Vec3D, OperationType } from '../entities/types';
import type { PresetData } from '../entities/types';
import { signals } from '../signals';

// ─── 状态接口 ───

interface VectorStoreState {
  // 当前运算类型
  operation: OperationType;

  // 2D 向量（parallelogram/triangle/subtraction/scalar/dotProduct）
  vecA: Vec2D;
  vecB: Vec2D;

  // 3D 向量（space3D/crossProduct）
  vecA3: Vec3D;
  vecB3: Vec3D;

  // 数乘标量
  scalarK: number;

  // 首尾相接链（triangle）— 额外向量（vecA, vecB 之后的）
  chainVecs: Vec2D[];

  // 基底分解（decomposition）
  decompTarget: Vec2D;
  basis1: Vec2D;
  basis2: Vec2D;

  // 当前激活的预设 ID
  activePresetId: string | null;

  // UI 配置
  showGrid: boolean;
  showAngleArc: boolean;
  showProjection: boolean;
  showDecompParallel: boolean;

  // 角度单位
  angleUnit: 'deg' | 'rad';

  // 3D 视图配置
  showPerspective: boolean;
  show3DGrid: boolean;

  // 平行四边形动画触发器（每次播放递增）
  parallelogramAnimTick: number;

  // 小数位数
  decimalPlaces: number;

  // 根号精确显示模式（卡西欧模式）
  surdMode: boolean;

  // 单位圆模式角度（弧度）
  unitCircleAngle: number;
  unitCirclePlaying: boolean;

  // 极化恒等式显示
  showPolarization: boolean;

  // ─── Actions ───
  setOperation(op: OperationType): void;
  setVecA(v: Vec2D): void;
  setVecB(v: Vec2D): void;
  setVecA3(v: Vec3D): void;
  setVecB3(v: Vec3D): void;
  setScalarK(k: number): void;
  setDecompTarget(v: Vec2D): void;
  setBasis1(v: Vec2D): void;
  setBasis2(v: Vec2D): void;
  addChainVec(v?: Vec2D): void;
  removeChainVec(index: number): void;
  setChainVec(index: number, v: Vec2D): void;
  loadPreset(preset: PresetData): void;
  setActivePresetId(id: string | null): void;
  toggleGrid(): void;
  toggleAngleArc(): void;
  toggleProjection(): void;
  toggleDecompParallel(): void;
  setAngleUnit(u: 'deg' | 'rad'): void;
  togglePerspective(): void;
  toggle3DGrid(): void;
  playParallelogramAnim(): void;
  setDecimalPlaces(n: number): void;
  toggleSurdMode(): void;
  setUnitCircleAngle(rad: number): void;
  setUnitCirclePlaying(playing: boolean): void;
  togglePolarization(): void;

  // ─── 快照（供 LoadPresetCommand 撤销使用）───
  getSnapshot(): VectorSnapshot;
  loadSnapshot(snap: VectorSnapshot): void;
}

export interface VectorSnapshot {
  operation: OperationType;
  vecA: Vec2D;
  vecB: Vec2D;
  chainVecs: Vec2D[];
  vecA3: Vec3D;
  vecB3: Vec3D;
  scalarK: number;
  decompTarget: Vec2D;
  basis1: Vec2D;
  basis2: Vec2D;
  activePresetId: string | null;
}

export const useVectorStore = create<VectorStoreState>()((set, get) => ({
  // 默认运算：平行四边形法则
  operation: 'parallelogram',

  // 默认 2D 向量（对应 VEC-011-B 一般情形）
  vecA: [2, 1],
  vecB: [1, 3],

  // 默认 3D 向量（对应 VEC-061-A）
  vecA3: [1, 0, 0],
  vecB3: [0, 1, 0],

  // 首尾相接链默认无额外向量
  chainVecs: [],

  // 数乘标量默认值
  scalarK: 2,

  // 基底分解默认（对应 VEC-051-A 标准正交基）
  decompTarget: [5, 3],
  basis1: [1, 0],
  basis2: [0, 1],

  activePresetId: null,

  showGrid: true,
  showAngleArc: true,
  showProjection: true,
  showDecompParallel: true,

  angleUnit: 'deg',
  showPerspective: true,
  show3DGrid: true,
  parallelogramAnimTick: 0,
  decimalPlaces: 2,
  surdMode: false,
  unitCircleAngle: 0,
  unitCirclePlaying: false,
  showPolarization: false,

  // ─── Actions ───

  setOperation(op) {
    set({ operation: op, activePresetId: null });
    signals.operationChanged.emit({ operation: op });
  },

  setVecA(v) {
    set({ vecA: v });
    signals.vectorChanged.emit({ key: 'vecA' });
  },

  setVecB(v) {
    set({ vecB: v });
    signals.vectorChanged.emit({ key: 'vecB' });
  },

  setVecA3(v) {
    set({ vecA3: v });
    signals.vectorChanged.emit({ key: 'vecA3' });
  },

  setVecB3(v) {
    set({ vecB3: v });
    signals.vectorChanged.emit({ key: 'vecB3' });
  },

  setScalarK(k) {
    set({ scalarK: k });
    signals.vectorChanged.emit({ key: 'scalarK' });
  },

  setDecompTarget(v) {
    set({ decompTarget: v });
    signals.vectorChanged.emit({ key: 'decompTarget' });
  },

  setBasis1(v) {
    set({ basis1: v });
    signals.vectorChanged.emit({ key: 'basis1' });
  },

  setBasis2(v) {
    set({ basis2: v });
    signals.vectorChanged.emit({ key: 'basis2' });
  },

  addChainVec(v: Vec2D = [1, 1]) {
    set((s) => ({ chainVecs: [...s.chainVecs, v] }));
    signals.vectorChanged.emit({ key: 'chainVecs' });
  },

  removeChainVec(index: number) {
    set((s) => ({ chainVecs: s.chainVecs.filter((_, i) => i !== index) }));
    signals.vectorChanged.emit({ key: 'chainVecs' });
  },

  setChainVec(index: number, v: Vec2D) {
    set((s) => {
      const next = [...s.chainVecs];
      next[index] = v;
      return { chainVecs: next };
    });
    signals.vectorChanged.emit({ key: 'chainVecs' });
  },

  loadPreset(preset) {
    const update: Partial<VectorStoreState> = {
      operation: preset.operation,
      activePresetId: preset.id,
    };
    if (preset.vecA !== undefined) update.vecA = preset.vecA;
    if (preset.vecB !== undefined) update.vecB = preset.vecB;
    if (preset.chainVecs !== undefined) update.chainVecs = preset.chainVecs;
    else if (preset.operation === 'triangle') update.chainVecs = [];
    if (preset.scalarK !== undefined) update.scalarK = preset.scalarK;
    if (preset.decompTarget !== undefined) update.decompTarget = preset.decompTarget;
    if (preset.basis1 !== undefined) update.basis1 = preset.basis1;
    if (preset.basis2 !== undefined) update.basis2 = preset.basis2;
    if (preset.vecA3 !== undefined) update.vecA3 = preset.vecA3;
    if (preset.vecB3 !== undefined) update.vecB3 = preset.vecB3;
    set(update);
    signals.presetLoaded.emit({ presetId: preset.id });
  },

  setActivePresetId(id) {
    set({ activePresetId: id });
  },

  toggleGrid() {
    set((s) => ({ showGrid: !s.showGrid }));
  },

  toggleAngleArc() {
    set((s) => ({ showAngleArc: !s.showAngleArc }));
  },

  toggleProjection() {
    set((s) => ({ showProjection: !s.showProjection }));
  },

  toggleDecompParallel() {
    set((s) => ({ showDecompParallel: !s.showDecompParallel }));
  },

  setAngleUnit(u) {
    set({ angleUnit: u });
  },

  togglePerspective() {
    set((s) => ({ showPerspective: !s.showPerspective }));
  },

  toggle3DGrid() {
    set((s) => ({ show3DGrid: !s.show3DGrid }));
  },

  playParallelogramAnim() {
    set((s) => ({ parallelogramAnimTick: s.parallelogramAnimTick + 1 }));
  },

  setDecimalPlaces(n) {
    set({ decimalPlaces: n });
  },
  toggleSurdMode() {
    set((s) => ({ surdMode: !s.surdMode }));
  },

  setUnitCircleAngle(rad) {
    set({ unitCircleAngle: rad });
  },

  setUnitCirclePlaying(playing) {
    set({ unitCirclePlaying: playing });
  },

  togglePolarization() {
    set((s) => ({ showPolarization: !s.showPolarization }));
  },

  getSnapshot(): VectorSnapshot {
    const s = get();
    return {
      operation: s.operation,
      vecA: s.vecA,
      vecB: s.vecB,
      chainVecs: [...s.chainVecs],
      vecA3: s.vecA3,
      vecB3: s.vecB3,
      scalarK: s.scalarK,
      decompTarget: s.decompTarget,
      basis1: s.basis1,
      basis2: s.basis2,
      activePresetId: s.activePresetId,
    };
  },

  loadSnapshot(snap) {
    set({
      operation: snap.operation,
      vecA: snap.vecA,
      vecB: snap.vecB,
      chainVecs: snap.chainVecs ? [...snap.chainVecs] : [],
      vecA3: snap.vecA3,
      vecB3: snap.vecB3,
      scalarK: snap.scalarK,
      decompTarget: snap.decompTarget,
      basis1: snap.basis1,
      basis2: snap.basis2,
      activePresetId: snap.activePresetId,
    });
  },
}));
