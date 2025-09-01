import { PrismaClient, Status, Strategy } from '@prisma/client';
import { OrderService } from './order.service';
import { StrategyService } from './strategy.service';
import { candleManager } from './candleManager';
import { checkMA2Crossover, checkMA3Crossover, Signal } from '../strategies/ma-crossover';
import { AppError } from '../errors/custom-errors';
import { getStrategy } from '../strategies';

const prisma = new PrismaClient();

export class StrategyEngine {
  private static instance: StrategyEngine;
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly LOOP_INTERVAL = 1000; // 1 segundo

  private constructor() {}

  static getInstance(): StrategyEngine {
    if (!StrategyEngine.instance) {
      StrategyEngine.instance = new StrategyEngine();
    }
    return StrategyEngine.instance;
  }

  /**
   * Inicia o loop principal do engine
   */
  start(): void {
    if (this.isRunning) {
      console.log('[STRATEGY_ENGINE] Engine já está rodando');
      return;
    }

    console.log('[STRATEGY_ENGINE] Iniciando Strategy Engine...');
    this.isRunning = true;

    this.intervalId = setInterval(async () => {
      try {
        await this.processStrategies();
      } catch (error) {
        console.error('[STRATEGY_ENGINE] Erro no loop principal:', error);
      }
    }, this.LOOP_INTERVAL);

    console.log('[STRATEGY_ENGINE] Strategy Engine iniciado com sucesso');
  }

  /**
   * Para o loop principal do engine
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('[STRATEGY_ENGINE] Engine já está parado');
      return;
    }

    console.log('[STRATEGY_ENGINE] Parando Strategy Engine...');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log('[STRATEGY_ENGINE] Strategy Engine parado');
  }

  /**
   * Verifica se o engine está rodando
   */
  isEngineRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Processa todas as estratégias ativas
   */
  private async processStrategies(): Promise<void> {
    try {
      console.log('[STRATEGY_ENGINE] Processando estratégias...');

      // 1. Verificar stops globais primeiro
      const globalStopCheck = await this.checkGlobalStops();
      if (globalStopCheck.shouldStop) {
        console.log(`[STRATEGY_ENGINE] Stop global atingido: ${globalStopCheck.reason}. Parando todas as estratégias.`);
        await this.deactivateAllStrategies(globalStopCheck.reason);
        return;
      }

      // 2. Buscar todas as estratégias ativas
      const activeStrategies = await prisma.strategy.findMany({
        where: {
          isActive: Status.active
        },
        orderBy: {
          id: 'asc'
        }
      });

      console.log(`[STRATEGY_ENGINE] Encontradas ${activeStrategies.length} estratégias ativas`);

      if (activeStrategies.length === 0) {
        return;
      }

      // 3. Processar cada estratégia
      for (const strategy of activeStrategies) {
        try {
          await this.checkStrategy(strategy);
        } catch (error) {
          console.error(`[STRATEGY_ENGINE] Erro ao processar estratégia ${strategy.id}:`, error);
        }
      }

    } catch (error) {
      console.error('[STRATEGY_ENGINE] Erro ao buscar estratégias ativas:', error);
    }
  }

  /**
   * Verifica stops globais da tabela configs
   */
  private async checkGlobalStops(): Promise<{ shouldStop: boolean; reason: string }> {
    try {
      const config = await prisma.config.findUnique({ where: { id: 1 } });
      
      if (!config) {
        return { shouldStop: false, reason: '' };
      }

      // Calcular lucro total do dia de todas as estratégias
      const strategies = await prisma.strategy.findMany({
        select: {
          currentDayProfit: true
        }
      });

      const totalDayProfit = strategies.reduce((sum, strategy) => {
        return sum + (strategy.currentDayProfit || 0);
      }, 0);

      console.log(`[STRATEGY_ENGINE] Lucro total do dia: ${totalDayProfit}`);

      // Verificar Stop Loss Global
      if (config.stopLossEnabled && config.stopLoss > 0) {
        const stopLossLimit = -config.stopLoss;
        if (totalDayProfit <= stopLossLimit) {
          return { 
            shouldStop: true, 
            reason: `Stop Loss Global atingido: ${totalDayProfit} <= ${stopLossLimit}` 
          };
        }
      }

      // Verificar Stop Gain Global
      if (config.stopGainEnabled && config.stopGain > 0) {
        if (totalDayProfit >= config.stopGain) {
          return { 
            shouldStop: true, 
            reason: `Stop Gain Global atingido: ${totalDayProfit} >= ${config.stopGain}` 
          };
        }
      }

      return { shouldStop: false, reason: '' };
    } catch (error) {
      console.error('[STRATEGY_ENGINE] Erro ao verificar stops globais:', error);
      return { shouldStop: false, reason: '' };
    }
  }

  /**
   * Verifica uma estratégia específica
   */
  private async checkStrategy(strategy: any): Promise<void> {
    console.log(`[STRATEGY_ENGINE] Verificando estratégia ${strategy.id} - ${strategy.name}`);

    try {
      // 1. Verificar se há ordem em aberto para esta estratégia
      const hasOpenOrder = await this.hasOpenOrder(strategy.id);
      
      if (hasOpenOrder) {
        console.log(`[STRATEGY_ENGINE] Estratégia ${strategy.id} tem ordem em aberto, pulando...`);
        return;
      }

      // 2. Verificar condições de stop individuais da estratégia
      const stopCheck = await StrategyService.checkStopConditions(strategy.id);
      if (stopCheck.shouldStop) {
        console.log(`[STRATEGY_ENGINE] ⚠️  STOP ATINGIDO - Estratégia ${strategy.id} (${strategy.name}): ${stopCheck.reason}`);
        console.log(`[STRATEGY_ENGINE] Desativando estratégia ${strategy.id} automaticamente...`);
        
        await this.deactivateStrategy(strategy.id, stopCheck.reason);
        return;
      }

      // 3. Obter candles para a estratégia
      const asset = strategy.asset || 'EURUSD-OTC'; // Usar asset da estratégia ou padrão
      const candles = await candleManager.getCandles(asset, 'M1', 100); // Obter últimos 100 candles de 1 minuto
      
      if (!candles || candles.length === 0) {
        console.warn(`[STRATEGY_ENGINE] Nenhum candle disponível para ${asset}`);
        return;
      }

      // 4. Executar lógica da estratégia com candles
      await this.executeStrategyLogic(strategy, candles, asset);

    } catch (error) {
      console.error(`[STRATEGY_ENGINE] Erro ao verificar estratégia ${strategy.id}:`, error);
    }
  }

  /**
   * Verifica se há ordem em aberto para uma estratégia
   */
  private async hasOpenOrder(strategyId: number): Promise<boolean> {
    try {
      const openOrder = await prisma.order.findFirst({
        where: {
          strategyId: strategyId,
          status: 'open'
        }
      });

      return !!openOrder;
    } catch (error) {
      console.error(`[STRATEGY_ENGINE] Erro ao verificar ordem aberta para estratégia ${strategyId}:`, error);
      return false;
    }
  }

  /**
   * Executa a lógica da estratégia baseada no tipo
   */
  private async executeStrategyLogic(strategy: Strategy, candles: any[], asset: string): Promise<void> {
    try {
      let signal: Signal = 'HOLD';
      
      // Usar Strategy Pattern ao invés de múltiplos IFs
      const strategyFunction = getStrategy(strategy.name);
      
      if (!strategyFunction) {
        console.warn(`Estratégia não encontrada: ${strategy.name}`);
        return;
      }

      // Executar a estratégia dinamicamente
      signal = strategyFunction(candles);
      
      console.log(`Estratégia ${strategy.name} executada. Sinal: ${signal}`);
      
      // Criar ordem se o sinal não for 'hold'
      if (signal !== 'HOLD') {
        await this.createOrder(strategy, signal, asset);
      }
    } catch (error) {
      console.error(`Erro ao executar estratégia ${strategy.name}:`, error);
    }
  }

  /**
   * Cria uma ordem baseada no sinal da estratégia
   */
  private async createOrder(strategy: any, signal: 'BUY' | 'SELL', asset: string): Promise<void> {
    try {
      console.log(`[STRATEGY_ENGINE] Criando ordem ${signal} para estratégia ${strategy.id}`);

      // Mapear BUY/SELL para CALL/PUT
      const direction = signal === 'BUY' ? 'call' : 'put';
      
      // Obter activeId do asset (EURUSD-OTC = 1)
      const activeId = this.getActiveId(asset);
      
      // Usar OrderService.sendOrderToIQOption com a assinatura correta
      const order = await OrderService.sendOrderToIQOption({
        ssid: 'demo_session', // TODO: Obter SSID real da sessão
        activeId: activeId,
        direction: direction,
        price: strategy.entryValue || 5.0,
        userBalanceId: 1, // TODO: Obter ID real do balance
        profitPercent: 80, // Payout padrão
        strategyId: strategy.id
      });
      
      console.log(`[STRATEGY_ENGINE] Ordem enviada com sucesso:`, {
        orderId: order.id,
        strategyId: strategy.id,
        direction: direction,
        amount: strategy.entryValue || 5.0,
        asset: asset,
        activeId: activeId
      });

    } catch (error) {
      console.error(`[STRATEGY_ENGINE] Erro ao criar ordem para estratégia ${strategy.id}:`, error);
      
      // Se for erro de stop condition, desativar estratégia
      if (error instanceof AppError && error.message.includes('stop')) {
        console.log(`[STRATEGY_ENGINE] Desativando estratégia ${strategy.id} devido a stop condition`);
        await this.deactivateStrategy(strategy.id);
      }
    }
  }

  /**
   * Obtém o activeId baseado no asset
   */
  private getActiveId(asset: string): number {
    // Mapeamento básico de assets para activeIds
    const assetMap: { [key: string]: number } = {
      'EURUSD-OTC': 1,
      'GBPUSD-OTC': 2,
      'USDJPY-OTC': 3,
      'AUDUSD-OTC': 4,
      'USDCAD-OTC': 5,
      'USDCHF-OTC': 6,
      'NZDUSD-OTC': 7,
      'EURGBP-OTC': 8,
      'EURJPY-OTC': 9,
      'GBPJPY-OTC': 10
    };
    
    return assetMap[asset] || 1; // Default para EURUSD-OTC
  }

  /**
   * Desativa uma estratégia
   */
  private async deactivateStrategy(strategyId: number, reason?: string): Promise<void> {
    try {
      await prisma.strategy.update({
        where: { id: strategyId },
        data: { 
          isActive: Status.inactive,
          stopHitDate: new Date()
        }
      });
      
      const logMessage = reason 
        ? `[STRATEGY_ENGINE] ✅ Estratégia ${strategyId} desativada: ${reason}`
        : `[STRATEGY_ENGINE] ✅ Estratégia ${strategyId} desativada`;
      
      console.log(logMessage);
    } catch (error) {
      console.error(`[STRATEGY_ENGINE] Erro ao desativar estratégia ${strategyId}:`, error);
    }
  }

  /**
   * Desativa todas as estratégias ativas
   */
  private async deactivateAllStrategies(reason: string): Promise<void> {
    try {
      const result = await prisma.strategy.updateMany({
        where: { isActive: Status.active },
        data: { 
          isActive: Status.inactive,
          stopHitDate: new Date()
        }
      });
      
      console.log(`[STRATEGY_ENGINE] ✅ ${result.count} estratégias desativadas devido a: ${reason}`);
    } catch (error) {
      console.error('[STRATEGY_ENGINE] Erro ao desativar todas as estratégias:', error);
    }
  }

  /**
   * Obtém estatísticas do engine
   */
  async getEngineStats(): Promise<{
    isRunning: boolean;
    activeStrategies: number;
    openOrders: number;
    lastProcessTime: Date;
  }> {
    try {
      const activeStrategies = await prisma.strategy.count({
        where: { isActive: Status.active }
      });

      const openOrders = await prisma.order.count({
        where: { status: 'open' }
      });

      return {
        isRunning: this.isRunning,
        activeStrategies,
        openOrders,
        lastProcessTime: new Date()
      };
    } catch (error) {
      console.error('[STRATEGY_ENGINE] Erro ao obter estatísticas:', error);
      return {
        isRunning: this.isRunning,
        activeStrategies: 0,
        openOrders: 0,
        lastProcessTime: new Date()
      };
    }
  }
}

// Exportar instância singleton
export const strategyEngine = StrategyEngine.getInstance();