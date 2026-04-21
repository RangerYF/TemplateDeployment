import { useEffect } from 'react';

let initialized = false;

export function initCrystalViewer(): void {
  if (initialized) return;
  initialized = true;
  // default crystal already set in store
}

export function useCrystalViewerInit(): void {
  useEffect(() => {
    initCrystalViewer();

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
