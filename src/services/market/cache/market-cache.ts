import { BinaryOpenState } from '../../../types/market.types';

// Interface para entrada do cache digital
interface DigitalInstrumentEntry {
  instrument_id: string;
  instrument_index: number;
  active_id: number;
  expiry_epoch: number;
  duration: 1 | 5;
  direction: "call" | "put";
}

/**
 * Singleton para cache de dados de mercado
 * Mantém em memória os dados necessários para o endpoint /api/markets/binary
 */
export class MarketCache {
  private static instance: MarketCache;
  
  // Cache tables conforme especificado
  public readonly names = new Map<number, string>();                    // active_id -> name (from underlying-list)
  public readonly binaryCommissions = new Map<number, number>();        // active_id -> open_percent (from trading-params)
  public readonly binaryOpenState = new Map<number, BinaryOpenState>(); // active_id -> { subtype, is_open }
  public readonly binaryValues = new Map<number, number>();             // active_id -> value (from instruments)
  
  // Cache de instrumentos digitais
  // Chave: `${active_id}:${expiry_epoch}:${duration}:${direction}`
  public readonly digitalIndex = new Map<string, DigitalInstrumentEntry>();

  private constructor() {}
  
  public static getInstance(): MarketCache {
    if (!MarketCache.instance) {
      MarketCache.instance = new MarketCache();
    }
    return MarketCache.instance;
  }
  
  /**
   * Função utilitária para calcular payout de binárias
   * payout_percent = 100 - open_percent
   */
  public getBinaryPayout(activeId: number): number | undefined {
    const openPercent = this.binaryCommissions.get(activeId);
    if (typeof openPercent !== "number") return undefined;
    return Math.max(0, 100 - openPercent);
  }

  /**
   * Obtém o valor binário do cache
   */
  public getBinaryValue(activeId: number): number | null {
    return this.binaryValues.get(activeId) || null;
  }

  /**
   * Atualiza nomes dos ativos (from underlying-list)
   */
  public updateNames(namesData: Record<number, string>): void {
    Object.entries(namesData).forEach(([activeId, name]) => {
      this.names.set(Number(activeId), name);
    });
  }

  /**
   * Atualiza comissões binárias (from trading-params)
   */
  public updateBinaryCommissions(commissionsData: Record<number, number>): void {
    Object.entries(commissionsData).forEach(([activeId, openPercent]) => {
      this.binaryCommissions.set(Number(activeId), openPercent);
    });
  }

  /**
   * Atualiza valores binários (from instruments)
   */
  public updateBinaryValues(valuesData: Record<number, number>): void {
    Object.entries(valuesData).forEach(([activeId, value]) => {
      this.binaryValues.set(Number(activeId), value);
    });
  }
  
  /**
   * Atualiza estado de abertura dos mercados binários (from instruments)
   */
  public updateBinaryOpenState(activeId: number, state: BinaryOpenState): void {
    this.binaryOpenState.set(activeId, state);
  }

  /**
   * Adiciona ou atualiza um instrumento digital no cache
   */
  public upsertDigitalInstrument(entry: DigitalInstrumentEntry): void {
    const key = `${entry.active_id}:${entry.expiry_epoch}:${entry.duration}:${entry.direction}`;
    this.digitalIndex.set(key, entry);
  }
  
  /**
   * Resolve instrumento digital em tempo real com tolerância de ±1-2s
   */
  public resolveDigitalInstrument(
    active_id: number,
    expiry_epoch: number,
    duration: 1 | 5,
    direction: "call" | "put"
  ): { instrument_id: string; instrument_index: number } | null {
    // Tentar busca exata primeiro
    const exactKey = `${active_id}:${expiry_epoch}:${duration}:${direction}`;
    const exactMatch = this.digitalIndex.get(exactKey);
    
    if (exactMatch) {
      return {
        instrument_id: exactMatch.instrument_id,
        instrument_index: exactMatch.instrument_index
      };
    }
    
    // Busca com tolerância de ±2 segundos
    for (let offset = -2; offset <= 2; offset++) {
      if (offset === 0) continue; // já testamos acima
      
      const tolerantKey = `${active_id}:${expiry_epoch + offset}:${duration}:${direction}`;
      const tolerantMatch = this.digitalIndex.get(tolerantKey);
      
      if (tolerantMatch) {
        return {
          instrument_id: tolerantMatch.instrument_id,
          instrument_index: tolerantMatch.instrument_index
        };
      }
    }
    
    return null;
  }
  
  /**
   * Limpa todos os caches
   */
  public clear(): void {
    this.names.clear();
    this.binaryCommissions.clear();
    this.binaryOpenState.clear();
    this.binaryValues.clear();
    this.digitalIndex.clear();
  }

  /**
   * Obtém estatísticas do cache
   */
  public getStats() {
    return {
      names: this.names.size,
      binaryCommissions: this.binaryCommissions.size,
      binaryOpenState: this.binaryOpenState.size,
      binaryValues: this.binaryValues.size,
      digitalIndex: this.digitalIndex.size,
    };
  }
}

// Export singleton instance
export const marketCache = MarketCache.getInstance();