// tests/strategies/movingAverage/ma-crossover.test.ts
import { Candle } from '../../../src/types/candle.types';
import { checkMA2Crossover } from '../../../src/strategies/ma-crossover';
import { calculateEMA } from '../../../src/indicators/ema';

// Função auxiliar para gerar candles
function generateCandles(count: number, startClose: number = 1, increment: number = 0.1): Candle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: (i + 1).toString(),
    symbol: 'EURUSD',
    timeframe: '1m',
    timestamp: 1629871200 + i * 60,
    open: startClose + i * increment,
    high: startClose + i * increment + 0.2,
    low: startClose + i * increment - 0.2,
    close: startClose + i * increment,
    volume: 1000,
    createdAt: new Date(1629871200 + i * 60 * 1000),
  }));
}

describe('MA Crossover Strategy - 2 MAs', () => {
  // Teste BUY - EMA curta cruza de baixo para cima
  it('returns BUY signal when short MA crosses above long MA', () => {
    const candles: Candle[] = [
      // Fase 1: EMA curta abaixo da longa (estabelecer posição inicial)
      { id: '1', symbol: 'EURUSD', timeframe: '1m', close: 1.0, open: 1.0, high: 1.0, low: 1.0, timestamp: 1672531200, createdAt: new Date('2023-01-01T00:00:00Z') },
      { id: '2', symbol: 'EURUSD', timeframe: '1m', close: 1.0, open: 1.0, high: 1.0, low: 1.0, timestamp: 1672534800, createdAt: new Date('2023-01-01T01:00:00Z') },
      { id: '3', symbol: 'EURUSD', timeframe: '1m', close: 1.0, open: 1.0, high: 1.0, low: 1.0, timestamp: 1672538400, createdAt: new Date('2023-01-01T02:00:00Z') },
      { id: '4', symbol: 'EURUSD', timeframe: '1m', close: 0.9, open: 1.0, high: 1.0, low: 0.9, timestamp: 1672542000, createdAt: new Date('2023-01-01T03:00:00Z') },
      { id: '5', symbol: 'EURUSD', timeframe: '1m', close: 0.8, open: 0.9, high: 0.9, low: 0.8, timestamp: 1672545600, createdAt: new Date('2023-01-01T04:00:00Z') },
      { id: '6', symbol: 'EURUSD', timeframe: '1m', close: 0.7, open: 0.8, high: 0.8, low: 0.7, timestamp: 1672549200, createdAt: new Date('2023-01-01T05:00:00Z') },
      { id: '7', symbol: 'EURUSD', timeframe: '1m', close: 0.6, open: 0.7, high: 0.7, low: 0.6, timestamp: 1672552800, createdAt: new Date('2023-01-01T06:00:00Z') },
      { id: '8', symbol: 'EURUSD', timeframe: '1m', close: 0.5, open: 0.6, high: 0.6, low: 0.5, timestamp: 1672556400, createdAt: new Date('2023-01-01T07:00:00Z') },
      // Fase 2: Posicionamento (EMA curta ainda abaixo)
      { id: '9', symbol: 'EURUSD', timeframe: '1m', close: 0.6, open: 0.5, high: 0.6, low: 0.5, timestamp: 1672560000, createdAt: new Date('2023-01-01T08:00:00Z') },
      { id: '10', symbol: 'EURUSD', timeframe: '1m', close: 0.7, open: 0.6, high: 0.7, low: 0.6, timestamp: 1672563600, createdAt: new Date('2023-01-01T09:00:00Z') },
      { id: '11', symbol: 'EURUSD', timeframe: '1m', close: 0.8, open: 0.7, high: 0.8, low: 0.7, timestamp: 1672567200, createdAt: new Date('2023-01-01T10:00:00Z') },
      // Fase 3: Cruzamento (EMA curta cruza acima da longa)
      { id: '12', symbol: 'EURUSD', timeframe: '1m', close: 1.5, open: 0.8, high: 1.5, low: 0.8, timestamp: 1672570800, createdAt: new Date('2023-01-01T11:00:00Z') }
    ];
  
    const signal = checkMA2Crossover(candles, 3, 8);
    expect(signal).toBe('BUY');
  });
  
  // Teste SELL - EMA curta cruza de cima para baixo
  it('returns SELL signal when short MA crosses below long MA', () => {
    const candles: Candle[] = [
      // Fase 1: Estabelecer EMA longa alta e EMA curta ainda mais alta
      { id: '1', symbol: 'EURUSD', timeframe: '1m', close: 1.0, open: 1.0, high: 1.0, low: 1.0, timestamp: 1672531200, createdAt: new Date('2023-01-01T00:00:00Z') },
      { id: '2', symbol: 'EURUSD', timeframe: '1m', close: 1.1, open: 1.0, high: 1.1, low: 1.0, timestamp: 1672534800, createdAt: new Date('2023-01-01T01:00:00Z') },
      { id: '3', symbol: 'EURUSD', timeframe: '1m', close: 1.2, open: 1.1, high: 1.2, low: 1.1, timestamp: 1672538400, createdAt: new Date('2023-01-01T02:00:00Z') },
      { id: '4', symbol: 'EURUSD', timeframe: '1m', close: 1.3, open: 1.2, high: 1.3, low: 1.2, timestamp: 1672542000, createdAt: new Date('2023-01-01T03:00:00Z') },
      { id: '5', symbol: 'EURUSD', timeframe: '1m', close: 1.4, open: 1.3, high: 1.4, low: 1.3, timestamp: 1672545600, createdAt: new Date('2023-01-01T04:00:00Z') },
      { id: '6', symbol: 'EURUSD', timeframe: '1m', close: 1.5, open: 1.4, high: 1.5, low: 1.4, timestamp: 1672549200, createdAt: new Date('2023-01-01T05:00:00Z') },
      { id: '7', symbol: 'EURUSD', timeframe: '1m', close: 1.6, open: 1.5, high: 1.6, low: 1.5, timestamp: 1672552800, createdAt: new Date('2023-01-01T06:00:00Z') },
      { id: '8', symbol: 'EURUSD', timeframe: '1m', close: 1.7, open: 1.6, high: 1.7, low: 1.6, timestamp: 1672556400, createdAt: new Date('2023-01-01T07:00:00Z') },
      // Fase 2: Manter EMA curta acima da longa
      { id: '9', symbol: 'EURUSD', timeframe: '1m', close: 1.8, open: 1.7, high: 1.8, low: 1.7, timestamp: 1672560000, createdAt: new Date('2023-01-01T08:00:00Z') },
      { id: '10', symbol: 'EURUSD', timeframe: '1m', close: 1.9, open: 1.8, high: 1.9, low: 1.8, timestamp: 1672563600, createdAt: new Date('2023-01-01T09:00:00Z') },
      { id: '11', symbol: 'EURUSD', timeframe: '1m', close: 2.0, open: 1.9, high: 2.0, low: 1.9, timestamp: 1672567200, createdAt: new Date('2023-01-01T10:00:00Z') },
      // Fase 3: Queda abrupta para forçar cruzamento para baixo
      { id: '12', symbol: 'EURUSD', timeframe: '1m', close: 0.1, open: 2.0, high: 2.0, low: 0.1, timestamp: 1672570800, createdAt: new Date('2023-01-01T11:00:00Z') }
    ];

    // Debug: Calcular EMAs manualmente para verificar
    const currentShortEMA = calculateEMA(candles, 3);
    const currentLongEMA = calculateEMA(candles, 8);
    
    // Para obter EMAs anteriores, precisamos calcular com candles até o penúltimo
    const previousCandles = candles.slice(0, -1);
    const previousShortEMA = calculateEMA(previousCandles, 3);
    const previousLongEMA = calculateEMA(previousCandles, 8);
    
    console.log('=== DEBUG TESTE SELL ===');
    console.log('Candles length:', candles.length);
    console.log('Current Short EMA:', currentShortEMA);
    console.log('Current Long EMA:', currentLongEMA);
    console.log('Previous Short EMA:', previousShortEMA);
    console.log('Previous Long EMA:', previousLongEMA);
    
    if (currentShortEMA !== undefined && currentLongEMA !== undefined && 
        previousShortEMA !== undefined && previousLongEMA !== undefined) {
      
      const previousDiff = previousShortEMA - previousLongEMA;
      const currentDiff = currentShortEMA - currentLongEMA;
      
      console.log('Previous Diff (short - long):', previousDiff);
      console.log('Current Diff (short - long):', currentDiff);
      console.log('Condição SELL (previousDiff > 0 && currentDiff < 0):', previousDiff > 0 && currentDiff < 0);
    } else {
      console.log('ERRO: Algumas EMAs são undefined');
      console.log('currentShortEMA:', currentShortEMA);
      console.log('currentLongEMA:', currentLongEMA);
      console.log('previousShortEMA:', previousShortEMA);
      console.log('previousLongEMA:', previousLongEMA);
    }
    console.log('========================');
  
    const signal = checkMA2Crossover(candles, 3, 8);
    console.log('Signal returned:', signal);
    expect(signal).toBe('SELL');
  });

  it('returns HOLD signal when no crossover occurs', () => {
    const candles = generateCandles(10, 1.5, 0);
    const signal = checkMA2Crossover(candles, 3, 8);
    expect(signal).toBe('HOLD');
  });

  it('returns HOLD when not enough candles for calculation', () => {
    const candles = generateCandles(5);
    const signal = checkMA2Crossover(candles, 3, 8);
    expect(signal).toBe('HOLD');
  });

  it('returns HOLD when EMAs are equal', () => {
    const candles = generateCandles(10, 1.0, 0);
    const signal = checkMA2Crossover(candles, 3, 8);
    expect(signal).toBe('HOLD');
  });

  it('returns BUY when exactly enough candles and short EMA > long EMA', () => {
    const candles = generateCandles(8, 1.0, 0.15);
    const signal = checkMA2Crossover(candles, 3, 8);
    expect(signal).toBe('BUY');
  });

  it('returns SELL when exactly enough candles and short EMA < long EMA', () => {
    const candles = generateCandles(8, 2.0, -0.15);
    const signal = checkMA2Crossover(candles, 3, 8);
    expect(signal).toBe('SELL');
  });

  it('returns HOLD when exactly enough candles and short EMA == long EMA', () => {
    const candles = generateCandles(8, 1.5, 0);
    const signal = checkMA2Crossover(candles, 3, 8);
    expect(signal).toBe('HOLD');
  });
});