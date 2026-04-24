// Visual theme tokens. Applied by setting data-theme on <html>.
// All three themes keep the same structural layout — only colors change.

type ThemeName = 'light' | 'dark' | 'blueprint';
type ThemeTokens = Record<string, string>;

const THEMES: Record<ThemeName, ThemeTokens> = {
  light: {
    '--bg': 'oklch(0.975 0.006 210)',
    '--panel': 'oklch(1 0 0 / 0.70)',
    '--panel-2': 'oklch(0.988 0.004 210 / 0.86)',
    '--border': 'oklch(0.88 0.01 220 / 0.7)',
    '--border-strong': 'oklch(0.80 0.015 220 / 0.82)',
    '--ink': 'oklch(0.22 0.01 250)',
    '--ink-2': 'oklch(0.46 0.012 250)',
    '--ink-3': 'oklch(0.63 0.01 250)',
    '--accent': 'oklch(0.66 0.16 156)',
    '--accent-strong': 'oklch(0.56 0.17 156)',
    '--accent-soft': 'oklch(0.95 0.04 160 / 0.85)',
    '--grid': 'oklch(0.93 0.004 230 / 0.62)',
    '--grid-strong': 'oklch(0.88 0.006 230 / 0.78)',
    '--glass-fill': 'oklch(0.94 0.02 185 / 0.26)',
    '--glass-stroke': 'oklch(0.55 0.09 185 / 0.82)',
    '--normal-line': 'oklch(0.62 0.01 250 / 0.82)',
    '--screen': 'oklch(0.97 0.004 210 / 0.78)',
    '--stage-bg': 'oklch(0.995 0.002 220 / 0.94)',
    '--chip-bg': 'oklch(0.98 0.003 220 / 0.82)',
    '--shadow': '0 10px 28px oklch(0.38 0.02 240 / 0.08), 0 24px 48px oklch(0.38 0.02 240 / 0.06)',
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
    '--bg': 'oklch(0.965 0.014 175)',
    '--panel': 'oklch(0.99 0.008 175 / 0.76)',
    '--panel-2': 'oklch(0.975 0.012 175 / 0.88)',
    '--border': 'oklch(0.88 0.02 175 / 0.7)',
    '--border-strong': 'oklch(0.80 0.024 175 / 0.82)',
    '--ink': 'oklch(0.22 0.03 165)',
    '--ink-2': 'oklch(0.45 0.025 165)',
    '--ink-3': 'oklch(0.62 0.02 165)',
    '--accent': 'oklch(0.52 0.18 150)',
    '--accent-strong': 'oklch(0.42 0.18 150)',
    '--accent-soft': 'oklch(0.93 0.05 155 / 0.85)',
    '--grid': 'oklch(0.92 0.012 175 / 0.64)',
    '--grid-strong': 'oklch(0.86 0.016 175 / 0.78)',
    '--glass-fill': 'oklch(0.90 0.06 175 / 0.30)',
    '--glass-stroke': 'oklch(0.48 0.14 165 / 0.80)',
    '--normal-line': 'oklch(0.58 0.02 165 / 0.82)',
    '--screen': 'oklch(0.96 0.012 175 / 0.80)',
    '--stage-bg': 'oklch(0.988 0.006 175 / 0.94)',
    '--chip-bg': 'oklch(0.95 0.012 175 / 0.82)',
    '--shadow': '0 10px 26px oklch(0.30 0.08 165 / 0.10), 0 24px 46px oklch(0.30 0.08 165 / 0.08)',
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
