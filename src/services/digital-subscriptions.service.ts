import { IQWSClient } from "./iq/ws-client";
import { digitalInstrumentsCache } from "./digital-instruments-cache.service";
import { Logger } from "../utils/logger";

export interface SubscriptionConfig {
  autoSubscribeInstruments: boolean;
  autoSubscribePrices: boolean;
  priceSubscriptionAssets: number[];
  reconnectOnDisconnect: boolean;
  subscriptionRetryDelay: number;
  maxRetryAttempts: number;
}

export class DigitalSubscriptionsService {
  private wsClient: IQWSClient;
  private config: SubscriptionConfig;
  private retryAttempts = new Map<string, number>();
  private subscriptionTimers = new Map<string, NodeJS.Timeout>();
  private isInitialized = false;

  constructor(wsClient: IQWSClient, config: Partial<SubscriptionConfig> = {}) {
    if (!wsClient) {
      throw new Error("wsClient é obrigatório para DigitalSubscriptionsService");
    }
    
    this.wsClient = wsClient;
    this.config = {
      autoSubscribeInstruments: true,
      autoSubscribePrices: false,
      priceSubscriptionAssets: [],
      reconnectOnDisconnect: true,
      subscriptionRetryDelay: 5000,
      maxRetryAttempts: 3,
      ...config,
    };

    this.setupEventHandlers();
  }

  /**
   * Inicializa as assinaturas automáticas
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      Logger.warn("DIGITAL_SUBSCRIPTIONS", "Serviço já inicializado");
      return;
    }

    try {
      // Aguardar conexão e autenticação
      if (!this.wsClient.isConnected()) {
        await this.wsClient.connect();
      }

      // Subscrever instrumentos digitais automaticamente
      if (this.config.autoSubscribeInstruments) {
        await this.subscribeInstrumentsWithRetry();
      }

      // Subscrever preços se configurado
      if (
        this.config.autoSubscribePrices &&
        this.config.priceSubscriptionAssets.length > 0
      ) {
        await this.subscribePricesWithRetry(
          this.config.priceSubscriptionAssets
        );
      }

      this.isInitialized = true;
      Logger.info("DIGITAL_SUBSCRIPTIONS", "Serviço inicializado com sucesso");
    } catch (error) {
      Logger.error(
        "DIGITAL_SUBSCRIPTIONS",
        "Erro ao inicializar serviço",
        error
      );
      throw error;
    }
  }

  /**
   * Subscreve instrumentos digitais com retry automático
   */
  private async subscribeInstrumentsWithRetry(): Promise<void> {
    const subscriptionKey = "digital-instruments";

    try {
      await this.wsClient.subscribeDigitalInstruments();
      this.retryAttempts.delete(subscriptionKey);
      Logger.info(
        "DIGITAL_SUBSCRIPTIONS",
        "Subscrito aos instrumentos digitais"
      );
    } catch (error) {
      const attempts = this.retryAttempts.get(subscriptionKey) || 0;

      if (attempts < this.config.maxRetryAttempts) {
        this.retryAttempts.set(subscriptionKey, attempts + 1);

        Logger.warn(
          "DIGITAL_SUBSCRIPTIONS",
          `Erro ao subscrever instrumentos (tentativa ${attempts + 1}/${
            this.config.maxRetryAttempts
          })`,
          error
        );

        // Agendar retry
        const timer = setTimeout(() => {
          this.subscribeInstrumentsWithRetry();
        }, this.config.subscriptionRetryDelay);

        this.subscriptionTimers.set(subscriptionKey, timer);
      } else {
        Logger.error(
          "DIGITAL_SUBSCRIPTIONS",
          "Máximo de tentativas excedido para subscrição de instrumentos",
          error
        );
        this.retryAttempts.delete(subscriptionKey);
      }
    }
  }

  /**
   * Subscreve preços digitais com retry automático
   */
  private async subscribePricesWithRetry(assetIds: number[]): Promise<void> {
    for (const assetId of assetIds) {
      const subscriptionKey = `digital-prices-${assetId}`;

      try {
        await this.wsClient.subscribeDigitalPrices(assetId);
        this.retryAttempts.delete(subscriptionKey);
        Logger.info(
          "DIGITAL_SUBSCRIPTIONS",
          `Subscrito aos preços digitais para ativo ${assetId}`
        );
      } catch (error) {
        const attempts = this.retryAttempts.get(subscriptionKey) || 0;

        if (attempts < this.config.maxRetryAttempts) {
          this.retryAttempts.set(subscriptionKey, attempts + 1);

          Logger.warn(
            "DIGITAL_SUBSCRIPTIONS",
            `Erro ao subscrever preços para ativo ${assetId} (tentativa ${
              attempts + 1
            }/${this.config.maxRetryAttempts})`,
            error
          );

          // Agendar retry
          const timer = setTimeout(() => {
            this.subscribePricesWithRetry([assetId]);
          }, this.config.subscriptionRetryDelay);

          this.subscriptionTimers.set(subscriptionKey, timer);
        } else {
          Logger.error(
            "DIGITAL_SUBSCRIPTIONS",
            `Máximo de tentativas excedido para subscrição de preços do ativo ${assetId}`,
            error
          );
          this.retryAttempts.delete(subscriptionKey);
        }
      }
    }
  }

  /**
   * Configura handlers de eventos do WebSocket
   */
  private setupEventHandlers(): void {
    if (!this.wsClient) {
      Logger.error("DIGITAL_SUBSCRIPTIONS", "wsClient não está disponível para configurar event handlers");
      return;
    }

    // Reconectar automaticamente quando desconectado
    this.wsClient.on("disconnected", () => {
      if (this.config.reconnectOnDisconnect && this.isInitialized) {
        Logger.info(
          "DIGITAL_SUBSCRIPTIONS",
          "Conexão perdida, tentando reconectar..."
        );
        this.handleReconnection();
      }
    });

    // Processar mensagens de instrumentos
    this.wsClient.on("message", (message) => {
      if (
        message?.name === "instruments" &&
        message?.msg?.type === "digital-option"
      ) {
        digitalInstrumentsCache.handleInstrumentsMessage(message);
      }
    });
  }

  /**
   * Trata reconexão automática
   */
  private async handleReconnection(): Promise<void> {
    try {
      // Aguardar um pouco antes de tentar reconectar
      await new Promise((resolve) =>
        setTimeout(resolve, this.config.subscriptionRetryDelay)
      );

      // Reinicializar assinaturas
      this.isInitialized = false;
      await this.initialize();
    } catch (error) {
      Logger.error(
        "DIGITAL_SUBSCRIPTIONS",
        "Erro na reconexão automática",
        error
      );

      // Tentar novamente após delay
      setTimeout(() => {
        this.handleReconnection();
      }, this.config.subscriptionRetryDelay * 2);
    }
  }

  /**
   * Adiciona ativo para subscrição de preços
   */
  async addPriceSubscription(assetId: number): Promise<void> {
    if (!this.config.priceSubscriptionAssets.includes(assetId)) {
      this.config.priceSubscriptionAssets.push(assetId);
    }

    if (this.isInitialized) {
      await this.subscribePricesWithRetry([assetId]);
    }
  }

  /**
   * Remove ativo da subscrição de preços
   */
  async removePriceSubscription(assetId: number): Promise<void> {
    const index = this.config.priceSubscriptionAssets.indexOf(assetId);
    if (index > -1) {
      this.config.priceSubscriptionAssets.splice(index, 1);
    }

    try {
      await this.wsClient.unsubscribeDigitalPrices(assetId);
      Logger.info(
        "DIGITAL_SUBSCRIPTIONS",
        `Removida subscrição de preços para ativo ${assetId}`
      );
    } catch (error) {
      Logger.error(
        "DIGITAL_SUBSCRIPTIONS",
        `Erro ao remover subscrição de preços para ativo ${assetId}`,
        error
      );
    }
  }

  /**
   * Retorna status das assinaturas
   */
  getSubscriptionStatus(): {
    isInitialized: boolean;
    activeSubscriptions: string[];
    retryAttempts: Record<string, number>;
    config: SubscriptionConfig;
  } {
    return {
      isInitialized: this.isInitialized,
      activeSubscriptions: this.wsClient.getActiveSubscriptions(),
      retryAttempts: Object.fromEntries(this.retryAttempts),
      config: this.config,
    };
  }

  /**
   * Finaliza o serviço e cancela todas as assinaturas
   */
  async shutdown(): Promise<void> {
    // Cancelar todos os timers
    for (const timer of this.subscriptionTimers.values()) {
      clearTimeout(timer);
    }
    this.subscriptionTimers.clear();

    // Cancelar todas as assinaturas
    try {
      await this.wsClient.unsubscribeAll();
    } catch (error) {
      Logger.error(
        "DIGITAL_SUBSCRIPTIONS",
        "Erro ao cancelar assinaturas",
        error
      );
    }

    this.isInitialized = false;
    this.retryAttempts.clear();

    Logger.info("DIGITAL_SUBSCRIPTIONS", "Serviço finalizado");
  }
}

/**
 * Factory function para criar uma instância do DigitalSubscriptionsService
 * com um wsClient válido e configuração personalizada
 * 
 * @param wsClient - Instância válida do IQWSClient
 * @param config - Configuração opcional para o serviço
 * @returns Nova instância do DigitalSubscriptionsService
 */
export function createDigitalSubscriptionsService(
  wsClient: IQWSClient,
  config?: Partial<SubscriptionConfig>
): DigitalSubscriptionsService {
  if (!wsClient) {
    throw new Error("wsClient é obrigatório para criar DigitalSubscriptionsService");
  }
  
  return new DigitalSubscriptionsService(wsClient, {
    autoSubscribeInstruments: true,
    autoSubscribePrices: false,
    reconnectOnDisconnect: true,
    subscriptionRetryDelay: 5000,
    maxRetryAttempts: 3,
    ...config,
  });
}
