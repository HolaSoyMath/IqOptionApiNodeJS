import { Request, Response } from 'express';
import { IQSocketService } from '../services/iqsocket.service';
import { ApiResponse } from '../types/response.types';

export class CandlesController {
  private static getSocketService(): IQSocketService {
    return IQSocketService.getInstance();
  }

  private static extractSsid(req: Request): string | null {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    return process.env.IQ_SSID || null;
  }

  private static validateActiveIds(actives: any[]): { valid: boolean; message?: string } {
    if (!Array.isArray(actives) || actives.length === 0) {
      return { valid: false, message: 'É necessário informar uma lista de active_id' };
    }

    const invalidActives = actives.filter(id => !Number.isInteger(id) || id <= 0);
    if (invalidActives.length > 0) {
      return { valid: false, message: `IDs de ativos inválidos: ${invalidActives.join(', ')}` };
    }

    return { valid: true };
  }

  private static validateSizes(sizes: any[]): { valid: boolean; message?: string } {
    if (!Array.isArray(sizes) || sizes.some(s => !Number.isInteger(s) || s <= 0)) {
      return { valid: false, message: 'Tamanhos de candles inválidos' };
    }
    return { valid: true };
  }

  /**
   * POST /api/candles/collect
   * Inicia coleta de candles para múltiplos ativos
   */
  static async collectCandles(req: Request, res: Response): Promise<void> {
    try {
      // Extrair SSID
      const ssid = CandlesController.extractSsid(req);
      if (!ssid) {
        const response: ApiResponse = {
          success: false,
          message: 'SSID é obrigatório. Forneça via header Authorization: Bearer <SSID> ou variável de ambiente IQ_SSID',
          timestamp: new Date().toISOString()
        };
        res.status(401).json(response);
        return;
      }

      // Validar parâmetros
      const { actives, sizes = [60, 300, 900] } = req.body;
      
      const activesValidation = CandlesController.validateActiveIds(actives);
      if (!activesValidation.valid) {
        const response: ApiResponse = {
          success: false,
          message: activesValidation.message!,
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const sizesValidation = CandlesController.validateSizes(sizes);
      if (!sizesValidation.valid) {
        const response: ApiResponse = {
          success: false,
          message: sizesValidation.message!,
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      console.log(`[CANDLES] Iniciando coleta para ${actives.length} ativos com tamanhos:`, sizes);
      
      // Obter serviço e garantir conexão
      const socketService = CandlesController.getSocketService();
      await socketService.ensureConnection({ ssid });

      // Configurar coleta para cada ativo
      const subscribed: Array<{ active_id: number; size: number }> = [];
      const errors: Array<{ active_id: number; error: string }> = [];

      for (const activeId of actives) {
        try {
          // Apenas assinar candles ao vivo, sem aguardar histórico
          await socketService.subscribeToLiveCandles(activeId, sizes);
          
          // Solicitar histórico em background (sem await)
          socketService.requestHistoricalCandles(activeId, sizes).catch(error => {
            console.warn(`[CANDLES] Aviso: Não foi possível obter histórico para ativo ${activeId}:`, error.message);
          });
          
          // Registrar combinações ativo/tamanho configuradas
          for (const size of sizes) {
            subscribed.push({ active_id: activeId, size });
          }
          
          console.log(`[CANDLES] Ativo ${activeId} configurado com sucesso`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
          errors.push({ active_id: activeId, error: errorMessage });
          console.error(`[CANDLES] Erro ao configurar ativo ${activeId}:`, error);
        }
      }

      // RESPONDER IMEDIATAMENTE após as subscrições, não esperar pelos dados
      const response: ApiResponse = {
        success: errors.length === 0,
        message: errors.length === 0 
          ? 'Subscrições de candles configuradas com sucesso. Dados serão recebidos em tempo real.'
          : `Subscrições configuradas com ${errors.length} erro(s)`,
        data: {
          requested: { actives, sizes },
          subscribed,
          errors: errors.length > 0 ? errors : undefined,
          note: 'Os candles serão recebidos via WebSocket em tempo real. Use /api/candles/live para acessar os dados.'
        },
        timestamp: new Date().toISOString()
      };

      res.status(errors.length === 0 ? 200 : 207).json(response);
    } catch (error) {
      console.error('[CANDLES] Erro ao iniciar coleta:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Erro interno ao iniciar coleta de candles',
        timestamp: new Date().toISOString()
      };

      res.status(500).json(response);
    }
  }

  /**
   * GET /api/candles/status
   * Obtém status da coleta de candles
   */
  static async getCollectionStatus(req: Request, res: Response): Promise<void> {
    try {
      const socketService = CandlesController.getSocketService();
      const status = socketService.getStatus();

      const response: ApiResponse = {
        success: true,
        message: 'Status da coleta de candles',
        data: status,
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('[CANDLES] Erro ao obter status:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Erro interno ao obter status',
        timestamp: new Date().toISOString()
      };

      res.status(500).json(response);
    }
  }

  /**
   * GET /api/candles/live/:active_id?size=60
   * Obtém candle atual para um ativo específico
   */
  static async getLiveCandles(req: Request, res: Response): Promise<void> {
    try {
      const activeId = parseInt(req.params.active_id);
      const size = parseInt(req.query.size as string) || 60;
      
      if (!Number.isInteger(activeId) || activeId <= 0) {
        const response: ApiResponse = {
          success: false,
          message: 'ID do ativo inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      if (!Number.isInteger(size) || size <= 0) {
        const response: ApiResponse = {
          success: false,
          message: 'Tamanho do candle inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const socketService = CandlesController.getSocketService();
      const currentCandle = socketService.getCurrentCandle(activeId, size);

      const response: ApiResponse = {
        success: true,
        message: `Candle atual para ativo ${activeId} (tamanho ${size}s)`,
        data: {
          active_id: activeId,
          size: size,
          candle: currentCandle,
          has_current: !!currentCandle,
          timestamp: currentCandle ? new Date(currentCandle.from * 1000).toISOString() : null
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('[CANDLES] Erro ao obter candle atual:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Erro interno ao obter candle atual',
        timestamp: new Date().toISOString()
      };

      res.status(500).json(response);
    }
  }

  /**
   * GET /api/candles/history/:active_id?size=60&limit=100
   * Obtém histórico de candles para um ativo específico
   */
  static async getHistoryCandles(req: Request, res: Response): Promise<void> {
    try {
      const activeId = parseInt(req.params.active_id);
      const size = parseInt(req.query.size as string) || 60;
      const limit = parseInt(req.query.limit as string) || 100;
      
      if (!Number.isInteger(activeId) || activeId <= 0) {
        const response: ApiResponse = {
          success: false,
          message: 'ID do ativo inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      if (!Number.isInteger(size) || size <= 0) {
        const response: ApiResponse = {
          success: false,
          message: 'Tamanho do candle inválido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      if (!Number.isInteger(limit) || limit <= 0 || limit > 1000) {
        const response: ApiResponse = {
          success: false,
          message: 'Limite inválido (deve ser entre 1 e 1000)',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const socketService = CandlesController.getSocketService();
      const fullHistory = socketService.getHistory(activeId, size);
      
      // Aplicar limite (últimos N candles)
      const history = fullHistory.slice(-limit);

      const response: ApiResponse = {
        success: true,
        message: `Histórico de candles para ativo ${activeId} (tamanho ${size}s)`,
        data: {
          active_id: activeId,
          size: size,
          candles: history,
          count: history.length,
          total_available: fullHistory.length,
          limited: fullHistory.length > limit
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('[CANDLES] Erro ao obter histórico:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Erro interno ao obter histórico',
        timestamp: new Date().toISOString()
      };

      res.status(500).json(response);
    }
  }

  /**
   * DELETE /api/candles/disconnect
   * Desconecta e limpa estado do serviço
   */
  static async disconnect(req: Request, res: Response): Promise<void> {
    try {
      const socketService = CandlesController.getSocketService();
      socketService.disconnect();

      const response: ApiResponse = {
        success: true,
        message: 'Serviço desconectado e estado limpo',
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('[CANDLES] Erro ao desconectar:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Erro interno ao desconectar',
        timestamp: new Date().toISOString()
      };

      res.status(500).json(response);
    }
  }
}