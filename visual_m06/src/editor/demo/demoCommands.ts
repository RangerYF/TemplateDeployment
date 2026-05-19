import type { Command } from '../commands/types';
import { useDemoEntityStore } from './demoEntityStore';
import type {
  DemoPoint, DemoVector, DemoVecOp, DemoBinding, DemoSnapshot,
  DemoMarker, DemoSegment, DemoCircle, DemoText, DemoAngleMark, DemoDistanceMark,
  DemoEntity, DemoSlider,
} from './demoTypes';

function store() {
  return useDemoEntityStore.getState();
}

// ─── CreateVectorCmd ───

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

// ─── DeleteVectorCmd ───

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

// ─── MovePointCmd ───

type PointPos = { x: number; y: number; xExpr?: string; yExpr?: string };

export class MovePointCmd implements Command {
  type = 'MovePoint';
  label = '移动端点';
  private pointId: string;
  private before: PointPos;
  private after: PointPos;

  constructor(pointId: string, before: PointPos, after: PointPos) {
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

// ─── UpdateVectorPropsCmd ───

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

// ─── CreateVecOpCmd ───

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

// ─── DeleteVecOpCmd ───

export class DeleteVecOpCmd implements Command {
  type = 'DeleteVecOp';
  label: string;
  private op: DemoVecOp;
  private childOps: DemoVecOp[];

  constructor(op: DemoVecOp) {
    this.op = op;
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

// ─── UpdateVecOpCmd ───

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

// ─── BindPointsCmd ───

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

// ─── UnbindPointsCmd ───

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

// ─── LoadDemoSnapshotCmd ───

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

// ═══════════════════════════════════════════
// 新增几何实体 Commands
// ═══════════════════════════════════════════

// ─── CreateMarkerCmd ───

export class CreateMarkerCmd implements Command {
  type = 'CreateMarker';
  label: string;
  private marker: DemoMarker;

  constructor(marker: DemoMarker) {
    this.marker = marker;
    this.label = `创建点 ${marker.label}`;
  }

  execute() {
    store().addEntity(this.marker);
  }

  undo() {
    store().removeEntity(this.marker.id);
  }
}

// ─── DeleteMarkerCmd（级联删除引用它的线段/圆/角度/距离标注）───

export class DeleteMarkerCmd implements Command {
  type = 'DeleteMarker';
  label: string;
  private marker: DemoMarker;
  private orphans: DemoEntity[];

  constructor(marker: DemoMarker) {
    this.marker = marker;
    this.label = `删除点 ${marker.label}`;
    const ents = store().entities;
    this.orphans = Object.values(ents).filter((e) => {
      if (e.type === 'demoSegment') {
        const s = e as DemoSegment;
        return s.startId === marker.id || s.endId === marker.id;
      }
      if (e.type === 'demoCircle') {
        const c = e as DemoCircle;
        return c.centerId === marker.id || c.radiusPointId === marker.id;
      }
      if (e.type === 'demoAngleMark') {
        const a = e as DemoAngleMark;
        return a.pointAId === marker.id || a.vertexId === marker.id || a.pointCId === marker.id;
      }
      if (e.type === 'demoDistanceMark') {
        const d = e as DemoDistanceMark;
        return d.pointAId === marker.id || d.pointBId === marker.id;
      }
      return false;
    });
  }

  execute() {
    const s = store();
    for (const o of this.orphans) s.removeEntity(o.id);
    s.removeEntity(this.marker.id);
  }

  undo() {
    const s = store();
    s.addEntity(this.marker);
    for (const o of this.orphans) s.addEntity(o);
  }
}

// ─── UpdateMarkerCmd ───

export class UpdateMarkerCmd implements Command {
  type = 'UpdateMarker';
  label = '修改标记点';
  private markerId: string;
  private before: Partial<DemoMarker>;
  private after: Partial<DemoMarker>;

  constructor(markerId: string, before: Partial<DemoMarker>, after: Partial<DemoMarker>) {
    this.markerId = markerId;
    this.before = before;
    this.after = after;
  }

  execute() {
    store().updateEntity(this.markerId, this.after);
  }

  undo() {
    store().updateEntity(this.markerId, this.before);
  }
}

// ─── CreateSegmentCmd（含自动创建端点 marker）───

export class CreateSegmentCmd implements Command {
  type = 'CreateSegment';
  label: string;
  private segment: DemoSegment;
  private newMarkers: DemoMarker[];

  constructor(segment: DemoSegment, newMarkers: DemoMarker[]) {
    this.segment = segment;
    this.newMarkers = newMarkers;
    this.label = `创建线段`;
  }

  execute() {
    const s = store();
    for (const m of this.newMarkers) s.addEntity(m);
    s.addEntity(this.segment);
  }

  undo() {
    const s = store();
    s.removeEntity(this.segment.id);
    for (const m of this.newMarkers) s.removeEntity(m.id);
  }
}

// ─── CreateCircleCmd ───

export class CreateCircleCmd implements Command {
  type = 'CreateCircle';
  label: string;
  private circle: DemoCircle;
  private newMarkers: DemoMarker[];

  constructor(circle: DemoCircle, newMarkers: DemoMarker[]) {
    this.circle = circle;
    this.newMarkers = newMarkers;
    this.label = `创建圆`;
  }

  execute() {
    const s = store();
    for (const m of this.newMarkers) s.addEntity(m);
    s.addEntity(this.circle);
  }

  undo() {
    const s = store();
    s.removeEntity(this.circle.id);
    for (const m of this.newMarkers) s.removeEntity(m.id);
  }
}

// ─── CreateTextCmd ───

export class CreateTextCmd implements Command {
  type = 'CreateText';
  label = '创建文字';
  private text: DemoText;

  constructor(text: DemoText) {
    this.text = text;
  }

  execute() {
    store().addEntity(this.text);
  }

  undo() {
    store().removeEntity(this.text.id);
  }
}

// ─── UpdateTextCmd ───

export class UpdateTextCmd implements Command {
  type = 'UpdateText';
  label = '修改文字';
  private textId: string;
  private before: Partial<DemoText>;
  private after: Partial<DemoText>;

  constructor(textId: string, before: Partial<DemoText>, after: Partial<DemoText>) {
    this.textId = textId;
    this.before = before;
    this.after = after;
  }

  execute() {
    store().updateEntity(this.textId, this.after);
  }

  undo() {
    store().updateEntity(this.textId, this.before);
  }
}

// ─── CreateAngleMarkCmd ───

export class CreateAngleMarkCmd implements Command {
  type = 'CreateAngleMark';
  label = '创建角度标注';
  private angleMark: DemoAngleMark;

  constructor(angleMark: DemoAngleMark) {
    this.angleMark = angleMark;
  }

  execute() {
    store().addEntity(this.angleMark);
  }

  undo() {
    store().removeEntity(this.angleMark.id);
  }
}

// ─── CreateDistanceMarkCmd ───

export class CreateDistanceMarkCmd implements Command {
  type = 'CreateDistanceMark';
  label = '创建距离标注';
  private distMark: DemoDistanceMark;

  constructor(distMark: DemoDistanceMark) {
    this.distMark = distMark;
  }

  execute() {
    store().addEntity(this.distMark);
  }

  undo() {
    store().removeEntity(this.distMark.id);
  }
}

// ─── DeleteGenericCmd（通用删除：线段/圆/文字/角度/距离标注）───

export class DeleteGenericCmd implements Command {
  type = 'DeleteGeneric';
  label: string;
  private entity: DemoEntity;

  constructor(entity: DemoEntity, label?: string) {
    this.entity = entity;
    this.label = label ?? `删除 ${entity.type}`;
  }

  execute() {
    store().removeEntity(this.entity.id);
  }

  undo() {
    store().addEntity(this.entity);
  }
}

// ─── UpdateGenericCmd ───

export class UpdateGenericCmd implements Command {
  type = 'UpdateGeneric';
  label = '修改属性';
  private entityId: string;
  private before: Partial<DemoEntity>;
  private after: Partial<DemoEntity>;

  constructor(entityId: string, before: Partial<DemoEntity>, after: Partial<DemoEntity>) {
    this.entityId = entityId;
    this.before = before;
    this.after = after;
  }

  execute() {
    store().updateEntity(this.entityId, this.after);
  }

  undo() {
    store().updateEntity(this.entityId, this.before);
  }
}

// ─── CreateConstructionCmd（通用几何构造，支持多实体原子化 undo/redo）───

export class CreateConstructionCmd implements Command {
  type = 'CreateConstruction';
  label: string;
  private entities: DemoEntity[];

  constructor(label: string, entities: DemoEntity[]) {
    this.label = label;
    this.entities = entities;
  }

  execute() {
    const s = store();
    for (const e of this.entities) s.addEntity(e);
  }

  undo() {
    const s = store();
    for (let i = this.entities.length - 1; i >= 0; i--) {
      s.removeEntity(this.entities[i].id);
    }
  }
}

// ─── TransformEntitiesCmd（几何变换：产物为新实体集合）───

export class TransformEntitiesCmd implements Command {
  type = 'TransformEntities';
  label: string;
  private produced: DemoEntity[];

  constructor(label: string, produced: DemoEntity[]) {
    this.label = label;
    this.produced = produced;
  }

  execute() {
    const s = store();
    for (const e of this.produced) s.addEntity(e);
  }

  undo() {
    const s = store();
    for (let i = this.produced.length - 1; i >= 0; i--) {
      s.removeEntity(this.produced[i].id);
    }
  }
}

// ─── ToggleVisibilityCmd ───

export class ToggleVisibilityCmd implements Command {
  type = 'ToggleVisibility';
  label: string;
  private entityId: string;
  private before: boolean;
  private after: boolean;

  constructor(entityId: string, before: boolean, after: boolean) {
    this.entityId = entityId;
    this.before = before;
    this.after = after;
    this.label = after ? '显示实体' : '隐藏实体';
  }

  execute() {
    store().updateEntity(this.entityId, { visible: this.after } as Partial<DemoEntity>);
  }

  undo() {
    store().updateEntity(this.entityId, { visible: this.before } as Partial<DemoEntity>);
  }
}

// ─── UpdateSliderCmd ───

export class UpdateSliderCmd implements Command {
  type = 'UpdateSlider';
  label = '修改滑动条';
  private sliderId: string;
  private before: Partial<DemoSlider>;
  private after: Partial<DemoSlider>;

  constructor(sliderId: string, before: Partial<DemoSlider>, after: Partial<DemoSlider>) {
    this.sliderId = sliderId;
    this.before = before;
    this.after = after;
  }

  execute() {
    store().updateEntity(this.sliderId, this.after);
  }

  undo() {
    store().updateEntity(this.sliderId, this.before);
  }
}
