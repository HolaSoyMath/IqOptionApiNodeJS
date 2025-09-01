import { PrismaClient } from '@prisma/client';
import { IQSocketService } from './iqsocket.service';
import { OrderService } from './order.service';

const prisma = new PrismaClient();

export class OrderListenerService {
  static initialize(iqSocket: IQSocketService) {
    // A IQ Option envia diferentes eventos para resultado
    // Você precisa verificar qual evento exato seu IQSocketService recebe
    
    // Opção 1: Se receber via mensagem genérica com logs temporários
    iqSocket.on('message', async (data: any) => {
      console.log('Evento recebido da IQ:', data.name);
      if (data.name === 'option-closed' || 
          data.name === 'position-changed' || 
          data.name === 'option-expired' || 
          data.name === 'digital-option-placed') {
        console.log('Dados do evento:', data);
        await this.processOrderResult(data);
      }
    });
    
    // Opção 2: Se receber eventos específicos (manter compatibilidade)
    iqSocket.on('option-closed', async (data: any) => {
      console.log('Evento option-closed recebido:', data);
      await this.processOrderResult(data);
    });
    
    iqSocket.on('position-changed', async (data: any) => {
      console.log('Evento position-changed recebido:', data);
      await this.processOrderResult(data);
    });
  }
  
  private static async processOrderResult(data: any) {
    try {
      console.log('Processando resultado da ordem:', data);
      
      // Extrair o ID da ordem do formato da IQ
      const iqOptionId = data.msg?.id || data.id;
      
      if (!iqOptionId) {
        console.log('ID da ordem não encontrado nos dados:', data);
        return;
      }
      
      console.log('Procurando ordem com iqOptionId:', iqOptionId);
      
      const order = await prisma.order.findFirst({
        where: { iqOptionId: String(iqOptionId) }
      });
      
      if (order) {
        console.log('Ordem encontrada:', order);
        
        // Verificar o formato exato do resultado da IQ
        const result = data.msg?.win || data.win ? 'win' : 'loss';
        const closePrice = data.msg?.close_price || data.close_price;
        
        console.log('Resultado da ordem:', { result, closePrice });
        
        await OrderService.processOrderResult(
          order.id,
          result,
          closePrice
        );
      } else {
        console.log('Ordem não encontrada no banco de dados para iqOptionId:', iqOptionId);
      }
    } catch (error) {
      console.error('Erro ao processar resultado:', error);
    }
  }
}