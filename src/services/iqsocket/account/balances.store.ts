import { IQSocketLogger } from "../utils/logger";

export type BalanceType = "REAL" | "PRACTICE" | "TOURNAMENT";

export interface Balance {
  id: number;
  type: BalanceType;
  currency: string;
  amount: number;
}

export class BalancesStore {
  private balances: Balance[] = [];
  private activeBalanceId: number | null = null;

  /**
   * Define todos os balances disponíveis
   */
  setAll(balances: Balance[]): void {
    this.balances = [...balances];
    IQSocketLogger.logWsMessage(
      "BALANCES_STORE",
      `Loaded ${balances.length} balances`
    );
  }

  /**
   * Obtém todos os balances
   */
  getAll(): Balance[] {
    return [...this.balances];
  }

  /**
   * Define o balance ativo pelo ID
   */
  setActive(balanceId: number): void {
    const balance = this.balances.find((b) => b.id === balanceId);
    if (balance) {
      this.activeBalanceId = balanceId;
      console.log(
        `[ACCOUNT] Active balance set to: ${balanceId} (${balance.type})`
      );
    } else {
      console.warn(
        `[ACCOUNT] Balance ID ${balanceId} not found in available balances`
      );
    }
  }

  /**
   * Obtém o ID do balance ativo
   */
  getActiveId(): number | null {
    return this.activeBalanceId;
  }

  /**
   * Obtém o balance ativo completo
   */
  getActive(): Balance | null {
    if (!this.activeBalanceId) return null;
    return this.balances.find((b) => b.id === this.activeBalanceId) || null;
  }

  /**
   * Resolve balance por modo (1=REAL, 2=PRACTICE)
   */
  resolveByMode(mode: 1 | 2): Balance | null {
    const targetType: BalanceType = mode === 1 ? "REAL" : "PRACTICE";
    return this.balances.find((b) => b.type === targetType) || null;
  }

  /**
   * Atualiza o amount de um balance específico
   */
  updateBalance(balanceId: number, amount: number): void {
    const balance = this.balances.find((b) => b.id === balanceId);
    if (balance) {
      balance.amount = amount;
    }
  }

  /**
   * Mapeia tipo numérico para string
   */
  static mapBalanceType(type: number): BalanceType {
    switch (type) {
      case 1:
        return "REAL";
      case 4:
        return "PRACTICE";
      case 2:
        return "TOURNAMENT";
      default:
        return "PRACTICE"; // fallback para demo
    }
  }

  /**
   * Mapeia tipo string para numérico
   */
  static mapBalanceMode(type: BalanceType): number {
    switch (type) {
      case "REAL":
        return 1;
      case "PRACTICE":
        return 4;
      case "TOURNAMENT":
        return 2;
      default:
        return 4;
    }
  }

  /**
   * Limpa todos os dados
   */
  clear(): void {
    this.balances = [];
    this.activeBalanceId = null;
  }
}
