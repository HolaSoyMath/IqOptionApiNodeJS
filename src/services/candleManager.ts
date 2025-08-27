import { EventEmitter } from "events";
import { Candle, CandleSubscription, MarketData } from "../types/candle.types";

class CandleManager extends EventEmitter {
  private static instance: CandleManager;
  private marketData: MarketData = {};
  private subscriptions: Set<CandleSubscription> = new Set();
  private maxCandlesPerSymbol: number = 1000;

  private constructor() {
    super();
    this.setMaxListeners(0);
  }

  static getInstance(): CandleManager {
    if (!CandleManager.instance) {
      CandleManager.instance = new CandleManager();
    }
    return CandleManager.instance;
  }

  /**
   * Adiciona um novo candle ao estado global
   */
  addCandle(candle: Candle): void {
    const { symbol, timeframe } = candle;

    if (!this.marketData[symbol]) {
      this.marketData[symbol] = {};
    }
    if (!this.marketData[symbol][timeframe]) {
      this.marketData[symbol][timeframe] = [];
    }

    this.marketData[symbol][timeframe].push(candle);

    if (this.marketData[symbol][timeframe].length > this.maxCandlesPerSymbol) {
      this.marketData[symbol][timeframe] = this.marketData[symbol][
        timeframe
      ].slice(-this.maxCandlesPerSymbol);
    }

    this.marketData[symbol][timeframe].sort(
      (a, b) => a.timestamp - b.timestamp
    );

    this.emit("newCandle", candle);
    this.emit(`candle:${symbol}:${timeframe}`, candle);
    this.emit(`candle:${symbol}`, candle);

    console.log(
      `[CANDLE MANAGER] Novo candle adicionado: ${symbol} ${timeframe} - Close: ${candle.close}`
    );
  }

  /**
   * Obtém candles de um símbolo e timeframe específico
   */
  getCandles(symbol: string, timeframe: string, limit?: number): Candle[] {
    const candles = this.marketData[symbol]?.[timeframe] || [];
    return limit ? candles.slice(-limit) : candles;
  }

  /**
   * Obtém o último candle de um símbolo e timeframe
   */
  getLastCandle(symbol: string, timeframe: string): Candle | null {
    const candles = this.getCandles(symbol, timeframe);
    return candles.length > 0 ? candles[candles.length - 1] : null;
  }

  /**
   * Obtém múltiplos candles de diferentes timeframes
   */
  getCandlesMultiTimeframe(
    symbol: string,
    timeframes: string[]
  ): { [timeframe: string]: Candle[] } {
    const result: { [timeframe: string]: Candle[] } = {};
    timeframes.forEach((tf) => {
      result[tf] = this.getCandles(symbol, tf);
    });
    return result;
  }

  /**
   * Obtém preço atual (último close) de um símbolo
   */
  getCurrentPrice(symbol: string, timeframe: string = "1m"): number | null {
    const lastCandle = this.getLastCandle(symbol, timeframe);
    return lastCandle ? lastCandle.close : null;
  }

  /**
   * Subscreve para receber atualizações de candles
   */
  subscribe(
    symbol: string,
    timeframe: string,
    callback?: (candle: Candle) => void
  ): void {
    const subscription: CandleSubscription = { symbol, timeframe, callback };
    this.subscriptions.add(subscription);

    if (callback) {
      this.on(`candle:${symbol}:${timeframe}`, callback);
    }

    console.log(`[CANDLE MANAGER] Subscrito para ${symbol} ${timeframe}`);
  }

  /**
   * Remove subscrição
   */
  unsubscribe(
    symbol: string,
    timeframe: string,
    callback?: (candle: Candle) => void
  ): void {
    if (callback) {
      this.removeListener(`candle:${symbol}:${timeframe}`, callback);
    }
    console.log(`[CANDLE MANAGER] Dessubscrito de ${symbol} ${timeframe}`);
  }

  /**
   * Obtém estatísticas dos dados em memória
   */
  getStats(): { [symbol: string]: { [timeframe: string]: number } } {
    const stats: { [symbol: string]: { [timeframe: string]: number } } = {};

    Object.keys(this.marketData).forEach((symbol) => {
      stats[symbol] = {};
      Object.keys(this.marketData[symbol]).forEach((timeframe) => {
        stats[symbol][timeframe] = this.marketData[symbol][timeframe].length;
      });
    });

    return stats;
  }

  /**
   * Limpa dados antigos (útil para manutenção)
   */
  clearOldData(olderThanHours: number = 24): void {
    const cutoffTime = Date.now() - olderThanHours * 60 * 60 * 1000;

    Object.keys(this.marketData).forEach((symbol) => {
      Object.keys(this.marketData[symbol]).forEach((timeframe) => {
        this.marketData[symbol][timeframe] = this.marketData[symbol][
          timeframe
        ].filter((candle) => candle.timestamp > cutoffTime);
      });
    });

    console.log(
      `[CANDLE MANAGER] Dados antigos removidos (>${olderThanHours}h)`
    );
  }

  /**
   * Obtém todos os símbolos disponíveis
   */
  getAvailableSymbols(): string[] {
    return Object.keys(this.marketData);
  }

  /**
   * Obtém todos os timeframes de um símbolo
   */
  getAvailableTimeframes(symbol: string): string[] {
    return Object.keys(this.marketData[symbol] || {});
  }
}

export const candleManager = CandleManager.getInstance();
