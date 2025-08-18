import { AuthService } from "./auth.service";
import { CandlesHandler } from "../candles/candles.handler";
import { BalancesHandler } from "../account/balances.handler";
import { AccountService } from "../account/account.service";
import { IQSocketLogger } from "../utils/logger";
import { TimeUtils } from "../utils/time";

export class RouterService {
  private lastTimeSync: number = 0;
  private pendingRequests = new Map<
    string,
    { resolve: Function; reject: Function; timeout: NodeJS.Timeout }
  >();

  constructor(
    private authService: AuthService,
    private candlesHandler: CandlesHandler,
    private balancesHandler?: BalancesHandler,
    private accountService?: AccountService
  ) {}

  route(raw: Buffer): void {
    try {
      const parsed = JSON.parse(raw.toString());

      // Log da mensagem recebida com mais detalhes
      IQSocketLogger.logWsMessage(
        parsed.name || "unknown",
        parsed.request_id ? `req_id: ${parsed.request_id}` : ""
      );

      // Novo: se houver request_id de uma requisição pendente, resolve imediatamente
      if (parsed.request_id && this.pendingRequests.has(parsed.request_id)) {
        this.handleResult(parsed);
        return;
      }

      // Roteamento por tipo de mensagem
      switch (parsed.name) {
        case "authenticated":
          this.authService.handleAuthResponse(parsed);
          break;

        case "timeSync":
          this.handleTimeSync(parsed);
          break;

        case "first-candles":
        case "candles":
          this.candlesHandler.handleFirstCandles(parsed);
          break;

        case "candle-generated":
          // Log adicional para debug
          if (!parsed.msg || !parsed.msg.active_id) {
            IQSocketLogger.logError(
              "ROUTER_DEBUG",
              `candle-generated sem active_id: ${JSON.stringify(parsed)}`
            );
          }
          this.candlesHandler.handleCandleGenerated(parsed);
          break;

        case "result":
          // Tentar processar como resposta de autenticação primeiro
          if (!this.authService.handleAuthResponse(parsed)) {
            // Se não for autenticação, processar como resultado normal
            this.handleResult(parsed);
          }
          break;

        case "option":
          // Algumas confirmações de abertura de ordem retornam como 'option'
          this.handleResult(parsed);
          break;

        case "profile":
          // Processar profile para extrair balances
          if (this.balancesHandler) {
            this.balancesHandler.handleProfile(parsed);
          }
          break;

        case "balances":
          // Processar mensagem específica de balances
          if (this.balancesHandler) {
            this.balancesHandler.handleBalances(parsed);
          }
          break;

        case "balance-changed":
          // Processar mudança de balance
          if (this.balancesHandler) {
            this.balancesHandler.handleBalanceChanged(parsed);
          }
          // Notificar AccountService para confirmações de switch
          if (this.accountService) {
            this.accountService.handleBalanceChangedConfirmation(parsed);
          }
          break;

        case "front":
          // Ignorar mensagens front (são normais)
          break;

        default:
          // Se ainda não tratado e tiver request_id pendente, resolve
          if (
            parsed.request_id &&
            this.pendingRequests.has(parsed.request_id)
          ) {
            this.handleResult(parsed);
            break;
          }
          // Log de mensagens não tratadas
          IQSocketLogger.logWsMessage("UNHANDLED", `${parsed.name}`);
          break;
      }
    } catch (error) {
      IQSocketLogger.logError("ROUTER_PARSE", error);
    }
  }

  private handleTimeSync(data: any): void {
    this.lastTimeSync = data.msg || Date.now();
    IQSocketLogger.logTimeSync(this.lastTimeSync);
  }

  private handleResult(data: any): void {
    const requestId = data.request_id;
    if (requestId && this.pendingRequests.has(requestId)) {
      const { resolve, timeout } = this.pendingRequests.get(requestId)!;
      clearTimeout(timeout);
      this.pendingRequests.delete(requestId);
      resolve(data);
    }
  }

  private addPendingRequest(
    requestId: string,
    resolve: Function,
    reject: Function
  ): void {
    const timeout = setTimeout(() => {
      this.pendingRequests.delete(requestId);
      reject(new Error(`Request timeout: ${requestId}`));
    }, 10000); // Voltando para 10 segundos

    this.pendingRequests.set(requestId, { resolve, reject, timeout });
  }

  // Método público para permitir acesso externo
  public addRequest(
    requestId: string,
    resolve: Function,
    reject: Function
  ): void {
    this.addPendingRequest(requestId, resolve, reject);
  }

  getLastTimeSync(): number {
    return this.lastTimeSync;
  }

  clearPendingRequests(): void {
    for (const [, { timeout }] of this.pendingRequests) {
      clearTimeout(timeout);
    }
    this.pendingRequests.clear();
  }
}
