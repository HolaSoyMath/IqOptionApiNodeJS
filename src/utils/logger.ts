export interface LogMetrics {
  timestamp: string;
  duration_ms?: number;
  memory_usage?: NodeJS.MemoryUsage;
  cache_stats?: any;
  performance_mark?: string;
}

export interface LogConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  enableMetrics: boolean;
  enableStructuredLogs: boolean;
  maxDataLength: number;
}

export class Logger {
  private static config: LogConfig = {
    level: process.env.LOG_LEVEL as any || 'info',
    enableMetrics: process.env.ENABLE_METRICS === 'true',
    enableStructuredLogs: process.env.STRUCTURED_LOGS === 'true',
    maxDataLength: parseInt(process.env.MAX_LOG_DATA_LENGTH || '1000')
  };

  private static performanceMarks = new Map<string, number>();

  private static formatMessage(level: string, context: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] [${context}] ${message}`;
  }

  private static shouldLog(level: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.config.level);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  private static truncateData(data: any): any {
    if (!data) return data;
    
    const dataStr = JSON.stringify(data);
    if (dataStr.length > this.config.maxDataLength) {
      return {
        ...data,
        _truncated: true,
        _originalLength: dataStr.length,
        _preview: dataStr.substring(0, this.config.maxDataLength) + '...'
      };
    }
    return data;
  }

  static debug(context: string, message: string, data?: any): void {
    if (!this.shouldLog('debug')) return;
    
    const formattedMessage = this.formatMessage('debug', context, message);
    const truncatedData = this.truncateData(data);
    
    if (this.config.enableStructuredLogs) {
      console.debug(JSON.stringify({
        level: 'debug',
        context,
        message,
        data: truncatedData,
        timestamp: new Date().toISOString()
      }));
    } else {
      if (truncatedData) {
        console.debug(formattedMessage, truncatedData);
      } else {
        console.debug(formattedMessage);
      }
    }
  }

  static info(context: string, message: string, data?: any): void {
    if (!this.shouldLog('info')) return;
    
    const formattedMessage = this.formatMessage('info', context, message);
    const truncatedData = this.truncateData(data);
    
    if (this.config.enableStructuredLogs) {
      console.info(JSON.stringify({
        level: 'info',
        context,
        message,
        data: truncatedData,
        timestamp: new Date().toISOString()
      }));
    } else {
      if (truncatedData) {
        console.info(formattedMessage, truncatedData);
      } else {
        console.info(formattedMessage);
      }
    }
  }

  static warn(context: string, message: string, data?: any): void {
    if (!this.shouldLog('warn')) return;
    
    const formattedMessage = this.formatMessage('warn', context, message);
    const truncatedData = this.truncateData(data);
    
    if (this.config.enableStructuredLogs) {
      console.warn(JSON.stringify({
        level: 'warn',
        context,
        message,
        data: truncatedData,
        timestamp: new Date().toISOString()
      }));
    } else {
      if (truncatedData) {
        console.warn(formattedMessage, truncatedData);
      } else {
        console.warn(formattedMessage);
      }
    }
  }

  static error(context: string, message: string, error?: any): void {
    if (!this.shouldLog('error')) return;
    
    const formattedMessage = this.formatMessage('error', context, message);
    const errorData = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : error;
    
    if (this.config.enableStructuredLogs) {
      console.error(JSON.stringify({
        level: 'error',
        context,
        message,
        error: errorData,
        timestamp: new Date().toISOString()
      }));
    } else {
      if (errorData) {
        console.error(formattedMessage, errorData);
      } else {
        console.error(formattedMessage);
      }
    }
  }

  static safe(context: string, message: string, data?: any): void {
    if (!this.shouldLog('info')) return;
    
    const formattedMessage = this.formatMessage('info', context, message);
    if (data && typeof data === 'object') {
      const safeData = Array.isArray(data) 
        ? `Array(${data.length})` 
        : `Object(${Object.keys(data).length} keys)`;
      console.info(formattedMessage, safeData);
    } else {
      console.info(formattedMessage, data);
    }
  }

  // Novos métodos para observabilidade avançada
  static startTimer(context: string, operation: string): string {
    const markId = `${context}_${operation}_${Date.now()}`;
    this.performanceMarks.set(markId, Date.now());
    
    if (this.config.enableMetrics) {
      this.debug(context, `⏱️ Iniciando operação: ${operation}`, { markId });
    }
    
    return markId;
  }

  static endTimer(context: string, markId: string, operation: string, additionalData?: any): number {
    const startTime = this.performanceMarks.get(markId);
    if (!startTime) {
      this.warn(context, `Timer não encontrado para markId: ${markId}`);
      return 0;
    }

    const duration = Date.now() - startTime;
    this.performanceMarks.delete(markId);

    const metrics: LogMetrics = {
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      performance_mark: operation
    };

    if (this.config.enableMetrics) {
      metrics.memory_usage = process.memoryUsage();
    }

    this.info(context, `✅ Operação concluída: ${operation} (${duration}ms)`, {
      ...metrics,
      ...additionalData
    });

    return duration;
  }

  static logCacheStats(context: string, cacheStats: any): void {
    if (!this.config.enableMetrics) return;
    
    this.info(context, `📊 Estatísticas do cache`, {
      ...cacheStats,
      memory_usage: process.memoryUsage(),
      timestamp: new Date().toISOString()
    });
  }

  static logPerformanceMetrics(context: string, operation: string, metrics: Partial<LogMetrics>): void {
    if (!this.config.enableMetrics) return;
    
    this.info(context, `📈 Métricas de performance: ${operation}`, {
      ...metrics,
      timestamp: new Date().toISOString()
    });
  }

  static setLogLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
    this.config.level = level;
    this.info('LOGGER', `Nível de log alterado para: ${level}`);
  }

  static enableMetrics(enable: boolean): void {
    this.config.enableMetrics = enable;
    this.info('LOGGER', `Métricas ${enable ? 'habilitadas' : 'desabilitadas'}`);
  }

  static getConfig(): LogConfig {
    return { ...this.config };
  }

  static getActiveTimers(): string[] {
    return Array.from(this.performanceMarks.keys());
  }
}

export default Logger;