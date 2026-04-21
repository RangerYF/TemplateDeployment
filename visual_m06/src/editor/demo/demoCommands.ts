import type { Command } from '../commands/types';
import { useDemoEntityStore } from './demoEntityStore';
import type { DemoPoint, DemoVector, DemoVecOp, DemoBinding, DemoSnapshot } from './demoTypes';

// ─── 辅助：获取 store ───
function store() {
  return useDemoEntityStore.getState();
}

// ─── CreateVectorCmd：创建起点 + 终点 + 向量 ───

export class CreateVectorCmd implements Command {
  type = 'CreateVector';
  label: string;
  private startPoint: DemoPoint;
  private endPoint: DemoPoint;
  private vector: DemoVector;

  constructor(startPoint: DemoPoint, endPoint: DemoPoint, vector: DemoVector) {
    this.startPoint = startPoint;
    this.endPoint = endPoint;
    this.vector = vector;
    this.label = `创建向量 ${vector.label}`;
  }

  execute() {
    const s = store();
    s.addEntity(this.startPoint);
    s.addEntity(this.endPoint);
    s.addEntity(this.vector);
  }

  undo() {
    const s = store();
    s.removeEntity(this.vector.id);
    s.removeEntity(this.endPoint.id);
    s.removeEntity(this.startPoint.id);
  }
}

// ─── DeleteVectorCmd：删除向量 + 端点 + 孤立运算 ───

export class DeleteVectorCmd implements Command {
  type = 'DeleteVector';
  label: string;
  private vector: DemoVector;
  private startPoint: DemoPoint;
  private endPoint: DemoPoint;
  private orphanOps: DemoVecOp[];
  private orphanBindings: DemoBinding[];

  constructor(
    vector: DemoVector,
    startPoint: DemoPoint,
    endPoint: DemoPoint,
    orphanOps: DemoVecOp[],
  ) {
    this.vector = vector;
    this.startPoint = startPoint;
    this.endPoint = endPoint;
    this.orphanOps = orphanOps;
    // 查找涉及此向量端点的绑定
    const bindings = store().bindings;
    this.orphanBindings = bindings.filter((b) =>
      b.pointA === startPoint.id || b.pointB === startPoint.id
      || b.pointA === endPoint.id || b.pointB === endPoint.id,
    );
    this.label = `删除向量 ${vector.label}`;
  }

  execute() {
    const s = store();
    for (const b of this.orphanBindings) s.removeBinding(b.id);
    for (const op of this.orphanOps) s.removeEntity(op.id);
    s.removeEntity(this.vector.id);
    s.removeEntity(this.endPoint.id);
    s.removeEntity(this.startPoint.id);
  }

  undo() {
    const s = store();
    s.addEntity(this.startPoint);
    s.addEntity(this.endPoint);
    s.addEntity(this.vector);
    for (const op of this.orphanOps) s.addEntity(op);
    for (const b of this.orphanBindings) s.addBinding(b);
  }
}

// ─── MovePointCmd：移动端点坐标 ───

export class MovePointCmd implements Command {
  type = 'MovePoint';
  label = '移动端点';
  private pointId: string;
  private before: { x: number; y: number };
  private after: { x: number; y: number };

  constructor(
    pointId: string,
    before: { x: number; y: number },
    after: { x: number; y: number },
  ) {
    this.pointId = pointId;
    this.before = before;
    this.after = after;
  }

  execute() {
    store().updateEntity(this.pointId, this.after);
  }

  undo() {
    store().updateEntity(this.pointId, this.before);
  }
}

// ─── UpdateVectorPropsCmd：更新颜色 / 标签 / showLabel ───

export class UpdateVectorPropsCmd implements Command {
  type = 'UpdateVectorProps';
  label = '修改向量属性';
  private vectorId: string;
  private before: Partial<DemoVector>;
  private after: Partial<DemoVector>;

  constructor(vectorId: string, before: Partial<DemoVector>, after: Partial<DemoVector>) {
    this.vectorId = vectorId;
    this.before = before;
    this.after = after;
  }

  execute() {
    store().updateEntity(this.vectorId, this.after);
  }

  undo() {
    store().updateEntity(this.vectorId, this.before);
  }
}

// ─── CreateVecOpCmd：创建运算实体（结果由渲染层实时计算）───

export class CreateVecOpCmd implements Command {
  type = 'CreateVecOp';
  label: string;
  private op: DemoVecOp;

  constructor(op: DemoVecOp) {
    this.op = op;
    this.label = `向量运算 ${op.kind}`;
  }

  execute() {
    store().addEntity(this.op);
  }

  undo() {
    store().removeEntity(this.op.id);
  }
}

// ─── DeleteVecOpCmd：删除运算实体（级联删除引用此运算的子运算）───

export class DeleteVecOpCmd implements Command {
  type = 'DeleteVecOp';
  label: string;
  private op: DemoVecOp;
  private childOps: DemoVecOp[];

  constructor(op: DemoVecOp) {
    this.op = op;
    // 查找引用此运算的子运算
    const ents = store().entities;
    this.childOps = Object.values(ents).filter(
      (en): en is DemoVecOp => en.type === 'demoVecOp' && en.id !== op.id
        && (en.vec1Id === op.id || en.vec2Id === op.id),
    );
    this.label = `删除运算 ${op.kind}`;
  }

  execute() {
    const s = store();
    for (const child of this.childOps) s.removeEntity(child.id);
    s.removeEntity(this.op.id);
  }

  undo() {
    const s = store();
    s.addEntity(this.op);
    for (const child of this.childOps) s.addEntity(child);
  }
}

// ─── UpdateVecOpCmd：修改运算参数（如 scalarK）───

export class UpdateVecOpCmd implements Command {
  type = 'UpdateVecOp';
  label = '修改运算参数';
  private opId: string;
  private before: Partial<DemoVecOp>;
  private after: Partial<DemoVecOp>;

  constructor(opId: string, before: Partial<DemoVecOp>, after: Partial<DemoVecOp>) {
    this.opId = opId;
    this.before = before;
    this.after = after;
  }

  execute() {
    store().updateEntity(this.opId, this.after);
  }

  undo() {
    store().updateEntity(this.opId, this.before);
  }
}

// ─── BindPointsCmd：绑定两端点（移动 pointB 到 pointA 位置）───

export class BindPointsCmd implements Command {
  type = 'BindPoints';
  label = '绑定端点';
  private binding: DemoBinding;
  private pointBId: string;
  private beforePos: { x: number; y: number };
  private afterPos: { x: number; y: number };

  constructor(
    binding: DemoBinding,
    beforePos: { x: number; y: number },
    afterPos: { x: number; y: number },
  ) {
    this.binding = binding;
    this.pointBId = binding.pointB;
    this.beforePos = beforePos;
    this.afterPos = afterPos;
  }

  execute() {
    const s = store();
    s.updateEntity(this.pointBId, this.afterPos);
    s.addBinding(this.binding);
  }

  undo() {
    const s = store();
    s.removeBinding(this.binding.id);
    s.updateEntity(this.pointBId, this.beforePos);
  }
}

// ─── UnbindPointsCmd：解除绑定 ───

export class UnbindPointsCmd implements Command {
  type = 'UnbindPoints';
  label = '解除绑定';
  private binding: DemoBinding;

  constructor(binding: DemoBinding) {
    this.binding = binding;
  }

  execute() {
    store().removeBinding(this.binding.id);
  }

  undo() {
    store().addBinding(this.binding);
  }
}

// ─── LoadDemoSnapshotCmd：导入快照（支持撤销）───

export class LoadDemoSnapshotCmd implements Command {
  type = 'LoadDemoSnapshot';
  label = '导入场景';
  private before: DemoSnapshot;
  private after: DemoSnapshot;

  constructor(before: DemoSnapshot, after: DemoSnapshot) {
    this.before = before;
    this.after = after;
  }

  execute() {
    store().loadSnapshot(this.after);
  }

  undo() {
    store().loadSnapshot(this.before);
  }
}
