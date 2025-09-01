import { Signal } from './ma-crossover';
import { checkMA2Crossover, checkMA3Crossover } from './ma-crossover';

// Tipo para função de estratégia
type StrategyFunction = (candles: any[]) => Signal;

// Registry de estratégias
export const strategyRegistry = new Map<string, StrategyFunction>([
  ['MA Crossover 2', (candles) => checkMA2Crossover(candles, 9, 21)],
  ['MA Crossover 3', (candles) => checkMA3Crossover(candles, 9, 14, 21)],
  ['MA2', (candles) => checkMA2Crossover(candles, 9, 21)], // Alias
  ['MA3', (candles) => checkMA3Crossover(candles, 9, 14, 21)] // Alias
]);

// Função helper para buscar estratégia (case insensitive)
export function getStrategy(name: string): StrategyFunction | undefined {
  // Busca exata primeiro
  if (strategyRegistry.has(name)) {
    return strategyRegistry.get(name);
  }
  
  // Busca case-insensitive
  for (const [key, value] of strategyRegistry.entries()) {
    if (key.toLowerCase() === name.toLowerCase()) {
      return value;
    }
  }
  
  return undefined;
}

// Função para listar estratégias disponíveis
export function getAvailableStrategies(): string[] {
  return Array.from(strategyRegistry.keys());
}

// Exportar também as estratégias individuais para testes
export { checkMA2Crossover, checkMA3Crossover } from './ma-crossover';
export type { Signal } from './ma-crossover';
export type { StrategyFunction };