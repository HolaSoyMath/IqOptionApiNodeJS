// tests/strategies/movingAverage/ma-crossover-3.test.ts
import { Candle } from '../../../src/types/candle.types';
import { checkMA3Crossover } from '../../../src/strategies/ma-crossover';

// Função auxiliar para gerar candles sequenciais
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

describe('MA Crossover Strategy - 3 MAs', () => {
  it('returns BUY signal when all MAs are aligned upward', () => {
    const candles = generateCandles(25, 1.0, 0.15);
    const signal = checkMA3Crossover(candles, 5, 10, 20);
    expect(signal).toBe('BUY');
  });

  it('returns SELL signal when all MAs are aligned downward', () => {
    const candles = generateCandles(25, 2.5, -0.15);
    const signal = checkMA3Crossover(candles, 5, 10, 20);
    expect(signal).toBe('SELL');
  });

  it('returns HOLD signal when MAs are not properly aligned', () => {
    const candles = generateCandles(10, 1.5, 0);
    const signal = checkMA3Crossover(candles, 5, 10, 20);
    expect(signal).toBe('HOLD');
  });

  it('returns HOLD when not enough candles for calculation', () => {
    const candles = generateCandles(15);
    const signal = checkMA3Crossover(candles, 5, 10, 20);
    expect(signal).toBe('HOLD');
  });

  it('returns HOLD when only two MAs are aligned', () => {
    const candles: Candle[] = [
      { id: '1', symbol: 'EURUSD', timeframe: '1m', timestamp: 1629871200, open: 1.0, high: 1.1, low: 0.9, close: 1.0, volume: 1000, createdAt: new Date(1629871200 * 1000) },
      { id: '2', symbol: 'EURUSD', timeframe: '1m', timestamp: 1629871260, open: 1.0, high: 1.2, low: 0.9, close: 1.1, volume: 1000, createdAt: new Date(1629871260 * 1000) },
      { id: '3', symbol: 'EURUSD', timeframe: '1m', timestamp: 1629871320, open: 1.1, high: 1.3, low: 1.0, close: 1.2, volume: 1000, createdAt: new Date(1629871320 * 1000) },
      { id: '4', symbol: 'EURUSD', timeframe: '1m', timestamp: 1629871380, open: 1.2, high: 1.4, low: 1.1, close: 1.3, volume: 1000, createdAt: new Date(1629871380 * 1000) },
      { id: '5', symbol: 'EURUSD', timeframe: '1m', timestamp: 1629871440, open: 1.3, high: 1.5, low: 1.2, close: 1.4, volume: 1000, createdAt: new Date(1629871440 * 1000) },
      { id: '6', symbol: 'EURUSD', timeframe: '1m', timestamp: 1629871500, open: 1.4, high: 1.6, low: 1.3, close: 1.5, volume: 1000, createdAt: new Date(1629871500 * 1000) },
      { id: '7', symbol: 'EURUSD', timeframe: '1m', timestamp: 1629871560, open: 1.5, high: 1.7, low: 1.4, close: 1.6, volume: 1000, createdAt: new Date(1629871560 * 1000) },
      { id: '8', symbol: 'EURUSD', timeframe: '1m', timestamp: 1629871620, open: 1.6, high: 1.8, low: 1.5, close: 1.7, volume: 1000, createdAt: new Date(1629871620 * 1000) },
      { id: '9', symbol: 'EURUSD', timeframe: '1m', timestamp: 1629871680, open: 1.7, high: 1.9, low: 1.6, close: 1.8, volume: 1000, createdAt: new Date(1629871680 * 1000) },
      { id: '10', symbol: 'EURUSD', timeframe: '1m', timestamp: 1629871740, open: 1.8, high: 2.0, low: 1.7, close: 1.9, volume: 1000, createdAt: new Date(1629871740 * 1000) },
      { id: '11', symbol: 'EURUSD', timeframe: '1m', timestamp: 1629871800, open: 1.9, high: 2.1, low: 1.8, close: 1.9, volume: 1000, createdAt: new Date(1629871800 * 1000) },
      { id: '12', symbol: 'EURUSD', timeframe: '1m', timestamp: 1629871860, open: 1.9, high: 2.0, low: 1.8, close: 1.8, volume: 1000, createdAt: new Date(1629871860 * 1000) },
      { id: '13', symbol: 'EURUSD', timeframe: '1m', timestamp: 1629871920, open: 1.8, high: 2.0, low: 1.7, close: 1.7, volume: 1000, createdAt: new Date(1629871920 * 1000) },
      { id: '14', symbol: 'EURUSD', timeframe: '1m', timestamp: 1629871980, open: 1.7, high: 1.9, low: 1.6, close: 1.6, volume: 1000, createdAt: new Date(1629871980 * 1000) },
      { id: '15', symbol: 'EURUSD', timeframe: '1m', timestamp: 1629872040, open: 1.6, high: 1.8, low: 1.5, close: 1.5, volume: 1000, createdAt: new Date(1629872040 * 1000) },
    ];

    const signal = checkMA3Crossover(candles, 5, 10, 20);
    expect(signal).toBe('HOLD');
  });

  it('returns HOLD for invalid period configuration', () => {
    const candles = generateCandles(20);
    const signal1 = checkMA3Crossover(candles, 10, 5, 20); // p1 > p2
    const signal2 = checkMA3Crossover(candles, 5, 20, 10); // p2 > p3
    const signal3 = checkMA3Crossover(candles, 5, 5, 10); // p1 == p2
    const signal4 = checkMA3Crossover(candles, 5, 10, 10); // p2 == p3
    
    expect(signal1).toBe('HOLD');
    expect(signal2).toBe('HOLD');
    expect(signal3).toBe('HOLD');
    expect(signal4).toBe('HOLD');
  });

  it('returns HOLD when EMA calculation returns undefined', () => {
    const candles = generateCandles(25, 1.0, 0.15);
    // Mock temporário para testar comportamento com undefined
    const originalCalculateEMA = jest.requireActual('../../../src/indicators/ema').calculateEMA;
    jest.spyOn(require('../../../src/indicators/ema'), 'calculateEMA').mockReturnValue(undefined);
    
    const signal = checkMA3Crossover(candles, 5, 10, 20);
    expect(signal).toBe('HOLD');
    
    // Restaurar implementação original
    jest.restoreAllMocks();
  });
});
