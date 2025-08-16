import { WSResponse } from '../../../types/iq-ws.types';
import { InitializationData, InstrumentsData } from '../../../types/market.types';
import { PayloadFormatError } from '../errors/market.errors';
import { CleanupService } from '../lifecycle/cleanup.service';
import { HeartbeatService } from '../lifecycle/heartbeat.service';

export interface MessageHandler {
  handle(message: WSResponse): void;
}

export class WSMessageRouter {
  private handlers = new Map<string, MessageHandler>();
  private cleanupService: CleanupService;
  private heartbeatService: HeartbeatService;

  constructor(cleanupService: CleanupService, heartbeatService: HeartbeatService) {
    this.cleanupService = cleanupService;
    this.heartbeatService = heartbeatService;
    this.setupDefaultHandlers();
  }

  /**
   * Registra um handler para um tipo de mensagem
   */
  registerHandler(messageName: string, handler: MessageHandler): void {
    this.handlers.set(messageName, handler);
  }

  /**
   * Processa mensagem recebida
   */
  handleMessage(message: WSResponse): void {
    const messageName = message.name;
    
    console.log(`[WS] Mensagem recebida: ${messageName}`);
    
    // Verificar se há requisição pendente
    if (message.request_id) {
      const resolved = this.cleanupService.resolvePendingRequest(
        message.request_id,
        message.msg || message.data || message
      );
      
      if (resolved) {
        return; // Requisição foi resolvida
      }
    }
    
    // Processar com handler específico
    const handler = this.handlers.get(messageName);
    if (handler) {
      try {
        handler.handle(message);
      } catch (error) {
        console.error(`[WS] Erro no handler ${messageName}:`, error);
      }
    } else {
      console.log(`[WS] Handler não encontrado para: ${messageName}`);
    }
  }

  /**
   * Configura handlers padrão
   */
  private setupDefaultHandlers(): void {
    // Handler para heartbeat
    this.registerHandler('heartbeat', {
      handle: (message: WSResponse) => {
        this.heartbeatService.handleHeartbeat(message.msg);
      }
    });

    // Handler para dados de inicialização
    this.registerHandler('api_option_init_all_result', {
      handle: (message: WSResponse) => {
        this.handleInitializationData(message.msg || message.data);
      }
    });

    this.registerHandler('initialization-data', {
      handle: (message: WSResponse) => {
        this.handleInitializationData(message.msg || message.data);
      }
    });

    // Handler para instrumentos
    this.registerHandler('instruments', {
      handle: (message: WSResponse) => {
        this.handleInstrumentsData(message.msg || message.data);
      }
    });
  }

  /**
   * Processa dados de inicialização
   */
  private handleInitializationData(data: any): void {
    console.log('[WS] Processando dados de inicialização');
    
    if (!data) {
      throw new PayloadFormatError('Dados de inicialização vazios');
    }
    
    // Resolver requisições pendentes de inicialização
    for (const [requestId] of this.cleanupService['pendingRequests']) {
      if (requestId.startsWith('init_')) {
        this.cleanupService.resolvePendingRequest(requestId, data);
        break;
      }
    }
  }

  /**
   * Processa dados de instrumentos
   */
  private handleInstrumentsData(data: any): void {
    console.log('[WS] Processando dados de instrumentos');
    
    if (!data) {
      throw new PayloadFormatError('Dados de instrumentos vazios');
    }
    
    // Resolver requisições pendentes de instrumentos
    for (const [requestId] of this.cleanupService['pendingRequests']) {
      if (requestId.startsWith('instruments_')) {
        this.cleanupService.resolvePendingRequest(requestId, data);
        break;
      }
    }
  }
}