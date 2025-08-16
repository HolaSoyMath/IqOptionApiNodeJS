import { EventEmitter } from 'events';
import { ConnectionService } from './connection.service';
import { IQSocketLogger } from '../utils/logger';
import { AuthTimeoutError } from '../errors/iqsocket.errors';

export class AuthService extends EventEmitter {
  private authRequestId?: string;
  private authTimeout?: NodeJS.Timeout;
  private authResolve?: () => void;
  private authReject?: (error: Error) => void;
  private authenticated = false;
  private requestCounter = 0;

  constructor(private connectionService: ConnectionService) {
    super();
  }

  async authenticate(ssid: string, timeoutMs: number = 10000): Promise<void> {
    if (this.authenticated) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.authResolve = resolve;
      this.authReject = reject;
      
      this.authRequestId = this.generateRequestId();
      
      // Configurar timeout
      this.authTimeout = setTimeout(() => {
        this.authReject?.(new AuthTimeoutError(timeoutMs));
        this.clearAuth();
      }, timeoutMs);

      // Enviar requisição de autenticação no formato correto
      const authMessage = {
        name: 'authenticate',
        request_id: this.authRequestId,
        msg: {
          ssid,
          protocol: 3,
          session_id: '',
          client_session_id: ''
        }
      };

      IQSocketLogger.logAuth(`Authenticating with SSID: ${ssid.substring(0, 10)}...`);
      this.connectionService.send(authMessage);
    });
  }

  handleAuthResponse(data: any): boolean {
    // Verificar resposta 'authenticated' com msg: true
    if (data.request_id === this.authRequestId && data.name === 'authenticated' && data.msg === true) {
      this.authenticated = true;
      IQSocketLogger.logAuth('Authentication successful');
      
      if (this.authTimeout) {
        clearTimeout(this.authTimeout);
      }
      
      this.authResolve?.();
      this.clearAuth();
      this.emit('authenticated');
      return true;
    }
    
    // Verificar resposta 'result' com success: true (formato alternativo)
    if (data.request_id === this.authRequestId && data.name === 'result' && data.msg?.success) {
      this.authenticated = true;
      IQSocketLogger.logAuth('Authentication successful (result)');
      
      if (this.authTimeout) {
        clearTimeout(this.authTimeout);
      }
      
      this.authResolve?.();
      this.clearAuth();
      this.emit('authenticated');
      return true;
    }
    
    return false;
  }

  isAuthenticated(): boolean {
    return this.authenticated;
  }

  reset(): void {
    this.authenticated = false;
    this.clearAuth();
  }

  private clearAuth(): void {
    this.authRequestId = undefined;
    this.authResolve = undefined;
    this.authReject = undefined;
    if (this.authTimeout) {
      clearTimeout(this.authTimeout);
      this.authTimeout = undefined;
    }
  }

  private generateRequestId(): string {
    return `auth_${++this.requestCounter}_${Date.now()}`;
  }
}