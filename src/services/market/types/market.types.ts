// Re-export dos tipos principais para facilitar imports internos
export {
  BinaryMarket,
  InstrumentMarket,
  MarketData,
  InitializationData,
  InstrumentsData
} from '../../../types/market.types';

// Tipos específicos do módulo market
export interface MarketServiceConfig {
  wsUrl?: string;
  maxReconnectAttempts?: number;
  cacheDefaultTTL?: number;
  heartbeatInterval?: number;
}

export interface MarketStats {
  totalBinaryMarkets: number;
  totalTurboMarkets: number;
  totalCryptoMarkets: number;
  totalForexMarkets: number;
  totalCfdMarkets: number;
  lastUpdated: string;
  cacheHitRate: number;
}