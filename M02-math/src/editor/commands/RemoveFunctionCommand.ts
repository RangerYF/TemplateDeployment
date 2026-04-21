import type { FunctionEntry } from '@/types';
import type { Command } from '@/editor/commands/types';
import { useFunctionStore } from '@/editor/store/functionStore';

export class RemoveFunctionCommand implements Command {
  readonly type  = 'remove-function';
  readonly label: string;
  private entry: FunctionEntry;

  constructor(entry: FunctionEntry) {
    this.entry = { ...entry }; // snapshot for undo
    this.label = `删除函数 ${entry.label}`;
  }

  execute(): void { useFunctionStore.getState().removeFunction(this.entry.id); }
  undo():    void { useFunctionStore.getState().addFunction(this.entry); }
}
