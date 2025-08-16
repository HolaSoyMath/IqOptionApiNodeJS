import { CacheMissError } from '../errors/market.errors';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class CacheService {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly DEFAULT_TTL = 60; // segundos

  /**
   * Obtém dados do cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    const now = Date.now();
    const isExpired = (now - entry.timestamp) / 1000 > entry.ttl;

    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Armazena dados no cache
   */
  set<T>(key: string, data: T, ttlSeconds: number = this.DEFAULT_TTL): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttlSeconds
    };

    this.cache.set(key, entry);
  }

  /**
   * Remove entrada do cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Limpa todo o cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Obtém dados do cache ou lança erro
   */
  getOrThrow<T>(key: string): T {
    const data = this.get<T>(key);
    if (data === null) {
      throw new CacheMissError(key);
    }
    return data;
  }

  /**
   * Verifica se uma chave existe no cache
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Obtém estatísticas do cache
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Chaves de cache padronizadas
export const CacheKeys = {
  BINARY_MARKETS: 'markets:binary',
  ALL_MARKETS: 'markets:all',
  CRYPTO_INSTRUMENTS: 'instruments:crypto',
  FOREX_INSTRUMENTS: 'instruments:forex',
  CFD_INSTRUMENTS: 'instruments:cfd',
  INITIALIZATION_DATA: 'init:data',
  PAIR_AVAILABILITY: (pair: string) => `pair:${pair.toLowerCase()}`,
} as const;

// TTL padrão por tipo de dados
export const CacheTTL = {
  PAYOUT_DATA: 10, // 10 segundos para dados de payout
  MARKET_DATA: 15, // 15 segundos para mercados
  INSTRUMENTS: 120, // 2 minutos para instrumentos
  INITIALIZATION: 300, // 5 minutos para dados de inicialização
  PAIR_CHECK: 60, // 1 minuto para verificação de pares
} as const;