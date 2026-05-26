import { Stock, Position, PortfolioPosition, PortfolioStats, ConcentrationWarning } from '../types';
import { BIST30_STOCKS, getBIST30ByCode } from '../data/mockBIST30';

export function calculateRiskScore(stock: Stock): number {
  const technical = stock.technicalScore * 0.25;
  const fundamental = stock.fundamentalScore * 0.25;
  const sector = stock.sectorScore * 0.15;
  const macro = stock.macroScore * 0.15;
  const liquidity = stock.liquidityScore * 0.10;
  // newsRisk placeholder = 50
  const news = 50 * 0.10;

  const compositeScore = technical + fundamental + sector + macro + liquidity + news;
  // Higher composite = lower risk score
  return Math.round(100 - compositeScore);
}

export function buildPortfolioPositions(positions: Position[]): PortfolioPosition[] {
  const result: PortfolioPosition[] = [];
  let totalValue = 0;

  const withValues = positions.map(p => {
    const stock = getBIST30ByCode(p.stockCode);
    if (!stock) return null;
    const cost = p.lots * 100 * p.buyPrice;
    const currentValue = p.lots * 100 * stock.price;
    totalValue += currentValue;
    return { ...p, stock, cost, currentValue, pnl: 0, pnlPercent: 0, weight: 0 };
  }).filter(Boolean) as (PortfolioPosition & { currentValue: number })[];

  withValues.forEach(p => {
    p.pnl = p.currentValue - p.cost;
    p.pnlPercent = p.cost > 0 ? (p.pnl / p.cost) * 100 : 0;
    p.weight = totalValue > 0 ? (p.currentValue / totalValue) * 100 : 0;
    result.push(p);
  });

  return result;
}

export function calculatePortfolioStats(positions: Position[]): PortfolioStats {
  const built = buildPortfolioPositions(positions);
  const totalValue = built.reduce((s, p) => s + p.currentValue, 0);
  const totalCost = built.reduce((s, p) => s + p.cost, 0);
  const totalPnl = totalValue - totalCost;

  const dailyPnl = built.reduce((s, p) => s + p.lots * 100 * p.stock.change, 0);
  const dailyPnlPercent = totalValue > 0 ? (dailyPnl / totalValue) * 100 : 0;
  const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  const warnings: ConcentrationWarning[] = [];

  // Stock concentration
  built.forEach(p => {
    if (p.weight > 15) {
      warnings.push({ type: 'stock', name: p.stockCode, weight: p.weight, threshold: 15 });
    }
  });

  // Sector concentration
  const sectorWeights: Record<string, number> = {};
  built.forEach(p => {
    const s = p.stock.sector;
    sectorWeights[s] = (sectorWeights[s] || 0) + p.weight;
  });
  Object.entries(sectorWeights).forEach(([sector, weight]) => {
    if (weight > 35) {
      warnings.push({ type: 'sector', name: sector, weight, threshold: 35 });
    }
  });

  const riskScore = calculatePortfolioRiskScore(built);

  return { totalValue, totalCost, dailyPnl, dailyPnlPercent, totalPnl, totalPnlPercent, riskScore, concentrationWarnings: warnings };
}

function calculatePortfolioRiskScore(positions: PortfolioPosition[]): number {
  if (positions.length === 0) return 0;

  const avgStockRisk = positions.reduce((s, p) => s + p.stock.riskScore * (p.weight / 100), 0);

  // Concentration penalty
  const maxWeight = Math.max(...positions.map(p => p.weight));
  const concentrationPenalty = maxWeight > 15 ? (maxWeight - 15) * 0.5 : 0;

  return Math.min(100, Math.round(avgStockRisk + concentrationPenalty));
}

export function getRiskLabel(score: number): string {
  if (score <= 25) return 'Düşük Risk';
  if (score <= 45) return 'Orta Risk';
  if (score <= 65) return 'Yüksek Risk';
  return 'Kritik Risk';
}

export function getRiskColor(score: number): string {
  if (score <= 25) return '#00C896';
  if (score <= 45) return '#FFB300';
  if (score <= 65) return '#FF7043';
  return '#FF4757';
}
