import request from 'supertest';
import express from 'express';
import { ConfigService } from '../../src/services/config.service';
import { configRoutes } from '../../src/routes/config.routes';
import { AppError } from '../../src/errors/custom-errors';
import { beforeEach, describe, it, expect, jest } from '@jest/globals';

// Mock do ConfigService
jest.mock('../../src/services/config.service');
const MockedConfigService = ConfigService as jest.MockedClass<typeof ConfigService>;

const app = express();
app.use(express.json());
app.use('/api/config', configRoutes);

describe('Testes do Controller de Configuração', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/config', () => {
    it('deve retornar configuração padrão quando não existe configuração', async () => {
      const defaultConfig = {
        id: 1,
        autoConnect: false,
        defaultEntryValue: 5.0,
        maxOperationsPerDay: 50,
        stopLoss: 0,
        stopGain: 0,
        stopLossEnabled: false,
        stopGainEnabled: false,
        notifications: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      jest.spyOn(ConfigService, 'getConfig').mockResolvedValue(defaultConfig);
      
      const response = await request(app)
        .get('/api/config');
        
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({
        autoConnect: defaultConfig.autoConnect,
        defaultEntryValue: defaultConfig.defaultEntryValue,
        maxOperationsPerDay: defaultConfig.maxOperationsPerDay,
        stopLoss: defaultConfig.stopLoss,
        stopGain: defaultConfig.stopGain,
        stopLossEnabled: defaultConfig.stopLossEnabled,
        stopGainEnabled: defaultConfig.stopGainEnabled,
        notifications: defaultConfig.notifications
      });
      expect(ConfigService.getConfig).toHaveBeenCalled();
    });

    it('deve retornar configuração existente quando há configuração salva', async () => {
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

      jest.spyOn(ConfigService, 'getConfig').mockResolvedValue(existingConfig);
      
      const response = await request(app)
        .get('/api/config');
        
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({
        autoConnect: existingConfig.autoConnect,
        defaultEntryValue: existingConfig.defaultEntryValue,
        maxOperationsPerDay: existingConfig.maxOperationsPerDay,
        stopLoss: existingConfig.stopLoss,
        stopGain: existingConfig.stopGain,
        stopLossEnabled: existingConfig.stopLossEnabled,
        stopGainEnabled: existingConfig.stopGainEnabled,
        notifications: existingConfig.notifications
      });
    });
  });

  describe('POST /api/config com dados válidos', () => {
    it('deve atualizar configuração com dados válidos e retornar status 200', async () => {
      const validData = {
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

      jest.spyOn(ConfigService, 'updateConfig').mockResolvedValue(updatedConfig);
      
      const response = await request(app)
        .post('/api/config')
        .send(validData);
        
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({
        autoConnect: updatedConfig.autoConnect,
        defaultEntryValue: updatedConfig.defaultEntryValue,
        maxOperationsPerDay: updatedConfig.maxOperationsPerDay,
        stopLoss: updatedConfig.stopLoss,
        stopGain: updatedConfig.stopGain,
        stopLossEnabled: updatedConfig.stopLossEnabled,
        stopGainEnabled: updatedConfig.stopGainEnabled,
        notifications: updatedConfig.notifications
      });
      expect(ConfigService.updateConfig).toHaveBeenCalledWith(validData);
    });
  });

  describe('POST /api/config com dados inválidos', () => {
    it('deve retornar 400 ao enviar defaultEntryValue negativo', async () => {
      const invalidData = {
        defaultEntryValue: -5.0
      };

      jest.spyOn(ConfigService, 'updateConfig').mockRejectedValue(
        new AppError('defaultEntryValue deve ser maior que zero', 400)
      );

      const response = await request(app)
        .post('/api/config')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('defaultEntryValue deve ser maior que zero');
    });

    it('deve retornar 400 ao enviar maxOperationsPerDay inválido', async () => {
      const invalidData = {
        maxOperationsPerDay: 0
      };

      jest.spyOn(ConfigService, 'updateConfig').mockRejectedValue(
        new AppError('maxOperationsPerDay deve ser maior que zero', 400)
      );

      const response = await request(app)
        .post('/api/config')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('maxOperationsPerDay deve ser maior que zero');
    });

    it('deve retornar 400 ao enviar notifications inválido', async () => {
      const invalidData = {
        notifications: { win: true } // Faltam chaves obrigatórias
      };

      jest.spyOn(ConfigService, 'updateConfig').mockRejectedValue(
        new AppError('notifications deve conter todas as chaves obrigatórias', 400)
      );

      const response = await request(app)
        .post('/api/config')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('notifications deve conter todas as chaves obrigatórias');
    });
  });
});