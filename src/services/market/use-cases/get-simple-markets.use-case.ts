import { SimpleMarketData } from '../../../types/market.types';
import { IQWebSocketClient } from '../ws/iq-ws.client';
import { CacheService } from '../cache/cache.service';
import { MarketDataMapper } from '../mappers/market.mappers';
import { MarketError } from '../errors/market.errors';

export class GetSimpleMarketsUseCase {
  private readonly CACHE_KEY = 'simple_markets';
  private readonly CACHE_TTL = 30000;
  private pendingInitRequests = new Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }>();
  private pendingInstrumentsRequests = new Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }>();

  constructor(
    private readonly wsClient: IQWebSocketClient,
    private readonly cacheService: CacheService,
    private readonly mappers: typeof MarketDataMapper
  ) {}

  async execute(): Promise<SimpleMarketData> {
    try {
      // Check cache first
      const cachedData = this.cacheService.get<SimpleMarketData>(this.CACHE_KEY);
      if (cachedData) {
        console.log('[GetSimpleMarkets] Returning cached data');
        return cachedData;
      }

      // Connect if needed (authentication happens automatically)
      if (!this.wsClient.isConnected()) {
        await this.wsClient.connect();
      }

      // Wait for authentication if not already authenticated
      if (!this.wsClient.isAuthenticated()) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (!this.wsClient.isAuthenticated()) {
          throw new MarketError('WebSocket authentication failed', 'AUTH_FAILED');
        }
      }

      // Get all market data with error handling
      const [initDataResult, cryptoDataResult] = await Promise.allSettled([
        this.getInitializationData(),
        this.getInstruments('crypto')
      ]);

      // Process initialization data (binary/turbo)
      let binaryMarkets: any[] = [];
      let turboMarkets: any[] = [];
      
      if (initDataResult.status === 'fulfilled' && initDataResult.value) {
        const { binary, turbo } = this.mappers.mapSimpleBinaryData(initDataResult.value);
        binaryMarkets = binary;
        turboMarkets = turbo;
      } else {
        console.warn('[GetSimpleMarkets] Falha ao obter dados de inicialização:', 
          initDataResult.status === 'rejected' ? initDataResult.reason?.message : 'Unknown error');
      }

      // Process crypto data
      let cryptoMarkets: any[] = [];
      if (cryptoDataResult.status === 'fulfilled' && cryptoDataResult.value) {
        cryptoMarkets = this.mappers.mapSimpleInstruments(cryptoDataResult.value, 'crypto');
      } else {
        console.warn('[GetSimpleMarkets] Falha ao obter dados crypto:', 
          cryptoDataResult.status === 'rejected' ? cryptoDataResult.reason?.message : 'Unknown error');
      }

      const result: SimpleMarketData = {
        binary_markets: binaryMarkets,
        turbo_markets: turboMarkets,
        crypto_markets: cryptoMarkets
      };

      // Cache the result
      this.cacheService.set(this.CACHE_KEY, result, this.CACHE_TTL);
      
      console.log('[GetSimpleMarkets] Retrieved simple market data successfully');
      return result;
      
    } catch (error) {
      console.error('[GetSimpleMarkets] Error:', error);
      throw new MarketError(
        `Failed to get simple markets: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GET_SIMPLE_MARKETS_ERROR'
      );
    }
  }

  private async getInitializationData(): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestId = `init-${Date.now()}`;
      
      const timeout = setTimeout(() => {
        this.pendingInitRequests.delete(requestId);
        reject(new MarketError('Timeout ao obter dados de inicialização', 'INIT_DATA_TIMEOUT'));
      }, 10000);

      this.pendingInitRequests.set(requestId, { resolve, reject, timeout });

      this.wsClient.sendMessage('sendMessage', {
        name: 'get-initialization-data',
        version: '3.0',
        body: {},
        request_id: requestId
      });
    });
  }

  private async getInstruments(type: 'crypto'): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestId = `instruments-${type}-${Date.now()}`;

      const timeout = setTimeout(() => {
        this.pendingInstrumentsRequests.delete(requestId);
        reject(new MarketError(`Timeout ao obter instrumentos ${type}`, 'INSTRUMENTS_TIMEOUT'));
      }, 10000);

      this.pendingInstrumentsRequests.set(requestId, { resolve, reject, timeout });

      this.wsClient.sendMessage('sendMessage', {
        name: 'get-instruments',
        version: '4.0',
        body: { type },
        request_id: requestId
      });
    });
  }

  public handleInitializationData(data: any, requestId: string): void {
    const pending = this.pendingInitRequests.get(requestId);
    if (pending) {
      clearTimeout(pending.timeout);
      pending.resolve(data);
      this.pendingInitRequests.delete(requestId);
    }
  }

  public handleInstrumentsData(data: any, requestId: string): void {
    const pending = this.pendingInstrumentsRequests.get(requestId);
    if (pending) {
      clearTimeout(pending.timeout);
      pending.resolve(data);
      this.pendingInstrumentsRequests.delete(requestId);
    }
  }
}