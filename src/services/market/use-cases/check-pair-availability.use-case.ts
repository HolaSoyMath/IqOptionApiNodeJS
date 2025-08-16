import { InstrumentMarket } from '../../../types/market.types';
import { GetAllMarketsUseCase } from './get-all-markets.use-case';
import { MarketError } from '../errors/market.errors';

export interface PairAvailabilityResult {
  available: boolean;
  markets: string[];
  profit_rates: Record<string, number>;
}

export class CheckPairAvailabilityUseCase {
  constructor(
    private readonly getAllMarketsUseCase: GetAllMarketsUseCase
  ) {}

  async execute(pair: string): Promise<PairAvailabilityResult> {
    try {
      if (!pair || typeof pair !== 'string') {
        throw new MarketError(
          'INVALID_PAIR',
          'Par inválido fornecido'
        );
      }

      const allMarkets = await this.getAllMarketsUseCase.execute();
      const availableMarkets: string[] = [];
      const profitRates: Record<string, number> = {};
      const normalizedPair = pair.toUpperCase().trim();
      
      // Verificar em mercados binários
      const binaryMatch = allMarkets.binary_markets.find(
        m => m.name.toUpperCase() === normalizedPair
      );
      if (binaryMatch) {
        availableMarkets.push('binary');
        profitRates.binary = binaryMatch.profit_commission;
      }
      
      // Verificar em mercados turbo
      const turboMatch = allMarkets.turbo_markets.find(
        m => m.name.toUpperCase() === normalizedPair
      );
      if (turboMatch) {
        availableMarkets.push('turbo');
        profitRates.turbo = turboMatch.profit_commission;
      }
      
      // Verificar em outros mercados
      const marketTypes = [
        { key: 'crypto_markets', name: 'crypto' },
        { key: 'forex_markets', name: 'forex' },
        { key: 'cfd_markets', name: 'cfd' }
      ] as const;
      
      marketTypes.forEach(({ key, name }) => {
        const markets = allMarkets[key] as InstrumentMarket[];
        const match = markets.find(
          m => m.name.toUpperCase() === normalizedPair
        );
        if (match) {
          availableMarkets.push(name);
          // Instrumentos não têm profit_commission, mas podemos adicionar outros dados se necessário
        }
      });
      
      return {
        available: availableMarkets.length > 0,
        markets: availableMarkets,
        profit_rates: profitRates
      };
      
    } catch (error) {
      console.error('Erro ao verificar disponibilidade do par:', error);
      
      if (error instanceof MarketError) {
        throw error;
      }
      
      throw new MarketError(
        `Falha ao verificar disponibilidade do par: ${error instanceof Error ? error.message : String(error)}`,
        'PAIR_AVAILABILITY_CHECK_ERROR'
      );
    }
  }
}