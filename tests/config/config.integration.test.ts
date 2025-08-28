import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import express from 'express';
import { configRoutes } from '../../src/routes/config.routes';
import { beforeEach, afterEach, describe, it, expect } from '@jest/globals';

const prisma = new PrismaClient();
const app = express();
app.use(express.json());
app.use('/api/config', configRoutes);

describe('Testes de Integração de Configuração', () => {
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

  describe('Fluxo Completo de Atualização', () => {
    it('deve fazer POST /api/config e depois GET /api/config verificando se os dados foram atualizados', async () => {
      const configData = {
        autoConnect: true,
        defaultEntryValue: 20.0,
        maxOperationsPerDay: 80,
        stopLoss: 30,
        stopGain: 60,
        stopLossEnabled: true,
        stopGainEnabled: true,
        notifications: { win: true, loss: true, auto: false, sound: true }
      };

      // POST para criar/atualizar configuração
      const postResponse = await request(app)
        .post('/api/config')
        .send(configData)
        .expect(200);

      expect(postResponse.body.success).toBe(true);
      expect(postResponse.body.data.autoConnect).toBe(true);
      expect(postResponse.body.data.defaultEntryValue).toBe(20.0);

      // GET para verificar se os dados foram salvos
      const getResponse = await request(app)
        .get('/api/config')
        .expect(200);

      expect(getResponse.body.success).toBe(true);
      expect(getResponse.body.data.autoConnect).toBe(true);
      expect(getResponse.body.data.defaultEntryValue).toBe(20.0);
      expect(getResponse.body.data.maxOperationsPerDay).toBe(80);
      expect(getResponse.body.data.notifications).toEqual(configData.notifications);
    });
  });

  describe('Fluxo com Dados Inválidos', () => {
    it('deve fazer POST /api/config com dados inválidos e verificar se o banco não foi alterado', async () => {
      // Primeiro, criar uma configuração válida
      const validConfig = {
        autoConnect: false,
        defaultEntryValue: 10.0,
        maxOperationsPerDay: 50
      };

      await request(app)
        .post('/api/config')
        .send(validConfig)
        .expect(200);

      // Tentar atualizar com dados inválidos
      const invalidConfig = {
        defaultEntryValue: -5.0 // Valor inválido
      };

      await request(app)
        .post('/api/config')
        .send(invalidConfig)
        .expect(400);

      // Verificar se a configuração original não foi alterada
      const getResponse = await request(app)
        .get('/api/config')
        .expect(200);

      expect(getResponse.body.data.defaultEntryValue).toBe(10.0); // Deve manter o valor original
      expect(getResponse.body.data.autoConnect).toBe(false);
    });
  });

  describe('Testes de Concorrência', () => {
    it('deve lidar com múltiplas requisições simultâneas para POST /api/config sem corromper dados', async () => {
      console.log('🔍 [DEBUG] Iniciando teste de concorrência');
      
      // Verificar estado inicial
      const initialConfigs = await prisma.config.findMany();
      console.log('🔍 [DEBUG] Configurações iniciais:', initialConfigs.length, initialConfigs);
      
      const configData1 = {
        autoConnect: true,
        defaultEntryValue: 15.0
      };

      const configData2 = {
        autoConnect: false,
        defaultEntryValue: 25.0
      };

      const configData3 = {
        autoConnect: true,
        defaultEntryValue: 35.0
      };

      console.log('🔍 [DEBUG] Dados de configuração para teste:', { configData1, configData2, configData3 });

      // Executar múltiplas requisições simultaneamente
      console.log('🔍 [DEBUG] Executando requisições simultâneas...');
      const promises = [
        request(app).post('/api/config').send(configData1),
        request(app).post('/api/config').send(configData2),
        request(app).post('/api/config').send(configData3)
      ];

      const responses = await Promise.all(promises);
      console.log('🔍 [DEBUG] Respostas das requisições:', responses.map(r => ({ status: r.status, body: r.body })));

      // Verificar se todas as requisições foram bem-sucedidas
      responses.forEach((response, index) => {
        console.log(`🔍 [DEBUG] Resposta ${index + 1}:`, { status: response.status, success: response.body.success });
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Verificar estado final do banco
      const configs = await prisma.config.findMany();
      console.log('🔍 [DEBUG] Configurações finais no banco:', configs.length, configs);

      // Verificar se há apenas uma configuração no banco
      expect(configs).toHaveLength(1);

      // Verificar se a configuração final é válida
      const finalConfig = configs[0];
      console.log('🔍 [DEBUG] Configuração final:', finalConfig);
      
      expect([15.0, 25.0, 35.0]).toContain(finalConfig.defaultEntryValue);
      expect([true, false]).toContain(finalConfig.autoConnect);
    });
  });
});