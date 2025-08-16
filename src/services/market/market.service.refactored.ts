import { MarketData } from '../../types/market.types';
import { IQWebSocketClient } from './ws/iq-ws.client';
import { CacheService } from './cache/cache.service';
import { SessionService } from './auth/session.service';
import { MarketDataMapper } from './mappers/market.mappers';
import { WSResponse } from '../../types/iq-ws.types'; // Add this import
import { 
  GetBinaryMarketsUseCase, 
  GetAllMarketsUseCase, 
  CheckPairAvailabilityUseCase,
  GetBinaryMarketsResult,
  PairAvailabilityResult
} from './use-cases';
import { MarketError } from './errors/market.errors';
import { config } from '../../config/app.config';
import { GetSimpleMarketsUseCase } from './use-cases/get-simple-markets.use-case';
import { SimpleMarketData } from '../../types/market.types';

/**
 * Serviço principal para gerenciamento de mercados da IQ Option
 * Refatorado seguindo princípios SOLID para melhor coesão e menor acoplamento
 */
export class MarketService {
  private readonly wsClient: IQWebSocketClient;
  private readonly cacheService: CacheService;
  private readonly sessionService: SessionService;
  private readonly mappers: typeof MarketDataMapper;
  
  // Use cases
  private readonly getBinaryMarketsUseCase: GetBinaryMarketsUseCase;
  private readonly getAllMarketsUseCase: GetAllMarketsUseCase;
  private readonly checkPairAvailabilityUseCase: CheckPairAvailabilityUseCase;
  private getSimpleMarketsUseCase: GetSimpleMarketsUseCase;

  constructor(ssid: string) {
    if (!ssid || typeof ssid !== 'string') {
      throw new MarketError('INVALID_SSID', 'SSID inválido fornecido');
    }

    // Inicializar serviços de infraestrutura
    this.cacheService = new CacheService();
    this.sessionService = new SessionService({ ssid });
    this.mappers = MarketDataMapper;
    
    // Configuração do WebSocket
    const wsConfig = {
      url: config.iqOption.wsUrl,
      connectionTimeout: 10000,
      authTimeout: 5000,
      heartbeatInterval: 30000,
      maxReconnectAttempts: 5
    };
    
    // Configurar event handlers para o WebSocket
    const eventHandlers = {
      onMessage: (message: WSResponse) => {
        this.handleWebSocketMessage(message);
      },
      onOpen: () => console.log('[WS] Conexão aberta'),
      onClose: () => console.log('[WS] Conexão fechada'),
      onError: (error: Error) => console.error('[WS] Erro:', error)
    };
    
    this.wsClient = new IQWebSocketClient(
      wsConfig,
      this.sessionService,
      eventHandlers
    );
    
    // Inicializar casos de uso
    this.getBinaryMarketsUseCase = new GetBinaryMarketsUseCase(
      this.wsClient,
      this.cacheService,
      this.mappers
    );
    
    this.getAllMarketsUseCase = new GetAllMarketsUseCase(
      this.wsClient,
      this.cacheService,
      this.mappers
    );
    
    this.checkPairAvailabilityUseCase = new CheckPairAvailabilityUseCase(
      this.getAllMarketsUseCase
    );
    
    this.getSimpleMarketsUseCase = new GetSimpleMarketsUseCase(
      this.wsClient,
      this.cacheService,
      this.mappers
    );
  }

  /**
   * Obtém apenas mercados binários e turbo disponíveis
   * @returns Promise com mercados binários e turbo filtrados
   */
  async getBinaryMarkets(): Promise<GetBinaryMarketsResult> {
    return this.getBinaryMarketsUseCase.execute();
  }

  /**
   * Obtém todos os tipos de mercados disponíveis
   * @returns Promise com todos os mercados (binary, turbo, crypto, forex, cfd)
   */
  async getAllMarkets(): Promise<MarketData> {
    return this.getAllMarketsUseCase.execute();
  }

  /**
   * Verifica a disponibilidade de um par específico em todos os mercados
   * @param pair Nome do par a ser verificado (ex: 'EURUSD', 'BTCUSD')
   * @returns Promise com informações de disponibilidade e taxas de lucro
   */
  async checkPairAvailability(pair: string): Promise<PairAvailabilityResult> {
    return this.checkPairAvailabilityUseCase.execute(pair);
  }

  /**
   * Limpa todos os caches e recursos
   */
  async cleanup(): Promise<void> {
    try {
      await this.wsClient.disconnect();
      this.cacheService.clear();
      console.log('MarketService cleanup concluído');
    } catch (error) {
      console.error('Erro durante cleanup do MarketService:', error);
      throw new MarketError(
        'Falha ao limpar recursos do MarketService: CLEANUP_ERROR',
        'CLEANUP_ERROR'
      );
    }
  }

  /**
   * Verifica o status da conexão WebSocket
   * @returns true se conectado, false caso contrário
   */
  isConnected(): boolean {
    return this.wsClient.isConnected();
  }

  /**
   * Obtém estatísticas do cache
   * @returns Objeto com estatísticas do cache
   */
  getCacheStats(): { size: number; keys: string[] } {
    return this.cacheService.getStats();
  }

  private handleWebSocketMessage(message: WSResponse): void {
    console.log(`[WS] Mensagem recebida: ${message.name}`);
    
    // Processar diferentes tipos de mensagem
    switch (message.name) {
      case 'api_option_init_all_result':
      case 'initialization-data':
        this.handleInitializationData(message);
        break;
      case 'instruments':
        this.handleInstrumentsData(message);
        break;
      default:
        console.log(`[WS] Tipo de mensagem não tratado: ${message.name}`);
    }
  }

  private handleInitializationData(message: WSResponse): void {
    console.log('[WS] Processando dados de inicialização:', message);
    
    // Notify the use case about the received data
    this.getAllMarketsUseCase.handleInitializationData(message.msg);
  }

  private handleInstrumentsData(message: WSResponse): void {
    console.log('[WS] Processando dados de instrumentos:', message);
    
    // Extract the type from the message
    const instrumentType = message.msg?.type;
    
    if (instrumentType) {
      console.log(`[WS] Tipo de instrumento recebido: ${instrumentType}`);
      
      // Notify the use case about the received instruments data
      this.getAllMarketsUseCase.handleInstrumentsData(message.msg, instrumentType);
    } else {
      console.warn('[WS] Mensagem de instrumentos sem tipo:', message);
    }
  }

  /**
   * Obtém mercados simplificados (apenas campos essenciais, sem schedule)
   * @returns Promise com mercados simplificados
   */
  async getSimpleMarkets(): Promise<SimpleMarketData> {
    return this.getSimpleMarketsUseCase.execute();
  }
}