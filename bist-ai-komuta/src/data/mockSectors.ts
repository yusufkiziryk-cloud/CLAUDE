import { Sector } from '../types';

export const SECTORS: Sector[] = [
  {
    name: 'Bankacılık', code: 'XBANK',
    momentumScore: 62, riskScore: 45,
    macroSensitivity: 'high',
    leaders: ['GARAN', 'AKBNK', 'ISCTR'],
    laggards: ['VAKBN', 'HALKB'],
    changePercent: 1.84,
  },
  {
    name: 'Holding', code: 'XHOLD',
    momentumScore: 58, riskScore: 42,
    macroSensitivity: 'medium',
    leaders: ['KCHOL', 'SAHOL'],
    laggards: ['DOHOL'],
    changePercent: 1.42,
  },
  {
    name: 'Enerji', code: 'XENER',
    momentumScore: 65, riskScore: 48,
    macroSensitivity: 'high',
    leaders: ['TUPRS', 'AYGAZ'],
    laggards: ['AKENR'],
    changePercent: 1.62,
  },
  {
    name: 'Sanayi', code: 'XUSIN',
    momentumScore: 44, riskScore: 58,
    macroSensitivity: 'medium',
    leaders: ['EREGL', 'ARCLK'],
    laggards: ['SISE', 'VESBE'],
    changePercent: -0.82,
  },
  {
    name: 'Savunma', code: 'XSAVUNMA',
    momentumScore: 78, riskScore: 28,
    macroSensitivity: 'low',
    leaders: ['ASELS', 'ROKET'],
    laggards: [],
    changePercent: 2.14,
  },
  {
    name: 'Otomotiv', code: 'XOTOM',
    momentumScore: 55, riskScore: 52,
    macroSensitivity: 'high',
    leaders: ['TOASO', 'FROTO'],
    laggards: ['OTKAR'],
    changePercent: 0.84,
  },
  {
    name: 'Perakende', code: 'XPERE',
    momentumScore: 70, riskScore: 35,
    macroSensitivity: 'medium',
    leaders: ['BIMAS', 'MGROS'],
    laggards: ['SOKM'],
    changePercent: 1.52,
  },
  {
    name: 'Telekom', code: 'XTELK',
    momentumScore: 52, riskScore: 42,
    macroSensitivity: 'low',
    leaders: ['TCELL', 'TTKOM'],
    laggards: [],
    changePercent: 0.48,
  },
  {
    name: 'Havacılık', code: 'XHAVA',
    momentumScore: 68, riskScore: 46,
    macroSensitivity: 'high',
    leaders: ['THYAO', 'PGSUS'],
    laggards: [],
    changePercent: 2.06,
  },
  {
    name: 'GYO', code: 'XGYO',
    momentumScore: 48, riskScore: 55,
    macroSensitivity: 'high',
    leaders: ['EMLAK', 'ISGYO'],
    laggards: ['OZGYO'],
    changePercent: -0.42,
  },
  {
    name: 'Teknoloji', code: 'XBLSM',
    momentumScore: 72, riskScore: 38,
    macroSensitivity: 'low',
    leaders: ['LOGO', 'INDES'],
    laggards: [],
    changePercent: 1.92,
  },
];

export const getTopSectors = (n = 3): Sector[] =>
  [...SECTORS].sort((a, b) => b.momentumScore - a.momentumScore).slice(0, n);

export const getWeakSectors = (n = 3): Sector[] =>
  [...SECTORS].sort((a, b) => a.momentumScore - b.momentumScore).slice(0, n);
