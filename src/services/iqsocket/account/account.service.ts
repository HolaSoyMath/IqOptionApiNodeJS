import { BalancesStore, Balance } from "./balances.store";
import { ConnectionService } from "../ws/connection.service";
import { IQSocketLogger } from "../utils/logger";

export interface SwitchResult {
  ok: boolean;
  balance_id?: number;
  error?: string;
}

export class AccountService {
  private requestCounter = 0;
  private pendingRequests = new Map<
    string,
    { resolve: Function; reject: Function; timeout: NodeJS.Timeout }
  >();

  constructor(
    private connectionService: ConnectionService,
    private store: BalancesStore
  ) {}

  /**
   * Solicita refresh dos balances (comando get-balances)
   */
  async refreshBalances(): Promise<void> {
    if (!this.connectionService.isOpen()) {
      throw new Error("WebSocket not connected");
    }

    const message = {
      name: "sendMessage",
      msg: {
        name: "get-balances",
        version: "1.0",
      },
      request_id: this.generateRequestId(),
    };

    this.connectionService.send(message);
    console.log("[ACCOUNT] Requested balances refresh");
  }

  /**
   * Troca balance por modo (1=REAL, 2=PRACTICE)
   */
  async switchByMode(mode: 1 | 2): Promise<SwitchResult> {
    if (!this.connectionService.isOpen()) {
      return { ok: false, error: "WebSocket not connected" };
    }

    // Resolve balance pelo modo
    const targetBalance = this.store.resolveByMode(mode);
    if (!targetBalance) {
      const modeStr = mode === 1 ? "REAL" : "PRACTICE";
      return { ok: false, error: `Balance ${modeStr} not available` };
    }

    console.log(
      `[ACCOUNT] Switching to mode=${mode} (${targetBalance.type}) -> balance_id=${targetBalance.id}`
    );

    try {
      const requestId = this.generateRequestId();

      // Enviar comando de troca (otimista)
      const message = {
        name: "api_profile_changebalance",
        msg: {
          balance_id: targetBalance.id,
        },
        request_id: requestId,
      };

      this.connectionService.send(message);

      // Atualiza localmente de forma imediata (otimista)
      this.store.setActive(targetBalance.id);

      // Dispara um refresh em background para sincronizar com o servidor
      setTimeout(() => {
        this.refreshBalances().catch(() => {});
      }, 0);

      console.log(
        `[ACCOUNT] Switch sent (optimistic): balance_id=${targetBalance.id}`
      );
      return { ok: true, balance_id: targetBalance.id };
    } catch (error) {
      IQSocketLogger.logError("ACCOUNT_SWITCH", error);
      return { ok: false, error: "Failed to send switch command" };
    }
  }

  private balanceChangedListener: ((data: any) => void) | null = null;

  /**
   * Método para ser chamado pelo router quando receber balance-changed
   */
  handleBalanceChangedConfirmation(data: any): void {
    if (this.balanceChangedListener) {
      this.balanceChangedListener(data);
    }
  }

  private generateRequestId(): string {
    return `acc_${++this.requestCounter}_${Date.now()}`;
  }

  /**
   * Limpa requests pendentes
   */
  clearPendingRequests(): void {
    for (const [, { timeout }] of this.pendingRequests) {
      clearTimeout(timeout);
    }
    this.pendingRequests.clear();
  }
}
