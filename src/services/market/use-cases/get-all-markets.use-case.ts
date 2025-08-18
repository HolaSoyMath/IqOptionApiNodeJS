import { MarketData, InstrumentMarket } from '../../../types/market.types';
import { IQWebSocketClient } from '../ws/iq-ws.client';
import { CacheService } from '../cache/cache.service';
import { MarketDataMapper } from '../mappers/market.mappers';
import { MarketError } from '../errors/market.errors';

export class GetAllMarketsUseCase {
  private readonly CACHE_KEY = 'all_markets';
  private readonly CACHE_TTL = 30000; // 30 seconds
  private pendingInitRequests = new Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }>();
  private pendingInstrumentRequests = new Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }>();

  constructor(
    private readonly wsClient: IQWebSocketClient,
    private readonly cacheService: CacheService,
    private readonly mappers: typeof MarketDataMapper
  ) {}

  async execute(): Promise<MarketData> {
    try {
      // Check cache first
      const cachedData = this.cacheService.get<MarketData>(this.CACHE_KEY);
      if (cachedData) {
        console.log('[GetAllMarkets] Returning cached data');
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
  
      // Get all market data with individual error handling
      const results = await Promise.allSettled([
        this.getInitializationData(),
        this.getInstruments('crypto'),
        this.getInstruments('forex'),
        this.getInstruments('cfd')
      ]);
  
      // Process results with fallbacks
      const initData = results[0].status === 'fulfilled' ? results[0].value : { binary: { list: [], actives: {} }, turbo: { list: [], actives: {} } };
      const cryptoData = results[1].status === 'fulfilled' ? results[1].value : { instruments: [] };
      const forexData = results[2].status === 'fulfilled' ? results[2].value : { instruments: [] };
      const cfdData = results[3].status === 'fulfilled' ? results[3].value : { instruments: [] };
  
      // Log any failures
      results.forEach((result, index) => {
        const types = ['initialization', 'crypto', 'forex', 'cfd'];
        if (result.status === 'rejected') {
          console.warn(`[GetAllMarkets] Failed to get ${types[index]} data:`, result.reason?.message);
        }
      });
  
      // Map data with fallbacks
      const { binary, turbo } = this.mappers.mapBinaryData(initData);
      const cryptoMarkets = this.mappers.mapInstruments(cryptoData, 'crypto');
      const forexMarkets = this.mappers.mapInstruments(forexData, 'forex');
      const cfdMarkets = this.mappers.mapInstruments(cfdData, 'cfd');
  
      const result: MarketData = {
        binary_markets: binary.filter(m => m.enabled && !m.is_suspended),
        turbo_markets: turbo.filter(m => m.enabled && !m.is_suspended),
        crypto_markets: cryptoMarkets,
        forex_markets: forexMarkets,
        cfd_markets: cfdMarkets,
        timestamp: new Date().toISOString(),
        server_time: Date.now()
      };
  
      // Cache the result
      this.cacheService.set(this.CACHE_KEY, result, this.CACHE_TTL);
      
      console.log('[GetAllMarkets] Retrieved all market data successfully');
      return result;
      
    } catch (error) {
      console.error('[GetAllMarkets] Error:', error);
      throw new MarketError(
        `Failed to get all markets: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GET_ALL_MARKETS_ERROR'
      );
    }
  }

  private async getInitializationData(): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestId = Date.now().toString();
      
      const timeout = setTimeout(() => {
        this.pendingInitRequests.delete(requestId);
        reject(new MarketError('Timeout ao obter dados de inicialização', 'INIT_DATA_TIMEOUT'));
      }, 10000);

      // Store the pending request
      this.pendingInitRequests.set(requestId, { resolve, reject, timeout });

      // Send initialization data request
      this.wsClient.sendMessage('sendMessage', {
        name: 'get-initialization-data',
        version: '3.0',
        body: {},
        request_id: requestId
      });
    });
  }

  private async getInstruments(type: 'crypto' | 'forex' | 'cfd'): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestId = `${type}_${Date.now()}`;
      
      const timeout = setTimeout(() => {
        this.pendingInstrumentRequests.delete(requestId);
        reject(new MarketError(`Timeout ao obter instrumentos ${type}`, 'INSTRUMENTS_TIMEOUT'));
      }, 10000);

      // Store the pending request
      this.pendingInstrumentRequests.set(requestId, { resolve, reject, timeout });

      // Send instruments request
      this.wsClient.sendMessage('sendMessage', {
        name: 'get-instruments',
        version: '4.0',
        body: { type },
        request_id: requestId
      });
    });
  }

  // Method to handle incoming initialization data
  public handleInitializationData(data: any): void {
    // Find and resolve pending requests
    for (const [requestId, pending] of this.pendingInitRequests.entries()) {
      clearTimeout(pending.timeout);
      pending.resolve(data);
      this.pendingInitRequests.delete(requestId);
      break; // Resolve the first pending request
    }
  }

  // Method to handle incoming instruments data
  public handleInstrumentsData(data: any, type?: string): void {
    
    // Extract type from data if not provided
    const instrumentType = type || data?.type;
    
    if (!instrumentType) {
      console.warn('[GetAllMarkets] No instrument type found in data:', data);
      return;
    }
    
    // Find and resolve pending requests based on type
    let resolved = false;
    for (const [requestId, pending] of this.pendingInstrumentRequests.entries()) {
      // Match by type prefix in request ID
      if (requestId.startsWith(instrumentType.toLowerCase())) {
        console.log(`[GetAllMarkets] Resolving ${instrumentType} request with ID: ${requestId}`);
        clearTimeout(pending.timeout);
        pending.resolve(data);
        this.pendingInstrumentRequests.delete(requestId);
        resolved = true;
        break;
      }
    }
    
    if (!resolved) {
      console.warn(`[GetAllMarkets] No pending request found for instrument type: ${instrumentType}`);
      console.log('[GetAllMarkets] Current pending requests:', Array.from(this.pendingInstrumentRequests.keys()));
    }
  }

  private processInstrumentResult(
    result: PromiseSettledResult<any>,
    type: 'crypto' | 'forex' | 'cfd'
  ): InstrumentMarket[] {
    if (result.status === 'fulfilled' && result.value) {
      return this.mappers.mapInstruments(result.value, type);
    } else {
      console.warn(`Erro ao obter ${type}:`, result.status === 'rejected' ? result.reason?.message : 'Unknown error');
      return [];
    }
  }

  // Cleanup method to clear pending requests
  public cleanup(): void {
    // Clear all pending initialization requests
    for (const [requestId, pending] of this.pendingInitRequests.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(new MarketError('Request cancelled during cleanup', 'CANCELLED'));
    }
    this.pendingInitRequests.clear();

    // Clear all pending instrument requests
    for (const [requestId, pending] of this.pendingInstrumentRequests.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(new MarketError('Request cancelled during cleanup', 'CANCELLED'));
    }
    this.pendingInstrumentRequests.clear();
  }
}