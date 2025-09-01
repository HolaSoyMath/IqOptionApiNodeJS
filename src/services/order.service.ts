import { PrismaClient, Order, Status } from "@prisma/client";
import { AppError } from "../errors/custom-errors";
import { StrategyService } from "./strategy.service";
import { LegacyOrderHelper } from "../helpers/legacyOrderHelper";
import { IQWSClient } from "./iq/ws-client";
import { IQOrderHelper } from "../helpers/iqOrderHelper";

const prisma = new PrismaClient();

export class OrderService {
  /**
   * Cria uma ordem manual
   */
  static async createManualOrder(data: {
    asset: string;
    type: "call" | "put";
    amount: number;
    accountType: "demo" | "real";
    payoutPercent: number;
    entryPrice?: number;
    iqOptionId?: string;
  }): Promise<Order> {
    try {
      return await prisma.order.create({
        data: {
          dateTime: new Date(),
          asset: data.asset,
          type: data.type,
          amount: data.amount,
          status: "open",
          profit: 0,
          source: "manual",
          accountType: data.accountType,
          payoutPercent: data.payoutPercent,
          entryPrice: data.entryPrice,
          iqOptionId: data.iqOptionId,
        },
      });
    } catch (error) {
      throw new AppError("Erro ao criar ordem manual", 500);
    }
  }

  /**
   * Cria uma ordem automática vinculada a uma estratégia
   */
  static async createAutomaticOrder(data: {
    strategyId: number;
    asset: string;
    type: "call" | "put";
    amount: number;
    accountType: "demo" | "real";
    payoutPercent: number;
    entryPrice?: number;
    iqOptionId?: string;
  }): Promise<Order> {
    try {
      // Verificar se estratégia existe
      const strategy = await prisma.strategy.findUnique({
        where: { id: data.strategyId },
      });

      if (!strategy) {
        throw new AppError("Estratégia não encontrada", 404);
      }

      return await prisma.order.create({
        data: {
          dateTime: new Date(),
          strategyId: data.strategyId,
          asset: data.asset,
          type: data.type,
          amount: data.amount,
          status: "open",
          profit: 0,
          source: "auto",
          accountType: data.accountType,
          payoutPercent: data.payoutPercent,
          entryPrice: data.entryPrice,
          iqOptionId: data.iqOptionId,
        },
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError("Erro ao criar ordem automática", 500);
    }
  }

  /**
   * Processa o resultado de uma ordem (win/loss)
   */
  static async processOrderResult(
    orderId: number,
    result: "win" | "loss",
    closePrice?: number
  ): Promise<void> {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        throw new AppError("Ordem não encontrada", 404);
      }

      // Calcular lucro
      let profit = 0;
      if (result === "win") {
        profit = (order.amount * (order.payoutPercent || 0)) / 100;
      } else {
        profit = -order.amount;
      }

      // Atualizar ordem
      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: result as Status,
          profit,
          closePrice,
          updatedAt: new Date(),
        },
      });

      // Se ordem tem estratégia, atualizar estatísticas
      if (order.strategyId) {
        await StrategyService.updateStrategyMetrics(
          order.strategyId,
          profit,
          result === 'win'
        );
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError("Erro ao processar resultado da ordem", 500);
    }
  }

  /**
   * Busca ordens com filtros e paginação
   */
  static async getOrders(filters: {
    strategyId?: number | "all";
    asset?: string;
    status?: "win" | "loss" | "open" | "all";
    page?: number;
    limit?: number;
    sortBy?: string;
    sortDir?: "asc" | "desc";
  }): Promise<{ orders: any[]; pagination: any; summary: any }> {
    try {
      const page = filters.page || 1;
      const limit = filters.limit || 50;
      const skip = (page - 1) * limit;

      const where: any = {};

      if (filters.strategyId && filters.strategyId !== "all") {
        where.strategyId = filters.strategyId;
      }
      if (filters.asset) {
        where.asset = filters.asset;
      }
      if (filters.status && filters.status !== "all") {
        where.status = filters.status;
      }

      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where,
          skip,
          take: limit,
          orderBy: {
            [filters.sortBy || "dateTime"]: filters.sortDir || "desc",
          },
          include: { strategy: true },
        }),
        prisma.order.count({ where }),
      ]);

      // Calcular summary
      const allOrders = await prisma.order.findMany({ where });
      const wins = allOrders.filter((o) => o.status === "win").length;
      const losses = allOrders.filter((o) => o.status === "loss").length;
      const totalProfit = allOrders.reduce((sum, o) => sum + o.profit, 0);

      return {
        orders: orders.map((o) => ({
          ...o,
          strategy: o.strategy
            ? { id: o.strategy.id, name: o.strategy.name }
            : null,
          dateTimeLocal: new Date(o.dateTime).toLocaleString("pt-BR"),
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        summary: {
          totalOperations: total,
          wins,
          losses,
          accuracyPercent: total > 0 ? (wins / (wins + losses)) * 100 : 0,
          totalProfit,
        },
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError("Erro ao buscar ordens", 500);
    }
  }

  /**
   * Envia ordem para IQ Option usando a lógica do TestOrderController
   */
  static async sendOrderToIQOption(data: {
    ssid: string;
    activeId: number;
    direction: "call" | "put";
    price: number;
    userBalanceId: number;
    profitPercent: number;
    strategyId?: number;
  }): Promise<Order> {
    try {
      const orderData = {
        dateTime: new Date(),
        asset: await this.getAssetName(data.activeId),
        type: data.direction,
        amount: data.price,
        status: "open" as const,
        profit: 0,
        source: data.strategyId ? ("auto" as const) : ("manual" as const),
        accountType: "demo" as const,
        payoutPercent: data.profitPercent,
        strategyId: data.strategyId,
      };
  
      const order = await prisma.order.create({ data: orderData });
  
      // 2. Usar lógica do TestOrderController para enviar à IQ
      const wsClient = await this.getWSClient(data.ssid);
  
      // Calcular expiração usando IQOrderHelper
      const expired = IQOrderHelper.calculateExpirationTimestamp();
  
      // Verificar se a expiração está no futuro
      const now = Math.floor(Date.now() / 1000);
      if (expired <= now + 30) {
        throw new AppError(
          "Timestamp de expiração muito próximo. Tente novamente.",
          400
        );
      }
  
      // Payload da ordem simplificado
      const orderBody = {
        user_balance_id: data.userBalanceId,
        active_id: data.activeId,
        option_type_id: 3, // 3 = Turbo (1m, 5m)
        direction: data.direction,
        expired: expired,
        price: data.price,
        refund_value: 0,
      };
  
      console.log('[ORDER] Enviando ordem:', orderBody);
  
      // 3. Enviar via WebSocket com timeout ajustado
      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          wsClient.removeListener("message", handleResponse);
          reject(new Error("Timeout na requisição de ordem"));
        }, 8000); // Reduzido para 8 segundos
  
        const handleResponse = (message: any) => {
          console.log('[ORDER] Resposta recebida:', message);
          
          // Verificar diferentes tipos de resposta da IQ Option
          if (
            message.name === "option" ||
            message.name === "option-opened" ||
            message.name === "binary-options.open-option" ||
            (message.msg && message.msg.result) ||
            (message.msg && message.msg.id)
          ) {
            clearTimeout(timeout);
            wsClient.removeListener("message", handleResponse);
            resolve(message);
          }
          
          // Verificar se há erro na resposta
          if (message.msg && message.msg.error) {
            clearTimeout(timeout);
            wsClient.removeListener("message", handleResponse);
            reject(new Error(`Erro da IQ Option: ${message.msg.error}`));
          }
        };
  
        wsClient.on("message", handleResponse);
        wsClient.send("binary-options.open-option", "2.0", orderBody);
      });
  
      // 4. Atualizar ordem com iqOptionId se disponível
      if (result && (result as any).msg?.id) {
        await prisma.order.update({
          where: { id: order.id },
          data: { iqOptionId: String((result as any).msg.id) },
        });
      }
  
      console.log('[ORDER] Ordem processada com sucesso:', result);
      return order;
    } catch (error) {
      console.error('[ORDER] Erro ao processar ordem:', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        `Erro ao enviar ordem para IQ Option: ${(error as Error).message}`,
        500
      );
    }
  }

  // Métodos auxiliares copiados do TestOrderController (preservando lógica exata)
  private static clientCache = new Map<
    string,
    { client: IQWSClient; timestamp: number }
  >();
  private static readonly CACHE_TTL = 60000; // 60 segundos

  private static async getWSClient(ssid: string): Promise<IQWSClient> {
    const cached = OrderService.clientCache.get(ssid);
    if (cached && Date.now() - cached.timestamp < OrderService.CACHE_TTL) {
      if (cached.client.isConnected()) {
        return cached.client;
      }
    }

    const client = new IQWSClient({
      url: process.env.IQ_WSS_URL || "wss://ws.iqoption.com/echo/websocket",
      ssid,
      timeout: 10000,
    });

    await client.connect();
    OrderService.clientCache.set(ssid, {
      client,
      timestamp: Date.now(),
    });
    return client;
  }

  // Método auxiliar para mapear activeId para nome
  private static async getAssetName(activeId: number): Promise<string> {
    const assetMap: Record<number, string> = {
      76: "EURUSD-OTC",
      77: "EURGBP-OTC",
      78: "USDCHF-OTC",
      // Adicionar mais conforme necessário
    };

    return assetMap[activeId] || `ACTIVE_${activeId}`;
  }
}
