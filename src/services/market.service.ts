// Arquivo de compatibilidade que mantém a interface original
// mas utiliza a implementação refatorada internamente

import { MarketService as RefactoredMarketService } from './market/market.service.refactored';
import { BinaryMarket, MarketData, SimpleMarketData } from '../types/market.types';
import { BinaryTurboInit } from '../types/market.types';
import { IQWSClient } from './iq/ws-client';

/**
 * MarketService com interface compatível com a versão original
 * Internamente utiliza a implementação refatorada seguindo princípios SOLID
 */
export class MarketService {
  private readonly refactoredService: RefactoredMarketService;
  private readonly ssid: string;

  constructor(ssid: string) {
    this.refactoredService = new RefactoredMarketService(ssid);
    this.ssid = ssid;
  }

  /**
   * Obtém apenas mercados binários disponíveis
   * Mantém compatibilidade com a interface original
   */
  async getBinaryMarkets(): Promise<{ binary: BinaryMarket[], turbo: BinaryMarket[] }> {
    return this.refactoredService.getBinaryMarkets();
  }

  /**
   * Obtém todos os mercados disponíveis
   * Mantém compatibilidade com a interface original
   */
  async getAllMarkets(): Promise<MarketData> {
    return this.refactoredService.getAllMarkets();
  }

  /**
   * Obtém mercados simplificados (apenas campos essenciais)
   * Mantém compatibilidade com a interface original
   */
  async getSimpleMarkets(): Promise<SimpleMarketData> {
    return this.refactoredService.getSimpleMarkets();
  }

  /**
   * Verifica disponibilidade de um par específico
   * Mantém compatibilidade com a interface original
   */
  async checkPairAvailability(pair: string): Promise<{ 
    available: boolean; 
    markets: string[]; 
    profit_rates: Record<string, number> 
  }> {
    return this.refactoredService.checkPairAvailability(pair);
  }

  /**
   * Obtém mercados Binary/Turbo de forma leve (sem schedule, sem payout)
   * Focado apenas em listagem de catálogo
   */
  async getBinaryTurboLite(): Promise<BinaryTurboInit> {
    try {
      const client = new IQWSClient({
        url: process.env.IQ_WSS_URL || 'wss://ws.iqoption.com/echo/websocket',
        ssid: this.ssid,
        timeout: 10000
      });

      await client.connect();
      const initData = await client.getInitializationData();
      
      const result: BinaryTurboInit = {
        binary: initData.binary.map(item => ({
          id: typeof item.id === 'number' ? item.id : parseInt(String(item.id)),
          name: item.name,
          active_id: item.active_id || (typeof item.id === 'number' ? item.id : parseInt(String(item.id))),
          category: 'binary' as const
        })),
        turbo: initData.turbo.map(item => ({
          id: typeof item.id === 'number' ? item.id : parseInt(String(item.id)),
          name: item.name,
          active_id: item.active_id || (typeof item.id === 'number' ? item.id : parseInt(String(item.id))),
          category: 'turbo' as const
        }))
      };

      client.disconnect();
      return result;
    } catch (error) {
      console.error('[MarketService] Erro ao buscar Binary/Turbo lite:', error);
      return { binary: [], turbo: [] };
    }
  }
}