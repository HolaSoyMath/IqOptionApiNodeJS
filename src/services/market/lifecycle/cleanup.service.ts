export interface CleanupResource {
  cleanup(): void;
}

export class CleanupService {
  private resources: CleanupResource[] = [];
  private intervals: NodeJS.Timeout[] = [];
  private timeouts: NodeJS.Timeout[] = [];
  private pendingRequests = new Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }>();

  /**
   * Registra um recurso para limpeza
   */
  registerResource(resource: CleanupResource): void {
    this.resources.push(resource);
  }

  /**
   * Registra um interval para limpeza
   */
  registerInterval(interval: NodeJS.Timeout): void {
    this.intervals.push(interval);
  }

  /**
   * Registra um timeout para limpeza
   */
  registerTimeout(timeout: NodeJS.Timeout): void {
    this.timeouts.push(timeout);
  }

  /**
   * Registra uma requisição pendente
   */
  registerPendingRequest(id: string, request: { resolve: Function; reject: Function; timeout: NodeJS.Timeout }): void {
    this.pendingRequests.set(id, request);
  }

  /**
   * Remove uma requisição pendente
   */
  removePendingRequest(id: string): boolean {
    const request = this.pendingRequests.get(id);
    if (request) {
      clearTimeout(request.timeout);
      this.pendingRequests.delete(id);
      return true;
    }
    return false;
  }

  /**
   * Resolve uma requisição pendente
   */
  resolvePendingRequest(id: string, data: any): boolean {
    const request = this.pendingRequests.get(id);
    if (request) {
      clearTimeout(request.timeout);
      this.pendingRequests.delete(id);
      request.resolve(data);
      return true;
    }
    return false;
  }

  /**
   * Rejeita uma requisição pendente
   */
  rejectPendingRequest(id: string, error: Error): boolean {
    const request = this.pendingRequests.get(id);
    if (request) {
      clearTimeout(request.timeout);
      this.pendingRequests.delete(id);
      request.reject(error);
      return true;
    }
    return false;
  }

  /**
   * Executa limpeza completa
   */
  cleanup(): void {
    console.log('[CLEANUP] Iniciando limpeza de recursos...');

    // Limpar intervals
    this.intervals.forEach(interval => {
      clearInterval(interval);
    });
    this.intervals = [];

    // Limpar timeouts
    this.timeouts.forEach(timeout => {
      clearTimeout(timeout);
    });
    this.timeouts = [];

    // Rejeitar requisições pendentes
    this.pendingRequests.forEach(request => {
      clearTimeout(request.timeout);
      request.reject(new Error('Conexão WebSocket fechada'));
    });
    this.pendingRequests.clear();

    // Limpar recursos registrados
    this.resources.forEach(resource => {
      try {
        resource.cleanup();
      } catch (error) {
        console.error('[CLEANUP] Erro ao limpar recurso:', error);
      }
    });
    this.resources = [];

    console.log('[CLEANUP] Limpeza concluída');
  }

  /**
   * Obtém estatísticas dos recursos
   */
  getStats(): {
    resources: number;
    intervals: number;
    timeouts: number;
    pendingRequests: number;
  } {
    return {
      resources: this.resources.length,
      intervals: this.intervals.length,
      timeouts: this.timeouts.length,
      pendingRequests: this.pendingRequests.size
    };
  }
}