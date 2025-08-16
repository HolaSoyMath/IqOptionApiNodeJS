import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { IQSocketLogger } from '../utils/logger';
import { ConnectionError, WsClosedError, ReconnectLimitError } from '../errors/iqsocket.errors';

export class ConnectionService extends EventEmitter {
  private ws: WebSocket | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts: number;
  private readonly reconnectDelay: number;
  private currentUrl?: string;
  private currentHeaders?: Record<string, string>;

  constructor(
    maxReconnectAttempts: number = 5,
    reconnectDelay: number = 5000
  ) {
    super();
    this.maxReconnectAttempts = maxReconnectAttempts;
    this.reconnectDelay = reconnectDelay;
  }

  async connect(url: string, headers?: Record<string, string>): Promise<WebSocket> {
    this.currentUrl = url;
    this.currentHeaders = headers;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url, {
          headers: {
            'Origin': 'https://iqoption.com',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            ...headers
          }
        });

        this.ws.on('open', () => {
          IQSocketLogger.logConnection('Connected successfully');
          this.reconnectAttempts = 0;
          this.emit('open');
          resolve(this.ws!);
        });

        this.ws.on('message', (data: Buffer) => {
          this.emit('message', data);
        });

        this.ws.on('close', (code: number, reason: Buffer) => {
          IQSocketLogger.logConnection(`Connection closed: ${code} ${reason.toString()}`);
          this.stopHeartbeat();
          this.emit('close', code, reason.toString());
          
          // Tentar reconectar se não foi fechamento intencional
          if (code !== 1000) {
            this.handleReconnect();
          }
        });

        this.ws.on('error', (error: Error) => {
          IQSocketLogger.logError('CONNECTION', error);
          this.emit('error', error);
          reject(new ConnectionError(error.message));
        });

      } catch (error) {
        reject(new ConnectionError(`Failed to create WebSocket: ${error}`));
      }
    });
  }

  onMessage(callback: (raw: Buffer) => void): void {
    this.on('message', callback);
  }

  send(obj: any): void {
    if (!this.isOpen()) {
      throw new WsClosedError();
    }
    
    const message = JSON.stringify(obj);
    this.ws!.send(message);
  }

  sendRaw(message: string): void {
    if (!this.isOpen()) {
      throw new WsClosedError();
    }
    
    this.ws!.send(message);
  }

  startHeartbeat(intervalMs: number = 30000): void {
    this.stopHeartbeat();
    
    this.heartbeatInterval = setInterval(() => {
      if (this.isOpen()) {
        this.send({ name: 'heartbeat', msg: {} });
      }
    }, intervalMs);
  }

  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  close(): void {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close(1000, 'Normal closure');
      this.ws = null;
    }
  }

  isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private async handleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      const error = new ReconnectLimitError(this.maxReconnectAttempts);
      IQSocketLogger.logError('RECONNECT', error);
      this.emit('error', error);
      return;
    }

    this.reconnectAttempts++;
    IQSocketLogger.logConnection(`Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
    
    setTimeout(async () => {
      try {
        if (this.currentUrl) {
          await this.connect(this.currentUrl, this.currentHeaders);
          this.emit('reconnected');
        }
      } catch (error) {
        IQSocketLogger.logError('RECONNECT', error);
        this.handleReconnect();
      }
    }, this.reconnectDelay);
  }
}