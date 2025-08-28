import { PrismaClient } from '@prisma/client';
import { beforeEach, afterEach, describe, it, expect } from '@jest/globals';

const prisma = new PrismaClient();

describe('Testes do Modelo de Configuração', () => {
  beforeEach(async () => {
    // Limpar dados de teste antes de cada teste
    await prisma.config.deleteMany();
  });

  afterEach(async () => {
    // Limpar dados de teste após cada teste
    await prisma.config.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Teste de Criação de Configuração Padrão', () => {
    it('deve criar uma nova configuração com valores padrão quando nenhum valor é fornecido', async () => {
      const config = await prisma.config.create({
        data: {}
      });

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
    });
  });

  describe('Teste de Persistência de Dados (Prisma aceita qualquer valor)', () => {
    it('deve aceitar defaultEntryValue negativo (validação será feita no ConfigService)', async () => {
      const config = await prisma.config.create({
        data: {
          defaultEntryValue: -1.0
        }
      });

      expect(config.defaultEntryValue).toBe(-1.0);
      // Nota: Prisma aceita valores inválidos, validação deve ser feita no ConfigService
    });

    it('deve aceitar maxOperationsPerDay zero (validação será feita no ConfigService)', async () => {
      const config = await prisma.config.create({
        data: {
          maxOperationsPerDay: 0
        }
      });

      expect(config.maxOperationsPerDay).toBe(0);
      // Nota: Prisma aceita valores inválidos, validação deve ser feita no ConfigService
    });

    it('deve aceitar maxOperationsPerDay negativo (validação será feita no ConfigService)', async () => {
      const config = await prisma.config.create({
        data: {
          maxOperationsPerDay: -5
        }
      });

      expect(config.maxOperationsPerDay).toBe(-5);
      // Nota: Prisma aceita valores inválidos, validação deve ser feita no ConfigService
    });

    it('deve aceitar notifications válido', async () => {
      const validNotifications = {
        win: true,
        loss: false,
        auto: true,
        sound: false
      };

      const config = await prisma.config.create({
        data: {
          notifications: validNotifications
        }
      });

      expect(config.notifications).toEqual(validNotifications);
    });
  });

  describe('Teste de Atualização de Campos', () => {
    it('deve atualizar autoConnect para true e verificar se persiste', async () => {
      // Criar configuração inicial
      const initialConfig = await prisma.config.create({
        data: {}
      });

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
    });

    it('deve atualizar notifications e verificar se persiste', async () => {
      // Criar configuração inicial
      const initialConfig = await prisma.config.create({
        data: {}
      });

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
    });
  });
});