import { Request, Response } from 'express';
import { IQWSClient, MarketLite } from '../services/iq/ws-client';
import { MarketService } from '../services/market.service';
import { MarketService as RefactoredMarketService } from '../services/market/market.service.refactored';
import { ApiResponse } from '../types/response.types';
import { BinaryMarket, BinaryTurboInit } from '../types/market.types';
import { marketCache } from '../services/market/cache/market-cache';
import { BinaryMarketResponse } from '../types/market.types';

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

  /**
   * Função utilitária para arredondar payout
   */
  private static roundPayout(x?: number): number | null {
    if (typeof x !== "number" || Number.isNaN(x)) return null;
    return Math.round(x);
  }

  // Endpoint GET /api/markets/binary atualizado
  static async getBinaryMarkets(req: Request, res: Response): Promise<void> {
    try {
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

      // Pré-aquecer o cache chamando o serviço que dispara get-initialization-data
      try {
        const marketService = new RefactoredMarketService(ssid);
        await marketService.getAllMarkets(); // não precisa aguardar atualização total; já preenche nomes/commissions/estado
      } catch (e) {
        console.warn('[BINARY] getAllMarkets falhou (seguindo com cache corrente):', (e as Error)?.message);
      }
      
      const out: BinaryMarketResponse[] = [];
      
      // Agregar ativos que aparecem em binaryOpenState
      for (const [activeId, state] of marketCache.binaryOpenState.entries()) {
        const name = marketCache.names.get(activeId) ?? String(activeId);
        const payout = marketCache.getBinaryPayout(activeId); // 100 - open_percent
        
        // Opcional: filtrar somente abertos
        // if (!state.is_open) continue;
        
        out.push({
          iq_active_id: activeId,
          name,
          type: "binary",
          subtype: state.subtype,        // "binary"|"turbo" se tiver salvo
          payout_percent: MarketController.roundPayout(payout),
          is_open: state.is_open
        });
      }
      
      // Ordenar desc por payout_percent (os undefined vão pro fim)
      out.sort((a, b) => (b.payout_percent ?? -1) - (a.payout_percent ?? -1));
      
      const response: ApiResponse = {
        success: true,
        message: `Mercados binários obtidos com sucesso (${out.length} mercados)`,
        data: out,
        timestamp: new Date().toISOString()
      };

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