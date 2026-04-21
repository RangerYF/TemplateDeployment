import type { FunctionEntry } from '@/types';
import type { Command } from '@/editor/commands/types';
import { useFunctionStore } from '@/editor/store/functionStore';

type FunctionPatch = Partial<Pick<FunctionEntry,
  'exprStr' | 'transform' | 'color' | 'label' | 'segments' | 'mode' | 'templateId' | 'namedParams'
>>;

export class UpdateFunctionParamCommand implements Command {
  readonly type  = 'update-function-param';
  readonly label: string;
  private id:     string;
  private before: FunctionPatch;
  private after:  FunctionPatch;

  constructor(id: string, before: FunctionPatch, after: FunctionPatch, label = '修改函数参数') {
    this.label  = label;
    this.id     = id;
    this.before = { ...before };
    this.after  = { ...after };
  }

  execute(): void { useFunctionStore.getState().updateFunction(this.id, this.after); }
  undo():    void { useFunctionStore.getState().updateFunction(this.id, this.before); }
}
