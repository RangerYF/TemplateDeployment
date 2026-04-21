import type { Editor } from '@/editor/core/Editor';
import type { ToolEvent } from '@/editor/tools/types';

/**
 * Apply standard scroll-wheel zoom at the pointer position.
 * Shared by all tools so every mode supports zooming.
 */
export function applyWheelZoom(
  editor: Editor | null,
  e: ToolEvent & { deltaY: number },
): void {
  if (!editor) return;
  const factor = e.deltaY > 0 ? 1.1 : 1 / 1.1;
  editor.setViewport(
    editor.getViewport().zoomAt(e.mathX, e.mathY, factor),
  );
}
