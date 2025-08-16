export interface CandleData {
  active_id: number;
  size: number;
  from: number;
  to: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  phase: 'closed' | 'T' | 'C';
  at?: number;
  id?: number;
}

export interface LiveCandle {
  active_id: number;
  size: number;
  from: number;
  to: number;
  at?: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  phase?: 'T' | 'closed' | 'C';
  id?: number;
}

export interface RequestInfo {
  active_id: number;
  size?: number;
  sizes?: number[];
  timestamp: number;
}