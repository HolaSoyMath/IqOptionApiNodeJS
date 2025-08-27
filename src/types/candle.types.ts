export interface Candle {
  id: string;
  symbol: string; // EURUSD, GBPUSD, etc.
  timeframe: string; // 1m, 5m, 15m, 1h, etc.
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  createdAt: Date;
}

export interface CandleSubscription {
  symbol: string;
  timeframe: string;
  callback?: (candle: Candle) => void;
}

export interface MarketData {
  [symbol: string]: {
    [timeframe: string]: Candle[];
  };
}
