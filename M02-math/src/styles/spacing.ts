/**
 * Design System — Spacing Scale (8px grid)
 * All values are Tailwind class-name strings unless suffixed with Px.
 */

export const SPACING = {
  '1': 'gap-1',   // 4px
  '2': 'gap-2',   // 8px
  '3': 'gap-3',   // 12px
  '4': 'gap-4',   // 16px
  '5': 'gap-5',   // 20px
  '6': 'gap-6',   // 24px
  '8': 'gap-8',   // 32px
  '10':'gap-10',  // 40px
  '12':'gap-12',  // 48px
  '16':'gap-16',  // 64px
  '20':'gap-20',  // 80px

  // Semantic aliases
  xs:  'gap-2',   // 8px
  sm:  'gap-3',   // 12px
  md:  'gap-4',   // 16px
  lg:  'gap-6',   // 24px
  xl:  'gap-8',   // 32px
  '2xl':'gap-12', // 48px

  // Pixel values (for inline styles / calculations)
  '1Px':  4,
  '2Px':  8,
  '3Px':  12,
  '4Px':  16,
  '5Px':  20,
  '6Px':  24,
  '8Px':  32,
  '10Px': 40,
  '12Px': 48,
  '16Px': 64,
  '20Px': 80,

  xsPx: 8,
  smPx: 12,
  mdPx: 16,
  lgPx: 24,
  xlPx: 32,
  '2xlPx': 48,
} as const;

export const SPACING_UTILS = {
  padding: {
    '1': 'p-1', '2': 'p-2', '3': 'p-3', '4': 'p-4', '5': 'p-5',
    '6': 'p-6', '8': 'p-8', '10': 'p-10', '12': 'p-12', '16': 'p-16', '20': 'p-20',
    xs: 'p-2', sm: 'p-3', md: 'p-4', lg: 'p-6', xl: 'p-8', '2xl': 'p-12',
  },
  paddingX: {
    '1': 'px-1', '2': 'px-2', '3': 'px-3', '4': 'px-4', '5': 'px-5',
    '6': 'px-6', '8': 'px-8', '10': 'px-10', '12': 'px-12', '16': 'px-16', '20': 'px-20',
    xs: 'px-2', sm: 'px-3', md: 'px-4', lg: 'px-6', xl: 'px-8', '2xl': 'px-12',
  },
  paddingY: {
    '1': 'py-1', '2': 'py-2', '3': 'py-3', '4': 'py-4', '5': 'py-5',
    '6': 'py-6', '8': 'py-8', '10': 'py-10', '12': 'py-12', '16': 'py-16', '20': 'py-20',
    xs: 'py-2', sm: 'py-3', md: 'py-4', lg: 'py-6', xl: 'py-8', '2xl': 'py-12',
  },
  margin: {
    '1': 'm-1', '2': 'm-2', '3': 'm-3', '4': 'm-4', '5': 'm-5',
    '6': 'm-6', '8': 'm-8', '10': 'm-10', '12': 'm-12', '16': 'm-16', '20': 'm-20',
    xs: 'm-2', sm: 'm-3', md: 'm-4', lg: 'm-6', xl: 'm-8', '2xl': 'm-12',
  },
  marginX: {
    '1': 'mx-1', '2': 'mx-2', '3': 'mx-3', '4': 'mx-4', '5': 'mx-5',
    '6': 'mx-6', '8': 'mx-8', '10': 'mx-10', '12': 'mx-12', '16': 'mx-16', '20': 'mx-20',
    xs: 'mx-2', sm: 'mx-3', md: 'mx-4', lg: 'mx-6', xl: 'mx-8', '2xl': 'mx-12',
  },
  marginY: {
    '1': 'my-1', '2': 'my-2', '3': 'my-3', '4': 'my-4', '5': 'my-5',
    '6': 'my-6', '8': 'my-8', '10': 'my-10', '12': 'my-12', '16': 'my-16', '20': 'my-20',
    xs: 'my-2', sm: 'my-3', md: 'my-4', lg: 'my-6', xl: 'my-8', '2xl': 'my-12',
  },
  spaceY: {
    '1': 'space-y-1', '2': 'space-y-2', '3': 'space-y-3', '4': 'space-y-4',
    '5': 'space-y-5', '6': 'space-y-6', '8': 'space-y-8', '10': 'space-y-10', '12': 'space-y-12',
    xs: 'space-y-2', sm: 'space-y-3', md: 'space-y-4', lg: 'space-y-6', xl: 'space-y-8', '2xl': 'space-y-12',
  },
  spaceX: {
    '1': 'space-x-1', '2': 'space-x-2', '3': 'space-x-3', '4': 'space-x-4',
    '5': 'space-x-5', '6': 'space-x-6', '8': 'space-x-8', '10': 'space-x-10', '12': 'space-x-12',
    xs: 'space-x-2', sm: 'space-x-3', md: 'space-x-4', lg: 'space-x-6', xl: 'space-x-8', '2xl': 'space-x-12',
  },
} as const;

export const COMPONENT_SPACING = {
  card: {
    padding: SPACING_UTILS.padding.lg,  // p-6  24px
    gap:     SPACING.md,                // gap-4 16px
  },
  form: {
    fieldGap:   SPACING.md,            // gap-4  16px between fields
    labelGap:   SPACING.sm,            // gap-3  12px between label and input
    sectionGap: SPACING.lg,            // gap-6  24px between sections
  },
  layout: {
    containerPadding: SPACING_UTILS.paddingX.lg, // px-6 24px
    sectionGap:       SPACING.xl,               // gap-8 32px
  },
  button: {
    paddingX: SPACING_UTILS.paddingX.md, // px-4 16px
    paddingY: 'py-2.5',                  // 10px
    gap:      SPACING.xs,               // gap-2 8px
  },
} as const;

export type SpacingKey = keyof typeof SPACING;
