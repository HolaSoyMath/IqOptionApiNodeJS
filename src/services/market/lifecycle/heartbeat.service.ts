import { HeartbeatData } from '../../../types/iq-ws.types';
import { CleanupResource } from './cleanup.service';

export interface HeartbeatConfig {
  interval: number; // em milissegundos
  onSend?: (data: HeartbeatData) => void;
  onReceive?: (data: HeartbeatData) => void;
}

export class HeartbeatService implements CleanupResource {
  private interval: NodeJS.Timeout | null = null;
  private config: HeartbeatConfig;
  private isActive = false;
  private lastSent: number = 0;
  private lastReceived: number = 0;

  constructor(config: HeartbeatConfig) {
    this.config = config;
  }

  /**
   * Inicia o heartbeat
   */
  start(): void {
    if (this.isActive) {
      console.log('[HEARTBEAT] Já está ativo');
      return;
    }

    console.log(`[HEARTBEAT] Iniciando com intervalo de ${this.config.interval}ms`);
    this.isActive = true;

    this.interval = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.interval);
  }

  /**
   * Para o heartbeat
   */
  stop(): void {
    if (!this.isActive) {
      return;
    }

    console.log('[HEARTBEAT] Parando');
    this.isActive = false;

    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  /**
   * Envia heartbeat
   */
  private sendHeartbeat(): void {
    const now = Date.now();
    const heartbeatData: HeartbeatData = {
      userTime: now,
      userTimeRecv: this.lastReceived || now
    };

    this.lastSent = now;
    
    if (this.config.onSend) {
      this.config.onSend(heartbeatData);
    }
  }

  /**
   * Processa heartbeat recebido
   */
  handleHeartbeat(data: HeartbeatData): void {
    this.lastReceived = Date.now();
    
    if (this.config.onReceive) {
      this.config.onReceive(data);
    }
  }

  /**
   * Verifica se o heartbeat está ativo
   */
  isRunning(): boolean {
    return this.isActive;
  }

  /**
   * Obtém estatísticas do heartbeat
   */
  getStats(): {
    isActive: boolean;
    lastSent: number;
    lastReceived: number;
    timeSinceLastSent: number;
    timeSinceLastReceived: number;
  } {
    const now = Date.now();
    return {
      isActive: this.isActive,
      lastSent: this.lastSent,
      lastReceived: this.lastReceived,
      timeSinceLastSent: this.lastSent ? now - this.lastSent : 0,
      timeSinceLastReceived: this.lastReceived ? now - this.lastReceived : 0
    };
  }

  /**
   * Implementa CleanupResource
   */
  cleanup(): void {
    this.stop();
  }
}