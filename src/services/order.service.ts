import { PrismaClient, Order } from "@prisma/client";
import { AppError } from "../errors/custom-errors";
import { StrategyService } from "./strategy.service";

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
        include: { strategy: true },
      });

      if (!order) {
        throw new AppError("Ordem não encontrada", 404);
      }

      // Calcular lucro/prejuízo
      const payoutPercent = order.payoutPercent ?? 0;
      const profit =
        result === "win" ? order.amount * (payoutPercent / 100) : -order.amount;

      // Atualizar ordem
      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: result,
          profit: profit,
          closePrice: closePrice,
        },
      });

      // Se for ordem automática, atualizar métricas da estratégia
      if (order.strategyId && order.strategy) {
        await StrategyService.updateStrategyMetrics(
          order.strategyId,
          profit,
          result === "win"
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
   * Envia ordem para IQ Option e registra no banco
   */
  static async sendOrderToIQ(data: {
    activeId: number;
    direction: "call" | "put";
    price: number;
    accountType: "demo" | "real";
    payoutPercent: number;
    strategyId?: number; // Se fornecido, é ordem automática
  }): Promise<Order> {
    try {
      // Aqui você chamaria o TestOrderController ou similar para enviar à IQ
      // Por enquanto, vamos apenas criar a ordem no banco

      const orderData = {
        dateTime: new Date(),
        asset: `ACTIVE_${data.activeId}`, // Você precisará mapear activeId para nome do ativo
        type: data.direction,
        amount: data.price,
        status: "open" as const,
        profit: 0,
        source: data.strategyId ? ("auto" as const) : ("manual" as const),
        accountType: data.accountType,
        payoutPercent: data.payoutPercent,
        strategyId: data.strategyId || undefined,
      };

      return await prisma.order.create({
        data: orderData,
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError("Erro ao enviar ordem para IQ Option", 500);
    }
  }
}
