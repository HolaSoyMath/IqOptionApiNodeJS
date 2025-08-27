// src/indicators/ema.ts
import { Candle } from "../types/candle.types";

export function calculateEMA(
  candles: Candle[],
  period: number
): number | undefined {
  if (period <= 0 || !Number.isFinite(period)) {
    return undefined;
  }

  if (candles.length < period) {
    return undefined;
  }

  const closes = candles.map((candle) => candle.close);

  const multiplier = 2 / (period + 1);

  let ema =
    closes.slice(0, period).reduce((sum, close) => sum + close, 0) / period;

  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * multiplier + ema * (1 - multiplier);
  }

  return parseFloat(ema.toFixed(6));
}
