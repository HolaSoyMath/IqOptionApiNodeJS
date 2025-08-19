/**
 * Interface para instrumentos digitais da IQ Option
 */
export interface DigitalInstrument {
  /** ID único do instrumento (formato: do{activeId}A{YYYYMMDD}D{HHMMSS}T{duration}M{C|P}SPT) */
  instrument_id: string;
  
  /** Índice numérico do instrumento */
  instrument_index: number;
  
  /** ID do ativo subjacente */
  active_id: number;
  
  /** Timestamp de expiração em epoch (segundos) */
  expiry_epoch: number;
  
  /** Duração da opção em minutos */
  duration_minutes: 1 | 5;
  
  /** Direção da opção */
  direction: "call" | "put";
  
  /** Preço de strike (opcional) */
  strike?: number | null;
  
  /** Se o instrumento está suspenso */
  is_suspended: boolean;
}