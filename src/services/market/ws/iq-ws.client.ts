import WebSocket from 'ws';
import { WSMessage, WSResponse, WSConnectionConfig, WSConnectionState, WSEventHandlers } from '../../../types/iq-ws.types';
import { WebSocketConnectionError, WebSocketAuthError, TimeoutError, ReconnectionFailedError } from '../errors/market.errors';
import { CleanupResource } from '../lifecycle/cleanup.service';
import { SessionService } from '../auth/session.service';

export class IQWebSocketClient implements CleanupResource {
  private ws: WebSocket | null = null;
  private state: WSConnectionState = 'disconnected';
  private config: WSConnectionConfig;
  private sessionService: SessionService;
  private eventHandlers: WSEventHandlers;
  private reconnectAttempts = 0;
  private connectionTimeout: NodeJS.Timeout | null = null;
  private authTimeout: NodeJS.Timeout | null = null;

  constructor(
    config: WSConnectionConfig,
    sessionService: SessionService,
    eventHandlers: WSEventHandlers = {}
  ) {
    this.config = config;
    this.sessionService = sessionService;
    this.eventHandlers = eventHandlers;
  }

  /**
   * Conecta ao WebSocket
   */
  async connect(): Promise<void> {
    if (this.state === 'connected' || this.state === 'connecting') {
      console.log('[WS] Já conectado ou conectando');
      return;
    }

    return new Promise((resolve, reject) => {
      console.log('[WS] Iniciando conexão...');
      this.state = 'connecting';
      
      this.ws = new WebSocket(this.config.url);
      
      // Timeout de conexão
      this.connectionTimeout = setTimeout(() => {
        if (this.state === 'connecting') {
          this.ws?.close();
          this.state = 'error';
          reject(new WebSocketConnectionError('Timeout na conexão'));
        }
      }, this.config.connectionTimeout);
      
      this.ws.on('open', () => {
        console.log('[WS] Conectado com sucesso');
        this.state = 'connected';
        this.reconnectAttempts = 0;
        
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout);
          this.connectionTimeout = null;
        }
        
        // Enviar SSID para autenticação
        this.sendSSID();
        
        // Aguardar autenticação
        this.waitForAuthentication(resolve, reject);
        
        this.eventHandlers.onOpen?.();
      });
      
      this.ws.on('error', (error) => {
        console.error('[WS] Erro:', error);
        this.state = 'error';
        
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout);
          this.connectionTimeout = null;
        }
        
        this.eventHandlers.onError?.(error as Error);
        reject(new WebSocketConnectionError(error.message));
      });
      
      this.ws.on('close', () => {
        console.log('[WS] Conexão fechada');
        this.state = 'disconnected';
        this.sessionService.invalidateSession();
        this.cleanup();
        this.eventHandlers.onClose?.();
      });
      
      this.ws.on('message', (data) => {
        this.handleMessage(data);
      });
    });
  }

  /**
   * Envia SSID para autenticação
   */
  private sendSSID(): void {
    const ssid = this.sessionService.getSSID();
    this.sendMessage('ssid', ssid);
  }

  /**
   * Aguarda confirmação de autenticação
   */
  private waitForAuthentication(resolve: Function, reject: Function): void {
    this.authTimeout = setTimeout(() => {
      if (!this.sessionService.isSessionAuthenticated()) {
        this.state = 'error';
        reject(new WebSocketAuthError('Timeout na autenticação'));
      }
    }, this.config.authTimeout);
    
    // Verificar autenticação periodicamente
    const checkAuth = setInterval(() => {
      if (this.sessionService.isSessionAuthenticated()) {
        clearInterval(checkAuth);
        if (this.authTimeout) {
          clearTimeout(this.authTimeout);
          this.authTimeout = null;
        }
        this.state = 'authenticated';
        this.eventHandlers.onAuthenticated?.();
        resolve();
      }
    }, 100);
  }

  /**
   * Envia mensagem via WebSocket
   */
  sendMessage(name: string, data: any, requestId?: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new WebSocketConnectionError('WebSocket não está conectado');
    }
    
    const message: WSMessage = {
      name,
      msg: data,
      request_id: requestId || Date.now().toString()
    };
    
    console.log(`[WS] Enviando: ${name}`);
    this.ws.send(JSON.stringify(message));
  }

  /**
   * Processa mensagens recebidas
   */
  private handleMessage(data: any): void {
    try {
      const message: WSResponse = JSON.parse(data.toString());
      
      // Marcar autenticação quando perfil é recebido
      if (message.name === 'profile') {
        this.sessionService.markAsAuthenticated();
        return;
      }
      
      this.eventHandlers.onMessage?.(message);
      
    } catch (error) {
      console.error('[WS] Erro ao processar mensagem:', error);
    }
  }

  /**
   * Reconecta em caso de falha
   */
  async reconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      throw new ReconnectionFailedError(this.reconnectAttempts);
    }
    
    this.reconnectAttempts++;
    console.log(`[WS] Tentativa de reconexão ${this.reconnectAttempts}/${this.config.maxReconnectAttempts}`);
    
    // Aguardar antes de reconectar
    await new Promise(resolve => setTimeout(resolve, 2000 * this.reconnectAttempts));
    
    await this.connect();
  }

  /**
   * Verifica se está conectado
   */
  isConnected(): boolean {
    return this.state === 'connected' || this.state === 'authenticated';
  }

  /**
   * Verifica se está autenticado
   */
  isAuthenticated(): boolean {
    return this.state === 'authenticated';
  }

  /**
   * Obtém estado atual
   */
  getState(): WSConnectionState {
    return this.state;
  }

  /**
   * Fecha conexão
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
    }
  }

  /**
   * Implementa CleanupResource
   */
  cleanup(): void {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
    
    if (this.authTimeout) {
      clearTimeout(this.authTimeout);
      this.authTimeout = null;
    }
    
    this.state = 'disconnected';
  }
}