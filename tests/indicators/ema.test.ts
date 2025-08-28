import { Candle } from '../../src/types/candle.types';
import { calculateEMA } from '../../src/indicators';

// Função auxiliar para gerar candles sequenciais
function generateCandles(count: number, startClose: number = 1): Candle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: (i + 1).toString(),
    symbol: 'EURUSD',
    timeframe: '1m',
    timestamp: 1629871200 + i * 60,
    open: startClose + i * 0.1,
    high: startClose + i * 0.1 + 0.5,
    low: startClose + i * 0.1 - 0.5,
    close: startClose + i,
    createdAt: new Date(),
  }));
}

describe('Testes da Média Móvel Exponencial (EMA) - Testes Estendidos', () => {
  // Testes de cálculo normal
  it('calcula EMA para 5 períodos com 5 candles', () => {
    const candles = generateCandles(5);
    const ema = calculateEMA(candles, 5);
    expect(ema).toBeCloseTo(3, 6);
  });

  it('calcula EMA para 5 períodos com 6 candles', () => {
    const candles = generateCandles(6);
    const ema = calculateEMA(candles, 5);
    expect(ema).toBeCloseTo(4, 6);
  });

  it('calcula EMA para 10 períodos com 10 candles', () => {
    const candles = generateCandles(10);
    const ema = calculateEMA(candles, 10);
    expect(ema).toBeCloseTo(5.5, 6);
  });

  it('calcula EMA para 10 períodos com 11 candles', () => {
    const candles = generateCandles(11);
    const ema = calculateEMA(candles, 10);
    expect(ema).toBeCloseTo(6.5, 6);
  });

  it('calcula EMA para 15 períodos com 15 candles', () => {
    const candles = generateCandles(15);
    const ema = calculateEMA(candles, 15);
    expect(ema).toBeCloseTo(8, 6);
  });

  it('calcula EMA para 15 períodos com 16 candles', () => {
    const candles = generateCandles(16);
    const ema = calculateEMA(candles, 15);
    expect(ema).toBeCloseTo(9, 6);
  });

  it('calcula EMA para 20 períodos com 20 candles', () => {
    const candles = generateCandles(20);
    const ema = calculateEMA(candles, 20);
    expect(ema).toBeCloseTo(10.5, 6);
  });

  it('calcula EMA para 20 períodos com 21 candles', () => {
    const candles = generateCandles(21);
    const ema = calculateEMA(candles, 20);
    expect(ema).toBeCloseTo(11.5, 6);
  });

  // Testes de casos de borda
  it('retorna undefined para array de candles vazio', () => {
    const candles: Candle[] = [];
    const ema = calculateEMA(candles, 5);
    expect(ema).toBeUndefined();
  });

  it('returns undefined for period 0', () => {
    const candles = generateCandles(3);
    const ema = calculateEMA(candles, 0);
    expect(ema).toBeUndefined();
  });

  it('returns undefined for negative period', () => {
    const candles = generateCandles(3);
    const ema = calculateEMA(candles, -1);
    expect(ema).toBeUndefined();
  });

  it('returns undefined for period NaN', () => {
    const candles = generateCandles(3);
    const ema = calculateEMA(candles, NaN);
    expect(ema).toBeUndefined();
  });

  it('returns undefined for period Infinity', () => {
    const candles = generateCandles(3);
    const ema = calculateEMA(candles, Infinity);
    expect(ema).toBeUndefined();
  });

  // Teste adicional para garantir que a função lida com períodos muito grandes
  it('returns undefined for period larger than candles array', () => {
    const candles = generateCandles(5);
    const ema = calculateEMA(candles, 10);
    expect(ema).toBeUndefined();
  });
});