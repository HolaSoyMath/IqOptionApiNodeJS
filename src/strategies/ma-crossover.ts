// src/strategies/ma-crossover.ts
import { Candle } from '../types/candle.types';
import { calculateEMA } from '../indicators/ema';

export type Signal = 'BUY' | 'SELL' | 'HOLD';

/**
 * Verifica cruzamento de 2 médias móveis (EMA)
 * @param candles Array de candles
 * @param shortPeriod Período da média curta
 * @param longPeriod Período da média longa
 * @returns Sinal de BUY, SELL ou HOLD
 */
export function checkMA2Crossover(candles: Candle[], shortPeriod: number, longPeriod: number): Signal {
  // Validações iniciais
  if (!candles || candles.length === 0 || shortPeriod <= 0 || longPeriod <= 0 || shortPeriod >= longPeriod) {
    return 'HOLD';
  }

  // Verificar se há candles suficientes para calcular EMAs
  if (candles.length < longPeriod) {
    return 'HOLD';
  }

  try {
    // Calcular as EMAs atuais
    const shortEMA = calculateEMA(candles, shortPeriod);
    const longEMA = calculateEMA(candles, longPeriod);

    // Verificar se os cálculos foram bem-sucedidos
    if (shortEMA === undefined || longEMA === undefined) {
      return 'HOLD';
    }

    // Se temos exatamente o mínimo de candles, verificar apenas alinhamento
    if (candles.length === longPeriod) {
      if (shortEMA > longEMA) {
        return 'BUY';
      } else if (shortEMA < longEMA) {
        return 'SELL';
      }
      return 'HOLD';
    }

    // Para detectar cruzamento, precisamos de pelo menos longPeriod + 1 candles
    if (candles.length >= longPeriod + 1) {
      // Calcular as EMAs do período anterior (excluindo o último candle)
      const previousCandles = candles.slice(0, -1);
      const previousShortEMA = calculateEMA(previousCandles, shortPeriod);
      const previousLongEMA = calculateEMA(previousCandles, longPeriod);
  
      // Verificar se as EMAs do período anterior estavam em cruzamento
      if (previousShortEMA !== undefined && previousLongEMA !== undefined) {
        const currentDiff = shortEMA - longEMA;
        const previousDiff = previousShortEMA - previousLongEMA;
  
        // Cruzamento de baixo para cima (BUY) - mudança de sinal negativo para positivo
        if (previousDiff <= 0 && currentDiff > 0) {
          return 'BUY';
        }
        // Cruzamento de cima para baixo (SELL) - mudança de sinal positivo para negativo
        else if (previousDiff >= 0 && currentDiff < 0) {
          return 'SELL';
        }
      } else {
        // Fallback: quando não conseguimos calcular EMAs anteriores,
        // usar apenas o alinhamento atual para determinar o sinal
        if (shortEMA > longEMA) {
          return 'BUY';
        } else if (shortEMA < longEMA) {
          return 'SELL';
        }
      }
    }

    return 'HOLD';
  } catch (error) {
    console.error('Error in MA crossover calculation:', error);
    return 'HOLD';
  }
}

/**
 * Verifica cruzamento de 3 médias móveis (EMA)
 * @param candles Array de candles
 * @param p1 Período da primeira média (mais curta)
 * @param p2 Período da segunda média (intermediária)
 * @param p3 Período da terceira média (mais longa)
 * @returns Sinal de BUY, SELL ou HOLD
 */
export function checkMA3Crossover(candles: Candle[], p1: number, p2: number, p3: number): Signal {
  // Validações iniciais
  if (!candles || candles.length === 0 || p1 <= 0 || p2 <= 0 || p3 <= 0 || p1 >= p2 || p2 >= p3) {
    return 'HOLD';
  }

  // Verificar se há candles suficientes
  if (candles.length < p3) {
    return 'HOLD';
  }

  try {
    // Calcular as três EMAs
    const ema1 = calculateEMA(candles, p1);
    const ema2 = calculateEMA(candles, p2);
    const ema3 = calculateEMA(candles, p3);

    // Verificar se os cálculos foram bem-sucedidos
    if (ema1 === undefined || ema2 === undefined || ema3 === undefined) {
      return 'HOLD';
    }

    // Verificar alinhamento
    if (ema1 > ema2 && ema2 > ema3) {
      return 'BUY';
    } else if (ema1 < ema2 && ema2 < ema3) {
      return 'SELL';
    }

    return 'HOLD';
  } catch (error) {
    console.error('Error in MA 3-crossover calculation:', error);
    return 'HOLD';
  }
}

/**
 * Estratégia completa de cruzamento de médias móveis
 * @param candles Array de candles
 * @param config Configuração da estratégia
 * @returns Sinal de BUY, SELL ou HOLD
 */
export function maCrossoverStrategy(
  candles: Candle[], 
  config: { type: '2ma' | '3ma', shortPeriod: number, midPeriod?: number, longPeriod: number }
): Signal {
  if (config.type === '2ma') {
    return checkMA2Crossover(candles, config.shortPeriod, config.longPeriod);
  } else if (config.type === '3ma' && config.midPeriod !== undefined) {
    return checkMA3Crossover(candles, config.shortPeriod, config.midPeriod, config.longPeriod);
  }
  
  return 'HOLD';
}
