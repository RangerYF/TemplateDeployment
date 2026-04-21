import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { registerTemplateBridge } from './templateBridge';

registerTemplateBridge();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// ── Dev console helpers ────────────────────────────────────────────────────────
// Usage:
//   createEntity('ellipse',   { a: 5, b: 3, cx: 0, cy: 0 })
//   createEntity('hyperbola', { a: 3, b: 4, cx: 0, cy: 0 })
//   createEntity('parabola',  { p: 2,       cx: 0, cy: 0 })
//   createEntity('circle',    { r: 4,       cx: 0, cy: 0 })
//   m03.store.getState().entities          // inspect all entities
//   m03.store.getState().resetViewport?.() // not available — use dblclick
if (import.meta.env.DEV) {
  Promise.all([
    import('@/editor/entities/types'),
    import('@/editor/store/entityStore'),
    import('@/types'),
  ]).then(([entities, storeModule, types]) => {
    const { createEntity } = entities;
    const { useEntityStore } = storeModule;
    const { ENTITY_COLORS } = types;

    // Global createEntity: creates + immediately adds to store
    (window as unknown as Record<string, unknown>).createEntity = (
      type: string,
      params: Record<string, number>,
    ) => {
      const store    = useEntityStore.getState();
      const colorIdx = store.entities.length % ENTITY_COLORS.length;
      const entity   = createEntity(
        type as Parameters<typeof createEntity>[0],
        params as unknown as Parameters<typeof createEntity>[1],
        { color: ENTITY_COLORS[colorIdx] },
      );
      store.addEntity(entity);
      console.log('[m03] added entity', entity.type, entity.id);
      return entity;
    };

    // Global store reference for inspection
    (window as unknown as Record<string, unknown>).m03 = { store: useEntityStore };
  });
}
