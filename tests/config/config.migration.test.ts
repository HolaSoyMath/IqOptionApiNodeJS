import { PrismaClient } from '@prisma/client';
import { beforeAll, afterAll, describe, it, expect } from '@jest/globals';
import { AppError } from '../../src/errors/custom-errors';

describe('Testes de Migração de Configuração', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
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
      let configId: number | undefined;
      
      try {
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
        configId = created.id;

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
        configId = undefined; // Marcar como deletado

        const deleted = await prisma.config.findFirst({
          where: { id: created.id }
        });

        expect(deleted).toBeNull();

      } catch (error: any) {
        throw new AppError('Erro nas operações CRUD: ' + (error as Error).message, 500);
      } finally {
        // Limpar dados criados neste teste
        if (configId) {
          await prisma.config.delete({ where: { id: configId } }).catch(() => {});
        }
      }
    });

    it('deve lidar com o campo notifications como JSON corretamente', async () => {
      const configIds: number[] = [];
      
      try {
        // Testar com notifications undefined (será null no banco)
        const configWithoutNotifications = await prisma.config.create({
          data: {
            autoConnect: false,
            defaultEntryValue: 10.0,
            maxOperationsPerDay: 30
          }
        });
        configIds.push(configWithoutNotifications.id);

        expect(configWithoutNotifications.notifications).toBeNull();

        // Testar com notifications como objeto JSON
        const notificationsData = {
          email: true,
          push: false,
          sound: true,
          telegram: false
        };

        const configWithNotifications = await prisma.config.create({
          data: {
            autoConnect: true,
            defaultEntryValue: 15.0,
            maxOperationsPerDay: 40,
            notifications: notificationsData
          }
        });
        configIds.push(configWithNotifications.id);

        expect(configWithNotifications.notifications).toEqual(notificationsData);

        // Verificar se persiste após busca
        const fetchedConfig = await prisma.config.findFirst({
          where: { id: configWithNotifications.id }
        });

        expect(fetchedConfig?.notifications).toEqual(notificationsData);

        // Testar atualização do campo JSON
        const updatedNotifications = {
          email: false,
          push: true,
          sound: false,
          telegram: true
        };

        const updatedConfig = await prisma.config.update({
          where: { id: configWithNotifications.id },
          data: { notifications: updatedNotifications }
        });

        expect(updatedConfig.notifications).toEqual(updatedNotifications);

      } catch (error: any) {
        throw new AppError('Erro ao testar campo JSON: ' + (error as Error).message, 500);
      } finally {
        // Limpar dados criados neste teste
        for (const id of configIds) {
          await prisma.config.delete({ where: { id } }).catch(() => {});
        }
      }
    });

    it('deve validar constraints de integridade', async () => {
      let configId: number | undefined;
      
      try {
        // Testar valores extremos válidos
        const config = await prisma.config.create({
          data: {
            autoConnect: true,
            defaultEntryValue: 999999.99,
            maxOperationsPerDay: 2147483647, // Max int
            stopLoss: 999999,
            stopGain: 999999,
            stopLossEnabled: false,
            stopGainEnabled: false
          }
        });
        configId = config.id;

        expect(config.defaultEntryValue).toBe(999999.99);
        expect(config.maxOperationsPerDay).toBe(2147483647);

        // Verificar se timestamps são criados automaticamente
        expect(config.createdAt).toBeInstanceOf(Date);
        expect(config.updatedAt).toBeInstanceOf(Date);

        // Verificar se updatedAt é atualizado em modificações
        const originalUpdatedAt = config.updatedAt;
        
        // Aguardar um pouco para garantir diferença no timestamp
        await new Promise(resolve => setTimeout(resolve, 10));
        
        const updated = await prisma.config.update({
          where: { id: config.id },
          data: { autoConnect: false }
        });

        expect(updated.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
        expect(updated.createdAt).toEqual(config.createdAt); // createdAt não deve mudar

      } catch (error: any) {
        throw new AppError('Erro ao validar constraints: ' + (error as Error).message, 500);
      } finally {
        // Limpar dados criados neste teste
        if (configId) {
          await prisma.config.delete({ where: { id: configId } }).catch(() => {});
        }
      }
    });
  });
});