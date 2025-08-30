import { PrismaClient, Status, AccountType, StopType } from '@prisma/client';
import { AppError } from '../errors/custom-errors';
import { UpdateStrategyDto } from '../dto/strategy.dto';
import { IQSocketService } from './iqsocket.service';

const prisma = new PrismaClient();

export interface StrategySummary {
  total: number;
  active: number;
  inactive: number;
  profitable: number;
  unprofitable: number;
}

export interface StrategyWithSummary {
  strategies: any[];
  summary: StrategySummary;
}

export class StrategyService {
  /**
   * Retorna todas as estratégias com summary dos cards
   */
  static async getAllStrategies(): Promise<StrategyWithSummary> {
    try {
      const strategies = await prisma.strategy.findMany({
        orderBy: { createdAt: 'desc' }
      });

      // Calcular summary
      const summary: StrategySummary = {
        total: strategies.length,
        active: strategies.filter(s => s.isActive === Status.active).length,
        inactive: strategies.filter(s => s.isActive === Status.inactive).length,
        profitable: strategies.filter(s => (s.totalProfit || 0) > 0).length,
        unprofitable: strategies.filter(s => (s.totalProfit || 0) < 0).length
      };

      return {
        strategies,
        summary
      };
    } catch (error) {
      throw new AppError('Erro ao buscar estratégias', 500);
    }
  }

  /**
   * Retorna uma estratégia específica por ID
   */
  static async getStrategyById(id: number): Promise<any> {
    try {
      const strategy = await prisma.strategy.findUnique({
        where: { id }
      });

      if (!strategy) {
        throw new AppError('Estratégia não encontrada', 404);
      }

      return strategy;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Erro ao buscar estratégia', 500);
    }
  }

  /**
   * Atualiza configurações de uma estratégia
   */
  static async updateStrategy(id: number, data: UpdateStrategyDto): Promise<any> {
    try {
      // Verificar se a estratégia existe
      const existingStrategy = await prisma.strategy.findUnique({
        where: { id }
      });

      if (!existingStrategy) {
        throw new AppError('Estratégia não encontrada', 404);
      }

      // Preparar dados para atualização
      const updateData: any = { ...data };

      // Converter strings para enums do Prisma
      if (data.isActive) {
        updateData.isActive = data.isActive as Status;
      }
      if (data.accountType) {
        updateData.accountType = data.accountType as AccountType;
      }
      if (data.stopGainType) {
        updateData.stopGainType = data.stopGainType as StopType;
      }
      if (data.stopLossType) {
        updateData.stopLossType = data.stopLossType as StopType;
      }

      // Quando alterar status para "active"
      if (data.isActive === 'active' && existingStrategy.isActive !== 'active') {
        const config = await prisma.config.findUnique({ where: { id: 1 } });
        
        if (config) {
          // Aplicar valores padrão APENAS se não foram fornecidos no request
          // E se a estratégia estava inativa (primeira ativação)
          if (data.entryValue === undefined) {
            updateData.entryValue = config.defaultEntryValue;
          }
          
          // Para stops, aplicar defaults apenas se não fornecidos E não configurados
          if (data.stopLossValue === undefined && !existingStrategy.stopLossEnabled) {
            updateData.stopLossValue = config.stopLoss;
            updateData.stopLossEnabled = config.stopLossEnabled;
          }
          
          if (data.stopGainValue === undefined && !existingStrategy.stopGainEnabled) {
            updateData.stopGainValue = config.stopGain;
            updateData.stopGainEnabled = config.stopGainEnabled;
          }
        }

        // Sempre resetar lucro do dia ao ativar
        updateData.currentDayProfit = 0;
        updateData.lastResetDate = new Date();
      }

      // Adicionar reset quando dailyResetGain ou dailyResetLoss mudam para true
      if (data.dailyResetGain === true || data.dailyResetLoss === true) {
        updateData.currentDayProfit = 0;
        updateData.lastResetDate = new Date();
      }

      // Quando alterar stopGainType/stopLossType para "percentage"
      if (data.stopGainType === 'percentage' || data.stopLossType === 'percentage') {
        try {
          // Tentar obter saldo atual usando o IQSocketService
          const socketService = IQSocketService.getInstance();
          const activeBalance = (socketService as any).balancesStore?.getActive();
          
          if (activeBalance && activeBalance.amount) {
            updateData.stopBaseBalance = activeBalance.amount;
          } else {
            // Fallback: usar um valor padrão ou manter o existente
            updateData.stopBaseBalance = existingStrategy.stopBaseBalance || 1000;
          }
        } catch (error) {
          // Se não conseguir obter o saldo, usar valor padrão
          updateData.stopBaseBalance = existingStrategy.stopBaseBalance || 1000;
        }
      }

      // Atualizar estratégia
      const updatedStrategy = await prisma.strategy.update({
        where: { id },
        data: updateData
      });

      return updatedStrategy;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Erro ao atualizar estratégia', 500);
    }
  }

  /**
   * Método auxiliar para reset à meia-noite
   */
  static async resetDailyProfits(): Promise<void> {
    try {
      const strategies = await prisma.strategy.findMany({
        where: {
          OR: [
            { dailyResetGain: true },
            { dailyResetLoss: true }
          ]
        }
      });

      const now = new Date();
      
      for (const strategy of strategies) {
        // Sempre resetar para fins de teste
        // Em produção, verificaria se é um novo dia
        await prisma.strategy.update({
          where: { id: strategy.id },
          data: {
            currentDayProfit: 0,
            lastResetDate: now
          }
        });
      }
    } catch (error) {
      throw new AppError('Erro ao resetar lucros diários', 500);
    }
  }

  /**
   * Atualiza métricas após uma operação
   */
  static async updateStrategyMetrics(
    strategyId: number, 
    profit: number, 
    isWin: boolean
  ): Promise<void> {
    try {
      const strategy = await prisma.strategy.findUnique({
        where: { id: strategyId }
      });

      if (!strategy) {
        throw new AppError('Estratégia não encontrada', 404);
      }

      // Calcular novas métricas
      const newOperationCount = (strategy.operationCount || 0) + 1;
      const newTotalProfit = (strategy.totalProfit || 0) + profit;
      const newCurrentDayProfit = (strategy.currentDayProfit || 0) + profit;
      
      // Calcular nova taxa de acerto
      // Assumindo que temos que calcular baseado em wins/total
      // Para isso, precisaríamos saber quantas operações foram wins anteriormente
      // Como não temos esse dado diretamente, vamos usar uma aproximação
      const currentWins = Math.round((strategy.accuracyRate || 0) * (strategy.operationCount || 0) / 100);
      const newWins = currentWins + (isWin ? 1 : 0);
      const newAccuracyRate = newOperationCount > 0 ? (newWins / newOperationCount) * 100 : 0;

      // Atualizar estratégia
      await prisma.strategy.update({
        where: { id: strategyId },
        data: {
          operationCount: newOperationCount,
          totalProfit: newTotalProfit,
          currentDayProfit: newCurrentDayProfit,
          accuracyRate: newAccuracyRate
        }
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Erro ao atualizar métricas da estratégia', 500);
    }
  }

  /**
   * Verifica se uma estratégia atingiu stop loss ou stop gain
   */
  static async checkStopConditions(strategyId: number): Promise<{ shouldStop: boolean; reason: string }> {
    try {
      const strategy = await prisma.strategy.findUnique({
        where: { id: strategyId }
      });

      if (!strategy) {
        throw new AppError('Estratégia não encontrada', 404);
      }

      const currentProfit = strategy.currentDayProfit || 0;

      // Verificar Stop Loss
      if (strategy.stopLossEnabled && strategy.stopLossValue) {
        let stopLossLimit: number;
        
        if (strategy.stopLossType === StopType.percentage) {
          const baseBalance = strategy.stopBaseBalance || 1000;
          stopLossLimit = -(baseBalance * strategy.stopLossValue / 100);
        } else {
          stopLossLimit = -strategy.stopLossValue;
        }

        if (currentProfit <= stopLossLimit) {
          return { shouldStop: true, reason: 'Stop Loss atingido' };
        }
      }

      // Verificar Stop Gain
      if (strategy.stopGainEnabled && strategy.stopGainValue) {
        let stopGainLimit: number;
        
        if (strategy.stopGainType === StopType.percentage) {
          const baseBalance = strategy.stopBaseBalance || 1000;
          stopGainLimit = baseBalance * strategy.stopGainValue / 100;
        } else {
          stopGainLimit = strategy.stopGainValue;
        }

        if (currentProfit >= stopGainLimit) {
          return { shouldStop: true, reason: 'Stop Gain atingido' };
        }
      }

      return { shouldStop: false, reason: '' };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Erro ao verificar condições de stop', 500);
    }
  }
}