import { EventEmitter } from "events";
import { ConnectionService } from "./iqsocket/ws/connection.service";
import { AuthService } from "./iqsocket/ws/auth.service";
import { SubscriptionsService } from "./iqsocket/ws/subscriptions.service";
import { RouterService } from "./iqsocket/ws/router.service";
import { CandlesStore } from "./iqsocket/candles/candles.store";
import { CandlesHandler } from "./iqsocket/candles/candles.handler";
import { RequestsStore } from "./iqsocket/requests/requests.store";
import { BalancesStore } from "./iqsocket/account/balances.store";
import { BalancesHandler } from "./iqsocket/account/balances.handler";
import { AccountService } from "./iqsocket/account/account.service";
import { CandleData, LiveCandle } from "./iqsocket/candles/candles.types";
import { IQSocketLogger } from "./iqsocket/utils/logger";
import { TimeUtils } from "./iqsocket/utils/time";

// Exportar tipos para compatibilidade
export { CandleData, LiveCandle } from "./iqsocket/candles/candles.types";
export { Balance, BalanceType } from "./iqsocket/account/balances.store";

/**
 * Fachada de compatibilidade que mantém a mesma interface do IQSocketService original
 * Internamente utiliza a arquitetura refatorada seguindo princípios SOLID
 */
export class IQSocketService extends EventEmitter {
  private static instance: IQSocketService;

  // Serviços componentizados
  private connectionService!: ConnectionService;
  private authService!: AuthService;
  private subscriptionsService!: SubscriptionsService;
  private routerService!: RouterService;
  private candlesStore!: CandlesStore;
  private candlesHandler!: CandlesHandler;
  private requestsStore!: RequestsStore;

  // Novos serviços de account/balances
  public balancesStore!: BalancesStore;
  private balancesHandler!: BalancesHandler;
  public accountService!: AccountService;

  // Estado
  private currentSsid?: string;
  private requestCounter = 0;
  private reconnectAttempts = 0;

  // Constantes
  private readonly url = "wss://iqoption.com/echo/websocket";
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_DELAY = 5000;
  private readonly HISTORY_SIZE = 500;

  private constructor() {
    super();
    this.initializeServices();
    this.setupEventHandlers();
  }

  public static getInstance(): IQSocketService {
    if (!IQSocketService.instance) {
      IQSocketService.instance = new IQSocketService();
    }
    return IQSocketService.instance;
  }

  private initializeServices(): void {
    // Inicializar stores
    this.candlesStore = new CandlesStore(this.HISTORY_SIZE);
    this.requestsStore = new RequestsStore();
    this.balancesStore = new BalancesStore();

    // Inicializar serviços WS
    this.connectionService = new ConnectionService(
      this.MAX_RECONNECT_ATTEMPTS,
      this.RECONNECT_DELAY
    );
    this.authService = new AuthService(this.connectionService);
    this.subscriptionsService = new SubscriptionsService(
      this.connectionService
    );

    // Inicializar handlers
    this.candlesHandler = new CandlesHandler(
      this.candlesStore,
      this.requestsStore
    );
    this.balancesHandler = new BalancesHandler(this.balancesStore);
    this.accountService = new AccountService(
      this.connectionService,
      this.balancesStore
    );
    this.routerService = new RouterService(
      this.authService,
      this.candlesHandler,
      this.balancesHandler,
      this.accountService
    );
  }

  private setupEventHandlers(): void {
    // Configurar roteamento de mensagens
    this.connectionService.onMessage((raw: Buffer) => {
      this.routerService.route(raw);
    });

    // Eventos de reconexão
    this.connectionService.on("reconnected", () => {
      this.authService.reset();
      if (this.currentSsid) {
        this.authService
          .authenticate(this.currentSsid)
          .then(() => {
            this.subscriptionsService.replay();
          })
          .catch((error) => {
            IQSocketLogger.logError("RECONNECT_AUTH", error);
          });
      }
    });

    // Propagar eventos de autenticação
    this.authService.on("authenticated", async () => {
      this.connectionService.startHeartbeat();
      // Tentar carregar balances assim que autenticar
      try {
        await this.accountService.refreshBalances();
      } catch (e) {
        IQSocketLogger.logError("ACCOUNT_REFRESH_ON_AUTH", e);
      }
      this.emit("authenticated");
    });
  }

  /**
   * Garante conexão e autenticação
   * Mantém compatibilidade com a interface original
   */
  async ensureConnection({ ssid }: { ssid: string }): Promise<void> {
    this.currentSsid = ssid;

    if (this.connectionService.isOpen() && this.authService.isAuthenticated()) {
      return;
    }

    try {
      // Conectar se necessário
      if (!this.connectionService.isOpen()) {
        await this.connectionService.connect(this.url);
      }

      // Autenticar
      await this.authService.authenticate(ssid);
    } catch (error) {
      IQSocketLogger.logError("ENSURE_CONNECTION", error);
      throw error;
    }
  }

  /**
   * Subscreve a candles ao vivo
   * Mantém compatibilidade com a interface original
   */
  async subscribeToLiveCandles(
    activeId: number,
    sizes: number[] = [60, 900]
  ): Promise<void> {
    if (
      !this.connectionService.isOpen() ||
      !this.authService.isAuthenticated()
    ) {
      throw new Error("Not connected or authenticated");
    }

    for (const size of sizes) {
      this.subscriptionsService.subscribeCandles(activeId, size);
    }
  }

  /**
   * Requisita candles históricos
   * Mantém compatibilidade com a interface original
   */
  async requestHistoricalCandles(
    activeId: number,
    sizes: number[] = [60, 900]
  ): Promise<void> {
    if (
      !this.connectionService.isOpen() ||
      !this.authService.isAuthenticated()
    ) {
      throw new Error("Not connected or authenticated");
    }

    return new Promise((resolve, reject) => {
      const requestId = this.generateRequestId();

      // Registrar request para resolução posterior
      this.requestsStore.set(requestId, {
        active_id: activeId,
        sizes: sizes,
        timestamp: TimeUtils.getCurrentTimestamp(),
      });

      // Configurar timeout para a requisição
      this.routerService.addRequest(requestId, resolve, reject);

      // Enviar requisição
      const message = {
        name: "get-first-candles",
        msg: {
          active_id: activeId,
          size: sizes,
          count: this.HISTORY_SIZE,
        },
        request_id: requestId,
      };

      this.connectionService.send(message);
    });
  }

  /**
   * Obtém candle atual
   * Mantém compatibilidade com a interface original
   */
  getCurrentCandle(activeId: number, size: number): LiveCandle | null {
    const current = this.candlesStore.getCurrent(activeId, size);
    return current || null;
  }

  /**
   * Obtém histórico de candles
   * Usado em /api/candles/history - mantido
   */
  getHistory(activeId: number, size: number): CandleData[] {
    return this.candlesStore.getHistory(activeId, size);
  }

  /**
   * Obtém status do serviço
   * Mantém compatibilidade com a interface original
   */
  getStatus(): any {
    const candlesStatus = this.candlesStore.status();
    const activeBalance = this.balancesStore.getActive();

    return {
      connected: this.connectionService.isOpen(),
      authenticated: this.authService.isAuthenticated(),
      subscriptions: this.subscriptionsService.getSubscriptions(),
      history: candlesStatus.historyCount,
      current: candlesStatus.currentKeys,
      lastTimeSync: this.routerService.getLastTimeSync(),
      reconnectAttempts: this.reconnectAttempts,
      activeBalance: activeBalance
        ? {
            id: activeBalance.id,
            type: activeBalance.type,
            amount: activeBalance.amount,
          }
        : null,
      balancesCount: this.balancesStore.getAll().length,
    };
  }

  /**
   * Desconecta e limpa estado
   * Mantém compatibilidade com a interface original
   */
  disconnect(): void {
    this.connectionService.close();
    this.authService.reset();
    this.subscriptionsService.clear();
    this.candlesStore.clear();
    this.requestsStore.clear();
    this.balancesStore.clear();
    this.accountService.clearPendingRequests();
    this.routerService.clearPendingRequests();
    this.reconnectAttempts = 0;

    IQSocketLogger.logConnection("Disconnected and cleaned up");
  }

  private generateRequestId(): string {
    return `req_${++this.requestCounter}_${Date.now()}`;
  }

  /**
   * Remove subscrição de candles ao vivo
   */
  async unsubscribeFromLiveCandles(
    activeId: number,
    sizes?: number[]
  ): Promise<{
    unsubscribed: number[];
    notSubscribed: number[];
    allSizes: number[];
  }> {
    if (
      !this.connectionService.isOpen() ||
      !this.authService.isAuthenticated()
    ) {
      throw new Error("Not connected or authenticated");
    }

    // Se sizes não fornecido, obter todas as subscrições ativas para este activeId
    const targetSizes =
      sizes || this.subscriptionsService.getActiveSubscriptions(activeId);

    if (targetSizes.length === 0) {
      return { unsubscribed: [], notSubscribed: [], allSizes: [] };
    }

    const unsubscribed: number[] = [];
    const notSubscribed: number[] = [];

    for (const size of targetSizes) {
      const wasUnsubscribed = this.subscriptionsService.unsubscribeCandles(
        activeId,
        size
      );

      if (wasUnsubscribed) {
        unsubscribed.push(size);
        // Limpar dados do store para este ativo/tamanho
        this.candlesStore.deleteCurrent(activeId, size);
      } else {
        notSubscribed.push(size);
      }
    }

    return { unsubscribed, notSubscribed, allSizes: targetSizes };
  }
}
