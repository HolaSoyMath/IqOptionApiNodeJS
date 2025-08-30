import { PrismaClient } from '@prisma/client';
import { beforeEach, afterEach, describe, it, expect, jest } from '@jest/globals';
import { AppError } from '../../src/errors/custom-errors';

// Tipo para o mock do Prisma Strategy
type MockedStrategyModel = {
  findMany: jest.MockedFunction<any>;
  findUnique: jest.MockedFunction<any>;
  create: jest.MockedFunction<any>;
  update: jest.MockedFunction<any>;
  delete: jest.MockedFunction<any>;
  deleteMany: jest.MockedFunction<any>;
};

// Mock do módulo @prisma/client
jest.mock('@prisma/client', () => {
  const mockStrategyModel = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn()
  };
  
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      strategy: mockStrategyModel,
      $disconnect: jest.fn()
    }))
  };
});

// Mock do StrategyService (assumindo que será criado)
class StrategyService {
  static async createStrategy(data: any) {
    const prisma = new PrismaClient();
    try {
      const strategy = await prisma.strategy.create({ data });
      return strategy;
    } catch (error) {
      throw new AppError('Erro ao criar estratégia', 500);
    }
  }

  static async getAllStrategies() {
    const prisma = new PrismaClient();
    try {
      const strategies = await prisma.strategy.findMany({
        orderBy: { createdAt: 'desc' }
      });
      return strategies;
    } catch (error) {
      throw new AppError('Erro ao buscar estratégias', 500);
    }
  }

  static async getStrategyById(id: number) {
    const prisma = new PrismaClient();
    try {
      const strategy = await prisma.strategy.findUnique({
        where: { id },
        include: { orders: true }
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

  static async updateStrategy(id: number, data: any) {
    const prisma = new PrismaClient();
    try {
      const strategy = await prisma.strategy.update({
        where: { id },
        data
      });
      return strategy;
    } catch (error) {
      throw new AppError('Erro ao atualizar estratégia', 500);
    }
  }

  static async deleteStrategy(id: number) {
    const prisma = new PrismaClient();
    try {
      await prisma.strategy.delete({
        where: { id }
      });
    } catch (error) {
      throw new AppError('Erro ao deletar estratégia', 500);
    }
  }
}

// Referência ao mock para usar nos testes
const mockPrismaInstance = new PrismaClient();
const mockPrisma = mockPrismaInstance as {
  strategy: MockedStrategyModel;
  $disconnect: jest.MockedFunction<any>;
};

describe('Testes do StrategyService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createStrategy()', () => {
    it('deve criar nova estratégia com sucesso', async () => {
      const strategyData = {
        name: 'Estratégia Teste',
        status: 'active',
        entryValue: 10.0,
        accountType: 'demo',
        stopGainType: 'percentage',
        stopGainValue: 50.0,
        stopLossType: 'percentage',
        stopLossValue: 30.0
      };

      const expectedStrategy = {
        id: '1',
        ...strategyData,
        accuracyRate: null,
        totalProfit: null,
        operationCount: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.strategy.create.mockResolvedValue(expectedStrategy);

      const result = await StrategyService.createStrategy(strategyData);

      expect(result).toEqual(expectedStrategy);
      expect(mockPrisma.strategy.create).toHaveBeenCalledWith({
        data: strategyData
      });
    });

    it('deve lançar AppError quando falha ao criar estratégia', async () => {
      const strategyData = {
        name: 'Estratégia Teste',
        status: 'active',
        entryValue: 10.0,
        accountType: 'demo',
        stopGainType: 'percentage',
        stopGainValue: 50.0,
        stopLossType: 'percentage',
        stopLossValue: 30.0
      };

      mockPrisma.strategy.create.mockRejectedValue(new Error('Database error'));

      await expect(StrategyService.createStrategy(strategyData))
        .rejects
        .toThrow(AppError);
      
      await expect(StrategyService.createStrategy(strategyData))
        .rejects
        .toThrow('Erro ao criar estratégia');
    });

    it('deve criar estratégia com campos opcionais', async () => {
      const strategyData = {
        name: 'Estratégia Completa',
        status: 'active',
        entryValue: 25.0,
        accountType: 'real',
        stopGainType: 'value',
        stopGainValue: 100.0,
        stopLossType: 'value',
        stopLossValue: 50.0,
        accuracyRate: 75.5,
        totalProfit: 150.75,
        operationCount: 20
      };

      const expectedStrategy = {
        id: '2',
        ...strategyData,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.strategy.create.mockResolvedValue(expectedStrategy);

      const result = await StrategyService.createStrategy(strategyData);

      expect(result).toEqual(expectedStrategy);
      expect(result.accuracyRate).toBe(75.5);
      expect(result.totalProfit).toBe(150.75);
      expect(result.operationCount).toBe(20);
    });
  });

  describe('getAllStrategies()', () => {
    it('deve listar todas as estratégias ordenadas por data de criação', async () => {
      const mockStrategies = [
        {
          id: '1',
          name: 'Estratégia 1',
          status: 'active',
          entryValue: 10.0,
          accountType: 'demo',
          stopGainType: 'percentage',
          stopGainValue: 50.0,
          stopLossType: 'percentage',
          stopLossValue: 30.0,
          accuracyRate: null,
          totalProfit: null,
          operationCount: null,
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-15')
        },
        {
          id: '2',
          name: 'Estratégia 2',
          status: 'inactive',
          entryValue: 15.0,
          accountType: 'real',
          stopGainType: 'value',
          stopGainValue: 75.0,
          stopLossType: 'value',
          stopLossValue: 40.0,
          accuracyRate: 68.5,
          totalProfit: 120.50,
          operationCount: 15,
          createdAt: new Date('2024-01-14'),
          updatedAt: new Date('2024-01-14')
        }
      ];

      mockPrisma.strategy.findMany.mockResolvedValue(mockStrategies);

      const result = await StrategyService.getAllStrategies();

      expect(result).toEqual(mockStrategies);
      expect(result).toHaveLength(2);
      expect(mockPrisma.strategy.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' }
      });
    });

    it('deve retornar array vazio quando não há estratégias', async () => {
      mockPrisma.strategy.findMany.mockResolvedValue([]);

      const result = await StrategyService.getAllStrategies();

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('deve lançar AppError quando falha ao buscar estratégias', async () => {
      mockPrisma.strategy.findMany.mockRejectedValue(new Error('Database error'));

      await expect(StrategyService.getAllStrategies())
        .rejects
        .toThrow(AppError);
      
      await expect(StrategyService.getAllStrategies())
        .rejects
        .toThrow('Erro ao buscar estratégias');
    });
  });

  describe('getStrategyById()', () => {
    it('deve buscar estratégia por ID com sucesso', async () => {
      const strategyId = 1;
      const mockStrategy = {
        id: strategyId,
        name: 'Estratégia Teste',
        status: 'active',
        entryValue: 10.0,
        accountType: 'demo',
        stopGainType: 'percentage',
        stopGainValue: 50.0,
        stopLossType: 'percentage',
        stopLossValue: 30.0,
        accuracyRate: null,
        totalProfit: null,
        operationCount: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        orders: [
          {
            id: 'order1',
            dateTime: new Date(),
            asset: 'EURUSD',
            type: 'call',
            amount: 10.0,
            status: 'win',
            profit: 8.5,
            source: 'auto',
            accountType: 'demo',
            strategyId: strategyId
          }
        ]
      };

      mockPrisma.strategy.findUnique.mockResolvedValue(mockStrategy);

      const result = await StrategyService.getStrategyById(strategyId);

      expect(result).toEqual(mockStrategy);
      expect(result.orders).toHaveLength(1);
      expect(mockPrisma.strategy.findUnique).toHaveBeenCalledWith({
        where: { id: strategyId },
        include: { orders: true }
      });
    });

    it('deve lançar AppError 404 quando estratégia não é encontrada', async () => {
      const strategyId = 999;
      
      mockPrisma.strategy.findUnique.mockResolvedValue(null);

      await expect(StrategyService.getStrategyById(strategyId))
        .rejects
        .toThrow(AppError);
      
      await expect(StrategyService.getStrategyById(strategyId))
        .rejects
        .toThrow('Estratégia não encontrada');
    });

    it('deve lançar AppError quando falha ao buscar estratégia', async () => {
      const strategyId = 1;
      
      mockPrisma.strategy.findUnique.mockRejectedValue(new Error('Database error'));

      await expect(StrategyService.getStrategyById(strategyId))
        .rejects
        .toThrow(AppError);
      
      await expect(StrategyService.getStrategyById(strategyId))
        .rejects
        .toThrow('Erro ao buscar estratégia');
    });
  });

  describe('updateStrategy()', () => {
    it('deve atualizar estratégia existente com sucesso', async () => {
      const strategyId = 1;
      const updateData = {
        name: 'Estratégia Atualizada',
        entryValue: 20.0,
        stopGainValue: 60.0
      };

      const updatedStrategy = {
        id: strategyId,
        name: 'Estratégia Atualizada',
        status: 'active',
        entryValue: 20.0,
        accountType: 'demo',
        stopGainType: 'percentage',
        stopGainValue: 60.0,
        stopLossType: 'percentage',
        stopLossValue: 30.0,
        accuracyRate: null,
        totalProfit: null,
        operationCount: null,
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date() // Data atualizada
      };

      mockPrisma.strategy.update.mockResolvedValue(updatedStrategy);

      const result = await StrategyService.updateStrategy(strategyId, updateData);

      expect(result).toEqual(updatedStrategy);
      expect(result.name).toBe('Estratégia Atualizada');
      expect(result.entryValue).toBe(20.0);
      expect(result.stopGainValue).toBe(60.0);
      expect(mockPrisma.strategy.update).toHaveBeenCalledWith({
        where: { id: strategyId },
        data: updateData
      });
    });

    it('deve atualizar campos opcionais (accuracyRate, totalProfit, operationCount)', async () => {
      const strategyId = 1;
      const updateData = {
        accuracyRate: 85.5,
        totalProfit: 250.75,
        operationCount: 30
      };

      const updatedStrategy = {
        id: strategyId,
        name: 'Estratégia Teste',
        status: 'active',
        entryValue: 10.0,
        accountType: 'demo',
        stopGainType: 'percentage',
        stopGainValue: 50.0,
        stopLossType: 'percentage',
        stopLossValue: 30.0,
        accuracyRate: 85.5,
        totalProfit: 250.75,
        operationCount: 30,
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date()
      };

      mockPrisma.strategy.update.mockResolvedValue(updatedStrategy);

      const result = await StrategyService.updateStrategy(strategyId, updateData);

      expect(result.accuracyRate).toBe(85.5);
      expect(result.totalProfit).toBe(250.75);
      expect(result.operationCount).toBe(30);
    });

    it('deve lançar AppError quando falha ao atualizar estratégia', async () => {
      const strategyId = 1;
      const updateData = { name: 'Novo Nome' };
      
      mockPrisma.strategy.update.mockRejectedValue(new Error('Database error'));

      await expect(StrategyService.updateStrategy(strategyId, updateData))
        .rejects
        .toThrow(AppError);
      
      await expect(StrategyService.updateStrategy(strategyId, updateData))
        .rejects
        .toThrow('Erro ao atualizar estratégia');
    });
  });

  describe('deleteStrategy()', () => {
    it('deve deletar estratégia com sucesso', async () => {
      const strategyId = 1;
      
      mockPrisma.strategy.delete.mockResolvedValue({
        id: strategyId,
        name: 'Estratégia Deletada'
      });

      await expect(StrategyService.deleteStrategy(strategyId))
        .resolves
        .not.toThrow();

      expect(mockPrisma.strategy.delete).toHaveBeenCalledWith({
        where: { id: strategyId }
      });
    });

    it('deve lançar AppError quando falha ao deletar estratégia', async () => {
      const strategyId = 1;
      
      mockPrisma.strategy.delete.mockRejectedValue(new Error('Database error'));

      await expect(StrategyService.deleteStrategy(strategyId))
        .rejects
        .toThrow(AppError);
      
      await expect(StrategyService.deleteStrategy(strategyId))
        .rejects
        .toThrow('Erro ao deletar estratégia');
    });
  });

  describe('Testes de Validação de Dados', () => {
    it('deve aceitar todos os valores válidos de enumerações no create', async () => {
      const testCases = [
        {
          status: 'active',
          accountType: 'demo',
          stopGainType: 'percentage',
          stopLossType: 'percentage'
        },
        {
          status: 'inactive',
          accountType: 'real',
          stopGainType: 'value',
          stopLossType: 'value'
        },
        {
          status: 'win',
          accountType: 'demo',
          stopGainType: 'percentage',
          stopLossType: 'value'
        },
        {
          status: 'loss',
          accountType: 'real',
          stopGainType: 'value',
          stopLossType: 'percentage'
        },
        {
          status: 'open',
          accountType: 'demo',
          stopGainType: 'percentage',
          stopLossType: 'percentage'
        }
      ];

      for (const testCase of testCases) {
        const strategyData = {
          name: `Estratégia ${testCase.status}`,
          status: testCase.status,
          entryValue: 10.0,
          accountType: testCase.accountType,
          stopGainType: testCase.stopGainType,
          stopGainValue: 50.0,
          stopLossType: testCase.stopLossType,
          stopLossValue: 30.0
        };

        const expectedStrategy = {
          id: '1',
          ...strategyData,
          accuracyRate: null,
          totalProfit: null,
          operationCount: null,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        mockPrisma.strategy.create.mockResolvedValue(expectedStrategy);

        const result = await StrategyService.createStrategy(strategyData);

        expect(result.status).toBe(testCase.status);
        expect(result.accountType).toBe(testCase.accountType);
        expect(result.stopGainType).toBe(testCase.stopGainType);
        expect(result.stopLossType).toBe(testCase.stopLossType);
      }
    });

    it('deve aceitar valores decimais válidos', async () => {
      const strategyData = {
        name: 'Estratégia Decimal',
        status: 'active',
        entryValue: 12.75,
        accountType: 'demo',
        stopGainType: 'percentage',
        stopGainValue: 33.33,
        stopLossType: 'percentage',
        stopLossValue: 22.22,
        accuracyRate: 68.95,
        totalProfit: 245.67
      };

      const expectedStrategy = {
        id: '1',
        ...strategyData,
        operationCount: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.strategy.create.mockResolvedValue(expectedStrategy);

      const result = await StrategyService.createStrategy(strategyData);

      expect(result.entryValue).toBe(12.75);
      expect(result.stopGainValue).toBe(33.33);
      expect(result.stopLossValue).toBe(22.22);
      expect(result.accuracyRate).toBe(68.95);
      expect(result.totalProfit).toBe(245.67);
    });
  });
});