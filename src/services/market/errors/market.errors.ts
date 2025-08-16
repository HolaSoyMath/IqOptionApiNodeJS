export class MarketError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class WebSocketConnectionError extends MarketError {
  constructor(message: string = 'Falha na conexão WebSocket') {
    super(message, 'WS_CONNECTION_ERROR');
  }
}

export class WebSocketAuthError extends MarketError {
  constructor(message: string = 'Falha na autenticação WebSocket') {
    super(message, 'WS_AUTH_ERROR');
  }
}

export class PayloadFormatError extends MarketError {
  constructor(message: string = 'Formato de payload inválido') {
    super(message, 'PAYLOAD_FORMAT_ERROR');
  }
}

export class TimeoutError extends MarketError {
  constructor(message: string = 'Timeout na operação') {
    super(message, 'TIMEOUT_ERROR');
  }
}

export class CacheMissError extends MarketError {
  constructor(key: string) {
    super(`Cache miss para a chave: ${key}`, 'CACHE_MISS_ERROR');
  }
}

export class InstrumentNotFoundError extends MarketError {
  constructor(instrument: string) {
    super(`Instrumento não encontrado: ${instrument}`, 'INSTRUMENT_NOT_FOUND');
  }
}

export class ReconnectionFailedError extends MarketError {
  constructor(attempts: number) {
    super(`Falha na reconexão após ${attempts} tentativas`, 'RECONNECTION_FAILED');
  }
}