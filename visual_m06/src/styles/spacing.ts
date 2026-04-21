/**
 * EduMind Spacing - 8px 网格系统
 */

export const SPACING = {
  '1': 'gap-1', '2': 'gap-2', '3': 'gap-3', '4': 'gap-4',
  '5': 'gap-5', '6': 'gap-6', '8': 'gap-8', '10': 'gap-10',
  '12': 'gap-12', '16': 'gap-16', '20': 'gap-20',
  xs: 'gap-2', sm: 'gap-3', md: 'gap-4', lg: 'gap-6', xl: 'gap-8', '2xl': 'gap-12',
  '1Px': 4, '2Px': 8, '3Px': 12, '4Px': 16, '5Px': 20, '6Px': 24,
  '8Px': 32, '10Px': 40, '12Px': 48, '16Px': 64, '20Px': 80,
} as const;

export const SPACING_UTILS = {
  padding: {
    '1': 'p-1', '2': 'p-2', '3': 'p-3', '4': 'p-4', '5': 'p-5',
    '6': 'p-6', '8': 'p-8', '10': 'p-10', '12': 'p-12',
    xs: 'p-2', sm: 'p-3', md: 'p-4', lg: 'p-6', xl: 'p-8',
  },
  paddingX: {
    '1': 'px-1', '2': 'px-2', '3': 'px-3', '4': 'px-4', '5': 'px-5',
    '6': 'px-6', '8': 'px-8',
    xs: 'px-2', sm: 'px-3', md: 'px-4', lg: 'px-6', xl: 'px-8',
  },
  paddingY: {
    '1': 'py-1', '2': 'py-2', '3': 'py-3', '4': 'py-4', '5': 'py-5',
    '6': 'py-6', '8': 'py-8',
    xs: 'py-2', sm: 'py-3', md: 'py-4', lg: 'py-6', xl: 'py-8',
  },
} as const;

export const COMPONENT_SPACING = {
  card: { padding: 'p-6', gap: 'gap-4' },
  form: { fieldGap: 'gap-4', labelGap: 'gap-3', sectionGap: 'gap-6' },
  layout: { containerPadding: 'px-6', sectionGap: 'gap-8' },
  button: { paddingX: 'px-4', paddingY: 'py-2.5', gap: 'gap-2' },
} as const;
