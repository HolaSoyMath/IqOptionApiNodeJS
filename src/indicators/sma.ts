import { Candle } from "../types/candle.types";

export function calculateSMA(
  candles: Candle[],
  period: number
): number | undefined {
  if (candles.length < period) {
    return undefined;
  }

  const relevantCandles = candles.slice(-period);

  const sum = relevantCandles.reduce(
    (total, candle) => total + candle.close,
    0
  );
  const sma = sum / period;

  return parseFloat(sma.toFixed(6));
}
