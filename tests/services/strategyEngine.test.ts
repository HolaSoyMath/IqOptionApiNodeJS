// tests/services/strategyEngine.test.ts

// Mock do Prisma ANTES dos imports
const prismaMock = {
  strategy: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn()
  },
  config: {
    findUnique: jest.fn()
  },
  order: {
    findFirst: jest.fn(),
    count: jest.fn()
  }
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => prismaMock),
  Status: {
    active: 'active',
    inactive: 'inactive'
  }
}));

// Outros mocks
jest.mock('../../src/services/order.service');
jest.mock('../../src/services/strategy.service');
jest.mock('../../src/services/candleManager');
jest.mock('../../src/strategies/ma-crossover');
jest.mock('../../src/strategies');

// Imports APÓS os mocks
import { StrategyEngine } from '../../src/services/strategyEngine.service';
import { OrderService } from '../../src/services/order.service';
import { StrategyService } from '../../src/services/strategy.service';
import { candleManager } from '../../src/services/candleManager';
import { checkMA2Crossover, checkMA3Crossover, Signal } from '../../src/strategies/ma-crossover';
import { getStrategy } from '../../src/strategies';
import { Status } from '@prisma/client';
import { AppError } from '../../src/errors/custom-errors';
import { Candle } from '../../src/types/candle.types';

// Mock dos serviços
const mockOrderService = {
  sendOrderToIQOption: jest.fn()
};

const mockStrategyService = {
  checkStopConditions: jest.fn()
};

(OrderService as any) = mockOrderService;
(StrategyService as any) = mockStrategyService;

// Mock do CandleManager
const mockCandleManager = {
  getCandles: jest.fn()
};

(candleManager as any).getCandles = mockCandleManager.getCandles;

// Mock das estratégias
const mockCheckMA2Crossover = checkMA2Crossover as jest.MockedFunction<typeof checkMA2Crossover>;
const mockCheckMA3Crossover = checkMA3Crossover as jest.MockedFunction<typeof checkMA3Crossover>;
const mockGetStrategy = getStrategy as jest.MockedFunction<typeof getStrategy>;

describe('StrategyEngine', () => {
  let strategyEngine: StrategyEngine;
  
  beforeEach(() => {
    // Reset all mocks (implementações + filas de mockResolvedValueOnce)
    jest.resetAllMocks();
    
    // Reset do singleton para isolar estado entre testes
    (StrategyEngine as any)['instance'] = undefined;
    
    // Nova instância "limpa" para cada teste
    strategyEngine = StrategyEngine.getInstance();
    
    // Stop engine if running
    if (strategyEngine.isEngineRunning()) {
      strategyEngine.stop();
    }
    
    // Reset timers
    jest.clearAllTimers();
    jest.useFakeTimers();
  });
  
  afterEach(() => {
    if (strategyEngine.isEngineRunning()) {
      strategyEngine.stop();
    }
    jest.useRealTimers();
  });
  
  describe('1. Start/Stop do engine', () => {
    test('deve iniciar o engine corretamente', () => {
      expect(strategyEngine.isEngineRunning()).toBe(false);
      
      strategyEngine.start();
      
      expect(strategyEngine.isEngineRunning()).toBe(true);
    });
    
    test('deve parar o engine corretamente', () => {
      strategyEngine.start();
      expect(strategyEngine.isEngineRunning()).toBe(true);
      
      strategyEngine.stop();
      
      expect(strategyEngine.isEngineRunning()).toBe(false);
    });
    
    test('não deve iniciar se já estiver rodando', () => {
      strategyEngine.start();
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      strategyEngine.start();
      
      expect(consoleSpy).toHaveBeenCalledWith('[STRATEGY_ENGINE] Engine já está rodando');
      consoleSpy.mockRestore();
    });
    
    test('não deve parar se já estiver parado', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      strategyEngine.stop();
      
      expect(consoleSpy).toHaveBeenCalledWith('[STRATEGY_ENGINE] Engine já está parado');
      consoleSpy.mockRestore();
    });
  });

  describe('2. processStrategies com estratégias ativas', () => {
    test('deve processar estratégias ativas corretamente', async () => {
      const mockStrategies = [
        { id: 1, name: 'Strategy 1', isActive: Status.active, asset: 'EURUSD-OTC' },
        { id: 2, name: 'Strategy 2', isActive: Status.active, asset: 'GBPUSD-OTC' }
      ];
      
      prismaMock.config.findUnique.mockResolvedValue({
        id: 1,
        stopLossEnabled: false,
        stopGainEnabled: false
      });
      
      prismaMock.strategy.findMany.mockResolvedValue(mockStrategies);
      
      // Mock hasOpenOrder to return false
      prismaMock.order.findFirst.mockResolvedValue(null);
      
      // Mock checkStopConditions
      mockStrategyService.checkStopConditions.mockResolvedValue({
        shouldStop: false,
        reason: ''
      });
      
      // Mock candles
      const mockCandles: Candle[] = [
        {
          id: '1',
          symbol: 'EURUSD',
          timeframe: '1m',
          timestamp: Date.now() - 60000,
          open: 1.0800,
          high: 1.0820,
          low: 1.0790,
          close: 1.0810,
          volume: 1000,
          createdAt: new Date()
        },
        {
          id: '2', 
          symbol: 'EURUSD',
          timeframe: '1m',
          timestamp: Date.now(),
          open: 1.0810,
          high: 1.0830,
          low: 1.0800,
          close: 1.0820,
          volume: 1200,
          createdAt: new Date()
        }
      ];
      mockCandleManager.getCandles.mockResolvedValue(mockCandles);
      
      // Mock strategy function
      const mockStrategyFunction = jest.fn().mockReturnValue('HOLD' as Signal);
      mockGetStrategy.mockReturnValue(mockStrategyFunction);
      
      strategyEngine.start();
      
      // Advance timer to trigger processStrategies
      await jest.advanceTimersByTimeAsync(1000);
      
      expect(prismaMock.strategy.findMany).toHaveBeenCalledWith({
        where: { isActive: Status.active },
        orderBy: { id: 'asc' }
      });
    });
    
    test('deve retornar early se não houver estratégias ativas', async () => {
      prismaMock.config.findUnique.mockResolvedValue(null);
      prismaMock.strategy.findMany.mockResolvedValue([]);
      
      strategyEngine.start();
      await jest.advanceTimersByTimeAsync(1000);
      
      expect(prismaMock.strategy.findMany).toHaveBeenCalled();
      expect(mockStrategyService.checkStopConditions).not.toHaveBeenCalled();
    });
  });

  describe('3. hasOpenOrder retornando true/false', () => {
    test('deve retornar true quando há ordem aberta', async () => {
      const mockOrder = { id: 1, strategyId: 1, status: 'open' };
      prismaMock.order.findFirst.mockResolvedValue(mockOrder);
      
      const result = await (strategyEngine as any).hasOpenOrder(1);
      
      expect(result).toBe(true);
      expect(prismaMock.order.findFirst).toHaveBeenCalledWith({
        where: {
          strategyId: 1,
          status: 'open'
        }
      });
    });
    
    test('deve retornar false quando não há ordem aberta', async () => {
      prismaMock.order.findFirst.mockResolvedValue(null);
      
      const result = await (strategyEngine as any).hasOpenOrder(1);
      
      expect(result).toBe(false);
    });
    
    test('deve retornar false em caso de erro', async () => {
      prismaMock.order.findFirst.mockRejectedValue(new Error('Database error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const result = await (strategyEngine as any).hasOpenOrder(1);
      
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        '[STRATEGY_ENGINE] Erro ao verificar ordem aberta para estratégia 1:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe('4. checkStrategy com ordem aberta (deve pular)', () => {
    test('deve pular estratégia quando há ordem aberta', async () => {
      const mockStrategy = { id: 1, name: 'Test Strategy' };
      prismaMock.order.findFirst.mockResolvedValue({ id: 1, status: 'open' });
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await (strategyEngine as any).checkStrategy(mockStrategy);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '[STRATEGY_ENGINE] Estratégia 1 tem ordem em aberto, pulando...'
      );
      expect(mockStrategyService.checkStopConditions).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('5. checkStrategy atingindo stop loss', () => {
    test('deve desativar estratégia quando stop loss é atingido', async () => {
      const mockStrategy = { id: 1, name: 'Test Strategy' };
      
      prismaMock.order.findFirst.mockResolvedValue(null);
      mockStrategyService.checkStopConditions.mockResolvedValue({
        shouldStop: true,
        reason: 'Stop Loss atingido'
      });
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await (strategyEngine as any).checkStrategy(mockStrategy);
      
      expect(prismaMock.strategy.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          isActive: Status.inactive,
          stopHitDate: expect.any(Date)
        }
      });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('STOP ATINGIDO - Estratégia 1')
      );
      consoleSpy.mockRestore();
    });
  });

  describe('6. checkStrategy atingindo stop gain', () => {
    test('deve desativar estratégia quando stop gain é atingido', async () => {
      const mockStrategy = { id: 1, name: 'Test Strategy' };
      
      prismaMock.order.findFirst.mockResolvedValue(null);
      mockStrategyService.checkStopConditions.mockResolvedValue({
        shouldStop: true,
        reason: 'Stop Gain atingido'
      });
      
      await (strategyEngine as any).checkStrategy(mockStrategy);
      
      expect(prismaMock.strategy.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          isActive: Status.inactive,
          stopHitDate: expect.any(Date)
        }
      });
    });
  });

  describe('7. executeStrategyLogic gerando sinal BUY', () => {
    test('deve criar ordem quando sinal é BUY', async () => {
      const mockStrategy = { id: 1, name: 'MA Crossover 2', entryValue: 10 };
      const mockCandles = [{ close: 1.1000, timestamp: Date.now() }];
      const asset = 'EURUSD-OTC';
      
      const mockStrategyFunction = jest.fn().mockReturnValue('BUY' as Signal);
      mockGetStrategy.mockReturnValue(mockStrategyFunction);
      
      const mockOrder = { id: 1, strategyId: 1 };
      mockOrderService.sendOrderToIQOption.mockResolvedValue(mockOrder as any);
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await (strategyEngine as any).executeStrategyLogic(mockStrategy, mockCandles, asset);
      
      expect(mockGetStrategy).toHaveBeenCalledWith('MA Crossover 2');
      expect(mockStrategyFunction).toHaveBeenCalledWith(mockCandles);
      expect(mockOrderService.sendOrderToIQOption).toHaveBeenCalledWith({
        ssid: 'demo_session',
        activeId: 1,
        direction: 'call',
        price: 10,
        userBalanceId: 1,
        profitPercent: 80,
        strategyId: 1
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe('8. executeStrategyLogic gerando sinal SELL', () => {
    test('deve criar ordem quando sinal é SELL', async () => {
      const mockStrategy = { id: 1, name: 'MA Crossover 2', entryValue: 5 };
      const mockCandles = [{ close: 1.1000, timestamp: Date.now() }];
      const asset = 'GBPUSD-OTC';
      
      const mockStrategyFunction = jest.fn().mockReturnValue('SELL' as Signal);
      mockGetStrategy.mockReturnValue(mockStrategyFunction);
      
      const mockOrder = { id: 1, strategyId: 1 };
      mockOrderService.sendOrderToIQOption.mockResolvedValue(mockOrder as any);
      
      await (strategyEngine as any).executeStrategyLogic(mockStrategy, mockCandles, asset);
      
      expect(mockOrderService.sendOrderToIQOption).toHaveBeenCalledWith({
        ssid: 'demo_session',
        activeId: 2, // GBPUSD-OTC = 2
        direction: 'put',
        price: 5,
        userBalanceId: 1,
        profitPercent: 80,
        strategyId: 1
      });
    });
  });

  describe('9. executeStrategyLogic gerando sinal HOLD', () => {
    test('não deve criar ordem quando sinal é HOLD', async () => {
      const mockStrategy = { id: 1, name: 'MA Crossover 2' };
      const mockCandles = [{ close: 1.1000, timestamp: Date.now() }];
      const asset = 'EURUSD-OTC';
      
      const mockStrategyFunction = jest.fn().mockReturnValue('HOLD' as Signal);
      mockGetStrategy.mockReturnValue(mockStrategyFunction);
      
      await (strategyEngine as any).executeStrategyLogic(mockStrategy, mockCandles, asset);
      
      expect(mockOrderService.sendOrderToIQOption).not.toHaveBeenCalled();
    });
    
    test('deve retornar early quando estratégia não é encontrada', async () => {
      const mockStrategy = { id: 1, name: 'Unknown Strategy' };
      const mockCandles = [{ close: 1.1000, timestamp: Date.now() }];
      const asset = 'EURUSD-OTC';
      
      mockGetStrategy.mockReturnValue(undefined);
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      await (strategyEngine as any).executeStrategyLogic(mockStrategy, mockCandles, asset);
      
      expect(consoleSpy).toHaveBeenCalledWith('Estratégia não encontrada: Unknown Strategy');
      expect(mockOrderService.sendOrderToIQOption).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('10. createOrder com sucesso', () => {
    test('deve criar ordem BUY com sucesso', async () => {
      const mockStrategy = { id: 1, entryValue: 15 };
      const signal = 'BUY' as const;
      const asset = 'EURUSD-OTC';
      
      const mockOrder = { id: 1, strategyId: 1 };
      mockOrderService.sendOrderToIQOption.mockResolvedValue(mockOrder as any);
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await (strategyEngine as any).createOrder(mockStrategy, signal, asset);
      
      expect(mockOrderService.sendOrderToIQOption).toHaveBeenCalledWith({
        ssid: 'demo_session',
        activeId: 1,
        direction: 'call',
        price: 15,
        userBalanceId: 1,
        profitPercent: 80,
        strategyId: 1
      });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '[STRATEGY_ENGINE] Criando ordem BUY para estratégia 1'
      );
      consoleSpy.mockRestore();
    });
    
    test('deve usar valor padrão quando entryValue não está definido', async () => {
      const mockStrategy = { id: 1 };
      const signal = 'SELL' as const;
      const asset = 'EURUSD-OTC';
      
      const mockOrder = { id: 1, strategyId: 1 };
      mockOrderService.sendOrderToIQOption.mockResolvedValue(mockOrder as any);
      
      await (strategyEngine as any).createOrder(mockStrategy, signal, asset);
      
      expect(mockOrderService.sendOrderToIQOption).toHaveBeenCalledWith(
        expect.objectContaining({
          price: 5.0 // valor padrão
        })
      );
    });
    
    test('deve desativar estratégia quando erro contém "stop"', async () => {
      const mockStrategy = { id: 1 };
      const signal = 'BUY' as const;
      const asset = 'EURUSD-OTC';
      
      const stopError = new AppError('stop condition reached', 400);
      mockOrderService.sendOrderToIQOption.mockRejectedValue(stopError);
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await (strategyEngine as any).createOrder(mockStrategy, signal, asset);
      
      expect(prismaMock.strategy.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          isActive: Status.inactive,
          stopHitDate: expect.any(Date)
        }
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe('11. Stops globais atingidos', () => {
    test('deve parar todas estratégias quando stop loss global é atingido', async () => {
      const mockConfig = {
        id: 1,
        stopLossEnabled: true,
        stopLoss: 100,
        stopGainEnabled: false
      };
      
      const mockStrategies = [
        { currentDayProfit: -60 },
        { currentDayProfit: -50 }
      ];
      
      prismaMock.config.findUnique.mockResolvedValue(mockConfig);
      prismaMock.strategy.findMany
        .mockResolvedValueOnce(mockStrategies) // Para checkGlobalStops
        .mockResolvedValueOnce([]); // Para processStrategies (estratégias ativas)
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      strategyEngine.start();
      await jest.advanceTimersByTimeAsync(1000);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Stop global atingido')
      );
      
      expect(prismaMock.strategy.updateMany).toHaveBeenCalledWith({
        where: { isActive: Status.active },
        data: {
          isActive: Status.inactive,
          stopHitDate: expect.any(Date)
        }
      });
      
      consoleSpy.mockRestore();
    });
    
    test('deve parar todas estratégias quando stop gain global é atingido', async () => {
      const mockConfig = {
        id: 1,
        stopLossEnabled: false,
        stopGainEnabled: true,
        stopGain: 200
      };
      
      const mockStrategiesForGlobalStops = [
        { currentDayProfit: 150 },
        { currentDayProfit: 60 }
      ];
      
      prismaMock.config.findUnique.mockResolvedValue(mockConfig);
      
      prismaMock.strategy.findMany
        // 1ª chamada: usada por checkGlobalStops (soma currentDayProfit)
        .mockResolvedValueOnce(mockStrategiesForGlobalStops)
        // 2ª chamada: usada por processStrategies (estratégias ativas)
        .mockResolvedValueOnce([]);
      
      prismaMock.strategy.updateMany.mockResolvedValue({ count: 2 });
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      strategyEngine.start();
      await jest.advanceTimersByTimeAsync(1000);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Stop global atingido: Stop Gain Global atingido')
      );
      
      consoleSpy.mockRestore();
    });
    
    test('deve continuar processamento quando stops globais não são atingidos', async () => {
      const mockConfig = {
        id: 1,
        stopLossEnabled: true,
        stopLoss: 100,
        stopGainEnabled: true,
        stopGain: 200
      };
      
      const mockStrategies = [
        { currentDayProfit: 50 },
        { currentDayProfit: -30 }
      ];
      
      prismaMock.config.findUnique.mockResolvedValue(mockConfig);
      prismaMock.strategy.findMany
        .mockResolvedValueOnce(mockStrategies)
        .mockResolvedValueOnce([]);
      
      strategyEngine.start();
      await jest.advanceTimersByTimeAsync(1000);
      
      expect(prismaMock.strategy.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('getEngineStats', () => {
    test('deve retornar estatísticas do engine', async () => {
      prismaMock.strategy.count.mockResolvedValue(3);
      prismaMock.order.count.mockResolvedValue(2);
      
      strategyEngine.start();
      
      const stats = await strategyEngine.getEngineStats();
      
      expect(stats).toEqual({
        isRunning: true,
        activeStrategies: 3,
        openOrders: 2,
        lastProcessTime: expect.any(Date)
      });
    });
    
    test('deve retornar valores padrão em caso de erro', async () => {
      prismaMock.strategy.count.mockRejectedValue(new Error('Database error'));
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const stats = await strategyEngine.getEngineStats();
      
      expect(stats).toEqual({
        isRunning: false,
        activeStrategies: 0,
        openOrders: 0,
        lastProcessTime: expect.any(Date)
      });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '[STRATEGY_ENGINE] Erro ao obter estatísticas:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Singleton pattern', () => {
    test('deve retornar a mesma instância', () => {
      const instance1 = StrategyEngine.getInstance();
      const instance2 = StrategyEngine.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('Error handling', () => {
    test('deve tratar erros no loop principal', async () => {
      prismaMock.config.findUnique.mockRejectedValue(new Error('Database error'));
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      strategyEngine.start();
      await jest.advanceTimersByTimeAsync(1000);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[STRATEGY_ENGINE\] Erro ao (verificar stops globais|buscar estratégias ativas):/),
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
    
    test('deve tratar erros ao verificar estratégia específica', async () => {
      const mockStrategy = { id: 1, name: 'Test Strategy' };
      
      // Mock para passar pela verificação de config primeiro
      prismaMock.config.findUnique.mockResolvedValue({
        stopLossEnabled: false,
        stopGainEnabled: false
      });
      prismaMock.strategy.findMany.mockResolvedValue([]);
      
      prismaMock.order.findFirst.mockRejectedValue(new Error('Database error'));
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await (strategyEngine as any).checkStrategy(mockStrategy);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[STRATEGY_ENGINE\] Erro ao verificar (estratégia|ordem aberta para estratégia) 1:/),
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });
});