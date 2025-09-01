export class IQOrderHelper {
  /**
   * Calcula o timestamp de expiração correto para evitar erro de tempo
   * Baseado no padrão da IQ Option: próximo minuto cheio + buffer
   */
  static calculateExpirationTimestamp(): number {
    const now = new Date();
    
    // Próximo minuto cheio (segundos = 0)
    const nextMinute = new Date(now);
    nextMinute.setSeconds(0, 0);
    nextMinute.setMinutes(nextMinute.getMinutes() + 1);
    
    // Adicionar 1 minuto para a expiração (operação de 1 minuto)
    const expiration = new Date(nextMinute);
    expiration.setMinutes(expiration.getMinutes() + 1);
    
    return Math.floor(expiration.getTime() / 1000);
  }
  
  /**
   * Constrói o instrument_id no formato esperado pela IQ Option
   * Formato: do{active_id}A{YYYYMMDD}D{HHMMSS}T{1M}C|P
   * MANTER EXATAMENTE COMO ESTÁ - NÃO ALTERAR NADA
   */
  static buildInstrumentId(
    activeId: number,
    expirationTimestamp: number,
    direction: 'call' | 'put'
  ): string {
    const expirationDate = new Date(expirationTimestamp * 1000);
    
    // Formato YYYYMMDD
    const year = expirationDate.getUTCFullYear();
    const month = String(expirationDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(expirationDate.getUTCDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;
    
    // Formato HHMMSS
    const hours = String(expirationDate.getUTCHours()).padStart(2, '0');
    const minutes = String(expirationDate.getUTCMinutes()).padStart(2, '0');
    const seconds = String(expirationDate.getUTCSeconds()).padStart(2, '0');
    const timeStr = `${hours}${minutes}${seconds}`;
    
    // Direção: C para Call, P para Put
    const directionChar = direction === 'call' ? 'C' : 'P';
    
    return `do${activeId}A${dateStr}D${timeStr}T1M${directionChar}SPT`;
  }
  
  /**
   * Calcula o valor baseado na expiração (conforme padrão do .har)
   */
  static calculateValue(expirationTimestamp: number): number {
    // Baseado no padrão observado: timestamp + variação
    return Math.floor(expirationTimestamp * 1000) + Math.floor(Math.random() * 100000);
  }
}