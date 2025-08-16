import { Request, Response } from 'express';
import { IQWSClient, MarketLite } from '../services/iq/ws-client';
import { MarketService } from '../services/market.service';
import { ApiResponse } from '../types/response.types';
import { BinaryMarket, BinaryTurboInit } from '../types/market.types';

export class MarketController {
  // Cache global para evitar múltiplas conexões
  private static clientCache = new Map<string, { client: IQWSClient; timestamp: number }>();
  private static readonly CACHE_TTL = 60000; // 60 segundos

  // Funções utilitárias para formatação e status
  private static sanitizeName(name?: string): string {
    if (!name) return '';
    return name.startsWith('front.') ? name.slice('front.'.length) : name;
  }

  private static async getWSClient(ssid: string): Promise<IQWSClient> {
    const cached = MarketController.clientCache.get(ssid);
    if (cached && (Date.now() - cached.timestamp) < MarketController.CACHE_TTL) {
      if (cached.client.isConnected()) {
        return cached.client;
      }
    }

    const client = new IQWSClient({
      url: process.env.IQ_WSS_URL || 'wss://ws.iqoption.com/echo/websocket',
      ssid,
      timeout: 10000
    });

    await client.connect();
    MarketController.clientCache.set(ssid, { client, timestamp: Date.now() });
    return client;
  }

  // Obter todos os mercados disponíveis (versão simplificada)
  static async getAllMarkets(req: Request, res: Response): Promise<void> {
    try {
      const ssid = req.headers.authorization?.replace('Bearer ', '') || process.env.IQ_SSID;
      
      if (!ssid) {
        const response: ApiResponse = {
          success: false,
          message: 'Token de autorização (SSID) é obrigatório',
          timestamp: new Date().toISOString()
        };
        res.status(401).json(response);
        return;
      }

      console.log('[API] Iniciando busca de mercados...');
      const client = await MarketController.getWSClient(ssid);
      const markets: MarketLite[] = [];

      // Buscar dados de múltiplas fontes com timeout resiliente
      const promises = [
        // Initialization data para binary/turbo
        client.getInitializationData().catch((error: Error) => {
          console.error('[API] Erro ao buscar initialization-data:', error);
          return { binary: [], turbo: [] };
        }),
        // Instruments para outros tipos
        client.getInstruments('forex').catch(() => []),
        client.getInstruments('crypto').catch(() => []),
        client.getInstruments('cfd').catch(() => []),
        client.getInstruments('digital-option').catch(() => [])
      ];

      const results = await Promise.allSettled(promises);
      const [initDataResult, forexDataResult, cryptoDataResult, cfdDataResult, digitalDataResult] = results;

      // Processar initialization data
      if (initDataResult.status === 'fulfilled') {
        const initData = initDataResult.value;
        if ('binary' in initData && 'turbo' in initData) {
          markets.push(...initData.binary);
          markets.push(...initData.turbo);
        }
      }

      // Processar instruments data
      if (forexDataResult.status === 'fulfilled') {
        const forexData = forexDataResult.value;
        if (Array.isArray(forexData)) {
          markets.push(...forexData);
        }
      }
      
      if (cryptoDataResult.status === 'fulfilled') {
        const cryptoData = cryptoDataResult.value;
        if (Array.isArray(cryptoData)) {
          markets.push(...cryptoData);
        }
      }
      
      if (cfdDataResult.status === 'fulfilled') {
        const cfdData = cfdDataResult.value;
        if (Array.isArray(cfdData)) {
          markets.push(...cfdData);
        }
      }
      
      if (digitalDataResult.status === 'fulfilled') {
        const digitalData = digitalDataResult.value;
        if (Array.isArray(digitalData)) {
          markets.push(...digitalData);
        }
      }

      console.log(`[API] Total de mercados encontrados: ${markets.length}`);

      // Aplicar formatação sem status
      const formattedMarkets = markets.map((market: any) => ({
        id: market.id,
        name: MarketController.sanitizeName(market.name),
        type: market.type,
        active_id: market.active_id
      }));

      const response: ApiResponse = {
        success: true,
        message: 'Mercados obtidos com sucesso',
        data: {
          markets: formattedMarkets,
          total: formattedMarkets.length
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('[API] Erro ao obter mercados:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Erro interno do servidor ao obter mercados',
        timestamp: new Date().toISOString()
      };

      res.status(500).json(response);
    }
  }

  static async getBinaryMarkets(req: Request, res: Response): Promise<void> {
    try {
      const ssid = req.headers.authorization?.replace('Bearer ', '') || process.env.IQ_SSID;
      
      if (!ssid) {
        const response: ApiResponse = {
          success: false,
          message: 'Token de autorização (SSID) é obrigatório',
          timestamp: new Date().toISOString()
        };
        res.status(401).json(response);
        return;
      }

      console.log('[BINARY] Iniciando busca de mercados Binary/Turbo...');
      const marketService = new MarketService(ssid);
      
      // Timeout de 10s para o snapshot
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 10000);
      });
      
      let markets: BinaryTurboInit;
      try {
        markets = await Promise.race([
          marketService.getBinaryTurboLite(),
          timeoutPromise
        ]) as BinaryTurboInit;
      } catch (error) {
        console.warn('[BINARY] Snapshot initialization-data não recebido no tempo limite');
        markets = { binary: [], turbo: [] };
      }

      const response: ApiResponse = {
        success: true,
        message: markets.binary.length === 0 && markets.turbo.length === 0 
          ? 'Snapshot initialization-data não recebido no tempo limite'
          : 'Mercados binários/turbo obtidos com sucesso',
        data: {
          binary_markets: markets.binary.map((m: any) => ({
            id: m.id,
            name: MarketController.sanitizeName(m.name),
            instrument_type: 'binary',
            payout_percentage: `${Number(m.payout_percentage ?? 0).toFixed(2)}%`,
            payout_raw: Number(m.payout_raw ?? 0),
            active_id: m.active_id,
            source: m.source,
            last_updated: m.last_updated
          })),
          turbo_markets: markets.turbo.map((m: any) => ({
            id: m.id,
            name: MarketController.sanitizeName(m.name),
            instrument_type: 'turbo',
            payout_percentage: `${Number(m.payout_percentage ?? 0).toFixed(2)}%`,
            payout_raw: Number(m.payout_raw ?? 0),
            active_id: m.active_id,
            source: m.source,
            last_updated: m.last_updated
          })),
          total_binary: markets.binary.length,
          total_turbo: markets.turbo.length
        },
        timestamp: new Date().toISOString()
      };

      console.log(`[BINARY] Retornando ${markets.binary.length} binary, ${markets.turbo.length} turbo`);
      res.status(200).json(response);
    } catch (error) {
      console.error('[BINARY] Erro ao obter mercados binários:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Erro interno do servidor ao obter mercados binários',
        timestamp: new Date().toISOString()
      };

      res.status(500).json(response);
    }
  }

  // Verificar se um par específico está disponível
  static async checkPairAvailability(req: Request, res: Response): Promise<void> {
    try {
      const { pair } = req.params;
      const ssid = req.headers.authorization?.replace('Bearer ', '');
      
      if (!ssid) {
        const response: ApiResponse = {
          success: false,
          message: 'Token de autorização (SSID) é obrigatório',
          timestamp: new Date().toISOString()
        };
        res.status(401).json(response);
        return;
      }

      const marketService = new MarketService(ssid);
      const markets = await marketService.getBinaryMarkets();
      
      const binaryPair = markets.binary.find((m: BinaryMarket) => m.name.toLowerCase() === pair.toLowerCase());
      const turboPair = markets.turbo.find((m: BinaryMarket) => m.name.toLowerCase() === pair.toLowerCase());
      
      const isAvailable = !!(binaryPair || turboPair);
      
      const response: ApiResponse = {
        success: true,
        message: `Verificação de disponibilidade para ${pair}`,
        data: {
          pair: pair.toUpperCase(),
          available: isAvailable,
          types: {
            binary: !!binaryPair,
            turbo: !!turboPair
          },
          details: {
            binary: binaryPair ? {
              id: binaryPair.id,
              profit_percentage: (100 - binaryPair.profit_commission).toFixed(2) + '%'
            } : null,
            turbo: turboPair ? {
              id: turboPair.id,
              profit_percentage: (100 - turboPair.profit_commission).toFixed(2) + '%'
            } : null
          }
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Erro ao verificar disponibilidade do par:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Erro interno do servidor ao verificar disponibilidade',
        timestamp: new Date().toISOString()
      };

      res.status(500).json(response);
    }
  }
}