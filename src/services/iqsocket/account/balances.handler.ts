import { BalancesStore, Balance, BalanceType } from "./balances.store";
import { IQSocketLogger } from "../utils/logger";

export class BalancesHandler {
  constructor(private store: BalancesStore) {}

  /**
   * Processa mensagem "profile" contendo balances
   */
  handleProfile(data: any): void {
    if (data.name !== "profile" || !data.msg) return;

    const msg = data.msg;

    try {
      // Extrair e normalizar balances
      if (msg.balances && Array.isArray(msg.balances)) {
        const balances: Balance[] = msg.balances.map((bal: any) => ({
          id: bal.id,
          type: BalancesStore.mapBalanceType(bal.type),
          currency: bal.currency || "USD",
          amount: bal.amount || 0,
        }));

        this.store.setAll(balances);
        console.log(
          `[ACCOUNT] Loaded balances: ${balances.length} (types: ${balances
            .map((b) => b.type)
            .join(", ")})`
        );
      }

      // Definir balance ativo se especificado
      if (msg.balance_id) {
        this.store.setActive(msg.balance_id);
        console.log(`[ACCOUNT] Active balance from profile: ${msg.balance_id}`);
      } else {
        // Definir balance padrão (PRACTICE se disponível)
        const practiceBalance = this.store.resolveByMode(2);
        if (practiceBalance) {
          this.store.setActive(practiceBalance.id);
          console.log(
            `[ACCOUNT] Default balance set to PRACTICE: ${practiceBalance.id}`
          );
        }
      }
    } catch (error) {
      IQSocketLogger.logError("PROFILE_HANDLER", error);
    }
  }

  /**
   * Processa mensagem "balances" específica
   */
  handleBalances(data: any): void {
    if (data.name !== "balances") return;

    try {
      // Armazenar dados brutos se necessário
      console.log(
        "[ACCOUNT] Received balances message:",
        JSON.stringify(data.msg)
      );

      // Se contém estrutura de balances, processar
      if (data.msg && Array.isArray(data.msg)) {
        const balances: Balance[] = data.msg.map((bal: any) => ({
          id: bal.id,
          type: BalancesStore.mapBalanceType(bal.type),
          currency: bal.currency || "USD",
          amount: bal.amount || 0,
        }));

        this.store.setAll(balances);
      }
    } catch (error) {
      IQSocketLogger.logError("BALANCES_HANDLER", error);
    }
  }

  /**
   * Processa mensagem "balance-changed"
   */
  handleBalanceChanged(data: any): void {
    if (data.name !== "balance-changed" || !data.msg?.current_balance) return;

    try {
      const currentBalance = data.msg.current_balance;

      // Atualizar balance ativo
      if (currentBalance.id) {
        this.store.setActive(currentBalance.id);
        console.log(`[ACCOUNT] Balance changed to: ${currentBalance.id}`);
      }

      // Atualizar amount se fornecido
      if (currentBalance.amount !== undefined) {
        this.store.updateBalance(currentBalance.id, currentBalance.amount);
      }
    } catch (error) {
      IQSocketLogger.logError("BALANCE_CHANGED_HANDLER", error);
    }
  }
}
