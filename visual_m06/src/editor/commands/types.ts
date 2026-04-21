// ─── Command 接口（与 visual_template 保持一致）───

export interface Command {
  type: string;
  label: string;
  execute(): void;
  undo(): void;
}
