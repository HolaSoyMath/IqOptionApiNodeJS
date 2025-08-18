import { BinaryMarket, InstrumentMarket, InitializationData, InstrumentsData, SimpleBinaryMarket, SimpleInstrumentMarket } from '../../../types/market.types';
import { PayloadFormatError } from '../errors/market.errors';

export class MarketDataMapper {
  /**
   * Mapeia dados binários da inicialização
   */
  static mapBinaryData(initData: InitializationData): { binary: BinaryMarket[], turbo: BinaryMarket[] } {
    console.log('[MAPPER] Processando dados binários');
    // console.log('[MAPPER] Dados recebidos:', JSON.stringify(initData, null, 2)); // ← Adicionar este log
  
    const binaryMarkets: BinaryMarket[] = [];
    const turboMarkets: BinaryMarket[] = [];
    const currentTime = new Date().toISOString();
    
    try {
      // Processar mercados binários
      if (initData.result?.binary?.actives) {
        Object.entries(initData.result.binary.actives).forEach(([id, active]: [string, any]) => {
          const market = this.createBinaryMarket(id, active, 'binary', currentTime);
          if (market) binaryMarkets.push(market);
        });
      }
      
      // Processar mercados turbo
      if (initData.result?.turbo?.actives) {
        Object.entries(initData.result.turbo.actives).forEach(([id, active]: [string, any]) => {
          const market = this.createBinaryMarket(id, active, 'turbo', currentTime);
          if (market) turboMarkets.push(market);
        });
      }

      console.log(`[MAPPER] Processados ${binaryMarkets.length} mercados binários e ${turboMarkets.length} mercados turbo`);
      
      return { binary: binaryMarkets, turbo: turboMarkets };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new PayloadFormatError(`Erro ao mapear dados binários: ${errorMessage}`);
    }
  }

  /**
   * Cria um mercado binário
   */
  private static createBinaryMarket(
    id: string, 
    active: any, 
    type: 'binary' | 'turbo', 
    currentTime: string
  ): BinaryMarket | null {
    try {
      const name = active.name ? active.name.split('.')[1] : `ACTIVE_${id}`;
      const commission = active.option?.profit?.commission || 0;
      const payoutRaw = commission > 0 ? (100.0 - commission) / 100.0 : 0;
      
      return {
        id: parseInt(id),
        name,
        enabled: active.enabled || false,
        is_suspended: active.is_suspended || false,
        type,
        profit_commission: commission,
        payout_percentage: payoutRaw * 100,
        payout_raw: payoutRaw,
        active_id: parseInt(id),
        is_open: active.enabled && !active.is_suspended,
        source: 'websocket',
        last_updated: currentTime
      };
    } catch (error) {
      console.error(`[MAPPER] Erro ao criar mercado ${id}:`, error);
      return null;
    }
  }

  /**
   * Mapeia instrumentos
   */
  static mapInstruments(instrumentsData: InstrumentsData, type: 'crypto' | 'forex' | 'cfd'): InstrumentMarket[] {
    console.log(`[MAPPER] Processando instrumentos ${type}`);
    
    const markets: InstrumentMarket[] = [];
    const currentTime = Math.floor(Date.now() / 1000);
    
    try {
      if (instrumentsData.instruments) {
        instrumentsData.instruments.forEach(instrument => {
          const market = this.createInstrumentMarket(instrument, type, currentTime);
          if (market) markets.push(market);
        });
      }
      
      console.log(`[MAPPER] Processados ${markets.length} instrumentos ${type}`);
      return markets;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new PayloadFormatError(`Erro ao mapear instrumentos ${type}: ${errorMessage}`);
    }
  }

  /**
   * Cria um mercado de instrumento
   */
  private static createInstrumentMarket(
    instrument: any, 
    type: 'crypto' | 'forex' | 'cfd', 
    currentTime: number
  ): InstrumentMarket | null {
    try {
      let isOpen = false;
      
      // Verificar se está aberto baseado no schedule
      if (instrument.schedule) {
        for (const scheduleTime of instrument.schedule) {
          if (scheduleTime.open < currentTime && currentTime < scheduleTime.close) {
            isOpen = true;
            break;
          }
        }
      }
      
      return {
        id: instrument.id,
        name: instrument.name,
        active_id: instrument.active_id,
        type,
        schedule: instrument.schedule || [],
        is_open: isOpen,
        precision: instrument.precision,
        min_amount: instrument.min_amount,
        max_amount: instrument.max_amount
      };
    } catch (error) {
      console.error(`[MAPPER] Erro ao criar instrumento ${instrument.id}:`, error);
      return null;
    }
  }

  /**
   * Calcula payout em porcentagem
   */
  static calculatePayoutPercentage(commission: number): number {
    return commission > 0 ? ((100 - commission) / 100) * 100 : 0;
  }

  /**
   * Calcula payout em decimal
   */
  static calculatePayoutRaw(commission: number): number {
    return commission > 0 ? (100.0 - commission) / 100.0 : 0;
  }

  /**
   * Normaliza nome do ativo
   */
  static normalizeAssetName(name: string): string {
    if (!name) return '';
    
    // Remove prefixos como "frx." ou "cry."
    const parts = name.split('.');
    return parts.length > 1 ? parts[1] : name;
  }

  /**
   * Mapeia dados binários simplificados (apenas campos essenciais)
   */
  static mapSimpleBinaryData(initData: InitializationData): { binary: SimpleBinaryMarket[], turbo: SimpleBinaryMarket[] } {
    console.log('[MAPPER] Processando dados binários simplificados');
    console.log('[MAPPER] Estrutura dos dados recebidos:', {
      hasResult: !!initData.result,
      hasBinary: !!initData.result?.binary,
      hasTurbo: !!initData.result?.turbo,
      binaryActives: initData.result?.binary?.actives ? Object.keys(initData.result.binary.actives).length : 0,
      turboActives: initData.result?.turbo?.actives ? Object.keys(initData.result.turbo.actives).length : 0
    });
  
    const binaryMarkets: SimpleBinaryMarket[] = [];
    const turboMarkets: SimpleBinaryMarket[] = [];
    
    try {
      // Processar mercados binários
      if (initData.result?.binary?.actives) {
        Object.entries(initData.result.binary.actives).forEach(([id, active]: [string, any]) => {
          const market = this.createSimpleBinaryMarket(id, active, 'binary');
          if (market) binaryMarkets.push(market);
        });
      } else {
        console.warn('[MAPPER] Nenhum dado de binary.actives encontrado');
      }
      
      // Processar mercados turbo
      if (initData.result?.turbo?.actives) {
        Object.entries(initData.result.turbo.actives).forEach(([id, active]: [string, any]) => {
          const market = this.createSimpleBinaryMarket(id, active, 'turbo');
          if (market) turboMarkets.push(market);
        });
      } else {
        console.warn('[MAPPER] Nenhum dado de turbo.actives encontrado');
      }

      console.log(`[MAPPER] Processados ${binaryMarkets.length} mercados binários e ${turboMarkets.length} mercados turbo (simplificados)`);
      
      return { binary: binaryMarkets, turbo: turboMarkets };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[MAPPER] Erro ao mapear dados binários simplificados:', errorMessage);
      // Retornar arrays vazios em caso de erro para não quebrar a aplicação
      return { binary: [], turbo: [] };
    }
  }

  /**
   * Cria um mercado binário simplificado (apenas campos essenciais)
   */
  private static createSimpleBinaryMarket(
    id: string, 
    active: any, 
    type: 'binary' | 'turbo'
  ): SimpleBinaryMarket | null {
    try {
      // Extrair nome do ativo (remover prefixo se existir)
      const name = active.name ? this.normalizeAssetName(active.name) : `ACTIVE_${id}`;
      
      return {
        id: parseInt(id),
        name,
        active_id: parseInt(id),
        type
      };
    } catch (error) {
      console.error(`[MAPPER] Erro ao criar mercado simplificado ${id}:`, error);
      return null;
    }
  }

  /**
   * Mapeia instrumentos simplificados (apenas campos essenciais)
   */
  static mapSimpleInstruments(instrumentsData: InstrumentsData, type: 'crypto' | 'forex' | 'cfd'): SimpleInstrumentMarket[] {
    console.log(`[MAPPER] Processando instrumentos ${type} simplificados`);
    
    const markets: SimpleInstrumentMarket[] = [];
    
    try {
      if (instrumentsData?.instruments) {
        instrumentsData.instruments.forEach(instrument => {
          const market = this.createSimpleInstrumentMarket(instrument, type);
          if (market) markets.push(market);
        });
      } else {
        console.warn(`[MAPPER] Nenhum dado de instrumentos ${type} encontrado`);
      }
      
      console.log(`[MAPPER] Processados ${markets.length} instrumentos ${type} (simplificados)`);
      return markets;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[MAPPER] Erro ao mapear instrumentos ${type} simplificados:`, errorMessage);
      // Retornar array vazio em caso de erro
      return [];
    }
  }

  /**
   * Cria um mercado de instrumento simplificado (apenas campos essenciais)
   */
  private static createSimpleInstrumentMarket(
    instrument: any, 
    type: 'crypto' | 'forex' | 'cfd'
  ): SimpleInstrumentMarket | null {
    try {
      return {
        id: instrument.id,
        name: instrument.name,
        active_id: instrument.active_id,
        type
      };
    } catch (error) {
      console.error(`[MAPPER] Erro ao criar instrumento simplificado ${instrument.id}:`, error);
      return null;
    }
  }
}