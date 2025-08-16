import { CandleData, LiveCandle } from './candles.types';
import { KeyUtils } from '../utils/keys';

export class CandlesStore {
  private history = new Map<string, CandleData[]>();
  private current = new Map<string, LiveCandle>();
  private readonly maxHistorySize: number;

  constructor(maxHistorySize: number = 500) {
    this.maxHistorySize = maxHistorySize;
  }

  pushHistory(activeId: number, size: number, candle: CandleData | LiveCandle): void {
    const key = KeyUtils.candleKey(activeId, size);
    if (!this.history.has(key)) {
      this.history.set(key, []);
    }
    
    const historyArray = this.history.get(key)!;
    
    // Converter para CandleData garantindo que todas as propriedades sejam obrigatórias
    const historyCandle: CandleData = {
      active_id: candle.active_id,
      size: candle.size,
      from: candle.from,
      to: candle.to,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume ?? 0,
      phase: 'closed',
      at: candle.at ?? candle.from,
      id: candle.id ?? candle.from
    };
    
    historyArray.push(historyCandle);
    
    // Manter tamanho do histórico
    if (historyArray.length > this.maxHistorySize) {
      historyArray.shift();
    }
  }

  getHistory(activeId: number, size: number): CandleData[] {
    const key = KeyUtils.candleKey(activeId, size);
    return this.history.get(key) || [];
  }

  getCurrent(activeId: number, size: number): LiveCandle | undefined {
    const key = KeyUtils.candleKey(activeId, size);
    return this.current.get(key);
  }

  setCurrent(activeId: number, size: number, candle: LiveCandle): void {
    const key = KeyUtils.candleKey(activeId, size);
    this.current.set(key, candle);
  }

  deleteCurrent(activeId: number, size: number): boolean {
    const key = KeyUtils.candleKey(activeId, size);
    return this.current.delete(key);
  }

  status(): { historyCount: number; currentKeys: string[] } {
    const historyCount = Array.from(this.history.values())
      .reduce((total, candles) => total + candles.length, 0);
    
    const currentKeys = Array.from(this.current.keys());
    
    return { historyCount, currentKeys };
  }

  clear(): void {
    this.history.clear();
    this.current.clear();
  }
}