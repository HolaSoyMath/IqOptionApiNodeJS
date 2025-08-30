import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { OrderService } from '../../src/services/order.service';
import { AppError } from '../../src/errors/custom-errors';

const prisma = new PrismaClient();

describe('Order Service Tests', () => {
  let testStrategy: any;

  beforeAll(async () => {
    // Limpar dados existentes
    await prisma.order.deleteMany();
    await prisma.strategy.deleteMany();
    
    // Criar estratégia de teste
    testStrategy = await prisma.strategy.create({
      data: {
        id: 1,
        name: 'Test Strategy for Orders',
        description: 'Estratégia para testar ordens',
        isActive: 'active',
        entryValue: 10,
        accountType: 'demo',
        totalProfit: 0,
        currentDayProfit: 0,
        operationCount: 0,
        accuracyRate: 0
      }
    });
  });

  afterAll(async () => {
    await prisma.order.deleteMany();
    await prisma.strategy.deleteMany();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Limpar ordens antes de cada teste
    await prisma.order.deleteMany();
  });

  describe('createManualOrder', () => {
    test('deve criar ordem manual com sucesso', async () => {
      const orderData = {
        asset: 'EUR/USD',
        type: 'call' as const,
        amount: 10,
        accountType: 'demo' as const,
        payoutPercent: 87,
        entryPrice: 1.0850
      };

      const order = await OrderService.createManualOrder(orderData);

      expect(order).toBeDefined();
      expect(order.asset).toBe('EUR/USD');
      expect(order.type).toBe('call');
      expect(order.amount).toBe(10);
      expect(order.source).toBe('manual');
      expect(order.status).toBe('open');
      expect(order.strategyId).toBeNull();
    });

    test('deve criar ordem manual com iqOptionId', async () => {
      const orderData = {
        asset: 'GBP/USD',
        type: 'put' as const,
        amount: 25,
        accountType: 'real' as const,
        payoutPercent: 85,
        entryPrice: 1.2750,
        iqOptionId: 'IQ123456789'
      };

      const order = await OrderService.createManualOrder(orderData);

      expect(order.iqOptionId).toBe('IQ123456789');
      expect(order.accountType).toBe('real');
    });
  });

  describe('createAutomaticOrder', () => {
    test('deve criar ordem automática vinculada a estratégia', async () => {
      const orderData = {
        strategyId: testStrategy.id,
        asset: 'EUR/USD',
        type: 'call' as const,
        amount: 10,
        accountType: 'demo' as const,
        payoutPercent: 87,
        entryPrice: 1.0850
      };

      const order = await OrderService.createAutomaticOrder(orderData);

      expect(order).toBeDefined();
      expect(order.strategyId).toBe(testStrategy.id);
      expect(order.source).toBe('auto');
      expect(order.status).toBe('open');
    });

    test('deve lançar erro para estratégia inexistente', async () => {
      const orderData = {
        strategyId: 99999,
        asset: 'EUR/USD',
        type: 'call' as const,
        amount: 10,
        accountType: 'demo' as const,
        payoutPercent: 87
      };

      await expect(OrderService.createAutomaticOrder(orderData))
        .rejects
        .toThrow(AppError);
    });
  });

  describe('processOrderResult', () => {
    test('deve processar ordem como WIN e calcular lucro', async () => {
      // Criar ordem de teste
      const order = await OrderService.createManualOrder({
        asset: 'EUR/USD',
        type: 'call' as const,
        amount: 100,
        accountType: 'demo' as const,
        payoutPercent: 87
      });

      await OrderService.processOrderResult(order.id, 'win', 1.0860);

      const updatedOrder = await prisma.order.findUnique({
        where: { id: order.id }
      });

      expect(updatedOrder?.status).toBe('win');
      expect(updatedOrder?.profit).toBe(87); // 100 * 0.87
      expect(updatedOrder?.closePrice).toBe(1.0860);
    });

    test('deve processar ordem como LOSS e calcular prejuízo', async () => {
      const order = await OrderService.createManualOrder({
        asset: 'EUR/USD',
        type: 'put' as const,
        amount: 50,
        accountType: 'demo' as const,
        payoutPercent: 85
      });

      await OrderService.processOrderResult(order.id, 'loss', 1.0860);

      const updatedOrder = await prisma.order.findUnique({
        where: { id: order.id }
      });

      expect(updatedOrder?.status).toBe('loss');
      expect(updatedOrder?.profit).toBe(-50);
      expect(updatedOrder?.closePrice).toBe(1.0860);
    });

    test('deve atualizar métricas da estratégia para ordem automática', async () => {
      const order = await OrderService.createAutomaticOrder({
        strategyId: testStrategy.id,
        asset: 'EUR/USD',
        type: 'call' as const,
        amount: 100,
        accountType: 'demo' as const,
        payoutPercent: 87
      });

      await OrderService.processOrderResult(order.id, 'win');

      const updatedStrategy = await prisma.strategy.findUnique({
        where: { id: testStrategy.id }
      });

      expect(updatedStrategy?.totalProfit).toBe(87);
      expect(updatedStrategy?.currentDayProfit).toBe(87);
      expect(updatedStrategy?.operationCount).toBe(1);
    });

    test('deve lançar erro para ordem inexistente', async () => {
      await expect(OrderService.processOrderResult(99999, 'win'))
        .rejects
        .toThrow(AppError);
    });
  });

  describe('getOrders', () => {
    beforeEach(async () => {
      // Criar algumas ordens de teste
      await OrderService.createManualOrder({
        asset: 'EUR/USD',
        type: 'call' as const,
        amount: 10,
        accountType: 'demo' as const,
        payoutPercent: 87
      });

      await OrderService.createManualOrder({
        asset: 'GBP/USD',
        type: 'put' as const,
        amount: 20,
        accountType: 'demo' as const,
        payoutPercent: 85
      });

      await OrderService.createAutomaticOrder({
        strategyId: testStrategy.id,
        asset: 'EUR/USD',
        type: 'call' as const,
        amount: 15,
        accountType: 'demo' as const,
        payoutPercent: 87
      });
    });

    test('deve retornar todas as ordens com paginação', async () => {
      const result = await OrderService.getOrders({
        page: 1,
        limit: 10
      });

      expect(result.orders).toHaveLength(3);
      expect(result.pagination.total).toBe(3);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
    });

    test('deve filtrar por ativo', async () => {
      const result = await OrderService.getOrders({
        asset: 'EUR/USD'
      });

      expect(result.orders).toHaveLength(2);
      expect(result.orders.every(o => o.asset === 'EUR/USD')).toBe(true);
    });

    test('deve filtrar por estratégia', async () => {
      const result = await OrderService.getOrders({
        strategyId: testStrategy.id
      });

      expect(result.orders).toHaveLength(1);
      expect(result.orders[0].strategyId).toBe(testStrategy.id);
    });

    test('deve calcular summary corretamente', async () => {
      // Processar algumas ordens como win/loss
      const orders = await prisma.order.findMany();
      await OrderService.processOrderResult(orders[0].id, 'win');
      await OrderService.processOrderResult(orders[1].id, 'loss');

      const result = await OrderService.getOrders({});

      expect(result.summary.totalOperations).toBe(3);
      expect(result.summary.wins).toBe(1);
      expect(result.summary.losses).toBe(1);
      expect(result.summary.accuracyPercent).toBe(50);
    });

    test('deve ordenar por data decrescente por padrão', async () => {
      const result = await OrderService.getOrders({});
      const dates = result.orders.map(o => new Date(o.dateTime).getTime());
      
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
      }
    });
  });

  describe('sendOrderToIQ', () => {
    test('deve criar ordem manual para envio à IQ', async () => {
      const order = await OrderService.sendOrderToIQ({
        activeId: 76,
        direction: 'call',
        price: 10,
        accountType: 'demo',
        payoutPercent: 87
      });

      expect(order).toBeDefined();
      expect(order.asset).toBe('ACTIVE_76');
      expect(order.type).toBe('call');
      expect(order.amount).toBe(10);
      expect(order.source).toBe('manual');
      expect(order.strategyId).toBeNull();
    });

    test('deve criar ordem automática para envio à IQ', async () => {
      const order = await OrderService.sendOrderToIQ({
        activeId: 76,
        direction: 'put',
        price: 15,
        accountType: 'demo',
        payoutPercent: 85,
        strategyId: testStrategy.id
      });

      expect(order).toBeDefined();
      expect(order.source).toBe('auto');
      expect(order.strategyId).toBe(testStrategy.id);
    });
  });
});