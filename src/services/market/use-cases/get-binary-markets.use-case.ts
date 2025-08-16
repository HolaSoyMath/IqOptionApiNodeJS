import { BinaryMarket } from '../../../types/market.types';
import { IQWebSocketClient } from '../ws/iq-ws.client';
import { CacheService } from '../cache/cache.service';
import { MarketDataMapper } from '../mappers/market.mappers';
import { MarketError } from '../errors/market.errors';

export interface GetBinaryMarketsResult {
  binary: BinaryMarket[];
  turbo: BinaryMarket[];
}

export class GetBinaryMarketsUseCase {
  private pendingRequests = new Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }>();
  private readonly CACHE_KEY = 'binary_markets';
  private readonly CACHE_TTL = 30000; // 30 seconds

  constructor(
    private readonly wsClient: IQWebSocketClient,
    private readonly cacheService: CacheService,
    private readonly mappers: typeof MarketDataMapper
  ) {
    this.setupMessageListener();
  }

  async execute(): Promise<GetBinaryMarketsResult> {
    try {
      // Check cache first
      const cachedData = this.cacheService.get<GetBinaryMarketsResult>(this.CACHE_KEY);
      if (cachedData) {
        console.log('[GetBinaryMarkets] Returning cached data');
        return cachedData;
      }

      // Connect if needed (authentication happens automatically)
      if (!this.wsClient.isConnected()) {
        await this.wsClient.connect();
      }

      // Wait for authentication if not already authenticated
      if (!this.wsClient.isAuthenticated()) {
        // Wait a bit for authentication to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (!this.wsClient.isAuthenticated()) {
          throw new MarketError('WebSocket authentication failed', 'AUTH_FAILED');
        }
      }

      // Get initialization data
      const initData = await this.getInitializationData();
      
      // Map and filter data
      const { binary, turbo } = this.mappers.mapBinaryData(initData);
      
      const result: GetBinaryMarketsResult = {
        binary: binary.filter(market => market.enabled && !market.is_suspended),
        turbo: turbo.filter(market => market.enabled && !market.is_suspended)
      };

      // Cache the result
      this.cacheService.set(this.CACHE_KEY, result, this.CACHE_TTL);
      
      console.log(`[GetBinaryMarkets] Found ${result.binary.length} binary and ${result.turbo.length} turbo markets`);
      return result;
      
    } catch (error) {
      console.error('[GetBinaryMarkets] Error:', error);
      throw new MarketError(
        `Failed to get binary markets: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GET_BINARY_MARKETS_ERROR'
      );
    }
  }

  private setupMessageListener(): void {
    // Você precisará modificar o wsClient para permitir adicionar listeners
    // ou usar um event emitter pattern
  }

  private async getInitializationData(): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestId = `init_${Date.now()}`;
      
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new MarketError('Timeout ao obter dados de inicialização', 'INIT_DATA_TIMEOUT'));
      }, 10000);

      // Registrar requisição pendente
      this.pendingRequests.set(requestId, { resolve, reject, timeout: timeoutHandle });

      // Enviar requisição
      // Alternativa 1: Usar api_option_init_all
      this.wsClient.sendMessage('api_option_init_all', '', requestId);
      
      // Alternativa 2: Usar sendMessage com get-initialization-data
      this.wsClient.sendMessage('sendMessage', {
        name: 'get-initialization-data',
        version: '3.0',
        body: {}
      }, requestId);
    });
  }

  // Método para ser chamado quando uma resposta WebSocket chegar
  handleWebSocketResponse(requestId: string, data: any): void {
    const request = this.pendingRequests.get(requestId);
    if (request) {
      clearTimeout(request.timeout);
      this.pendingRequests.delete(requestId);
      request.resolve(data);
    }
  }
}