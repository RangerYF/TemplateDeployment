import type { Command } from './types';
import type { Vec2D, Vec3D } from '../entities/types';

// ─── 更新 2D 向量命令 ───

export class UpdateVec2DCommand implements Command {
  readonly type = 'UPDATE_VEC2D';
  readonly label: string;

  constructor(
    label: string,
    private readonly before: Vec2D,
    private readonly after: Vec2D,
    private readonly apply: (v: Vec2D) => void,
  ) {
    this.label = label;
  }

  execute(): void {
    this.apply(this.after);
  }

  undo(): void {
    this.apply(this.before);
  }
}

// ─── 更新 3D 向量命令 ───

export class UpdateVec3DCommand implements Command {
  readonly type = 'UPDATE_VEC3D';
  readonly label: string;

  constructor(
    label: string,
    private readonly before: Vec3D,
    private readonly after: Vec3D,
    private readonly apply: (v: Vec3D) => void,
  ) {
    this.label = label;
  }

  execute(): void {
    this.apply(this.after);
  }

  undo(): void {
    this.apply(this.before);
  }
}

// ─── 更新标量命令 ───

export class UpdateScalarCommand implements Command {
  readonly type = 'UPDATE_SCALAR';
  readonly label = '修改标量 k';

  constructor(
    private readonly before: number,
    private readonly after: number,
    private readonly apply: (v: number) => void,
  ) {}

  execute(): void {
    this.apply(this.after);
  }

  undo(): void {
    this.apply(this.before);
  }
}

// ─── 加载预设命令（复合命令，支持撤销到上一状态）───

export class LoadPresetCommand implements Command {
  readonly type = 'LOAD_PRESET';

  constructor(
    readonly label: string,
    private readonly doFn: () => void,
    private readonly undoFn: () => void,
  ) {}

  execute(): void {
    this.doFn();
  }

  undo(): void {
    this.undoFn();
  }
}
