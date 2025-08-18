import { BinaryOpenState } from '../../../types/market.types';

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
   * Limpa todos os caches
   */
  public clear(): void {
    this.names.clear();
    this.binaryCommissions.clear();
    this.binaryOpenState.clear();
  }
  
  /**
   * Atualiza nomes dos ativos (from underlying-list)
   */
  public updateNames(nameData: Record<number, string>): void {
    Object.entries(nameData).forEach(([activeId, name]) => {
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
   * Atualiza estado de abertura dos mercados binários (from instruments)
   */
  public updateBinaryOpenState(activeId: number, state: BinaryOpenState): void {
    this.binaryOpenState.set(activeId, state);
  }
}

// Export singleton instance
export const marketCache = MarketCache.getInstance();