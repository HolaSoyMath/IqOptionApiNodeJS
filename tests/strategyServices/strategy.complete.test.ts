import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { StrategyService } from '../../src/services/strategy.service';
import request from 'supertest';
import app from '../../src/app';
import { AppError } from '../../src/errors/custom-errors';

const prisma = new PrismaClient();

describe('Strategy Service Tests', () => {
  beforeAll(async () => {
    // Limpar e preparar banco de teste
    await prisma.order.deleteMany();
    await prisma.strategy.deleteMany();
    await prisma.config.deleteMany();
    
    // Criar config padrão
    await prisma.config.create({
      data: {
        id: 1,
        autoConnect: false,
        defaultEntryValue: 20,
        maxOperationsPerDay: 10,
        stopLoss: 100,
        stopGain: 50,
        stopLossEnabled: true,
        stopGainEnabled: true,
        notifications: true
      }
    });
    
    // Criar estratégias de teste
    await prisma.strategy.createMany({
      data: [
        {
          id: 1,
          name: 'Test Strategy 1',
          description: 'Estratégia de teste 1',
          isActive: 'active',
          totalProfit: 100,
          entryValue: 5,
          accountType: 'demo',
          stopGainType: 'value',
          stopGainValue: 50,
          stopGainEnabled: true,
          stopLossType: 'value',
          stopLossValue: 100,
          stopLossEnabled: true,
          currentDayProfit: 25,
          lastResetDate: new Date()
        },
        {
          id: 2,
          name: 'Test Strategy 2',
          description: 'Estratégia de teste 2',
          isActive: 'inactive',
          totalProfit: -50,
          entryValue: 10,
          accountType: 'real',
          stopGainType: 'percentage',
          stopGainValue: 10,
          stopGainEnabled: false,
          stopLossType: 'percentage',
          stopLossValue: 5,
          stopLossEnabled: false,
          currentDayProfit: -15,
          lastResetDate: new Date()
        }
      ]
    });
  });

  afterAll(async () => {
    await prisma.order.deleteMany();
    await prisma.strategy.deleteMany();
    await prisma.config.deleteMany();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Reset para estado conhecido antes de cada teste
    const strategies = await prisma.strategy.findMany();
    for (const strategy of strategies) {
      await prisma.strategy.update({
        where: { id: strategy.id },
        data: {
          isActive: strategy.name === 'Test Strategy 1' ? 'active' : 'inactive',
          currentDayProfit: strategy.name === 'Test Strategy 1' ? 25 : -15
        }
      });
    }
  });

  describe('getAllStrategies', () => {
    test('deve retornar todas as estratégias com summary correto', async () => {
      const result = await StrategyService.getAllStrategies();
      
      expect(result.strategies).toHaveLength(2);
      expect(result.summary.total).toBe(2);
      expect(result.summary.active).toBe(1);
      expect(result.summary.inactive).toBe(1);
      expect(result.summary.profitable).toBe(1);
      expect(result.summary.unprofitable).toBe(1);
      
      // Verificar estrutura das estratégias
      const activeStrategy = result.strategies.find(s => s.isActive === 'active');
      expect(activeStrategy).toBeDefined();
      expect(activeStrategy?.name).toBe('Test Strategy 1');
      expect(activeStrategy?.totalProfit).toBe(100);
    });

    test('deve retornar summary zerado quando não há estratégias', async () => {
      await prisma.strategy.deleteMany();
      
      const result = await StrategyService.getAllStrategies();
      
      expect(result.strategies).toHaveLength(0);
      expect(result.summary.total).toBe(0);
      expect(result.summary.active).toBe(0);
      expect(result.summary.inactive).toBe(0);
      expect(result.summary.profitable).toBe(0);
      expect(result.summary.unprofitable).toBe(0);
      
      // Recriar estratégias para outros testes
      await prisma.strategy.createMany({
        data: [
          {
            id: 1,
            name: 'Test Strategy 1',
            description: 'Estratégia de teste 1',
            isActive: 'active',
            totalProfit: 100,
            entryValue: 5,
            accountType: 'demo',
            currentDayProfit: 25,
            lastResetDate: new Date()
          },
          {
            id: 2,
            name: 'Test Strategy 2',
            description: 'Estratégia de teste 2',
            isActive: 'inactive',
            totalProfit: -50,
            entryValue: 10,
            accountType: 'real',
            currentDayProfit: -15,
            lastResetDate: new Date()
          }
        ]
      });
    });
  });

  describe('getStrategyById', () => {
    test('deve retornar estratégia existente', async () => {
      const strategies = await prisma.strategy.findMany();
      const strategy = await StrategyService.getStrategyById(strategies[0].id);
      
      expect(strategy).toBeDefined();
      expect(strategy.id).toBe(strategies[0].id);
      expect(strategy.name).toBe('Test Strategy 1');
    });

    test('deve lançar erro para estratégia inexistente', async () => {
      await expect(StrategyService.getStrategyById(99999))
        .rejects
        .toThrow(AppError);
    });
  });

  describe('updateStrategy', () => {
    test('deve atualizar estratégia e aplicar valores padrão ao ativar', async () => {
      const strategies = await prisma.strategy.findMany();
      const inactiveStrategy = strategies.find(s => s.isActive === 'inactive');
      
      const updated = await StrategyService.updateStrategy(inactiveStrategy!.id, {
        isActive: 'active'
      });

      expect(updated.isActive).toBe('active');
      expect(updated.currentDayProfit).toBe(0);
      expect(updated.lastResetDate).toBeDefined();
      expect(updated.entryValue).toBe(20); // Valor padrão da config
    });

    test('deve capturar saldo base ao definir stop percentual', async () => {
      const strategies = await prisma.strategy.findMany();
      const strategy = strategies[0];
      
      const updated = await StrategyService.updateStrategy(strategy.id, {
        stopGainType: 'percentage',
        stopGainValue: 10,
        stopGainEnabled: true
      });

      expect(updated.stopBaseBalance).toBeDefined();
      expect(updated.stopGainType).toBe('percentage');
      expect(updated.stopGainValue).toBe(10);
    });

    test('deve resetar lucro diário quando dailyResetGain é true', async () => {
      const strategies = await prisma.strategy.findMany();
      const strategy = strategies[0];
      
      // Primeiro, definir um lucro atual
      await prisma.strategy.update({
        where: { id: strategy.id },
        data: { currentDayProfit: 100 }
      });
      
      const updated = await StrategyService.updateStrategy(strategy.id, {
        dailyResetGain: true
      });

      expect(updated.currentDayProfit).toBe(0);
      expect(updated.lastResetDate).toBeDefined();
    });

    test('deve lançar erro para estratégia inexistente', async () => {
      await expect(StrategyService.updateStrategy(99999, { isActive: 'active' }))
        .rejects
        .toThrow(AppError);
    });
  });

  describe('resetDailyProfits', () => {
    test('deve resetar lucros diários de todas as estratégias', async () => {
      // Definir lucros atuais
      const strategies = await prisma.strategy.findMany();
      for (const strategy of strategies) {
        await prisma.strategy.update({
          where: { id: strategy.id },
          data: { currentDayProfit: 50 }
        });
      }
      
      await StrategyService.resetDailyProfits();
      
      const updatedStrategies = await prisma.strategy.findMany();
      for (const strategy of updatedStrategies) {
        expect(strategy.currentDayProfit).toBe(0);
      }
    });
  });

  describe('updateStrategyMetrics', () => {
    test('deve atualizar métricas após operação lucrativa', async () => {
      const strategies = await prisma.strategy.findMany();
      const strategy = strategies[0];
      
      const initialProfit = strategy.totalProfit || 0;
      const initialDayProfit = strategy.currentDayProfit || 0;
      const initialOperationCount = strategy.operationCount || 0;
      
      await StrategyService.updateStrategyMetrics(strategy.id, 25, true);
      
      // Buscar a estratégia atualizada
      const updated = await prisma.strategy.findUnique({ where: { id: strategy.id } });
      
      expect(updated).not.toBeNull();
      expect(updated!.totalProfit).toBe(initialProfit + 25);
      expect(updated!.currentDayProfit).toBe(initialDayProfit + 25);
      expect(updated!.operationCount).toBe(initialOperationCount + 1);
    });

    test('deve atualizar métricas após operação com prejuízo', async () => {
      const strategies = await prisma.strategy.findMany();
      const strategy = strategies[0];
      
      const initialProfit = strategy.totalProfit || 0;
      const initialDayProfit = strategy.currentDayProfit || 0;
      const initialOperationCount = strategy.operationCount || 0;
      
      await StrategyService.updateStrategyMetrics(strategy.id, -15, false);
      
      // Buscar a estratégia atualizada
      const updated = await prisma.strategy.findUnique({ where: { id: strategy.id } });
      
      expect(updated).not.toBeNull();
      expect(updated!.totalProfit).toBe(initialProfit - 15);
      expect(updated!.currentDayProfit).toBe(initialDayProfit - 15);
      expect(updated!.operationCount).toBe(initialOperationCount + 1);
    });
  });

  describe('checkStopConditions', () => {
    test('deve detectar stop loss por valor', async () => {
      const strategies = await prisma.strategy.findMany();
      const strategy = strategies[0];
      
      await prisma.strategy.update({
        where: { id: strategy.id },
        data: {
          stopLossEnabled: true,
          stopLossType: 'value',
          stopLossValue: 50,
          currentDayProfit: -51
        }
      });

      const result = await StrategyService.checkStopConditions(strategy.id);
      expect(result.shouldStop).toBe(true);
      expect(result.reason).toContain('Stop Loss');
    });

    test('deve detectar stop gain por valor', async () => {
      const strategies = await prisma.strategy.findMany();
      const strategy = strategies[0];
      
      await prisma.strategy.update({
        where: { id: strategy.id },
        data: {
          stopGainEnabled: true,
          stopGainType: 'value',
          stopGainValue: 50,
          currentDayProfit: 51
        }
      });

      const result = await StrategyService.checkStopConditions(strategy.id);
      expect(result.shouldStop).toBe(true);
      expect(result.reason).toContain('Stop Gain');
    });

    test('deve detectar stop gain por percentual', async () => {
      const strategies = await prisma.strategy.findMany();
      const strategy = strategies[0];
      
      await prisma.strategy.update({
        where: { id: strategy.id },
        data: {
          stopGainEnabled: true,
          stopGainType: 'percentage',
          stopGainValue: 10,
          stopBaseBalance: 1000,
          currentDayProfit: 101
        }
      });

      const result = await StrategyService.checkStopConditions(strategy.id);
      expect(result.shouldStop).toBe(true);
      expect(result.reason).toContain('Stop Gain');
    });

    test('deve detectar stop loss por percentual', async () => {
      const strategies = await prisma.strategy.findMany();
      const strategy = strategies[0];
      
      await prisma.strategy.update({
        where: { id: strategy.id },
        data: {
          stopLossEnabled: true,
          stopLossType: 'percentage',
          stopLossValue: 5,
          stopBaseBalance: 1000,
          currentDayProfit: -51
        }
      });

      const result = await StrategyService.checkStopConditions(strategy.id);
      expect(result.shouldStop).toBe(true);
      expect(result.reason).toContain('Stop Loss');
    });

    test('não deve parar quando condições não são atendidas', async () => {
      const strategies = await prisma.strategy.findMany();
      const strategy = strategies[0];
      
      await prisma.strategy.update({
        where: { id: strategy.id },
        data: {
          stopGainEnabled: true,
          stopGainType: 'value',
          stopGainValue: 100,
          stopLossEnabled: true,
          stopLossType: 'value',
          stopLossValue: 100,
          currentDayProfit: 25
        }
      });

      const result = await StrategyService.checkStopConditions(strategy.id);
      expect(result.shouldStop).toBe(false);
      expect(result.reason).toBe('');
    });

    test('deve lançar erro para estratégia inexistente', async () => {
      await expect(StrategyService.checkStopConditions(99999))
        .rejects
        .toThrow(AppError);
    });
  });
});

describe('Strategy Controller Tests', () => {
  beforeAll(async () => {
    // Garantir que temos estratégias para testar
    await prisma.strategy.deleteMany();
    await prisma.strategy.createMany({
      data: [
        {
          id: 3,
          name: 'Controller Test Strategy 1',
          description: 'Estratégia para teste do controller',
          isActive: 'active',
          totalProfit: 75,
          entryValue: 8,
          accountType: 'demo',
          currentDayProfit: 15,
          lastResetDate: new Date()
        },
        {
          id: 4,
          name: 'Controller Test Strategy 2',
          description: 'Segunda estratégia para teste',
          isActive: 'inactive',
          totalProfit: -25,
          entryValue: 12,
          accountType: 'real',
          currentDayProfit: -5,
          lastResetDate: new Date()
        }
      ]
    });
  });

  describe('GET /api/strategies', () => {
    test('deve retornar 200 com lista de estratégias', async () => {
      const response = await request(app)
        .get('/api/strategies')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Estratégias recuperadas com sucesso');
      expect(response.body.data.strategies).toBeDefined();
      expect(response.body.data.summary).toBeDefined();
      expect(response.body.data.strategies).toHaveLength(2);
      expect(response.body.data.summary.total).toBe(2);
      expect(response.body.data.summary.active).toBe(1);
      expect(response.body.data.summary.inactive).toBe(1);
    });

    test('deve retornar estrutura correta mesmo sem estratégias', async () => {
      await prisma.strategy.deleteMany();
      
      const response = await request(app)
        .get('/api/strategies')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.strategies).toHaveLength(0);
      expect(response.body.data.summary.total).toBe(0);
      
      // Recriar estratégias
      await prisma.strategy.createMany({
        data: [
          {
            id: 1, 
            name: 'Controller Test Strategy 1',
            description: 'Estratégia para teste do controller',
            isActive: 'active',
            totalProfit: 75,
            entryValue: 8,
            accountType: 'demo',
            currentDayProfit: 15,
            lastResetDate: new Date()
          },
          {
            id: 2, 
            name: 'Controller Test Strategy 2',
            description: 'Segunda estratégia para teste',
            isActive: 'inactive',
            totalProfit: -25,
            entryValue: 12,
            accountType: 'real',
            currentDayProfit: -5,
            lastResetDate: new Date()
          }
        ]
      });
    });
  });

  describe('PUT /api/strategies/:id', () => {
    test('deve atualizar estratégia com dados válidos', async () => {
      const strategies = await prisma.strategy.findMany();
      const strategy = strategies[0];
      
      const response = await request(app)
        .put(`/api/strategies/${strategy.id}`)
        .send({
          isActive: 'inactive',
          entryValue: 15
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Estratégia atualizada com sucesso');
      expect(response.body.data.entryValue).toBe(15);
      expect(response.body.data.isActive).toBe('inactive');
    });

    test('deve atualizar configurações de stop', async () => {
      const strategies = await prisma.strategy.findMany();
      const strategy = strategies[0];
      
      const response = await request(app)
        .put(`/api/strategies/${strategy.id}`)
        .send({
          stopGainEnabled: true,
          stopGainType: 'percentage',
          stopGainValue: 15,
          stopLossEnabled: true,
          stopLossType: 'value',
          stopLossValue: 50
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.stopGainEnabled).toBe(true);
      expect(response.body.data.stopGainType).toBe('percentage');
      expect(response.body.data.stopGainValue).toBe(15);
      expect(response.body.data.stopLossEnabled).toBe(true);
      expect(response.body.data.stopLossType).toBe('value');
      expect(response.body.data.stopLossValue).toBe(50);
    });

    test('deve retornar 400 para ID inválido', async () => {
      const response = await request(app)
        .put('/api/strategies/invalid')
        .send({ isActive: 'active' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('ID da estratégia deve ser um número válido');
    });

    test('deve retornar 404 para estratégia inexistente', async () => {
      const response = await request(app)
        .put('/api/strategies/99999')
        .send({ isActive: 'active' })
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    test('deve retornar 400 para dados inválidos', async () => {
      const strategies = await prisma.strategy.findMany();
      const strategy = strategies[0];
      
      const response = await request(app)
        .put(`/api/strategies/${strategy.id}`)
        .send({
          isActive: 'invalid_status',
          entryValue: -5
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('deve retornar 400 para accountType inválido', async () => {
      const strategies = await prisma.strategy.findMany();
      const strategy = strategies[0];
      
      const response = await request(app)
        .put(`/api/strategies/${strategy.id}`)
        .send({
          accountType: 'invalid_account'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('deve retornar 400 para stopGainType inválido', async () => {
      const strategies = await prisma.strategy.findMany();
      const strategy = strategies[0];
      
      const response = await request(app)
        .put(`/api/strategies/${strategy.id}`)
        .send({
          stopGainType: 'invalid_type'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});