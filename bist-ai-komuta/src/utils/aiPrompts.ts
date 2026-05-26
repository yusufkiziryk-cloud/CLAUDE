import { Stock, AIAnalysis, DecisionNote } from '../types';

const DISCLAIMER = 'Bu içerik yatırım tavsiyesi değildir. Karar destek amacıyla hazırlanmıştır. Yatırım kararları kişisel risk profili ve güncel veriyle birlikte değerlendirilmelidir.';

function getTechnicalVerdict(stock: Stock): string {
  const trend = stock.price > stock.ema50 ? 'yukarı' : 'aşağı';
  const rsiStatus = stock.rsi > 70 ? 'aşırı alım bölgesinde' : stock.rsi < 30 ? 'aşırı satım bölgesinde' : 'nötr bölgede';
  const macdStatus = stock.macd > stock.macdSignal ? 'pozitif kesişim gösteriyor' : 'negatif ayrışma var';

  return `Mevcut veriler ışığında ${stock.code} ${trend} eğilimde görünmektedir. RSI ${stock.rsi} ile ${rsiStatus}. MACD ${macdStatus}. EMA50 (${stock.ema50.toFixed(2)}) üzerinde kapanış ${stock.price > stock.ema50 ? 'devam ediyor' : 'henüz gerçekleşmedi'}. Destek: ${stock.support.toFixed(2)}, Direnç: ${stock.resistance.toFixed(2)}.`;
}

function getFundamentalVerdict(stock: Stock): string {
  const parts: string[] = [];
  if (stock.pe !== null) parts.push(`F/K ${stock.pe.toFixed(1)}`);
  if (stock.pbv !== null) parts.push(`PD/DD ${stock.pbv.toFixed(1)}`);
  if (stock.roe !== null) parts.push(`ROE %${stock.roe.toFixed(1)}`);
  if (stock.revenueGrowth !== null) parts.push(`ciro büyümesi %${stock.revenueGrowth.toFixed(1)}`);

  return `Temel göstergeler: ${parts.join(', ')}. ${stock.fundamentalScore > 65 ? 'Mevcut veriler ışığında temel tablo görece güçlü görünmektedir' : 'Temel tablo orta seviyede olup dikkatli takip edilmelidir'}.`;
}

function getDecisionNote(stock: Stock): DecisionNote {
  const { technicalScore, fundamentalScore, riskScore } = stock;
  const avg = (technicalScore + fundamentalScore) / 2;

  if (riskScore > 60) return 'Risk/getiri dengesi zayıf';
  if (avg > 70 && riskScore < 35) return 'Güçlü izlenmeli';
  if (avg > 60 && riskScore < 45) return 'İzleme listesine alınabilir';
  if (technicalScore < 40 && fundamentalScore > 60) return 'Teknik teyit beklenmeli';
  if (fundamentalScore > 65 && riskScore > 45) return 'Hikaye güçlü ama riskler yüksek';
  if (stock.rsi > 65) return 'Temkinli yaklaşılmalı';
  if (technicalScore < 45) return 'Kısa vadede oynaklık, orta vadede potansiyel';
  return 'Fiyatlama dikkat gerektiriyor';
}

export function generateStockAnalysis(stock: Stock): AIAnalysis {
  const decisionNote = getDecisionNote(stock);
  const direction = stock.changePercent >= 0 ? 'artış' : 'düşüş';

  return {
    stockCode: stock.code,
    summary: `${stock.name} (${stock.code}), ${stock.sector} sektöründe faaliyet göstermekte olup bugün %${Math.abs(stock.changePercent).toFixed(2)} ${direction} ile ${stock.price.toFixed(2)} TL seviyesinde işlem görmektedir. 52 haftalık aralık: ${stock.low52w.toFixed(2)} - ${stock.high52w.toFixed(2)} TL.`,

    technical: getTechnicalVerdict(stock),

    fundamental: getFundamentalVerdict(stock),

    sectorMacro: `${stock.sector} sektörü mevcut makro ortamda ${stock.macroScore > 60 ? 'görece olumlu' : 'baskı altında'} bir konumda bulunmaktadır. Sektörel momentum ve makro duyarlılık birlikte değerlendirildiğinde pozisyon boyutlandırmasında temkinli olunması önerilir.`,

    risks: [
      'Kur oynaklığı ve faiz değişimleri fiyatlamayı etkileyebilir',
      stock.rsi > 65 ? 'RSI aşırı alım bölgesine yakın, düzeltme olasılığı göz ardı edilmemeli' : 'RSI nötr bölgede, teknik baskı sınırlı görünüyor',
      stock.debtEquity !== null && stock.debtEquity > 1.5 ? 'Borçluluk oranı dikkat gerektiren seviyede' : 'Borçluluk makul seviyelerde görünüyor',
      'Jeopolitik riskler ve küresel piyasa koşulları etkili olabilir',
      'Veriler gecikmeli olabilir; gerçek zamanlı analiz için güncel kaynaklar kontrol edilmelidir',
    ],

    scenarios: {
      bull: `Olumlu senaryoda ${stock.resistance.toFixed(2)} TL direncinin kırılması ve ${(stock.resistance * 1.08).toFixed(2)} TL bölgesine doğru hareket olası senaryo olarak değerlendirilebilir. Teyit için hacim artışı gerekmektedir.`,
      base: `Baz senaryoda ${stock.support.toFixed(2)} - ${stock.resistance.toFixed(2)} TL bant aralığında konsolidasyon devam edebilir. Mevcut trend netleşene kadar temkinli yaklaşım önerilir.`,
      bear: `Olumsuz senaryoda ${stock.support.toFixed(2)} TL desteğinin kırılması durumunda ${(stock.support * 0.92).toFixed(2)} TL bölgesi önem kazanabilir. Stop-loss seviyesi bireysel risk toleransına göre belirlenmelidir.`,
    },

    decisionNote,
    disclaimer: DISCLAIMER,
    generatedAt: new Date().toISOString(),
  };
}

export function generateMorningBrief(date: string): string {
  return `# Günlük Piyasa Özeti — ${date}

## BIST Genel Görünüm
Mevcut veriler ışığında BIST-100 endeksi gün içinde pozitif seyir izlemektedir. Bankacılık ve savunma sektörleri öne çıkan başlıklar arasında yer almaktadır.

## Portföyde Dikkat Edilecekler
• Yüksek volatiliteli pozisyonlar için stop-loss seviyeleri gözden geçirilmelidir.
• Sektör yoğunlaşması bulunan portföylerde dağılım dengelemesi değerlendirilebilir.

## Güçlü Sektörler
Savunma, Teknoloji, Perakende sektörleri momentum açısından olumlu görünmektedir.

## Zayıf Sektörler
Sanayi ve GYO sektörleri baskı altında görünmektedir.

## Kritik Hatırlatma
Piyasa verileri gecikmeli olabilir. Tüm analizler karar destek amaçlıdır.

## AI Kurumsal Not
Risk önce, getiri sonra. Mevcut volatilite ortamında pozisyon boyutlandırması ve çeşitlendirme kritik önem taşımaktadır. Duygusal kararlar yerine sistematik yaklaşım önerilir.

---
*${DISCLAIMER}*`;
}
