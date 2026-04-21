import { useHistoryStore } from './store/historyStore';

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
}

export function setupShortcuts(): void {
  document.addEventListener('keydown', handleKeyDown);
}

export function teardownShortcuts(): void {
  document.removeEventListener('keydown', handleKeyDown);
}
