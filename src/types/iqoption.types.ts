export interface IQOptionInitializationData {
  result: {
    binary: {
      actives: Record<string, IQOptionActive>;
    };
    turbo: {
      actives: Record<string, IQOptionActive>;
    };
  };
  isSuccessful: boolean;
}

export interface IQOptionActive {
  name: string;
  enabled: boolean;
  is_suspended: boolean;
  option: {
    profit: {
      commission: number;
    };
  };
  schedule?: Array<{
    open: number;
    close: number;
  }>;
}

export interface PayoutData {
  id: number;
  name: string;
  instrument_type: 'binary' | 'turbo';
  payout_percentage: string;
  payout_raw: number;
  active_id: number;
  source: 'websocket' | 'rest';
  last_updated: string;
}