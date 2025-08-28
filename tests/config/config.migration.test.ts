import { PrismaClient } from '@prisma/client';
import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect } from '@jest/globals';
import { AppError } from '../../src/errors/custom-errors';

describe('Testes de Migração de Configuração', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // Adicionar limpeza antes e depois de cada teste
  beforeEach(async () => {
    // Limpar dados antes de cada teste para garantir estado limpo
    await prisma.config.deleteMany({});
  });

  afterEach(async () => {
    // Limpar dados após cada teste para não interferir com outros
    await prisma.config.deleteMany({});
  });

  describe('Validação do Schema do Banco de Dados', () => {
    it('deve ter a tabela config com as colunas corretas', async () => {
      try {
        // Verificar se a tabela existe e tem as colunas corretas
        const result = await prisma.$queryRaw`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns 
          WHERE table_name = 'configs' 
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
          'autoConnect',
          'defaultEntryValue',
          'maxOperationsPerDay',
          'stopLoss',
          'stopGain',
          'stopLossEnabled',
          'stopGainEnabled',
          'notifications',
          'createdAt',
          'updatedAt'
        ];

        const columnNames = columns.map(col => col.column_name);
        
        expectedColumns.forEach(expectedCol => {
          expect(columnNames).toContain(expectedCol);
        });

        // Verificar tipos específicos
        const idColumn = columns.find(col => col.column_name === 'id');
        expect(idColumn?.data_type).toBe('integer');
        expect(idColumn?.is_nullable).toBe('NO');

        const notificationsColumn = columns.find(col => col.column_name === 'notifications');
        expect(notificationsColumn?.is_nullable).toBe('YES'); // JSON pode ser null

      } catch (error: any) {
        throw new AppError('Erro ao verificar estrutura da tabela: ' + (error as Error).message, 500);
      }
    });

    it('deve ser capaz de realizar operações CRUD básicas', async () => {
      try {
        // Limpar dados de teste
        await prisma.config.deleteMany({});

        // Criar configuração
        const created = await prisma.config.create({
          data: {
            autoConnect: true,
            defaultEntryValue: 25,
            maxOperationsPerDay: 100,
            stopLoss: 50,
            stopGain: 100,
            stopLossEnabled: true,
            stopGainEnabled: true,
            notifications: {
              email: true,
              push: false,
              sound: true
            }
          }
        });

        expect(created.id).toBeDefined();
        expect(created.autoConnect).toBe(true);
        expect(created.notifications).toEqual({
          email: true,
          push: false,
          sound: true
        });

        // Ler configuração
        const found = await prisma.config.findFirst({
          where: { id: created.id }
        });

        expect(found).toBeDefined();
        expect(found?.autoConnect).toBe(true);

        // Atualizar configuração
        const updated = await prisma.config.update({
          where: { id: created.id },
          data: { autoConnect: false }
        });

        expect(updated.autoConnect).toBe(false);
        expect(updated.defaultEntryValue).toBe(25); // Outros campos mantidos

        // Deletar configuração
        await prisma.config.delete({
          where: { id: created.id }
        });

        const deleted = await prisma.config.findFirst({
          where: { id: created.id }
        });

        expect(deleted).toBeNull();

      } catch (error: any) {
        throw new AppError('Erro nas operações CRUD: ' + (error as Error).message, 500);
      }
    });

    it('deve lidar com o campo notifications como JSON corretamente', async () => {
      try {
        // Limpar dados de teste
        await prisma.config.deleteMany({});

        // Testar com notifications undefined (será null no banco)
        const configWithoutNotifications = await prisma.config.create({
          data: {
            autoConnect: false,
            defaultEntryValue: 10,
            maxOperationsPerDay: 50,
            stopLoss: 0,
            stopGain: 0,
            stopLossEnabled: false,
            stopGainEnabled: false
            // notifications omitido - será null
          }
        });

        expect(configWithoutNotifications.notifications).toBeNull();

        // Testar com notifications como objeto
        const configWithNotifications = await prisma.config.create({
          data: {
            autoConnect: true,
            defaultEntryValue: 20,
            maxOperationsPerDay: 75,
            stopLoss: 25,
            stopGain: 50,
            stopLossEnabled: true,
            stopGainEnabled: true,
            notifications: {
              email: true,
              push: true,
              sound: false,
              custom: 'valor personalizado'
            }
          }
        });

        expect(configWithNotifications.notifications).toEqual({
          email: true,
          push: true,
          sound: false,
          custom: 'valor personalizado'
        });

        // Limpar dados de teste
        await prisma.config.deleteMany({});

      } catch (error: any) {
        throw new AppError('Erro ao testar campo JSON notifications: ' + (error as Error).message, 500);
      }
    });

    it('deve criar configuração com valores padrão quando nenhum dado é fornecido', async () => {
      try {
        // Limpar dados de teste
        await prisma.config.deleteMany({});
        
        // Criar configuração sem fornecer dados - deve usar valores padrão do schema
        const configWithDefaults = await prisma.config.create({
          data: {}
        });
        
        // Verificar se os valores padrão do schema foram aplicados
        expect(configWithDefaults.id).toBeDefined();
        expect(configWithDefaults.autoConnect).toBe(false); // @default(false)
        expect(configWithDefaults.defaultEntryValue).toBe(5.0); // @default(5.0)
        expect(configWithDefaults.maxOperationsPerDay).toBe(50); // @default(50)
        expect(configWithDefaults.stopLoss).toBe(0); // @default(0)
        expect(configWithDefaults.stopGain).toBe(0); // @default(0)
        expect(configWithDefaults.stopLossEnabled).toBe(false); // @default(false)
        expect(configWithDefaults.stopGainEnabled).toBe(false); // @default(false)
        expect(configWithDefaults.notifications).toBeNull(); // Json? (opcional)
        expect(configWithDefaults.createdAt).toBeDefined();
        expect(configWithDefaults.updatedAt).toBeDefined();

        // Limpar dados de teste
        await prisma.config.deleteMany({});

      } catch (error: any) {
        throw new AppError('Erro ao testar valores padrão: ' + (error as Error).message, 500);
      }
    });

    it('deve validar constraint de ID único', async () => {
      try {
        // Limpar dados de teste
        await prisma.config.deleteMany({});
        
        // Criar primeira configuração
        const firstConfig = await prisma.config.create({
          data: {
            autoConnect: true,
            defaultEntryValue: 10
          }
        });
        
        // Tentar criar segunda configuração com mesmo ID deve falhar
        // Como o ID tem @default(1), isso deve gerar conflito
        
        await expect(prisma.config.create({
          data: {
            id: firstConfig.id, // Forçar mesmo ID
            autoConnect: false,
            defaultEntryValue: 20
          }
        })).rejects.toThrow();

        // Limpar dados de teste
        await prisma.config.deleteMany({});

      } catch (error: any) {
        throw new AppError('Erro ao testar constraint de ID único: ' + (error as Error).message, 500);
      }
    });
  });

  describe('Testes de Integridade de Dados', () => {
    it('deve manter consistência de dados através das operações', async () => {
      try {        
        // Verificar estado inicial do banco (deve estar limpo)
        const initialConfigs = await prisma.config.findMany();
        expect(initialConfigs).toHaveLength(0); // Deve estar vazio

        // Criar uma configuração inicial
        const initialConfig = await prisma.config.create({
          data: {
            autoConnect: false,
            defaultEntryValue: 10,
            maxOperationsPerDay: 25,
            stopLoss: 5,
            stopGain: 10,
            stopLossEnabled: true,
            stopGainEnabled: false,
            notifications: {
              email: true,
              push: false,
              sound: true
            }
          }
        });

        // Verificar se a configuração foi criada corretamente
        expect(initialConfig).toBeDefined();
        expect(initialConfig.defaultEntryValue).toBe(10);
        expect(initialConfig.maxOperationsPerDay).toBe(25);
        
        // Armazenar o ID real gerado para usar nas próximas operações
        const configId = initialConfig.id;
        expect(configId).toBeGreaterThan(0); // ID deve ser um número positivo

        // Verificar estado do banco após criação
        const afterCreateConfigs = await prisma.config.findMany();
        expect(afterCreateConfigs).toHaveLength(1);

        // Testar atualização (upsert) usando o ID real
        const updatedConfig = await prisma.config.upsert({
          where: { id: configId },
          update: {
            defaultEntryValue: 20,
            maxOperationsPerDay: 50,
            autoConnect: true
          },
          create: {
            defaultEntryValue: 20,
            maxOperationsPerDay: 50,
            autoConnect: true
          }
        });

        // Verificar se a atualização funcionou
        expect(updatedConfig.defaultEntryValue).toBe(20);
        expect(updatedConfig.maxOperationsPerDay).toBe(50);
        expect(updatedConfig.autoConnect).toBe(true);
        expect(updatedConfig.id).toBe(configId); // ID deve permanecer o mesmo

        // Verificar que existe apenas uma configuração
        const allConfigs = await prisma.config.findMany();
        expect(allConfigs).toHaveLength(1);

        // Não precisa limpar manualmente - afterEach fará isso
        // const finalDeleteResult = await prisma.config.deleteMany({});

      } catch (error: any) {
        console.error('🔍 [DEBUG] Erro capturado:', error);
        throw new AppError('Erro ao testar integridade de dados: ' + (error as Error).message, 500);
      }
    });
  });
});