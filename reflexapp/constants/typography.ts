import { Platform } from 'react-native';

export const FontFamily = {
  regular:     Platform.select({ ios: 'System',   android: 'Roboto'     }) ?? 'System',
  medium:      Platform.select({ ios: 'System',   android: 'Roboto'     }) ?? 'System',
  semiBold:    Platform.select({ ios: 'System',   android: 'Roboto'     }) ?? 'System',
  bold:        Platform.select({ ios: 'System',   android: 'Roboto'     }) ?? 'System',
  light:       Platform.select({ ios: 'System',   android: 'Roboto'     }) ?? 'System',
} as const;

export const FontSize = {
  xs:   11,
  sm:   13,
  base: 15,
  md:   17,
  lg:   20,
  xl:   24,
  '2xl': 28,
  '3xl': 34,
  '4xl': 42,
  hero: 52,
} as const;

export const FontWeight = {
  light:    '300' as const,
  regular:  '400' as const,
  medium:   '500' as const,
  semiBold: '600' as const,
  bold:     '700' as const,
  heavy:    '800' as const,
};

export const LineHeight = {
  tight:    1.1,
  snug:     1.3,
  normal:   1.5,
  relaxed:  1.7,
  loose:    2.0,
} as const;

export const LetterSpacing = {
  tight:   -0.5,
  normal:  0,
  wide:    0.5,
  wider:   1.0,
  widest:  2.0,
} as const;

export const Typography = {
  hero: {
    fontSize:      FontSize.hero,
    fontWeight:    FontWeight.light,
    lineHeight:    FontSize.hero * LineHeight.tight,
    letterSpacing: LetterSpacing.tight,
  },
  h1: {
    fontSize:      FontSize['3xl'],
    fontWeight:    FontWeight.semiBold,
    lineHeight:    FontSize['3xl'] * LineHeight.snug,
    letterSpacing: LetterSpacing.tight,
  },
  h2: {
    fontSize:      FontSize['2xl'],
    fontWeight:    FontWeight.semiBold,
    lineHeight:    FontSize['2xl'] * LineHeight.snug,
    letterSpacing: LetterSpacing.tight,
  },
  h3: {
    fontSize:      FontSize.xl,
    fontWeight:    FontWeight.medium,
    lineHeight:    FontSize.xl * LineHeight.snug,
    letterSpacing: LetterSpacing.normal,
  },
  h4: {
    fontSize:      FontSize.lg,
    fontWeight:    FontWeight.medium,
    lineHeight:    FontSize.lg * LineHeight.normal,
    letterSpacing: LetterSpacing.normal,
  },
  body: {
    fontSize:      FontSize.base,
    fontWeight:    FontWeight.regular,
    lineHeight:    FontSize.base * LineHeight.relaxed,
    letterSpacing: LetterSpacing.normal,
  },
  bodySmall: {
    fontSize:      FontSize.sm,
    fontWeight:    FontWeight.regular,
    lineHeight:    FontSize.sm * LineHeight.relaxed,
    letterSpacing: LetterSpacing.normal,
  },
  label: {
    fontSize:      FontSize.sm,
    fontWeight:    FontWeight.medium,
    lineHeight:    FontSize.sm * LineHeight.normal,
    letterSpacing: LetterSpacing.wide,
  },
  caption: {
    fontSize:      FontSize.xs,
    fontWeight:    FontWeight.regular,
    lineHeight:    FontSize.xs * LineHeight.normal,
    letterSpacing: LetterSpacing.wide,
  },
  overline: {
    fontSize:      FontSize.xs,
    fontWeight:    FontWeight.semiBold,
    lineHeight:    FontSize.xs * LineHeight.normal,
    letterSpacing: LetterSpacing.widest,
    textTransform: 'uppercase' as const,
  },
  button: {
    fontSize:      FontSize.base,
    fontWeight:    FontWeight.semiBold,
    lineHeight:    FontSize.base * LineHeight.normal,
    letterSpacing: LetterSpacing.wide,
  },
  buttonSm: {
    fontSize:      FontSize.sm,
    fontWeight:    FontWeight.medium,
    lineHeight:    FontSize.sm * LineHeight.normal,
    letterSpacing: LetterSpacing.wide,
  },
} as const;
