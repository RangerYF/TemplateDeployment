// Visual theme tokens. Applied by setting data-theme on <html>.
// All three themes keep the same structural layout — only colors change.

type ThemeName = 'light' | 'dark' | 'blueprint';
type ThemeTokens = Record<string, string>;

const THEMES: Record<ThemeName, ThemeTokens> = {
  light: {
    '--bg': 'oklch(0.985 0.002 150)',
    '--panel': 'oklch(1 0 0)',
    '--panel-2': 'oklch(0.98 0.003 150)',
    '--border': 'oklch(0.93 0.005 150)',
    '--border-strong': 'oklch(0.86 0.01 150)',
    '--ink': 'oklch(0.18 0.01 250)',
    '--ink-2': 'oklch(0.48 0.01 250)',
    '--ink-3': 'oklch(0.65 0.008 250)',
    '--accent': 'oklch(0.62 0.16 150)',
    '--accent-strong': 'oklch(0.52 0.17 150)',
    '--accent-soft': 'oklch(0.95 0.04 150)',
    '--grid': 'oklch(0.965 0.003 150)',
    '--grid-strong': 'oklch(0.93 0.005 150)',
    '--glass-fill': 'oklch(0.93 0.04 150 / 0.35)',
    '--glass-stroke': 'oklch(0.62 0.12 150)',
    '--normal-line': 'oklch(0.70 0.01 250)',
    '--screen': 'oklch(0.96 0.004 150)',
    '--stage-bg': 'oklch(0.995 0.002 150)',
    '--chip-bg': 'oklch(0.97 0.004 150)',
    '--shadow': '0 1px 2px oklch(0 0 0 / 0.04), 0 4px 16px oklch(0.5 0.08 150 / 0.06)',
    '--pattern-bg': 'oklch(0.10 0.008 250)',
  },
  dark: {
    '--bg': 'oklch(0.15 0.008 250)',
    '--panel': 'oklch(0.20 0.008 250)',
    '--panel-2': 'oklch(0.17 0.008 250)',
    '--border': 'oklch(0.26 0.008 250)',
    '--border-strong': 'oklch(0.36 0.01 250)',
    '--ink': 'oklch(0.96 0.005 250)',
    '--ink-2': 'oklch(0.72 0.008 250)',
    '--ink-3': 'oklch(0.55 0.008 250)',
    '--accent': 'oklch(0.72 0.17 150)',
    '--accent-strong': 'oklch(0.82 0.17 150)',
    '--accent-soft': 'oklch(0.28 0.08 150)',
    '--grid': 'oklch(0.22 0.008 250)',
    '--grid-strong': 'oklch(0.28 0.008 250)',
    '--glass-fill': 'oklch(0.50 0.10 150 / 0.18)',
    '--glass-stroke': 'oklch(0.72 0.14 150)',
    '--normal-line': 'oklch(0.60 0.008 250)',
    '--screen': 'oklch(0.22 0.008 250)',
    '--stage-bg': 'oklch(0.12 0.008 250)',
    '--chip-bg': 'oklch(0.24 0.008 250)',
    '--shadow': '0 1px 2px oklch(0 0 0 / 0.3), 0 4px 16px oklch(0 0 0 / 0.3)',
    '--pattern-bg': 'oklch(0.06 0.008 250)',
  },
  blueprint: {
    '--bg': 'oklch(0.96 0.018 150)',
    '--panel': 'oklch(0.99 0.008 150)',
    '--panel-2': 'oklch(0.97 0.014 150)',
    '--border': 'oklch(0.90 0.02 150)',
    '--border-strong': 'oklch(0.82 0.025 150)',
    '--ink': 'oklch(0.22 0.03 150)',
    '--ink-2': 'oklch(0.45 0.025 150)',
    '--ink-3': 'oklch(0.62 0.02 150)',
    '--accent': 'oklch(0.52 0.18 150)',
    '--accent-strong': 'oklch(0.42 0.18 150)',
    '--accent-soft': 'oklch(0.92 0.05 150)',
    '--grid': 'oklch(0.94 0.015 150)',
    '--grid-strong': 'oklch(0.88 0.02 150)',
    '--glass-fill': 'oklch(0.88 0.08 150 / 0.4)',
    '--glass-stroke': 'oklch(0.52 0.16 150)',
    '--normal-line': 'oklch(0.60 0.02 150)',
    '--screen': 'oklch(0.95 0.015 150)',
    '--stage-bg': 'oklch(0.985 0.008 150)',
    '--chip-bg': 'oklch(0.95 0.015 150)',
    '--shadow': '0 1px 2px oklch(0.3 0.08 150 / 0.08), 0 4px 16px oklch(0.3 0.08 150 / 0.08)',
    '--pattern-bg': 'oklch(0.10 0.015 150)',
  },
};

function applyTheme(name: ThemeName): void {
  const theme: ThemeTokens = THEMES[name] || THEMES.light;
  const root = document.documentElement;
  for (const [k, v] of Object.entries(theme)) {
    root.style.setProperty(k, v);
  }
  root.dataset.theme = name;
}

// Wavelength (nm) → CSS color approximating visible spectrum.
function wavelengthToColor(wl: number): string {
  let r = 0, g = 0, b = 0;
  if (wl >= 380 && wl < 440)      { r = -(wl - 440) / 60; g = 0; b = 1; }
  else if (wl >= 440 && wl < 490) { r = 0; g = (wl - 440) / 50; b = 1; }
  else if (wl >= 490 && wl < 510) { r = 0; g = 1; b = -(wl - 510) / 20; }
  else if (wl >= 510 && wl < 580) { r = (wl - 510) / 70; g = 1; b = 0; }
  else if (wl >= 580 && wl < 645) { r = 1; g = -(wl - 645) / 65; b = 0; }
  else if (wl >= 645 && wl <= 780){ r = 1; g = 0; b = 0; }
  let f = 1;
  if (wl > 700) f = 0.3 + 0.7 * (780 - wl) / 80;
  else if (wl < 420) f = 0.3 + 0.7 * (wl - 380) / 40;
  const to255 = (c: number): number => Math.round(255 * Math.pow(Math.max(0, c) * f, 0.8));
  return `rgb(${to255(r)}, ${to255(g)}, ${to255(b)})`;
}

Object.assign(window, { applyTheme, wavelengthToColor, THEMES });

export {};
