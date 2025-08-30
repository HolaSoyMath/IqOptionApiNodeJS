import { PrismaClient } from '@prisma/client';
import { describe, it, expect, afterAll } from '@jest/globals';

const prisma = new PrismaClient();

describe('Testes do Modelo de Configuração', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Teste de Criação de Configuração Padrão', () => {
    it('deve criar uma nova configuração com valores padrão quando nenhum valor é fornecido', async () => {
      let configId: number | undefined;
      
      try {
        const config = await prisma.config.create({
          data: {}
        });
        configId = config.id;

        expect(config).toBeDefined();
        expect(config.autoConnect).toBe(false);
        expect(config.defaultEntryValue).toBe(5.0);
        expect(config.maxOperationsPerDay).toBe(50);
        expect(config.stopLoss).toBe(0);
        expect(config.stopGain).toBe(0);
        expect(config.stopLossEnabled).toBe(false);
        expect(config.stopGainEnabled).toBe(false);
        expect(config.notifications).toBeNull();
        expect(config.createdAt).toBeInstanceOf(Date);
        expect(config.updatedAt).toBeInstanceOf(Date);
      } finally {
        // Limpar dados criados neste teste
        if (configId) {
          await prisma.config.delete({ where: { id: configId } }).catch(() => {});
        }
      }
    });
  });

  describe('Teste de Persistência de Dados (Prisma aceita qualquer valor)', () => {
    it('deve aceitar defaultEntryValue negativo (validação será feita no ConfigService)', async () => {
      let configId: number | undefined;
      
      try {
        const config = await prisma.config.create({
          data: {
            defaultEntryValue: -1.0
          }
        });
        configId = config.id;

        expect(config.defaultEntryValue).toBe(-1.0);
        // Nota: Prisma aceita valores inválidos, validação deve ser feita no ConfigService
      } finally {
        if (configId) {
          await prisma.config.delete({ where: { id: configId } }).catch(() => {});
        }
      }
    });

    it('deve aceitar maxOperationsPerDay zero (validação será feita no ConfigService)', async () => {
      let configId: number | undefined;
      
      try {
        const config = await prisma.config.create({
          data: {
            maxOperationsPerDay: 0
          }
        });
        configId = config.id;

        expect(config.maxOperationsPerDay).toBe(0);
        // Nota: Prisma aceita valores inválidos, validação deve ser feita no ConfigService
      } finally {
        if (configId) {
          await prisma.config.delete({ where: { id: configId } }).catch(() => {});
        }
      }
    });

    it('deve aceitar maxOperationsPerDay negativo (validação será feita no ConfigService)', async () => {
      let configId: number | undefined;
      
      try {
        const config = await prisma.config.create({
          data: {
            maxOperationsPerDay: -5
          }
        });
        configId = config.id;

        expect(config.maxOperationsPerDay).toBe(-5);
        // Nota: Prisma aceita valores inválidos, validação deve ser feita no ConfigService
      } finally {
        if (configId) {
          await prisma.config.delete({ where: { id: configId } }).catch(() => {});
        }
      }
    });

    it('deve aceitar notifications válido', async () => {
      let configId: number | undefined;
      
      try {
        const notifications = {
          win: true,
          loss: false,
          auto: true,
          sound: false
        };

        const config = await prisma.config.create({
          data: {
            notifications: notifications
          }
        });
        configId = config.id;

        expect(config.notifications).toEqual(notifications);
      } finally {
        if (configId) {
          await prisma.config.delete({ where: { id: configId } }).catch(() => {});
        }
      }
    });
  });

  describe('Teste de Atualização de Campos', () => {
    it('deve atualizar autoConnect para true e verificar se persiste', async () => {
      let configId: number | undefined;
      
      try {
        // Criar configuração inicial dentro do próprio teste
        const initialConfig = await prisma.config.create({
          data: {}
        });
        configId = initialConfig.id;

        // Atualizar autoConnect
        const updatedConfig = await prisma.config.update({
          where: { id: initialConfig.id },
          data: { autoConnect: true }
        });

        expect(updatedConfig.autoConnect).toBe(true);

        // Verificar se persiste após busca
        const fetchedConfig = await prisma.config.findUnique({
          where: { id: initialConfig.id }
        });

        expect(fetchedConfig?.autoConnect).toBe(true);
      } finally {
        if (configId) {
          await prisma.config.delete({ where: { id: configId } }).catch(() => {});
        }
      }
    });

    it('deve atualizar notifications e verificar se persiste', async () => {
      let configId: number | undefined;
      
      try {
        // Criar configuração inicial dentro do próprio teste
        const initialConfig = await prisma.config.create({
          data: {}
        });
        configId = initialConfig.id;

        const newNotifications = {
          win: false,
          loss: false,
          auto: false,
          sound: false
        };

        // Atualizar notifications
        const updatedConfig = await prisma.config.update({
          where: { id: initialConfig.id },
          data: { notifications: newNotifications }
        });

        expect(updatedConfig.notifications).toEqual(newNotifications);

        // Verificar se persiste após busca
        const fetchedConfig = await prisma.config.findUnique({
          where: { id: initialConfig.id }
        });

        expect(fetchedConfig?.notifications).toEqual(newNotifications);
      } finally {
        if (configId) {
          await prisma.config.delete({ where: { id: configId } }).catch(() => {});
        }
      }
    });
  });
});