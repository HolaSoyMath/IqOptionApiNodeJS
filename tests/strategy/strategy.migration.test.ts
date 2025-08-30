import { PrismaClient } from '@prisma/client';
import { beforeAll, afterAll, describe, it, expect } from '@jest/globals';

describe('Testes de Migração de Estratégias', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Validação do Schema do Banco de Dados', () => {
    it('deve criar a tabela strategies com todas as colunas corretas', async () => {
      try {
        // Verificar se a tabela existe e tem as colunas corretas
        const result = await prisma.$queryRaw`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns 
          WHERE table_name = 'Strategy' 
          ORDER BY column_name;
        `;

        const columns = result as Array<{
          column_name: string;
          data_type: string;
          is_nullable: string;
        }>;

        // Verificar colunas obrigatórias
        const expectedColumns = [
          'id',
          'name',
          'status',
          'entryValue',
          'accountType',
          'stopGainType',
          'stopGainValue',
          'stopLossType',
          'stopLossValue',
          'accuracyRate',
          'totalProfit',
          'operationCount',
          'createdAt',
          'updatedAt'
        ];

        const columnNames = columns.map(col => col.column_name);
        
        expectedColumns.forEach(expectedCol => {
          expect(columnNames).toContain(expectedCol);
        });

        expect(columns.length).toBeGreaterThanOrEqual(expectedColumns.length);
      } catch (error) {
        console.error('Erro ao verificar schema:', error);
        throw error;
      }
    });

    it('deve ter os tipos de dados corretos para cada coluna', async () => {
      try {
        const result = await prisma.$queryRaw`
          SELECT column_name, data_type
          FROM information_schema.columns 
          WHERE table_name = 'Strategy'
        `;

        const columns = result as Array<{
          column_name: string;
          data_type: string;
        }>;

        const columnTypes = columns.reduce((acc, col) => {
          acc[col.column_name] = col.data_type;
          return acc;
        }, {} as Record<string, string>);

        // Verificar tipos esperados
        expect(columnTypes.id).toBe('integer');
        expect(columnTypes.name).toBe('text');
        expect(columnTypes.entryValue).toBe('double precision');
        expect(columnTypes.stopGainValue).toBe('double precision');
        expect(columnTypes.stopLossValue).toBe('double precision');
        expect(columnTypes.accuracyRate).toBe('double precision');
        expect(columnTypes.totalProfit).toBe('double precision');
        expect(columnTypes.operationCount).toBe('integer');
        expect(columnTypes.createdAt).toBe('timestamp without time zone');
        expect(columnTypes.updatedAt).toBe('timestamp without time zone');
      } catch (error) {
        console.error('Erro ao verificar tipos de dados:', error);
        throw error;
      }
    });

    it('deve ter as constraints corretas (nullable, default values)', async () => {
      try {
        const result = await prisma.$queryRaw`
          SELECT 
            column_name, 
            is_nullable,
            column_default
          FROM information_schema.columns 
          WHERE table_name = 'Strategy'
        `;

        const columns = result as Array<{
          column_name: string;
          is_nullable: string;
          column_default: string | null;
        }>;


        const columnConstraints = columns.reduce((acc, col) => {
          acc[col.column_name] = {
            nullable: col.is_nullable === 'YES',
            default: col.column_default
          };
          return acc;
        }, {} as Record<string, { nullable: boolean; default: string | null }>);


        // Verificar campos obrigatórios (NOT NULL)
        expect(columnConstraints.id.nullable).toBe(false);
        expect(columnConstraints.name.nullable).toBe(false);
        expect(columnConstraints.status.nullable).toBe(false);
        expect(columnConstraints.entryValue.nullable).toBe(false);
        expect(columnConstraints.accountType.nullable).toBe(false);
        expect(columnConstraints.stopGainType.nullable).toBe(false);
        expect(columnConstraints.stopGainValue.nullable).toBe(false);
        expect(columnConstraints.stopLossType.nullable).toBe(false);
        expect(columnConstraints.stopLossValue.nullable).toBe(false);
        expect(columnConstraints.createdAt.nullable).toBe(false);
        expect(columnConstraints.updatedAt.nullable).toBe(false);

        // Verificar campos opcionais (NULL)
        expect(columnConstraints.accuracyRate.nullable).toBe(true);
        expect(columnConstraints.totalProfit.nullable).toBe(true);
        expect(columnConstraints.operationCount.nullable).toBe(true); // Campo é nullable no schema

        // Verificar valores padrão
        
        expect(columnConstraints.id.default).toContain('nextval'); // Auto increment
        // PostgreSQL usa CURRENT_TIMESTAMP em vez de now() na representação do schema
        expect(columnConstraints.createdAt.default).toMatch(/(now\(\)|CURRENT_TIMESTAMP)/); // Aceita ambos
        // operationCount não tem valor padrão (é nullable)
        expect(columnConstraints.operationCount.default).toBeNull();
        // O campo updatedAt com @updatedAt não tem default explícito no banco
        expect(columnConstraints.updatedAt.default).toBeNull();
      } catch (error) {
        console.error('❌ Erro ao verificar constraints:', error);
        throw error;
      }
    });
  });

  describe('Teste de Funcionalidade CRUD Básica', () => {
    it('deve permitir operações CRUD básicas na tabela strategies', async () => {
      let createdStrategy;
      
      try {
        // CREATE - Criar uma estratégia
        createdStrategy = await prisma.strategy.create({
          data: {
            name: 'Estratégia de Teste CRUD',
            status: 'active',
            entryValue: 10.0,
            accountType: 'demo',
            stopGainType: 'percentage',
            stopGainValue: 50.0,
            stopLossType: 'percentage',
            stopLossValue: 30.0
          }
        });

        expect(createdStrategy).toBeDefined();
        expect(createdStrategy.id).toBeDefined();
        expect(createdStrategy.name).toBe('Estratégia de Teste CRUD');

        // READ - Ler a estratégia criada
        const foundStrategy = await prisma.strategy.findUnique({
          where: { id: createdStrategy.id }
        });

        expect(foundStrategy).toBeDefined();
        expect(foundStrategy?.name).toBe('Estratégia de Teste CRUD');

        // UPDATE - Atualizar a estratégia
        const updatedStrategy = await prisma.strategy.update({
          where: { id: createdStrategy.id },
          data: {
            name: 'Estratégia Atualizada CRUD',
            entryValue: 15.0
          }
        });

        expect(updatedStrategy.name).toBe('Estratégia Atualizada CRUD');
        expect(updatedStrategy.entryValue).toBe(15.0);

        // DELETE - Deletar a estratégia
        await prisma.strategy.delete({
          where: { id: createdStrategy.id }
        });
        createdStrategy = null; // Marcar como deletada

        // Verificar que foi deletada
        const deletedStrategy = await prisma.strategy.findUnique({
          where: { id: updatedStrategy.id }
        });

        expect(deletedStrategy).toBeNull();
      } finally {
        // Limpar dados do teste se ainda existir
        if (createdStrategy) {
          await prisma.strategy.delete({ where: { id: createdStrategy.id } }).catch(() => {});
        }
      }
    });
  });

  describe('Teste de Relação com Orders', () => {
    it('deve manter integridade referencial com a tabela orders', async () => {
      let strategy, order;
      
      try {
        // Criar estratégia
        strategy = await prisma.strategy.create({
          data: {
            name: 'Estratégia para Teste de Relação',
            status: 'active',
            entryValue: 10.0,
            accountType: 'demo',
            stopGainType: 'percentage',
            stopGainValue: 50.0,
            stopLossType: 'percentage',
            stopLossValue: 30.0
          }
        });

        // Criar order relacionada
        order = await prisma.order.create({
          data: {
            dateTime: new Date(),
            strategyId: strategy.id,
            asset: 'EURUSD',
            type: 'call',
            amount: 10.0,
            status: 'open',
            profit: 0,
            source: 'auto',
            accountType: 'demo'
          }
        });

        // Verificar relação
        const strategyWithOrders = await prisma.strategy.findUnique({
          where: { id: strategy.id },
          include: { orders: true }
        });

        expect(strategyWithOrders).toBeDefined();
        expect(strategyWithOrders?.orders).toBeDefined();
        expect(strategyWithOrders?.orders).toHaveLength(1);
        expect(strategyWithOrders?.orders[0].id).toBe(order.id);
      } finally {
        // Limpar dados do teste
        if (order) await prisma.order.delete({ where: { id: order.id } }).catch(() => {});
        if (strategy) await prisma.strategy.delete({ where: { id: strategy.id } }).catch(() => {});
      }
    });
  });

  describe('Teste de Validação de Enums', () => {
    it('deve validar valores de enum corretamente', async () => {
      let validStrategy;
      
      try {
        // Testar valores válidos
        validStrategy = await prisma.strategy.create({
          data: {
            name: 'Estratégia Enum Válida',
            status: 'active',
            entryValue: 10.0,
            accountType: 'demo',
            stopGainType: 'percentage',
            stopGainValue: 50.0,
            stopLossType: 'value',
            stopLossValue: 30.0
          }
        });

        expect(validStrategy.status).toBe('active');
        expect(validStrategy.accountType).toBe('demo');
        expect(validStrategy.stopGainType).toBe('percentage');
        expect(validStrategy.stopLossType).toBe('value');

        // Testar valores inválidos (devem falhar)
        await expect(prisma.strategy.create({
          data: {
            name: 'Estratégia Enum Inválida',
            status: 'invalid_status' as any,
            entryValue: 10.0,
            accountType: 'demo',
            stopGainType: 'percentage',
            stopGainValue: 50.0,
            stopLossType: 'percentage',
            stopLossValue: 30.0
          }
        })).rejects.toThrow();
      } finally {
        // Limpar dados do teste
        if (validStrategy) {
          await prisma.strategy.delete({ where: { id: validStrategy.id } }).catch(() => {});
        }
      }
    });
  });
});