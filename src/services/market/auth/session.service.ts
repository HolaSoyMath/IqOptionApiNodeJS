import { WebSocketAuthError } from '../errors/market.errors';

export interface SessionConfig {
  ssid: string;
  validateSession?: boolean;
  sessionTimeout?: number;
}

export class SessionService {
  private ssid: string;
  private isAuthenticated = false;
  private sessionTimeout: number;
  private sessionTimer: NodeJS.Timeout | null = null;

  constructor(config: SessionConfig) {
    this.ssid = config.ssid;
    this.sessionTimeout = config.sessionTimeout || 3600000; // 1 hora
    
    if (!this.ssid) {
      throw new WebSocketAuthError('SSID é obrigatório');
    }
  }

  /**
   * Obtém o SSID atual
   */
  getSSID(): string {
    return this.ssid;
  }

  /**
   * Atualiza o SSID
   */
  updateSSID(newSSID: string): void {
    if (!newSSID) {
      throw new WebSocketAuthError('SSID não pode ser vazio');
    }
    
    this.ssid = newSSID;
    this.isAuthenticated = false;
    this.resetSessionTimer();
  }

  /**
   * Marca a sessão como autenticada
   */
  markAsAuthenticated(): void {
    this.isAuthenticated = true;
    this.startSessionTimer();
    console.log('[SESSION] Sessão autenticada com sucesso');
  }

  /**
   * Verifica se a sessão está autenticada
   */
  isSessionAuthenticated(): boolean {
    return this.isAuthenticated;
  }

  /**
   * Invalida a sessão
   */
  invalidateSession(): void {
    this.isAuthenticated = false;
    this.resetSessionTimer();
    console.log('[SESSION] Sessão invalidada');
  }

  /**
   * Valida se a sessão ainda é válida
   */
  validateSession(): void {
    if (!this.isAuthenticated) {
      throw new WebSocketAuthError('Sessão não autenticada');
    }
  }

  /**
   * Inicia o timer de sessão
   */
  private startSessionTimer(): void {
    this.resetSessionTimer();
    
    this.sessionTimer = setTimeout(() => {
      console.log('[SESSION] Sessão expirada por timeout');
      this.invalidateSession();
    }, this.sessionTimeout);
  }

  /**
   * Reseta o timer de sessão
   */
  private resetSessionTimer(): void {
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
      this.sessionTimer = null;
    }
  }

  /**
   * Renova a sessão (reseta o timer)
   */
  renewSession(): void {
    if (this.isAuthenticated) {
      this.startSessionTimer();
    }
  }

  /**
   * Limpa recursos da sessão
   */
  cleanup(): void {
    this.resetSessionTimer();
    this.isAuthenticated = false;
  }
}