import { candleManager } from "../candleManager";
import { Candle } from "../../types/candle.types";

export class MovingAverageStrategy {
  private symbol: string;
  private timeframe: string;
  private period: number;

  constructor(symbol: string, timeframe: string, period: number = 20) {
    this.symbol = symbol;
    this.timeframe = timeframe;
    this.period = period;

    // Subscrever para novos candles
    candleManager.subscribe(symbol, timeframe, this.onNewCandle.bind(this));
  }

  private onNewCandle(candle: Candle): void {
    const signal = this.calculateSignal();
    if (signal) {
      console.log(`[MA STRATEGY] Sinal: ${signal} para ${this.symbol}`);
      // Aqui você pode executar ordens automaticamente
    }
  }

  private calculateSignal(): "BUY" | "SELL" | null {
    const candles = candleManager.getCandles(
      this.symbol,
      this.timeframe,
      this.period + 1
    );

    if (candles.length < this.period + 1) {
      return null; // Não há dados suficientes
    }

    const currentPrice = candles[candles.length - 1].close;
    const ma = this.calculateMA(candles.slice(0, -1));
    const previousMA = this.calculateMA(candles.slice(1, -1));

    // Sinal de compra: preço cruza acima da MA
    if (currentPrice > ma && candles[candles.length - 2].close <= previousMA) {
      return "BUY";
    }

    // Sinal de venda: preço cruza abaixo da MA
    if (currentPrice < ma && candles[candles.length - 2].close >= previousMA) {
      return "SELL";
    }

    return null;
  }

  private calculateMA(candles: Candle[]): number {
    const sum = candles.reduce((acc, candle) => acc + candle.close, 0);
    return sum / candles.length;
  }
}
