// Light/dark theme manager — sets data-theme on <html>, persists to localStorage.
const KEY = 'p07-theme';
export type ThemeMode = 'light' | 'dark';

export function initTheme(): void {
  const saved = (localStorage.getItem(KEY) as ThemeMode) || 'light';
  document.documentElement.setAttribute('data-theme', saved);
}

export function getTheme(): ThemeMode {
  return (document.documentElement.getAttribute('data-theme') as ThemeMode) || 'light';
}

export function toggleTheme(): ThemeMode {
  const next: ThemeMode = getTheme() === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem(KEY, next); } catch { /* ignore */ }
  return next;
}

/** Read a CSS custom property off <html>, with a fallback. */
export function cssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** Current canvas / 3D scene background colour (hex). */
export function canvasBg(): string {
  return cssVar('--canvas-bg', '#FAFAFA');
}
