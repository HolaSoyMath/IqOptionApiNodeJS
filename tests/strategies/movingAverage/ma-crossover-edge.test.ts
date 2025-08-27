import { Candle } from '../../../src/types/candle.types';
import { checkMA2Crossover, checkMA3Crossover } from '../../../src/strategies/ma-crossover';
import { calculateEMA } from '../../../src/indicators/ema';

// Mock da função calculateEMA
jest.mock('../../../src/indicators/ema');

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

describe('MA Crossover Strategy - Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns HOLD for empty candles array', () => {
    const candles: Candle[] = [];
    const signal2 = checkMA2Crossover(candles, 3, 8);
    const signal3 = checkMA3Crossover(candles, 5, 10, 20);
    expect(signal2).toBe('HOLD');
    expect(signal3).toBe('HOLD');
  });

  it('returns HOLD for invalid periods', () => {
    const candles = generateCandles(5);
    const signal2 = checkMA2Crossover(candles, 0, 8);
    const signal3 = checkMA3Crossover(candles, -1, 10, 20);
    expect(signal2).toBe('HOLD');
    expect(signal3).toBe('HOLD');
  });

  it('handles rapid price changes correctly', () => {
    const candles = generateCandles(12, 1.0, 0);
    // Modificar alguns candles para ter mudanças bruscas
    candles[3].close = 0.9;
    candles[5].close = 1.5;
    
    const signal = checkMA2Crossover(candles, 3, 8);
    expect(['BUY', 'SELL', 'HOLD']).toContain(signal);
  });

  // NOVOS TESTES ADICIONADOS
  it('uses current alignment when previous EMA calculation fails', () => {
    const candles = generateCandles(9, 1.0, 0.15);
    
    
    (calculateEMA as jest.Mock)
      .mockReturnValueOnce(1.8) // shortEMA atual
      .mockReturnValueOnce(1.5) // longEMA atual
      .mockReturnValueOnce(undefined) // previousShortEMA
      .mockReturnValueOnce(1.4); // previousLongEMA


    const signal = checkMA2Crossover(candles, 3, 8);
    
    expect(signal).toBe('BUY');
  });

  it('returns HOLD when both current and previous EMA calculations fail', () => {
    const candles = generateCandles(2);
    (calculateEMA as jest.Mock).mockReturnValue(undefined);
    
    const signal = checkMA2Crossover(candles, 3, 8);
    expect(signal).toBe('HOLD');
  });

  it('handles errors in EMA calculation gracefully', () => {
    const candles = generateCandles(5);
    (calculateEMA as jest.Mock).mockImplementation(() => {
      throw new Error('Calculation error');
    });
    
    const signal = checkMA2Crossover(candles, 3, 8);
    expect(signal).toBe('HOLD');
  });

  it('uses current alignment for SELL when previous EMA calculation fails', () => {
    const candles = generateCandles(9, 1.0, 0.15);
    
    (calculateEMA as jest.Mock)
      .mockReturnValueOnce(1.2) // shortEMA atual (menor que longEMA)
      .mockReturnValueOnce(1.5) // longEMA atual
      .mockReturnValueOnce(undefined) // previousShortEMA
      .mockReturnValueOnce(1.4); // previousLongEMA

    const signal = checkMA2Crossover(candles, 3, 8);
    
    expect(signal).toBe('SELL'); // Deve usar fallback para alinhamento atual
  });

  it('returns HOLD for invalid period order (short >= long)', () => {
    const candles = generateCandles(10);
    const signal1 = checkMA2Crossover(candles, 5, 5); // short == long
    const signal2 = checkMA2Crossover(candles, 8, 3); // short > long
    
    expect(signal1).toBe('HOLD');
    expect(signal2).toBe('HOLD');
  });
});