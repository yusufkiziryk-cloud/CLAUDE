export const Spacing = {
  '0':   0,
  '1':   4,
  '2':   8,
  '3':   12,
  '4':   16,
  '5':   20,
  '6':   24,
  '7':   28,
  '8':   32,
  '9':   36,
  '10':  40,
  '12':  48,
  '14':  56,
  '16':  64,
  '20':  80,
  '24':  96,
  '32': 128,
} as const;

export const BorderRadius = {
  sm:    8,
  md:    12,
  lg:    16,
  xl:    20,
  '2xl': 24,
  '3xl': 32,
  full:  9999,
} as const;

export const Shadow = {
  sm: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius:  4,
    elevation:     2,
  },
  md: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius:  8,
    elevation:     4,
  },
  lg: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 8 },
    shadowRadius:  16,
    shadowOpacity: 0.16,
    elevation:     8,
  },
  glow: (color: string) => ({
    shadowColor:   color,
    shadowOffset:  { width: 0, height: 0 },
    shadowRadius:  12,
    shadowOpacity: 0.6,
    elevation:     6,
  }),
} as const;

export const Layout = {
  screenPaddingH: Spacing['5'],
  screenPaddingV: Spacing['4'],
  cardGap:        Spacing['3'],
  sectionGap:     Spacing['6'],
} as const;
