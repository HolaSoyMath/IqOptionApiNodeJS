export class AuthTimeoutError extends Error {
  constructor(timeout: number) {
    super(`Authentication timeout after ${timeout}ms`);
    this.name = 'AuthTimeoutError';
  }
}

export class WsClosedError extends Error {
  constructor(code?: number, reason?: string) {
    super(`WebSocket closed${code ? ` with code ${code}` : ''}${reason ? `: ${reason}` : ''}`);
    this.name = 'WsClosedError';
  }
}

export class ConnectionError extends Error {
  constructor(message: string) {
    super(`Connection error: ${message}`);
    this.name = 'ConnectionError';
  }
}

export class ReconnectLimitError extends Error {
  constructor(maxAttempts: number) {
    super(`Maximum reconnection attempts (${maxAttempts}) exceeded`);
    this.name = 'ReconnectLimitError';
  }
}