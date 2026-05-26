export interface Stock {
  code: string;
  name: string;
  sector: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  high52w: number;
  low52w: number;
  // Fundamentals
  pe: number | null;
  pbv: number | null;
  evEbitda: number | null;
  roe: number | null;
  debtEquity: number | null;
  revenueGrowth: number | null;
  netIncomeGrowth: number | null;
  // Technicals
  rsi: number;
  macd: number;
  macdSignal: number;
  ema20: number;
  ema50: number;
  ema200: number;
  support: number;
  resistance: number;
  // Scores
  technicalScore: number;
  fundamentalScore: number;
  sectorScore: number;
  macroScore: number;
  liquidityScore: number;
  riskScore: number;
}

export interface Position {
  id: string;
  stockCode: string;
  lots: number;
  buyPrice: number;
  buyDate: string;
  targetHorizon: 'short' | 'medium' | 'long';
  note: string;
}

export interface PortfolioPosition extends Position {
  stock: Stock;
  currentValue: number;
  cost: number;
  pnl: number;
  pnlPercent: number;
  weight: number;
}

export interface Alarm {
  id: string;
  stockCode: string;
  type: AlarmType;
  condition: 'above' | 'below';
  value: number;
  priority: 'low' | 'watch' | 'high' | 'critical';
  triggered: boolean;
  triggeredAt?: string;
  createdAt: string;
  active: boolean;
  note?: string;
}

export type AlarmType =
  | 'price'
  | 'support_break'
  | 'resistance_break'
  | 'rsi'
  | 'volume_surge'
  | 'volatility'
  | 'portfolio_concentration'
  | 'sector_rotation'
  | 'balance_sheet'
  | 'news';

export interface Sector {
  name: string;
  code: string;
  momentumScore: number;
  riskScore: number;
  macroSensitivity: 'high' | 'medium' | 'low';
  leaders: string[];
  laggards: string[];
  changePercent: number;
}

export interface PortfolioStats {
  totalValue: number;
  totalCost: number;
  dailyPnl: number;
  dailyPnlPercent: number;
  totalPnl: number;
  totalPnlPercent: number;
  riskScore: number;
  concentrationWarnings: ConcentrationWarning[];
}

export interface ConcentrationWarning {
  type: 'stock' | 'sector';
  name: string;
  weight: number;
  threshold: number;
}

export interface AIAnalysis {
  stockCode: string;
  summary: string;
  technical: string;
  fundamental: string;
  sectorMacro: string;
  risks: string[];
  scenarios: {
    bull: string;
    base: string;
    bear: string;
  };
  decisionNote: DecisionNote;
  disclaimer: string;
  generatedAt: string;
}

export type DecisionNote =
  | 'Güçlü izlenmeli'
  | 'İzleme listesine alınabilir'
  | 'Teknik teyit beklenmeli'
  | 'Temkinli yaklaşılmalı'
  | 'Fiyatlama dikkat gerektiriyor'
  | 'Hikaye güçlü ama riskler yüksek'
  | 'Kısa vadede oynaklık, orta vadede potansiyel'
  | 'Risk/getiri dengesi zayıf';

export type RootStackParamList = {
  MainTabs: undefined;
  StockDetail: { stockCode: string };
  AddPosition: undefined;
  AlarmDetail: { alarmId: string };
};

export type TabParamList = {
  Dashboard: undefined;
  Portfolio: undefined;
  Stocks: undefined;
  Alarms: undefined;
  AI: undefined;
};
