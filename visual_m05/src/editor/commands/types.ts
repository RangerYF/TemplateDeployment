export interface Command {
  type: string;
  label: string;
  execute(): void;
  undo(): void;
}
