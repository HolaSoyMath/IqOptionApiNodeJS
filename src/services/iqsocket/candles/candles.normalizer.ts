import { CandleData, LiveCandle } from './candles.types';
import { TimeUtils } from '../utils/time';

export class CandlesNormalizer {
  /**
   * Normaliza dados de seed (first-candles) para CandleData
   * Mapeia max→high, min→low, from=timestamp, to=timestamp+size
   */
  static normalizeSeed(msg: any, activeId: number, sizes?: number[]): CandleData[] {
    const candles: CandleData[] = [];
    
    if (!msg.candles || !Array.isArray(msg.candles)) {
      return candles;
    }

    for (const candle of msg.candles) {
      const normalizedCandle: CandleData = {
        active_id: activeId,
        size: candle.size || 60,
        from: candle.from,
        to: candle.to || (candle.from + (candle.size || 60)),
        open: candle.open,
        high: candle.max || candle.high,
        low: candle.min || candle.low,
        close: candle.close,
        volume: candle.volume || 0,
        phase: 'closed',
        at: candle.at || candle.from,
        id: candle.id || `${activeId}_${candle.from}` // 👈 Incluir activeId no ID
      };

      // Filtrar por sizes se especificado
      if (!sizes || sizes.includes(normalizedCandle.size)) {
        candles.push(normalizedCandle);
      }
    }

    return candles;
  }

  /**
   * Processa rollover ou inicializa candle ao vivo
   * Fecha anterior quando tick.from > prev.from
   * Atualiza high/low com Math.max/min
   */
  static rollOrInitLive(
    prev: LiveCandle | undefined, 
    tick: any
  ): { closed?: LiveCandle; current: LiveCandle } {
    const tickFrom = tick.from;
    const tickClose = tick.close;
    const tickMax = tick.max || tick.high || tickClose;
    const tickMin = tick.min || tick.low || tickClose;
    
    // Se não há candle anterior ou é um novo minuto, inicializar novo
    if (!prev || TimeUtils.isNewMinute(prev.from, tickFrom)) {
      const newCandle: LiveCandle = {
        active_id: tick.active_id,
        size: tick.size || 60,
        from: tickFrom,
        to: tickFrom + (tick.size || 60),
        at: tick.at || tickFrom,
        open: tickClose,
        high: tickMax,
        low: tickMin,
        close: tickClose,
        volume: tick.volume || 0,
        phase: tick.phase || 'T',
        id: tick.id || `${tick.active_id}_${tickFrom}` // 👈 Incluir active_id no ID
      };
  
      return {
        closed: prev, // Fechar o anterior se existir
        current: newCandle
      };
    }

    // Atualizar candle existente
    const updatedCandle: LiveCandle = {
      ...prev,
      high: Math.max(prev.high, tickMax, tickClose),
      low: Math.min(prev.low, tickMin, tickClose),
      close: tickClose,
      volume: tick.volume ?? prev.volume,
      phase: tick.phase || prev.phase,
      at: tick.at || prev.at
    };

    return {
      current: updatedCandle
    };
  }
}