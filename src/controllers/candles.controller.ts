import { Request, Response } from 'express';
import { IQSocketService } from '../services/iqsocket.service';
import { ApiResponse } from '../types/response.types';

export class CandlesController {
  private static socketService: IQSocketService | null = null;

  private static getSocketService(): IQSocketService {
    if (!this.socketService) {
      this.socketService = IQSocketService.getInstance();
    }
    return this.socketService;
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

  /**
   * POST /api/candles/collect
   * Inicia coleta de candles para múltiplos ativos
   */
  static async collectCandles(req: Request, res: Response): Promise<void> {
    try {
      const { actives, sizes = [60], ssid } = req.body;
      
      // Validar entrada
      const validation = CandlesController.validateActiveIds(actives);
      if (!validation.valid) {
        const response: ApiResponse = {
          success: false,
          message: validation.message!,
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      if (!Array.isArray(sizes) || sizes.some(s => !Number.isInteger(s) || s <= 0)) {
        const response: ApiResponse = {
          success: false,
          message: 'Tamanhos de candle inválidos',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      if (!ssid || typeof ssid !== 'string') {
        const response: ApiResponse = {
          success: false,
          message: 'SSID é obrigatório para autenticação',
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
          note: 'Os candles serão recebidos via WebSocket em tempo real. Use /api/candles/history para acessar os dados históricos.'
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

  /**
   * POST /api/candles/unsubscribe
   * Remove subscrições de candles ao vivo para múltiplos mercados
   */
  static async unsubscribeCandles(req: Request, res: Response): Promise<void> {
    try {
      const { active_ids, sizes } = req.body;
      
      // Validar active_ids
      if (!Array.isArray(active_ids) || active_ids.length === 0) {
        const response: ApiResponse = {
          success: false,
          message: 'active_ids deve ser um array com pelo menos um elemento',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const invalidActiveIds = active_ids.filter(id => !Number.isInteger(id) || id <= 0);
      if (invalidActiveIds.length > 0) {
        const response: ApiResponse = {
          success: false,
          message: `IDs de mercados inválidos: ${invalidActiveIds.join(', ')}`,
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Validar sizes se fornecido
      if (sizes !== undefined) {
        if (!Array.isArray(sizes) || sizes.some(s => !Number.isInteger(s) || s <= 0)) {
          const response: ApiResponse = {
            success: false,
            message: 'sizes deve ser um array de números inteiros positivos',
            timestamp: new Date().toISOString()
          };
          res.status(400).json(response);
          return;
        }
      }

      console.log(`[CANDLES] Removendo subscrições para mercados ${active_ids.join(', ')}${sizes ? ` com tamanhos: ${sizes.join(', ')}` : ' (todos os tamanhos)'}`);
      
      const socketService = CandlesController.getSocketService();
      
      // Verificar se está conectado
      if (!socketService.getStatus().connected || !socketService.getStatus().authenticated) {
        const response: ApiResponse = {
          success: false,
          message: 'Serviço não está conectado ou autenticado',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Processar cada mercado
      const results: Array<{
        active_id: number;
        unsubscribed: number[];
        not_subscribed: number[];
        error?: string;
      }> = [];

      let hasErrors = false;

      for (const activeId of active_ids) {
        try {
          const result = await socketService.unsubscribeFromLiveCandles(activeId, sizes);
          
          results.push({
            active_id: activeId,
            unsubscribed: result.unsubscribed,
            not_subscribed: result.notSubscribed
          });

          console.log(`[CANDLES] Mercado ${activeId} - Removidas: ${result.unsubscribed.join(', ') || 'nenhuma'}`);
        } catch (error) {
          hasErrors = true;
          const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
          
          results.push({
            active_id: activeId,
            unsubscribed: [],
            not_subscribed: [],
            error: errorMessage
          });

          console.error(`[CANDLES] Erro ao remover subscrições do mercado ${activeId}:`, error);
        }
      }

      // Calcular totais
      const totalUnsubscribed = results.reduce((sum, r) => sum + r.unsubscribed.length, 0);
      const totalNotSubscribed = results.reduce((sum, r) => sum + r.not_subscribed.length, 0);
      const totalErrors = results.filter(r => r.error).length;

      // Determinar status da resposta
      let statusCode = 200;
      let message = 'Unsubscribed successfully';

      if (totalErrors > 0) {
        statusCode = hasErrors && totalUnsubscribed === 0 ? 500 : 207;
        message = `Processamento concluído com ${totalErrors} erro(s)`;
      } else if (totalUnsubscribed === 0 && totalNotSubscribed > 0) {
        message = 'Already unsubscribed';
      }

      const response: ApiResponse = {
        success: totalErrors === 0,
        message,
        data: {
          requested: {
            active_ids,
            sizes: sizes || 'all'
          },
          summary: {
            total_markets: active_ids.length,
            unsubscribed_count: totalUnsubscribed,
            not_subscribed_count: totalNotSubscribed,
            errors_count: totalErrors
          },
          results
        },
        timestamp: new Date().toISOString()
      };

      res.status(statusCode).json(response);
      
    } catch (error) {
      console.error('[CANDLES] Erro ao remover subscrições:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Erro interno ao remover subscrições de candles',
        timestamp: new Date().toISOString()
      };

      res.status(500).json(response);
    }
  }
}