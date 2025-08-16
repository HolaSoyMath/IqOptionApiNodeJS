import { CandlesStore } from './candles.store';
import { CandlesNormalizer } from './candles.normalizer';
import { RequestsStore } from '../requests/requests.store';
import { IQSocketLogger } from '../utils/logger';
import { KeyUtils } from '../utils/keys';

export class CandlesHandler {
  constructor(
    private candlesStore: CandlesStore,
    private requestsStore: RequestsStore
  ) {}

  /**
   * Processa first-candles (dados históricos)
   */
  handleFirstCandles(data: any): void {
    const requestId = data.request_id;
    if (!requestId) {
      IQSocketLogger.logError('FIRST_CANDLES', 'Missing request_id');
      return;
    }

    const activeId = this.requestsStore.getActiveFromRequest(requestId);
    const sizes = this.requestsStore.getSizesFromRequest(requestId);
    
    if (activeId === null) {
      IQSocketLogger.logError('FIRST_CANDLES', `Unknown request_id: ${requestId}`);
      return;
    }

    const normalizedCandles = CandlesNormalizer.normalizeSeed(data, activeId, sizes || undefined);
    
    // Agrupar por size e adicionar ao histórico
    const candlesBySize = new Map<number, typeof normalizedCandles>();
    
    for (const candle of normalizedCandles) {
      if (!candlesBySize.has(candle.size)) {
        candlesBySize.set(candle.size, []);
      }
      candlesBySize.get(candle.size)!.push(candle);
    }

    // Processar cada grupo de size
    for (const [size, candles] of candlesBySize) {
      for (const candle of candles) {
        this.candlesStore.pushHistory(activeId, size, candle);
        
        // Log do seed
        // No método handleFirstCandles, para seed:
        IQSocketLogger.logSeed(
          size,
          candle.id ?? candle.from,   // id
          activeId,                   // << novo arg
          candle.from, candle.to,
          candle.open, candle.high, candle.low, candle.close
        );
      }
    }

    // Limpar request processada
    this.requestsStore.delete(requestId);
  }

  /**
   * Processa candle-generated (dados ao vivo)
   */
  handleCandleGenerated(data: any): void {
    // Acessar dados dentro de msg
    const msg = data.msg || data;
    const activeId = msg.active_id;
    const size = msg.size || 60;
    
    if (!activeId || !size) {
      IQSocketLogger.logError('CANDLE_GENERATED', `Missing active_id or size. Received: ${JSON.stringify(data)}`);
      return;
    }

    // Obter candle atual
    const currentCandle = this.candlesStore.getCurrent(activeId, size);
    
    // Processar rollover
    const result = CandlesNormalizer.rollOrInitLive(currentCandle, msg);
    
    // Se houve fechamento do candle anterior
    if (result.closed) {
      this.candlesStore.pushHistory(activeId, size, result.closed);
      
      // Log de fechamento
      // No método handleCandleGenerated, para rollover:
      if (result.closed) {
        IQSocketLogger.logClose(
          size,
          result.closed.id ?? result.closed.from,
          activeId,
          result.closed.from, result.closed.to,
          result.closed.open, result.closed.high, result.closed.low, result.closed.close
        );
      }
      
      // Log de rollover
      IQSocketLogger.logRoll(
        result.current.id || result.current.from,
        activeId, // 👈 Adicionar activeId
        size,
        result.current.from
      );
    }
    
    // Atualizar candle atual
    this.candlesStore.setCurrent(activeId, size, result.current);
    
    // Log do candle ao vivo
    const delta = currentCandle ? 
      (result.current.close - currentCandle.close).toFixed(5) : undefined;
    
    // Para o candle atual (live):
    IQSocketLogger.logLive(
      size,
      result.current.id ?? result.current.from,
      activeId,
      result.current.from, result.current.to,
      result.current.open, result.current.high, result.current.low, result.current.close,
      result.current.phase ?? 'T',
      delta
    );
  }
}