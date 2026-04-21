import { useHistoryStore } from './store/historyStore';
import { useToolStore } from './store/toolStore';
import { useSelectionStore } from './store/selectionStore';

function handleKeyDown(e: KeyboardEvent): void {
  const isMod = e.metaKey || e.ctrlKey;

  // Ctrl+Z / Cmd+Z → Undo
  if (isMod && !e.shiftKey && e.key === 'z') {
    e.preventDefault();
    useHistoryStore.getState().undo();
    return;
  }

  // Ctrl+Y / Cmd+Shift+Z → Redo
  if ((isMod && e.key === 'y') || (isMod && e.shiftKey && e.key === 'z')) {
    e.preventDefault();
    useHistoryStore.getState().redo();
    return;
  }

  // Escape → 回到 SelectTool + 清除选中
  if (e.key === 'Escape') {
    e.preventDefault();
    // 先让当前 tool 处理 Escape（如重置内部状态）
    const currentTool = useToolStore.getState().getActiveTool();
    if (currentTool?.onKeyDown) {
      currentTool.onKeyDown(e);
    }
    useToolStore.getState().setActiveTool('select');
    useSelectionStore.getState().clear();
    return;
  }

  // 其他按键 → 转发到活跃 Tool 的 onKeyDown
  const activeTool = useToolStore.getState().getActiveTool();
  if (activeTool?.onKeyDown) {
    activeTool.onKeyDown(e);
  }
}

export function setupShortcuts(): void {
  document.addEventListener('keydown', handleKeyDown);
}

export function teardownShortcuts(): void {
  document.removeEventListener('keydown', handleKeyDown);
}
