import { DigitalInstrument } from "../types/order.types";
import { Logger } from "../utils/logger";

export class DigitalInstrumentsCacheService {
  private static instance: DigitalInstrumentsCacheService;
  private instrumentsCache = new Map<string, DigitalInstrument>();
  private lastUpdate: number = 0;
  private readonly CACHE_TTL = 300000; // 5 minutos
  private readonly lockMap = new Map<string, Promise<void>>();
  private updateInProgress = false;

  private constructor() {}

  static getInstance(): DigitalInstrumentsCacheService {
    if (!this.instance) {
      this.instance = new DigitalInstrumentsCacheService();
    }
    return this.instance;
  }

  /**
   * Adiciona ou atualiza um instrumento digital no cache com proteção contra race conditions
   */
  async addInstrument(instrument: DigitalInstrument): Promise<void> {
    const lockKey = `add_${instrument.instrument_id}`;
    
    // Verificar se já existe uma operação em andamento para este instrumento
    if (this.lockMap.has(lockKey)) {
      await this.lockMap.get(lockKey);
      return;
    }

    // Criar lock para esta operação
    const lockPromise = this.performAddInstrument(instrument);
    this.lockMap.set(lockKey, lockPromise);

    try {
      await lockPromise;
    } finally {
      this.lockMap.delete(lockKey);
    }
  }

  private async performAddInstrument(instrument: DigitalInstrument): Promise<void> {
    // Validar se o instrumento ainda é válido
    const now = Date.now() / 1000;
    if (instrument.expiry_epoch <= now) {
      Logger.warn("DIGITAL_CACHE", `Tentativa de adicionar instrumento expirado: ${instrument.instrument_id}`);
      return;
    }

    this.instrumentsCache.set(instrument.instrument_id, instrument);
    this.lastUpdate = Date.now();
    Logger.debug("DIGITAL_CACHE", `Instrumento adicionado: ${instrument.instrument_id} (index: ${instrument.instrument_index})`);
  }

  /**
   * Obtém o instrument_index para um instrument_id específico com validação de consistência
   */
  getInstrumentIndex(instrumentId: string): number | null {
    const instrument = this.instrumentsCache.get(instrumentId);
    
    if (!instrument) {
      Logger.debug("DIGITAL_CACHE", `Instrumento não encontrado: ${instrumentId}`);
      return null;
    }

    // Verificar se o instrumento ainda é válido
    const now = Date.now() / 1000;
    if (instrument.expiry_epoch <= now) {
      Logger.warn("DIGITAL_CACHE", `Instrumento expirado removido do cache: ${instrumentId}`);
      this.instrumentsCache.delete(instrumentId);
      return null;
    }

    if (this.isCacheExpired()) {
      Logger.warn("DIGITAL_CACHE", `Cache expirado, instrumento pode estar desatualizado: ${instrumentId}`);
    }

    return instrument.instrument_index;
  }

  /**
   * Obtém todos os instrumentos para um active_id específico, filtrando expirados
   */
  getInstrumentsByActiveId(activeId: number): DigitalInstrument[] {
    const now = Date.now() / 1000;
    const validInstruments: DigitalInstrument[] = [];
    const expiredKeys: string[] = [];

    for (const [key, instrument] of this.instrumentsCache.entries()) {
      if (instrument.active_id === activeId) {
        if (instrument.expiry_epoch > now) {
          validInstruments.push(instrument);
        } else {
          expiredKeys.push(key);
        }
      }
    }

    // Remover instrumentos expirados
    if (expiredKeys.length > 0) {
      Logger.debug("DIGITAL_CACHE", `Removendo ${expiredKeys.length} instrumentos expirados`);
      expiredKeys.forEach(key => this.instrumentsCache.delete(key));
    }

    return validInstruments;
  }

  /**
   * Obtém instrumentos por duração e direção com limpeza automática de expirados
   */
  getInstrumentsByParams(
    activeId: number, 
    duration: 1 | 5, 
    direction: "call" | "put"
  ): DigitalInstrument[] {
    const now = Date.now() / 1000;
    const validInstruments: DigitalInstrument[] = [];
    const expiredKeys: string[] = [];

    for (const [key, instrument] of this.instrumentsCache.entries()) {
      if (instrument.active_id === activeId &&
          instrument.duration_minutes === duration &&
          instrument.direction === direction) {
        
        if (instrument.expiry_epoch > now) {
          validInstruments.push(instrument);
        } else {
          expiredKeys.push(key);
        }
      }
    }

    // Remover instrumentos expirados em background
    if (expiredKeys.length > 0) {
      setImmediate(() => {
        Logger.debug("DIGITAL_CACHE", `Removendo ${expiredKeys.length} instrumentos expirados em background`);
        expiredKeys.forEach(key => this.instrumentsCache.delete(key));
      });
    }

    return validInstruments;
  }

  /**
   * Processa mensagem de instrumentos digitais recebida via WebSocket com proteção contra race conditions
   */
  async handleInstrumentsMessage(message: any): Promise<void> {
    if (this.updateInProgress) {
      Logger.debug("DIGITAL_CACHE", "Atualização já em andamento, ignorando mensagem duplicada");
      return;
    }

    this.updateInProgress = true;

    try {
      if (!message.msg?.instruments || !Array.isArray(message.msg.instruments)) {
        Logger.warn("DIGITAL_CACHE", "Formato de instrumentos inválido");
        return;
      }

      const data = message?.msg || message?.data || message;
      const instruments = data.instruments || [];
      
      Logger.info("DIGITAL_CACHE", `Processando ${instruments.length} instrumentos digitais`);
      
      let addedCount = 0;
      let skippedCount = 0;
      
      // Processar instrumentos em lotes para evitar bloqueio
      const batchSize = 50;
      for (let i = 0; i < instruments.length; i += batchSize) {
        const batch = instruments.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (rawInstrument: any) => {
          try {
            const parsedInstrument = this.parseInstrument(rawInstrument);
            if (parsedInstrument) {
              await this.addInstrument(parsedInstrument);
              addedCount++;
            } else {
              skippedCount++;
            }
          } catch (error) {
            Logger.error("DIGITAL_CACHE", "Erro ao processar instrumento individual", error);
            skippedCount++;
          }
        }));

        // Pequena pausa entre lotes para não bloquear o event loop
        if (i + batchSize < instruments.length) {
          await new Promise(resolve => setImmediate(resolve));
        }
      }
      
      Logger.info("DIGITAL_CACHE", `Instrumentos processados: ${addedCount} adicionados, ${skippedCount} ignorados`);
      
    } catch (error) {
      Logger.error("DIGITAL_CACHE", "Erro ao processar mensagem de instrumentos", error);
    } finally {
      this.updateInProgress = false;
    }
  }

  /**
   * Converte dados brutos do WebSocket em DigitalInstrument
   */
  private parseInstrument(rawInstrument: any): DigitalInstrument | null {
    try {
      // Validar campos obrigatórios
      if (!rawInstrument.instrument_id || 
          typeof rawInstrument.instrument_index !== 'number' ||
          typeof rawInstrument.active_id !== 'number') {
        Logger.warn("DIGITAL_CACHE", "Instrumento com campos obrigatórios faltando", rawInstrument);
        return null;
      }

      const parsed = this.parseInstrumentId(rawInstrument.instrument_id);
      if (!parsed) {
        Logger.warn("DIGITAL_CACHE", `Não foi possível parsear instrument_id: ${rawInstrument.instrument_id}`);
        return null;
      }

      // Validar se o instrumento ainda não expirou
      const now = Date.now() / 1000;
      if (parsed.expiryEpoch <= now) {
        Logger.debug("DIGITAL_CACHE", `Instrumento já expirado ignorado: ${rawInstrument.instrument_id}`);
        return null;
      }

      return {
        instrument_id: rawInstrument.instrument_id,
        instrument_index: rawInstrument.instrument_index,
        active_id: rawInstrument.active_id,
        expiry_epoch: parsed.expiryEpoch,
        duration_minutes: parsed.duration,
        direction: parsed.direction,
        strike: rawInstrument.strike || null,
        is_suspended: rawInstrument.is_suspended || false,
      };
    } catch (error) {
      Logger.error("DIGITAL_CACHE", "Erro ao parsear instrumento", error);
      return null;
    }
  }

  private parseInstrumentId(instrumentId: string): {
    activeId: number;
    expiryEpoch: number;
    duration: 1 | 5;
    direction: "call" | "put";
  } | null {
    try {
      // Formato esperado: do{activeId}A{YYYYMMDD}D{HHMMSS}T{duration}M{C|P}SPT
      const regex = /^do(\d+)A(\d{8})D(\d{6})T(\d+)M([CP])SPT$/;
      const match = instrumentId.match(regex);
      
      if (!match) {
        return null;
      }
      
      const [, activeIdStr, dateStr, timeStr, durationStr, directionStr] = match;
      
      const activeId = parseInt(activeIdStr);
      const duration = parseInt(durationStr) as 1 | 5;
      const direction = directionStr === "C" ? "call" : "put";
      
      // Parse da data e hora
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6)) - 1; // Month is 0-indexed
      const day = parseInt(dateStr.substring(6, 8));
      const hours = parseInt(timeStr.substring(0, 2));
      const minutes = parseInt(timeStr.substring(2, 4));
      const seconds = parseInt(timeStr.substring(4, 6));
      
      const expiryDate = new Date(year, month, day, hours, minutes, seconds);
      const expiryEpoch = Math.floor(expiryDate.getTime() / 1000);
      
      return {
        activeId,
        expiryEpoch,
        duration,
        direction,
      };
    } catch (error) {
      Logger.error("DIGITAL_CACHE", `Erro ao parsear instrument_id: ${instrumentId}`, error);
      return null;
    }
  }

  private isCacheExpired(): boolean {
    return Date.now() - this.lastUpdate > this.CACHE_TTL;
  }

  /**
   * Limpa o cache removendo instrumentos expirados
   */
  async cleanupExpiredInstruments(): Promise<void> {
    const now = Date.now() / 1000;
    const expiredKeys: string[] = [];

    for (const [key, instrument] of this.instrumentsCache.entries()) {
      if (instrument.expiry_epoch <= now) {
        expiredKeys.push(key);
      }
    }

    if (expiredKeys.length > 0) {
      Logger.info("DIGITAL_CACHE", `Limpando ${expiredKeys.length} instrumentos expirados`);
      expiredKeys.forEach(key => this.instrumentsCache.delete(key));
    }
  }

  clearCache(): void {
    this.instrumentsCache.clear();
    this.lastUpdate = 0;
    Logger.info("DIGITAL_CACHE", "Cache de instrumentos digitais limpo");
  }

  getCacheStats(): {
    size: number;
    lastUpdate: number;
    isExpired: boolean;
    instruments: string[];
    activeOperations: number;
  } {
    return {
      size: this.instrumentsCache.size,
      lastUpdate: this.lastUpdate,
      isExpired: this.isCacheExpired(),
      instruments: Array.from(this.instrumentsCache.keys()),
      activeOperations: this.lockMap.size,
    };
  }

  /**
   * Inicia limpeza automática de instrumentos expirados
   */
  startAutoCleanup(intervalMs: number = 60000): void {
    setInterval(() => {
      this.cleanupExpiredInstruments().catch(error => {
        Logger.error("DIGITAL_CACHE", "Erro na limpeza automática", error);
      });
    }, intervalMs);
    
    Logger.info("DIGITAL_CACHE", `Limpeza automática iniciada com intervalo de ${intervalMs}ms`);
  }
}

export const digitalInstrumentsCache = DigitalInstrumentsCacheService.getInstance();