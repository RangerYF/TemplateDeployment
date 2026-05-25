import type { CSSProperties } from 'react';
import type { ViewportType } from '@/core/types';
import { P08_FIELD_BUILDER_SCENE_ID } from '@/domains/em/builder/p08-field-builder-scene';
import {
  getP08ModuleKeyByPresetId,
  type P08ModuleKey,
} from '@/shell/pages/p08PresetCatalog';
import { COLORS } from '@/styles/tokens';

type P08ThemeKey = P08ModuleKey | 'builder' | 'generic';

export interface P08SceneTheme {
  key: P08ThemeKey;
  marker: string;
  accent: string;
  accentStrong: string;
  accentSoft: string;
  accentTint: string;
  border: string;
  stageBase: string;
}

const THEME_BY_KEY: Record<P08ThemeKey, P08SceneTheme> = {
  electrostatic: {
    key: 'electrostatic',
    marker: 'E',
    accent: '#1D78D6',
    accentStrong: '#124E8C',
    accentSoft: '#EEF6FF',
    accentTint: '#DCEBFF',
    border: '#C8DCF7',
    stageBase: '#F7FBFF',
  },
  'particle-electric': {
    key: 'particle-electric',
    marker: 'qE',
    accent: '#D97706',
    accentStrong: '#9A4D00',
    accentSoft: '#FFF7E8',
    accentTint: '#FCE4BE',
    border: '#F2D7A8',
    stageBase: '#FFFBF3',
  },
  magnetostatic: {
    key: 'magnetostatic',
    marker: 'B',
    accent: '#00A870',
    accentStrong: '#0F7A56',
    accentSoft: '#EDFDF6',
    accentTint: '#D7F7E7',
    border: '#BFEBD6',
    stageBase: '#F7FFFB',
  },
  'particle-magnetic': {
    key: 'particle-magnetic',
    marker: 'qvB',
    accent: '#8B5CF6',
    accentStrong: '#5B34B3',
    accentSoft: '#F6F0FF',
    accentTint: '#E6DBFF',
    border: '#D9CCFF',
    stageBase: '#FBF9FF',
  },
  'combined-field': {
    key: 'combined-field',
    marker: 'E+B',
    accent: '#E85D04',
    accentStrong: '#9A3412',
    accentSoft: '#FFF2E8',
    accentTint: '#FFDCC7',
    border: '#F3CEB8',
    stageBase: '#FFF9F5',
  },
  builder: {
    key: 'builder',
    marker: 'DIY',
    accent: '#0F766E',
    accentStrong: '#115E59',
    accentSoft: '#ECFDF5',
    accentTint: '#CCFBF1',
    border: '#B7E8DF',
    stageBase: '#F4FFFB',
  },
  generic: {
    key: 'generic',
    marker: 'P-08',
    accent: COLORS.primary,
    accentStrong: COLORS.primaryHover,
    accentSoft: COLORS.primaryLight,
    accentTint: '#D5F5E6',
    border: '#BFEBD6',
    stageBase: '#F8FFFB',
  },
};

export function getP08SceneTheme(presetId?: string): P08SceneTheme {
  if (presetId === P08_FIELD_BUILDER_SCENE_ID) {
    return THEME_BY_KEY.builder;
  }

  const moduleKey = presetId ? getP08ModuleKeyByPresetId(presetId) : undefined;
  return moduleKey ? THEME_BY_KEY[moduleKey] : THEME_BY_KEY.generic;
}

export function getP08PageBackground(presetId?: string): CSSProperties {
  const theme = getP08SceneTheme(presetId);
  return {
    backgroundColor: COLORS.bgPage,
    backgroundImage: [
      `radial-gradient(circle at 8% 10%, ${toAlpha(theme.accent, 0.08)} 0%, rgba(255,255,255,0) 26%)`,
      `radial-gradient(circle at 92% 12%, ${toAlpha(theme.accentStrong, 0.09)} 0%, rgba(255,255,255,0) 22%)`,
      `linear-gradient(180deg, #FCFDFE 0%, ${theme.stageBase} 100%)`,
    ].join(', '),
  };
}

export function getP08CanvasBackground(
  presetId: string,
  viewport: ViewportType,
): CSSProperties {
  const theme = getP08SceneTheme(presetId);
  const viewportGlow =
    viewport === 'motion'
      ? 'rgba(255, 243, 224, 0.95)'
      : viewport === 'force'
        ? 'rgba(244, 247, 255, 0.95)'
        : viewport === 'field'
          ? 'rgba(241, 248, 255, 0.96)'
          : 'rgba(248, 250, 252, 0.96)';

  return {
    backgroundColor: theme.stageBase,
    backgroundImage: [
      `radial-gradient(circle at 16% 16%, ${toAlpha(theme.accent, 0.16)} 0%, rgba(255,255,255,0) 30%)`,
      `radial-gradient(circle at 82% 14%, ${viewportGlow} 0%, rgba(255,255,255,0) 24%)`,
      `radial-gradient(circle at 50% 100%, ${toAlpha(theme.accentStrong, 0.08)} 0%, rgba(255,255,255,0) 36%)`,
      `linear-gradient(180deg, #FFFFFF 0%, ${theme.stageBase} 100%)`,
    ].join(', '),
  };
}

export function getP08PanelSurfaceStyle(presetId?: string): CSSProperties {
  const theme = getP08SceneTheme(presetId);
  return {
    borderRadius: 28,
    border: `1px solid ${theme.border}`,
    background: `linear-gradient(180deg, rgba(255,255,255,0.98) 0%, ${theme.accentSoft} 100%)`,
    boxShadow: `0 24px 56px ${toAlpha(theme.accentStrong, 0.12)}`,
    overflow: 'hidden',
  };
}

export function getP08CanvasShellStyle(presetId?: string): CSSProperties {
  const theme = getP08SceneTheme(presetId);
  return {
    borderRadius: 32,
    border: `1px solid ${theme.border}`,
    background: `linear-gradient(180deg, rgba(255,255,255,0.98) 0%, ${toAlpha(theme.accentSoft, 0.9)} 100%)`,
    boxShadow: `0 28px 64px ${toAlpha(theme.accentStrong, 0.14)}`,
  };
}

export function getP08FloatingCardStyle(presetId?: string): CSSProperties {
  const theme = getP08SceneTheme(presetId);
  return {
    border: `1px solid ${theme.border}`,
    background: `linear-gradient(180deg, rgba(255,255,255,0.97) 0%, ${toAlpha(theme.accentSoft, 0.92)} 100%)`,
    boxShadow: `0 18px 42px ${toAlpha(theme.accentStrong, 0.15)}`,
    backdropFilter: 'blur(12px)',
  };
}

export function toAlpha(hexColor: string, alpha: number): string {
  const hex = hexColor.replace('#', '');
  const safeAlpha = Math.max(0, Math.min(alpha, 1));

  if (hex.length !== 6) {
    return `rgba(0, 0, 0, ${safeAlpha})`;
  }

  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${safeAlpha})`;
}
