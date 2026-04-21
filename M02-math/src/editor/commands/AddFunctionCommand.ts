import type { FunctionEntry } from '@/types';
import type { Command } from '@/editor/commands/types';
import { useFunctionStore } from '@/editor/store/functionStore';

export class AddFunctionCommand implements Command {
  readonly type  = 'add-function';
  readonly label: string;
  private entry: FunctionEntry;

  constructor(entry: FunctionEntry) {
    this.entry = entry;
    this.label = `添加函数 ${entry.label}`;
  }

  execute(): void { useFunctionStore.getState().addFunction(this.entry); }
  undo():    void { useFunctionStore.getState().removeFunction(this.entry.id); }
}
