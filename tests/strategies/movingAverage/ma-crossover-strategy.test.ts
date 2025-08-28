import { Candle } from '../../../src/types/candle.types';
import { maCrossoverStrategy, checkMA3Crossover, checkMA2Crossover } from '../../../src/strategies/ma-crossover';
import { calculateEMA } from '../../../src/indicators/ema';

// Mock da função calculateEMA
jest.mock('../../../src/indicators/ema');

function generateCandles(count: number, startClose: number = 1, increment: number = 0.1): Candle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: (i + 1).toString(),
    symbol: 'EURUSD',
    timeframe: '1m',
    timestamp: 1629871200 + i * 60,
    open: startClose + i * increment,
    high: startClose + i * increment + 0.2,
    low: startClose + i * increment - 0.2,
    close: startClose + i * increment,
    volume: 1000,
    createdAt: new Date(1629871200 + i * 60 * 1000),
  }));
}

describe('Testes da Função de Estratégia MA Crossover', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Testes da Estratégia maCrossoverStrategy', () => {
    it('chama checkMA2Crossover para estratégia 2ma', () => {
      const candles = generateCandles(10);
      (calculateEMA as jest.Mock)
        .mockReturnValueOnce(1.8) // shortEMA atual
        .mockReturnValueOnce(1.5) // longEMA atual
        .mockReturnValueOnce(1.4) // previousShortEMA
        .mockReturnValueOnce(1.6); // previousLongEMA

      const signal = maCrossoverStrategy(candles, {
        type: '2ma',
        shortPeriod: 5,
        longPeriod: 10
      });

      expect(signal).toBe('BUY');
    });

    it('chama checkMA3Crossover para estratégia 3ma', () => {
      const candles = generateCandles(15);
      (calculateEMA as jest.Mock)
        .mockReturnValue(1.5); // Todas as EMAs iguais para HOLD

      const signal = maCrossoverStrategy(candles, {
        type: '3ma',
        shortPeriod: 5,
        midPeriod: 10,
        longPeriod: 20
      });

      expect(signal).toBe('HOLD');
    });

    it('retorna HOLD para estratégia 3ma sem midPeriod', () => {
      const candles = generateCandles(10);
      
      const signal = maCrossoverStrategy(candles, {
        type: '3ma',
        shortPeriod: 5,
        longPeriod: 20
      } as any); // Forçar tipo para testar cenário inválido

      expect(signal).toBe('HOLD');
    });

    it('retorna HOLD para tipo de estratégia inválido', () => {
      const candles = generateCandles(10);
      
      const signal = maCrossoverStrategy(candles, {
        type: 'invalid' as any,
        shortPeriod: 5,
        longPeriod: 20
      });

      expect(signal).toBe('HOLD');
    });
  });

  describe('Testes de Tratamento de Erros', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      jest.resetAllMocks();
    });

    it('checkMA2Crossover deve retornar HOLD quando calculateEMA lança um erro', () => {
      const candles = generateCandles(15);
      
      // Mock calculateEMA para lançar um erro
      (calculateEMA as jest.Mock).mockImplementation(() => {
        throw new Error('EMA calculation failed');
      });
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      const signal = checkMA2Crossover(candles, 5, 10);
      
      expect(signal).toBe('HOLD');
      expect(consoleSpy).toHaveBeenCalledWith('Error in MA crossover calculation:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });

    it('checkMA3Crossover deve retornar HOLD quando calculateEMA lança um erro', () => {
      const candles = generateCandles(25);
      
      // Mock calculateEMA para lançar um erro
      (calculateEMA as jest.Mock).mockImplementation(() => {
        throw new Error('EMA calculation failed');
      });
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      const signal = checkMA3Crossover(candles, 5, 10, 20);
      
      expect(signal).toBe('HOLD');
      expect(consoleSpy).toHaveBeenCalledWith('Error in MA 3-crossover calculation:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('Testes de tratamento de erros do checkMA3Crossover', () => {
    beforeEach(() => {
      // Limpar completamente todos os mocks antes de cada teste
      jest.clearAllMocks();
      jest.resetAllMocks();
    });

    it('retorna HOLD quando o cálculo de EMA lança erro', () => {
      const candles = generateCandles(15);
      (calculateEMA as jest.Mock).mockImplementation(() => {
        throw new Error('EMA calculation failed');
      });

      const signal = checkMA3Crossover(candles, 5, 10, 20);
      expect(signal).toBe('HOLD');
    });

    it('retorna BUY para alinhamento ascendente de EMA (ema1 > ema2 > ema3)', () => {
      const candles = generateCandles(25);
      
      
      // Mock com implementação específica para garantir ordem correta
      (calculateEMA as jest.Mock).mockImplementation((candles, period) => {
        if (period === 5) {
          return 1.8; // ema1 (short)
        }
        if (period === 10) {
          return 1.5; // ema2 (mid)
        }
        if (period === 20) {
          return 1.2; // ema3 (long)
        }
        return undefined;
      });
      
      const signal = checkMA3Crossover(candles, 5, 10, 20);
      
      
      expect(signal).toBe('BUY');
      expect(calculateEMA).toHaveBeenCalledTimes(3);
      expect(calculateEMA).toHaveBeenCalledWith(candles, 5);
      expect(calculateEMA).toHaveBeenCalledWith(candles, 10);
      expect(calculateEMA).toHaveBeenCalledWith(candles, 20);
    });

    it('retorna SELL para alinhamento descendente de EMA (ema1 < ema2 < ema3)', () => {
      const candles = generateCandles(25);
      
      
      // Mock com implementação específica para SELL
      (calculateEMA as jest.Mock).mockImplementation((candles, period) => {
        if (period === 5) {
          return 1.2; // ema1 (short) - menor valor
        }
        if (period === 10) {
          return 1.5; // ema2 (mid) - valor médio
        }
        if (period === 20) {
          return 1.8; // ema3 (long) - maior valor
        }
        return undefined;
      });
      
      const signal = checkMA3Crossover(candles, 5, 10, 20);
      
      
      expect(signal).toBe('SELL');
      expect(calculateEMA).toHaveBeenCalledTimes(3);
      expect(calculateEMA).toHaveBeenCalledWith(candles, 5);
      expect(calculateEMA).toHaveBeenCalledWith(candles, 10);
      expect(calculateEMA).toHaveBeenCalledWith(candles, 20);
    });

    it('retorna HOLD para alinhamento misto de EMA', () => {
      const candles = generateCandles(15);
      
      // Mock para cenário HOLD (sem ordem específica)
      (calculateEMA as jest.Mock).mockImplementation((candles, period) => {
        if (period === 5) return 1.5; // ema1 (short)
        if (period === 10) return 1.8; // ema2 (mid) - maior que ema1
        if (period === 20) return 1.2; // ema3 (long) - menor que ema2
        return undefined;
      });
      
      const signal = checkMA3Crossover(candles, 5, 10, 20);
      expect(signal).toBe('HOLD');
    });
  });
});