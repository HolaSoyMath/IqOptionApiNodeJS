export interface BinaryMarket {
  id: number;
  name: string;
  enabled: boolean;
  is_suspended: boolean;
  type: 'binary' | 'turbo';
  profit_commission: number;
  payout_percentage: number;
  payout_raw: number;
  active_id: number;
  schedule?: Array<{
    open: number;
    close: number;
  }>;
  is_open: boolean;
  source: 'websocket' | 'rest';
  last_updated: string;
}

export interface InstrumentMarket {
  id: string;
  name: string;
  active_id: number;
  type: 'crypto' | 'forex' | 'cfd';
  schedule: Array<{
    open: number;
    close: number;
  }>;
  is_open: boolean;
  precision?: number;
  min_amount?: number;
  max_amount?: number;
}

export interface MarketData {
  binary_markets: BinaryMarket[];
  turbo_markets: BinaryMarket[];
  crypto_markets: InstrumentMarket[];
  forex_markets: InstrumentMarket[];
  cfd_markets: InstrumentMarket[];
  timestamp: string;
  server_time: number;
}

export interface InitializationData {
  result?: {
    binary?: {
      actives: Record<string, any>;
    };
    turbo?: {
      actives: Record<string, any>;
    };
  };
  [key: string]: any;
}

export interface InstrumentsData {
  instruments: Array<{
    id: string;
    name: string;
    active_id: number;
    schedule: Array<{
      open: number;
      close: number;
    }>;
    precision: number;
    min_amount: number;
    max_amount: number;
  }>;
}

export interface PairAvailabilityResult {
  available: boolean;
  markets: string[];
  profit_rates: Record<string, number>;
}


// Tipos simplificados para o endpoint /markets (sem schedule)
export interface SimpleBinaryMarket {
  id: number;
  name: string;
  active_id: number;
  type: 'binary' | 'turbo';
}

export interface SimpleInstrumentMarket {
  id: string;
  name: string;
  active_id: number;
  type: 'crypto' | 'forex' | 'cfd';
}

export interface SimpleMarketData {
  binary_markets: SimpleBinaryMarket[];
  turbo_markets: SimpleBinaryMarket[];
  crypto_markets: SimpleInstrumentMarket[];
}

// Novo tipo leve para Binary/Turbo
export interface BinTurboLite {
  id: number;
  name: string;
  active_id: number;
  category: 'binary' | 'turbo';
}

export interface BinaryTurboInit {
  binary: Array<BinTurboLite>;
  turbo: Array<BinTurboLite>;
}