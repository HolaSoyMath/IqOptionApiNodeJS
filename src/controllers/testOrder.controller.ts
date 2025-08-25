import { Request, Response } from 'express';
import { IQWSClient } from '../services/iq/ws-client';

export class TestOrderController {
  // Cache para clientes WebSocket
  private static clientCache = new Map<
    string,
    { client: IQWSClient; timestamp: number }
  >();
  private static readonly CACHE_TTL = 60000; // 60 segundos

  private static async getWSClient(ssid: string): Promise<IQWSClient> {
    const cached = TestOrderController.clientCache.get(ssid);
    if (cached && Date.now() - cached.timestamp < TestOrderController.CACHE_TTL) {
      if (cached.client.isConnected()) {
        return cached.client;
      }
    }

    const client = new IQWSClient({
      url: process.env.IQ_WSS_URL || "wss://ws.iqoption.com/echo/websocket",
      ssid,
      timeout: 10000,
    });

    await client.connect();
    TestOrderController.clientCache.set(ssid, { client, timestamp: Date.now() });
    return client;
  }

  /**
   * Calcula o timestamp de expiração correto para evitar erro de tempo
   * Baseado no padrão da IQ Option: próximo minuto cheio + buffer
   */
  private static calculateExpirationTimestamp(): number {
    const now = new Date();
    
    // Próximo minuto cheio (segundos = 0)
    const nextMinute = new Date(now);
    nextMinute.setSeconds(0, 0);
    nextMinute.setMinutes(nextMinute.getMinutes() + 1);
    
    // Adicionar 1 minuto para a expiração (operação de 1 minuto)
    const expiration = new Date(nextMinute);
    expiration.setMinutes(expiration.getMinutes() + 1);
    
    return Math.floor(expiration.getTime() / 1000);
  }

  /**
   * Constrói o instrument_id no formato esperado pela IQ Option
   * Formato: do{active_id}A{YYYYMMDD}D{HHMMSS}T{1M}C|P
   */
  private static buildInstrumentId(
    activeId: number, 
    expirationTimestamp: number, 
    direction: 'call' | 'put'
  ): string {
    const expirationDate = new Date(expirationTimestamp * 1000);
    
    // Formato YYYYMMDD
    const year = expirationDate.getUTCFullYear();
    const month = String(expirationDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(expirationDate.getUTCDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;
    
    // Formato HHMMSS
    const hours = String(expirationDate.getUTCHours()).padStart(2, '0');
    const minutes = String(expirationDate.getUTCMinutes()).padStart(2, '0');
    const seconds = String(expirationDate.getUTCSeconds()).padStart(2, '0');
    const timeStr = `${hours}${minutes}${seconds}`;
    
    // Direção: C para Call, P para Put
    const directionChar = direction === 'call' ? 'C' : 'P';
    
    return `do${activeId}A${dateStr}D${timeStr}T1M${directionChar}SPT`;
  }

  /**
   * Calcula o valor baseado na expiração (conforme padrão do .har)
   */
  private static calculateValue(expirationTimestamp: number): number {
    // Baseado no padrão observado: timestamp + variação
    return Math.floor(expirationTimestamp * 1000) + Math.floor(Math.random() * 100000);
  }

  static async openOrder(req: Request, res: Response): Promise<void> {
    try {
      const ssid = req.headers.authorization?.replace('Bearer ', '');
      if (!ssid) {
        res.status(401).json({ 
          success: false, 
          message: "SSID necessário. Use o header Authorization: Bearer <SSID>" 
        });
        return;
      }

      // Extrair parâmetros do body da requisição
      const {
        activeId,
        direction,
        price = 1.0,
        userBalanceId,
        profitPercent
      } = req.body;

      // Validações dos parâmetros obrigatórios
      if (!activeId) {
        res.status(400).json({
          success: false,
          message: "activeId é obrigatório",
          example: { activeId: 76, direction: "call", userBalanceId: 19389341, profitPercent: 87 }
        });
        return;
      }

      if (!direction || !['call', 'put'].includes(direction)) {
        res.status(400).json({
          success: false,
          message: "direction deve ser 'call' ou 'put'",
          example: { activeId: 76, direction: "call", userBalanceId: 19389341, profitPercent: 87 }
        });
        return;
      }

      if (!userBalanceId) {
        res.status(400).json({
          success: false,
          message: "userBalanceId é obrigatório",
          example: { activeId: 76, direction: "call", userBalanceId: 19389341, profitPercent: 87 }
        });
        return;
      }

      if (!profitPercent || profitPercent < 1 || profitPercent > 100) {
        res.status(400).json({
          success: false,
          message: "profitPercent deve ser um número entre 1 e 100",
          example: { activeId: 76, direction: "call", userBalanceId: 19389341, profitPercent: 87 }
        });
        return;
      }

      // Obter cliente WebSocket
      const wsClient = await TestOrderController.getWSClient(ssid);

      // Calcular expiração correta (próximo minuto + 1 minuto)
      const expired = TestOrderController.calculateExpirationTimestamp();
      
      // Verificar se a expiração está no futuro
      const now = Math.floor(Date.now() / 1000);
      if (expired <= now + 30) { // Buffer de 30 segundos
        res.status(400).json({
          success: false,
          message: "Timestamp de expiração muito próximo. Tente novamente.",
          debug: {
            now: now,
            expired: expired,
            difference: expired - now
          }
        });
        return;
      }

      // Construir instrument_id
      const instrumentId = TestOrderController.buildInstrumentId(
        activeId, 
        expired, 
        direction
      );

      // Calcular value
      const value = TestOrderController.calculateValue(expired);

      // Payload da ordem usando parâmetros dinâmicos
      const orderBody = {
        user_balance_id: userBalanceId,
        active_id: activeId,
        option_type_id: 3, // 3 = Turbo (1m, 5m)
        direction: direction,
        expired: expired,
        price: price,
        refund_value: 0,
        value: value,
        profit_percent: profitPercent
      };

      // Enviar via WebSocket com a assinatura correta
      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout na requisição de ordem'));
        }, 15000);

        const handleResponse = (message: any) => {
          if (message.name === 'option' || message.name === 'option-opened' || message.name === 'binary-options.open-option') {
            clearTimeout(timeout);
            wsClient.removeListener('message', handleResponse);
            resolve(message);
          }
        };

        wsClient.on('message', handleResponse);
        
        // Usar a assinatura correta do método send
        wsClient.send('binary-options.open-option', '2.0', orderBody);
      });

      res.json({
        success: true,
        message: "Ordem enviada com sucesso",
        data: {
          instrumentId: instrumentId,
          expiration: new Date(expired * 1000).toISOString(),
          timeToExpiration: expired - now,
          payload: orderBody,
          result: result
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Erro ao processar ordem de teste",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}