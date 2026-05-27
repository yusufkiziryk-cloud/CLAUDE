/**
 * Refleks App — Color System
 * Zen wellness aesthetic: earth tones, soft creams, calming greens, deep slate
 */

export const Palette = {
  // ── Earth & Warm ─────────────────────────────────────────────────────────
  cream:       '#F5F0E8',
  creamLight:  '#FAF7F2',
  creamDark:   '#EDE5D8',
  sand:        '#D4B896',
  sandLight:   '#E8D5BF',
  amber:       '#C49A6C',

  // ── Forest & Sage ────────────────────────────────────────────────────────
  sage:        '#7C9885',
  sageDark:    '#5A7A63',
  sageLight:   '#A8C4B0',
  moss:        '#4A6741',
  mint:        '#B8D4BE',

  // ── Deep Navy & Slate ────────────────────────────────────────────────────
  navy:        '#1A1A2E',
  navyMid:     '#16213E',
  navyLight:   '#0F3460',
  slate:       '#2D3748',
  slateMid:    '#4A5568',
  slateLight:  '#718096',

  // ── Calming Blues ────────────────────────────────────────────────────────
  sky:         '#7EB8C9',
  skyLight:    '#A8D4E0',
  skyPale:     '#D4EEF5',

  // ── Glow & Accent ────────────────────────────────────────────────────────
  glow:        '#B8D4BE',
  glowWarm:    '#F0D5A0',
  glowBlue:    '#7EB8C9',
  glowPurple:  '#9B8EC4',

  // ── Neutrals ─────────────────────────────────────────────────────────────
  white:       '#FFFFFF',
  offWhite:    '#F8F5F0',
  black:       '#000000',
  charcoal:    '#1C1C1E',
  graphite:    '#3A3A3C',

  // ── Status ───────────────────────────────────────────────────────────────
  success:     '#52C77A',
  warning:     '#F5A623',
  error:       '#E05252',
  info:        '#5B9BD5',

  // ── Transparent ──────────────────────────────────────────────────────────
  transparent: 'transparent',
} as const;

export const Colors = {
  dark: {
    background:        Palette.navy,
    backgroundSecond:  Palette.navyMid,
    backgroundCard:    'rgba(255,255,255,0.06)',
    backgroundGlass:   'rgba(255,255,255,0.08)',
    surface:           Palette.navyMid,

    text:              Palette.cream,
    textSecondary:     Palette.slateLight,
    textMuted:         Palette.slateMid,
    textAccent:        Palette.sageLight,
    textWarning:       Palette.warning,

    primary:           Palette.sage,
    primaryLight:      Palette.sageLight,
    primaryDark:       Palette.sageDark,

    accent:            Palette.sky,
    accentLight:       Palette.skyLight,

    border:            'rgba(255,255,255,0.10)',
    borderStrong:      'rgba(255,255,255,0.20)',

    tabBar:            Palette.navyMid,
    tabBarBorder:      'rgba(255,255,255,0.08)',
    tabActive:         Palette.sage,
    tabInactive:       Palette.slateMid,

    glow:              Palette.sage,
    glowOpacity:       'rgba(124,152,133,0.35)',

    gradientTop:       Palette.navy,
    gradientMid:       Palette.navyMid,
    gradientBottom:    '#0D0D1A',

    chartLine:         Palette.sage,
    chartFill:         'rgba(124,152,133,0.20)',
  },
  light: {
    background:        Palette.creamLight,
    backgroundSecond:  Palette.cream,
    backgroundCard:    'rgba(255,255,255,0.85)',
    backgroundGlass:   'rgba(255,255,255,0.60)',
    surface:           Palette.white,

    text:              Palette.navy,
    textSecondary:     Palette.slate,
    textMuted:         Palette.slateMid,
    textAccent:        Palette.sageDark,
    textWarning:       Palette.warning,

    primary:           Palette.sageDark,
    primaryLight:      Palette.sage,
    primaryDark:       Palette.moss,

    accent:            Palette.sky,
    accentLight:       Palette.skyPale,

    border:            'rgba(0,0,0,0.08)',
    borderStrong:      'rgba(0,0,0,0.16)',

    tabBar:            Palette.white,
    tabBarBorder:      'rgba(0,0,0,0.06)',
    tabActive:         Palette.sageDark,
    tabInactive:       Palette.slateMid,

    glow:              Palette.sage,
    glowOpacity:       'rgba(124,152,133,0.20)',

    gradientTop:       Palette.creamLight,
    gradientMid:       Palette.cream,
    gradientBottom:    Palette.creamDark,

    chartLine:         Palette.sageDark,
    chartFill:         'rgba(90,122,99,0.15)',
  },
} as const;

// Zone color map — each organ system has its own color
export const ZoneColors = {
  brain:      { base: '#9B8EC4', glow: 'rgba(155,142,196,0.5)' },
  sinus:      { base: '#7EB8C9', glow: 'rgba(126,184,201,0.5)' },
  neck:       { base: '#A8C4B0', glow: 'rgba(168,196,176,0.5)' },
  spine:      { base: '#C4A882', glow: 'rgba(196,168,130,0.5)' },
  lung:       { base: '#7EB8C9', glow: 'rgba(126,184,201,0.5)' },
  heart:      { base: '#E08080', glow: 'rgba(224,128,128,0.5)' },
  stomach:    { base: '#C49A6C', glow: 'rgba(196,154,108,0.5)' },
  liver:      { base: '#D4956C', glow: 'rgba(212,149,108,0.5)' },
  kidney:     { base: '#7C9885', glow: 'rgba(124,152,133,0.5)' },
  intestine:  { base: '#A8C4B0', glow: 'rgba(168,196,176,0.5)' },
  pituitary:  { base: '#B8A8E0', glow: 'rgba(184,168,224,0.5)' },
  sciatic:    { base: '#C4B882', glow: 'rgba(196,184,130,0.5)' },
  uterus:     { base: '#E0A8B8', glow: 'rgba(224,168,184,0.5)' },
  ear:        { base: '#80C4C4', glow: 'rgba(128,196,196,0.5)' },
  shenmen:    { base: '#9B8EC4', glow: 'rgba(155,142,196,0.6)' },
} as const;

export type ColorScheme = keyof typeof Colors;
export type AppColors = typeof Colors.dark;
