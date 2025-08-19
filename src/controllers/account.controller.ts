import { Request, Response } from "express";
import { IQSocketService } from "../services/iqsocket.service";
import { ApiResponse } from "../types/response.types";
import { Logger } from "../utils/logger";

export class AccountController {
  private static socketService: IQSocketService | null = null;

  private static getSocketService(): IQSocketService {
    if (!this.socketService) {
      this.socketService = IQSocketService.getInstance();
    }
    return this.socketService;
  }

  // Helper: força refresh e aguarda store de balances popular (timeout curto)
  private static async ensureBalancesLoaded(
    socketService: IQSocketService,
    timeoutMs = 2000
  ): Promise<void> {
    const svcAny = socketService as any;
    try {
      await svcAny.accountService.refreshBalances();
    } catch (error) {
      Logger.error("ACCOUNT", "Error getting balances", error);
      // Remover a referência a 'res' que não existe neste contexto
      throw error; // Re-throw para que o método chamador possa tratar
    }
    const start = Date.now();
    while (
      svcAny.balancesStore.getAll().length === 0 &&
      Date.now() - start < timeoutMs
    ) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  /**
   * GET /api/account/balances
   * Retorna todos os balances e o balance ativo
   */
  static async getBalances(req: Request, res: Response): Promise<void> {
    try {
      const ssid = req.headers.authorization?.replace("Bearer ", "");

      if (!ssid) {
        const response: ApiResponse = {
          success: false,
          message: "Authorization header com SSID é obrigatório",
          timestamp: new Date().toISOString(),
        };
        res.status(401).json(response);
        return;
      }

      const socketService = AccountController.getSocketService();
      await socketService.ensureConnection({ ssid });

      // Aguarda carregar os balances
      await AccountController.ensureBalancesLoaded(socketService);

      const balancesStore = (socketService as any).balancesStore;
      if (!balancesStore) {
        const response: ApiResponse = {
          success: false,
          message: "Balances store not initialized",
          timestamp: new Date().toISOString(),
        };
        res.status(500).json(response);
        return;
      }

      const allBalances = balancesStore.getAll();
      const activeBalanceId = balancesStore.getActiveId();

      const response: ApiResponse = {
        success: true,
        message: "Balances retrieved successfully",
        data: {
          active_balance_id: activeBalanceId,
          balances: allBalances,
        },
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    } catch (error) {
      console.error("[ACCOUNT] Error getting balances:", error);

      const response: ApiResponse = {
        success: false,
        message: "Internal error retrieving balances",
        timestamp: new Date().toISOString(),
      };

      res.status(500).json(response);
    }
  }

  /**
   * GET /api/account/actualbalance
   * Retorna o balance ativo atual
   */
  static async getActualBalance(req: Request, res: Response): Promise<void> {
    try {
      const ssid = req.headers.authorization?.replace("Bearer ", "");

      if (!ssid) {
        const response: ApiResponse = {
          success: false,
          message: "Authorization header com SSID é obrigatório",
          timestamp: new Date().toISOString(),
        };
        res.status(401).json(response);
        return;
      }

      const socketService = AccountController.getSocketService();
      await socketService.ensureConnection({ ssid });

      // Aguarda carregar os balances
      await AccountController.ensureBalancesLoaded(socketService);

      const balancesStore = (socketService as any).balancesStore;
      if (!balancesStore) {
        const response: ApiResponse = {
          success: false,
          message: "Balances store not initialized",
          timestamp: new Date().toISOString(),
        };
        res.status(500).json(response);
        return;
      }

      const activeBalance = balancesStore.getActive();

      const response: ApiResponse = {
        success: true,
        message: "Active balance retrieved successfully",
        data: {
          active: activeBalance,
        },
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    } catch (error) {
      Logger.error("ACCOUNT", "Error getting active balance", error);
      res.status(500).json({
        success: false,
        message: "Erro interno do servidor",
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * POST /api/account/switch
   * Troca o balance ativo por modo
   */
  static async switchBalance(req: Request, res: Response): Promise<void> {
    try {
      const { mode } = req.body;
      const ssid = req.headers.authorization?.replace("Bearer ", "");

      if (!ssid) {
        const response: ApiResponse = {
          success: false,
          message: "Authorization header com SSID é obrigatório",
          timestamp: new Date().toISOString(),
        };
        res.status(401).json(response);
        return;
      }

      if (!mode || (mode !== 1 && mode !== 2)) {
        const response: ApiResponse = {
          success: false,
          message: "Mode deve ser 1 (REAL) ou 2 (PRACTICE)",
          timestamp: new Date().toISOString(),
        };
        res.status(400).json(response);
        return;
      }

      const socketService = AccountController.getSocketService();
      await socketService.ensureConnection({ ssid });

      // Antes de tentar trocar, garante que temos balances em memória
      await AccountController.ensureBalancesLoaded(socketService);

      const accountService = (socketService as any).accountService;
      if (!accountService) {
        const response: ApiResponse = {
          success: false,
          message: "Account service not initialized",
          timestamp: new Date().toISOString(),
        };
        res.status(500).json(response);
        return;
      }

      const result = await accountService.switchByMode(mode);

      if (result.ok) {
        const modeStr = mode === 1 ? "REAL" : "PRACTICE";
        const response: ApiResponse = {
          success: true,
          message: `Active balance switched to ${modeStr}`,
          data: { balance_id: result.balance_id },
          timestamp: new Date().toISOString(),
        };
        res.status(200).json(response);
      } else {
        const response: ApiResponse = {
          success: false,
          message: result.error || "Failed to switch balance",
          timestamp: new Date().toISOString(),
        };
        res.status(400).json(response);
      }
    } catch (error) {
      Logger.error("ACCOUNT", "Error switching balance", error);
      res.status(500).json({
        success: false,
        message: "Erro interno do servidor",
        timestamp: new Date().toISOString(),
      });
    }
  }
}
