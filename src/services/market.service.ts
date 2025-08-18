import { MarketData } from '../types/market.types';
import { IQWebSocketClient } from './market/ws/iq-ws.client';
import { CacheService } from './market/cache/cache.service';
import { SessionService } from './market/auth/session.service';
import { MarketDataMapper } from './market/mappers/market.mappers';
import { WSResponse } from '../types/iq-ws.types';
import { 
  GetBinaryMarketsUseCase, 
  GetAllMarketsUseCase, 
  CheckPairAvailabilityUseCase,
  GetBinaryMarketsResult,
  PairAvailabilityResult
} from './market/use-cases';
import { MarketError } from './market/errors/market.errors';
import { config } from '../config/app.config';
import { GetSimpleMarketsUseCase } from './market/use-cases/get-simple-markets.use-case';
import { SimpleMarketData, BinaryMarket, BinaryTurboInit } from '../types/market.types';
import { marketCache } from './market/cache/market-cache';
import Logger from '../utils/logger';
import { IQWSClient } from './iq/ws-client';

/**
 * Serviço principal para gerenciamento de mercados da IQ Option
 * Refatorado seguindo princípios SOLID para melhor coesão e menor acoplamento
 */
export class MarketService {
  private readonly wsClient: IQWebSocketClient;
  private readonly cacheService: CacheService;
  private readonly sessionService: SessionService;
  private readonly mappers: typeof MarketDataMapper;
  private readonly ssid: string;
  
  // Use cases
  private readonly getBinaryMarketsUseCase: GetBinaryMarketsUseCase;
  private readonly getAllMarketsUseCase: GetAllMarketsUseCase;
  private readonly checkPairAvailabilityUseCase: CheckPairAvailabilityUseCase;
  private getSimpleMarketsUseCase: GetSimpleMarketsUseCase;

  constructor(ssid: string) {
    if (!ssid || typeof ssid !== 'string') {
      throw new MarketError('INVALID_SSID', 'SSID inválido fornecido');
    }

    this.ssid = ssid;

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
      onOpen: () => Logger.info('MARKET_SERVICE', 'Conexão WebSocket aberta'),
      onClose: () => Logger.info('MARKET_SERVICE', 'Conexão WebSocket fechada'),
      onError: (error: Error) => Logger.error('MARKET_SERVICE', 'Erro WebSocket', error)
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

    Logger.info('MARKET_SERVICE', 'MarketService inicializado com sucesso');
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
   * Obtém mercados simplificados (apenas campos essenciais)
   * Mantém compatibilidade com a interface original
   */
  async getSimpleMarkets(): Promise<SimpleMarketData> {
    return this.getSimpleMarketsUseCase.execute();
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
   * Obtém mercados Binary/Turbo de forma leve (sem schedule, sem payout)
   * Focado apenas em listagem de catálogo
   */
  async getBinaryTurboLite(): Promise<BinaryTurboInit> {
    try {
      const client = new IQWSClient({
        url: process.env.IQ_WSS_URL || 'wss://ws.iqoption.com/echo/websocket',
        ssid: this.ssid,
        timeout: 10000
      });

      await client.connect();
      const initData = await client.getInitializationData();
      
      const result: BinaryTurboInit = {
        binary: initData.binary.map(item => ({
          id: typeof item.id === 'number' ? item.id : parseInt(String(item.id)),
          name: item.name,
          active_id: item.active_id || (typeof item.id === 'number' ? item.id : parseInt(String(item.id))),
          category: 'binary' as const
        })),
        turbo: initData.turbo.map(item => ({
          id: typeof item.id === 'number' ? item.id : parseInt(String(item.id)),
          name: item.name,
          active_id: item.active_id || (typeof item.id === 'number' ? item.id : parseInt(String(item.id))),
          category: 'turbo' as const
        }))
      };

      client.disconnect();
      return result;
    } catch (error) {
      Logger.error('MARKET_SERVICE', 'Erro ao buscar Binary/Turbo lite', error);
      return { binary: [], turbo: [] };
    }
  }

  /**
   * Limpa todos os caches e recursos
   */
  async cleanup(): Promise<void> {
    try {
      await this.wsClient.disconnect();
      this.cacheService.clear();
      Logger.info('MARKET_SERVICE', 'MarketService cleanup concluído');
    } catch (error) {
      Logger.error('MARKET_SERVICE', 'Erro durante cleanup do MarketService', error);
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
    Logger.debug('MARKET_SERVICE', `Mensagem WebSocket recebida: ${message.name}`);
    
    // Processar diferentes tipos de mensagem
    switch (message.name) {
      case 'api_option_init_all_result':
      case 'initialization-data':
        this.handleInitializationData(message);
        break;
      case 'instruments':
        this.handleInstrumentsData(message);
        break;
      case 'timeSync':
        this.handleTimeSync(message);
        break;
      case 'front':
        this.handleFrontMessage(message);
        break;
      default:
        Logger.debug('MARKET_SERVICE', `Tipo de mensagem não tratado: ${message.name}`);
    }
  }

  private handleTimeSync(message: WSResponse): void {
    // Atualizar timestamp interno se necessário
    Logger.safe('MARKET_SERVICE', 'TimeSync recebido', { timestamp: Date.now() });
  }

  private handleFrontMessage(message: WSResponse): void {
    // Processar configurações do frontend se necessário
    Logger.safe('MARKET_SERVICE', 'Mensagem front recebida', message);
  }

  private handleInitializationData(message: WSResponse): void {
    const data = (message as any)?.msg || (message as any)?.data || message;
    try {
      // BINÁRIAS
      const binaryActives = data?.binary?.actives || {};
      const nameMap: Record<number, string> = {};
      const commissions: Record<number, number> = {};

      for (const [idStr, active] of Object.entries<any>(binaryActives)) {
        const activeId = Number(idStr);
        const rawName = active?.name ?? active?.asset ?? active?.ticker ?? active?.symbol ?? String(activeId);
        const name = typeof rawName === 'string' && rawName.startsWith('front.') ? rawName.slice(6) : rawName;
        nameMap[activeId] = name;

        const commission = active?.option?.profit?.commission;
        if (typeof commission === 'number') commissions[activeId] = commission;

        const isOpen = !!(active?.enabled && !active?.is_suspended);
        marketCache.updateBinaryOpenState(activeId, { subtype: 'binary', is_open: isOpen });
      }

      // TURBO
      const turboActives = data?.turbo?.actives || {};
      for (const [idStr, active] of Object.entries<any>(turboActives)) {
        const activeId = Number(idStr);
        const rawName = active?.name ?? active?.asset ?? active?.ticker ?? active?.symbol ?? String(activeId);
        const name = typeof rawName === 'string' && rawName.startsWith('front.') ? rawName.slice(6) : rawName;
        nameMap[activeId] = name;

        const commission = active?.option?.profit?.commission;
        if (typeof commission === 'number') commissions[activeId] = commission;

        const isOpen = !!(active?.enabled && !active?.is_suspended);
        marketCache.updateBinaryOpenState(activeId, { subtype: 'turbo', is_open: isOpen });
      }

      if (Object.keys(nameMap).length) {
        marketCache.updateNames(nameMap);
        Logger.safe('MARKET_SERVICE', `Cache names atualizado`, nameMap);
      }
      if (Object.keys(commissions).length) {
        marketCache.updateBinaryCommissions(commissions);
        Logger.safe('MARKET_SERVICE', `Cache binaryCommissions atualizado`, commissions);
      }
    } catch (err) {
      Logger.warn('MARKET_SERVICE', 'Falha ao aplicar initialization-data no cache', err);
    }

    this.getAllMarketsUseCase.handleInitializationData(message.msg);
  }

  private handleInstrumentsData(message: WSResponse): void {
    try {
      const data = (message as any)?.msg || (message as any)?.data || message;
      const instrumentType = data?.type;

      if (instrumentType === 'binary-option' || instrumentType === 'turbo-option') {
        const subtype = instrumentType === 'binary-option' ? 'binary' : 'turbo';
        const list = Array.isArray(data?.instruments) ? data.instruments : [];

        let count = 0;
        for (const instr of list) {
          const activeId = Number(instr?.active_id ?? instr?.id);
          if (!Number.isFinite(activeId)) continue;

          let isOpen = !!instr?.enabled;
          if (!isOpen && Array.isArray(instr?.schedule)) {
            const now = Date.now() / 1000;
            isOpen = instr.schedule.some((w: any) => now >= w.open && now <= w.close);
          }

          marketCache.updateBinaryOpenState(activeId, { subtype, is_open: isOpen });
          count++;
        }
        Logger.safe('MARKET_SERVICE', `Cache binaryOpenState (${subtype}) atualizado`, { count });
      }
    } catch (err) {
      Logger.warn('MARKET_SERVICE', 'Falha ao aplicar instruments no cache', err);
    }

    const instrumentType = (message as any)?.msg?.type;
    if (instrumentType) {
      this.getAllMarketsUseCase.handleInstrumentsData((message as any).msg, instrumentType);
    } else {
      Logger.warn('MARKET_SERVICE', 'Mensagem de instrumentos sem tipo', message);
    }
  }
}