import { ConfigService, ConfigData } from '../../src/services/config.service';
import { AppError } from '../../src/errors/custom-errors';
import { beforeEach, describe, it, expect, jest } from '@jest/globals';

// Tipo para o mock do Prisma Config
type MockedConfigModel = {
  findFirst: jest.MockedFunction<any>;
  create: jest.MockedFunction<any>;
  update: jest.MockedFunction<any>;
  upsert: jest.MockedFunction<any>;
  deleteMany: jest.MockedFunction<any>;
};

// Mock do módulo @prisma/client ANTES de definir mockPrisma
jest.mock('@prisma/client', () => {
  const mockConfigModel = {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
    deleteMany: jest.fn()
  };
  
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      config: mockConfigModel,
      $disconnect: jest.fn()
    }))
  };
});

// Agora criamos uma referência ao mock para usar nos testes
const { PrismaClient } = require('@prisma/client');
const mockPrismaInstance = new PrismaClient();
const mockPrisma = mockPrismaInstance as {
  config: MockedConfigModel;
  $disconnect: jest.MockedFunction<any>;
};

describe('Testes do ConfigService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getConfig() quando não existe configuração', () => {
    it('deve criar uma configuração padrão quando não há configuração no banco', async () => {
      
      const expectedConfig = {
        id: 1,
        autoConnect: false,
        defaultEntryValue: 5.0,
        maxOperationsPerDay: 50,
        stopLoss: 0,
        stopGain: 0,
        stopLossEnabled: false,
        stopGainEnabled: false,
        notifications: {
          win: true,
          loss: true,
          auto: true,
          sound: true
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Mock do upsert para simular criação de nova configuração
      mockPrisma.config.upsert.mockResolvedValue(expectedConfig);
      
      const config = await ConfigService.getConfig();

      expect(config).toBeDefined();
      expect(config.defaultEntryValue).toBe(5.0);
      expect(config.maxOperationsPerDay).toBe(50);
      expect(config.autoConnect).toBe(false);
      expect(config.notifications).toEqual({
        win: true,
        loss: true,
        auto: true,
        sound: true
      });
      
      expect(mockPrisma.config.upsert).toHaveBeenCalledWith({
        where: { id: 1 },
        update: {},
        create: {
          id: 1,
          autoConnect: false,
          defaultEntryValue: 5.0,
          maxOperationsPerDay: 50,
          stopLoss: 0,
          stopGain: 0,
          stopLossEnabled: false,
          stopGainEnabled: false,
          notifications: {
            win: true,
            loss: true,
            auto: true,
            sound: true
          }
        }
      });
      
    });
  });

  describe('getConfig() quando existe configuração', () => {
    it('deve retornar a configuração existente', async () => {
      
      const existingConfig = {
        id: 1,
        autoConnect: true,
        defaultEntryValue: 10.0,
        maxOperationsPerDay: 100,
        stopLoss: 50,
        stopGain: 100,
        stopLossEnabled: true,
        stopGainEnabled: true,
        notifications: { win: true, loss: true, auto: false, sound: true },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Mock do upsert para simular retorno de configuração existente
      mockPrisma.config.upsert.mockResolvedValue(existingConfig);
      
      const config = await ConfigService.getConfig();

      expect(config).toEqual(existingConfig);
      expect(mockPrisma.config.upsert).toHaveBeenCalledWith({
        where: { id: 1 },
        update: {},
        create: expect.any(Object)
      });
      
    });
  });

  describe('updateConfig() com dados válidos', () => {
    it('deve atualizar configurações com dados válidos', async () => {
      const validData: ConfigData = {
        autoConnect: true,
        defaultEntryValue: 15.0,
        maxOperationsPerDay: 75,
        stopLoss: 25,
        stopGain: 50,
        stopLossEnabled: true,
        stopGainEnabled: true,
        notifications: { win: true, loss: false, auto: true, sound: false }
      };

      const updatedConfig = {
        id: 1,
        ...validData,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.config.upsert.mockResolvedValue(updatedConfig);
      
      const result = await ConfigService.updateConfig(validData);

      expect(result).toEqual(updatedConfig);
      expect(mockPrisma.config.upsert).toHaveBeenCalledWith({
        where: { id: 1 },
        update: {
          ...validData,
          updatedAt: expect.any(Date)
        },
        create: expect.any(Object)
      });
    });
  });

  describe('updateConfig() com dados inválidos', () => {
    it('deve retornar erro ao tentar atualizar com defaultEntryValue negativo', async () => {
      const invalidData: ConfigData = {
        defaultEntryValue: -5.0
      };

      await expect(ConfigService.updateConfig(invalidData))
        .rejects
        .toThrow(AppError);
        
      await expect(ConfigService.updateConfig(invalidData))
        .rejects
        .toThrow('defaultEntryValue deve ser um número positivo');
    });

    it('deve retornar erro ao tentar atualizar com maxOperationsPerDay inválido', async () => {
      const invalidData: ConfigData = {
        maxOperationsPerDay: 0
      };

      await expect(ConfigService.updateConfig(invalidData))
        .rejects
        .toThrow(AppError);
        
      await expect(ConfigService.updateConfig(invalidData))
        .rejects
        .toThrow('maxOperationsPerDay deve ser um inteiro positivo');
    });

    it('deve retornar erro ao tentar atualizar com notifications com chaves faltando', async () => {
      const reallyInvalidData = {
        notifications: { win: true } // Faltam outras chaves obrigatórias
      } as ConfigData;

      await expect(ConfigService.updateConfig(reallyInvalidData))
        .rejects
        .toThrow(AppError);
        
      await expect(ConfigService.updateConfig(reallyInvalidData))
        .rejects
        .toThrow('notifications.loss deve ser um booleano');
    });
  });

  describe('Tratamento de Erros', () => {
    it('deve lidar corretamente com erro de banco de dados', async () => {
      
      // Mock do upsert para simular erro de banco
      mockPrisma.config.upsert.mockRejectedValue(new Error('Database connection error'));

      await expect(ConfigService.getConfig())
        .rejects
        .toThrow(AppError);
        
      await expect(ConfigService.getConfig())
        .rejects
        .toThrow('Erro ao recuperar configurações');
        
    });
  });
});