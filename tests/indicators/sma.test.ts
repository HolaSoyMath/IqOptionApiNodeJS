import { Candle } from '../../src/types/candle.types';
import { calculateSMA } from '../../src/indicators';

describe('Testes da Média Móvel Simples (SMA)', () => {
  // Função auxiliar para gerar candles
  function generateCandles(count: number, startClose: number = 1): Candle[] {
    return Array.from({ length: count }, (_, i) => ({
      id: (i + 1).toString(),
      symbol: 'EURUSD',
      timeframe: '1m',
      timestamp: 1629871200 + i * 60,
      open: startClose + i * 0.1,
      high: startClose + i * 0.1 + 0.2,
      low: startClose + i * 0.1 - 0.2,
      close: startClose + i * 0.1,
      createdAt: new Date(),
    }));
  }

  it('retorna undefined quando não há candles suficientes para o período SMA', () => {
    const candles = generateCandles(2);
    const sma = calculateSMA(candles, 3);
    expect(sma).toBeUndefined();
  });

  it('calcula SMA para 3 períodos corretamente', () => {
    const candles = generateCandles(3);
    // Valores de close: [1.0, 1.1, 1.2]
    // SMA = (1.0 + 1.1 + 1.2) / 3 = 1.1
    const sma = calculateSMA(candles, 3);
    expect(sma).toBeCloseTo(1.1, 6);
  });

  it('calcula SMA para 5 períodos corretamente', () => {
    const candles = generateCandles(5);
    // Valores de close: [1.0, 1.1, 1.2, 1.3, 1.4]
    // SMA = (1.0 + 1.1 + 1.2 + 1.3 + 1.4) / 5 = 1.2
    const sma = calculateSMA(candles, 5);
    expect(sma).toBeCloseTo(1.2, 6);
  });

  it('calcula SMA para 10 períodos corretamente', () => {
    const candles = generateCandles(10);
    // Valores de close: [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9]
    // SMA = (1.0 + 1.1 + 1.2 + 1.3 + 1.4 + 1.5 + 1.6 + 1.7 + 1.8 + 1.9) / 10 = 1.45
    const sma = calculateSMA(candles, 10);
    expect(sma).toBeCloseTo(1.45, 6);
  });

  it('calcula SMA para 20 períodos corretamente', () => {
    const candles = generateCandles(20);
    // Valores de close: [1.0, 1.1, 1.2, ..., 2.9]
    // SMA = (1.0 + 1.1 + ... + 2.9) / 20
    // Soma dos 20 termos = (1.0 + 2.9) * 20 / 2 = 3.9 * 10 = 39
    // SMA = 39 / 20 = 1.95
    const sma = calculateSMA(candles, 20);
    expect(sma).toBeCloseTo(1.95, 6);
  });

  it('calcula SMA corretamente com mais candles que o período', () => {
    const candles = generateCandles(10); // 10 candles
    // SMA deve considerar apenas os últimos 5 candles
    // Últimos 5 valores de close: [1.5, 1.6, 1.7, 1.8, 1.9]
    // SMA = (1.5 + 1.6 + 1.7 + 1.8 + 1.9) / 5 = 1.7
    const sma = calculateSMA(candles, 5);
    expect(sma).toBeCloseTo(1.7, 6);
  });

  it('calcula SMA corretamente com valores decimais', () => {
    const candles: Candle[] = [
      { id: '1', symbol: 'EURUSD', timeframe: '1m', timestamp: 1629871200, open: 1.123456, high: 1.2, low: 1.0, close: 1.111111, createdAt: new Date() },
      { id: '2', symbol: 'EURUSD', timeframe: '1m', timestamp: 1629871260, open: 1.2, high: 1.3, low: 1.1, close: 1.222222, createdAt: new Date() },
      { id: '3', symbol: 'EURUSD', timeframe: '1m', timestamp: 1629871320, open: 1.3, high: 1.4, low: 1.2, close: 1.333333, createdAt: new Date() },
    ];

    const sma = calculateSMA(candles, 3);
    // SMA = (1.111111 + 1.222222 + 1.333333) / 3 = 1.222222
    expect(sma).toBeCloseTo(1.222222, 6);
  });

  it('calculates SMA correctly with mixed values', () => {
    const candles: Candle[] = [
      { id: '1', symbol: 'EURUSD', timeframe: '1m', timestamp: 1629871200, open: 1.0, high: 1.5, low: 0.9, close: 1.2, createdAt: new Date() },
      { id: '2', symbol: 'EURUSD', timeframe: '1m', timestamp: 1629871260, open: 1.2, high: 1.8, low: 1.1, close: 1.5, createdAt: new Date() },
      { id: '3', symbol: 'EURUSD', timeframe: '1m', timestamp: 1629871320, open: 1.5, high: 2.0, low: 1.4, close: 1.8, createdAt: new Date() },
      { id: '4', symbol: 'EURUSD', timeframe: '1m', timestamp: 1629871380, open: 1.8, high: 2.2, low: 1.7, close: 2.0, createdAt: new Date() },
      { id: '5', symbol: 'EURUSD', timeframe: '1m', timestamp: 1629871440, open: 2.0, high: 2.5, low: 1.9, close: 2.3, createdAt: new Date() },
    ];

    const sma = calculateSMA(candles, 5);
    // SMA = (1.2 + 1.5 + 1.8 + 2.0 + 2.3) / 5 = 1.76
    expect(sma).toBeCloseTo(1.76, 6);
  });

  it('returns correct value for period 1', () => {
    const candles = generateCandles(3);
    // SMA de período 1 deve ser igual ao último preço de fechamento
    const sma = calculateSMA(candles, 1);
    expect(sma).toBeCloseTo(1.2, 6); // Último close é 1.2
  });

  it('handles large period correctly', () => {
    const candles = generateCandles(100);
    // SMA de 100 períodos
    // Primeiro close: 1.0, último close: 10.9
    // Soma = (1.0 + 10.9) * 100 / 2 = 11.9 * 50 = 595
    // SMA = 595 / 100 = 5.95
    const sma = calculateSMA(candles, 100);
    expect(sma).toBeCloseTo(5.95, 6);
  });
});