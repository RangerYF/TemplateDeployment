export interface Command {
  readonly type: string;
  readonly label: string;
  execute(): void;
  undo(): void;
}
